import { createHash } from "node:crypto";
import fp from "fastify-plugin";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";

export const LOGIN_RATE_LIMIT_MAX = 10;
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
  }
}

export function loginRateLimitKey(route: string, ip: string): string {
  const clientHash = createHash("sha256").update(ip).digest("hex");
  return `login-rate:${route}:${clientHash}`;
}

const loginRateLimitPlugin: FastifyPluginAsync = async (app) => {
  app.decorate("loginRateLimit", async (request: FastifyRequest, reply: FastifyReply) => {
    const key = loginRateLimitKey(request.routeOptions.url ?? "unknown-login-route", request.ip);
    const result = await app.redis.eval(
      INCREMENT_WITH_EXPIRY,
      1,
      key,
      LOGIN_RATE_LIMIT_WINDOW_SECONDS,
    ) as [number, number];
    const attempts = Number(result[0]);
    const ttl = Math.max(1, Number(result[1]));

    if (attempts > LOGIN_RATE_LIMIT_MAX) {
      reply.header("Retry-After", String(ttl));
      return reply.status(429).send({
        error: { message: "Çok fazla giriş denemesi, lütfen daha sonra tekrar deneyin" },
      });
    }
  });
};

export default fp(loginRateLimitPlugin, {
  name: "login-rate-limit",
  dependencies: ["redis"],
});
