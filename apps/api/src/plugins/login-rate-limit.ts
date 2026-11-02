import { createHash } from "node:crypto";
import fp from "fastify-plugin";
import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";

export const LOGIN_RATE_LIMIT_MAX = 10;
export const ACCOUNT_LOGIN_RATE_LIMIT_MAX = 30;
export const PUBLIC_ANALYTICS_RATE_LIMIT_MAX = 120;
const LOGIN_RATE_LIMIT_WINDOW_SECONDS = 15 * 60;

const INCREMENT_WITH_EXPIRY = `
local attempts = redis.call("INCR", KEYS[1])
if attempts == 1 then
  redis.call("EXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("TTL", KEYS[1])
return { attempts, ttl }
`;

declare module "fastify" {
  interface FastifyInstance {
    loginRateLimit: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    publicAnalyticsRateLimit: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

function rateLimitKey(scope: string, route: string, ip: string): string {
  const clientHash = createHash("sha256").update(ip).digest("hex");
  return `${scope}-rate:${route}:${clientHash}`;
}

export function loginRateLimitKey(route: string, ip: string): string {
  return rateLimitKey("login", route, ip);
}

export function loginAccountRateLimitKey(route: string, identifier: string): string {
  return rateLimitKey("login-account", route, identifier.trim().normalize("NFKC").toLowerCase());
}

export function publicAnalyticsRateLimitKey(route: string, ip: string): string {
  return rateLimitKey("public-analytics", route, ip);
}

async function incrementAndEnforce(
  app: FastifyInstance,
  reply: FastifyReply,
  key: string,
  maximum: number,
): Promise<boolean> {
  const result = await app.redis.eval(
    INCREMENT_WITH_EXPIRY,
    1,
    key,
    LOGIN_RATE_LIMIT_WINDOW_SECONDS,
  ) as [number, number];
  const attempts = Number(result[0]);
  const ttl = Math.max(1, Number(result[1]));
  if (attempts <= maximum) return true;

  reply.header("Retry-After", String(ttl));
  await reply.status(429).send({
    error: { message: "Çok fazla deneme yaptınız, lütfen daha sonra tekrar deneyin" },
  });
  return false;
}

function accountIdentifier(request: FastifyRequest): string | null {
  const route = request.routeOptions.url ?? "";
  if (route === "/admin/auth/mfa/verify" || route === "/admin/auth/mfa/enable") {
    return request.session.pendingAdminId ? `admin:${request.session.pendingAdminId}` : null;
  }
  if (!["/auth/login", "/vendor/auth/login", "/admin/auth/login"].includes(route)) return null;
  if (!request.body || typeof request.body !== "object") return null;
  const body = request.body as Record<string, unknown>;
  const value = typeof body.email === "string" ? body.email : typeof body.username === "string" ? body.username : null;
  return value?.trim() || null;
}

function buildRateLimiter(app: FastifyInstance, scope: string, maximum: number) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const route = request.routeOptions.url ?? "unknown-route";
    const ipKey = rateLimitKey(scope, route, request.ip);
    if (!await incrementAndEnforce(app, reply, ipKey, maximum)) return;

    if (scope === "login") {
      const identifier = accountIdentifier(request);
      if (identifier) {
        const accountKey = loginAccountRateLimitKey(route, identifier);
        await incrementAndEnforce(app, reply, accountKey, ACCOUNT_LOGIN_RATE_LIMIT_MAX);
      }
    }
  };
}

const loginRateLimitPlugin: FastifyPluginAsync = async (app) => {
  app.decorate("loginRateLimit", buildRateLimiter(app, "login", LOGIN_RATE_LIMIT_MAX));
  app.decorate(
    "publicAnalyticsRateLimit",
    buildRateLimiter(app, "public-analytics", PUBLIC_ANALYTICS_RATE_LIMIT_MAX),
  );
};

export default fp(loginRateLimitPlugin, {
  name: "login-rate-limit",
  dependencies: ["redis"],
});
