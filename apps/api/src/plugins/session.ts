import fp from "fastify-plugin";
import { FastifyPluginAsync } from "fastify";
import cookie from "@fastify/cookie";
import fastifySession from "@fastify/session";
import RedisStore from "connect-redis";
import { env } from "../config/env";
import type { CartLine } from "../modules/cart/cart.types";

declare module "fastify" {
  interface Session {
    // customerId, vendorId ve adminId kasıtlı olarak aynı oturum
    // nesnesinde, bağımsız alanlar olarak tutuluyor - tek çerez, tek Redis
    // kaydı. Bu üç kimlik birbirini etkilemez (bir satıcı aynı anda
    // müşteri olarak da alışveriş yapabilir), sadece ayrı çerez isimleri
    // kullanmıyoruz çünkü tek session store girdisi operasyonel olarak
    // daha basit ve "anında yetki iptali" özelliğini bozmuyor.
    customerId?: number;
    vendorId?: number;
    adminId?: number;
    cart?: CartLine[];
  }
}

// Redis tabanlı oturum: bir hesap (müşteri/satıcı/admin) yasaklanır/
// silinirse erişimi anında kesilebilir (session store'dan tek satır
// silmek yeterli) — stateless JWT bunu bir gölge kara liste olmadan
// yapamazdı.
const sessionPlugin: FastifyPluginAsync = async (app) => {
  await app.register(cookie);

  const store = new RedisStore({ client: app.redis, prefix: "sess:" });

  await app.register(fastifySession, {
    store,
    secret: env.SESSION_SECRET,
    cookieName: "gs_sid",
    cookie: {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 30,
    },
  });
};

export default fp(sessionPlugin, { name: "session", dependencies: ["redis"] });
