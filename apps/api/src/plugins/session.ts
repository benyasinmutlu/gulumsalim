import fp from "fastify-plugin";
import { FastifyPluginAsync } from "fastify";
import cookie from "@fastify/cookie";
import fastifySession from "@fastify/session";
import type { FastifySessionOptions, SessionStore } from "@fastify/session";
import { env } from "../config/env";
import type { CartLine } from "../modules/cart/cart.types";
import { RedisSessionStore } from "./redis-session-store";

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
    // bkz. coupon.service.ts - sepetle aynı oturum tabanlı yaklaşım:
    // kod POST /cart/coupon ile doğrulanıp burada saklanır, checkout
    // tamamlanınca (ya da DELETE /cart/coupon ile) temizlenir.
    couponCode?: string;
  }
}

// Redis tabanlı oturum: bir hesap (müşteri/satıcı/admin) yasaklanır/
// silinirse erişimi anında kesilebilir (session store'dan tek satır
// silmek yeterli) — stateless JWT bunu bir gölge kara liste olmadan
// yapamazdı.
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;

export type { SessionStore };

export function sessionRegisterOptions(store: SessionStore): FastifySessionOptions {
  return {
    store,
    secret: env.SESSION_SECRET,
    cookieName: "gs_sid",
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: SESSION_MAX_AGE_MS,
    },
  };
}

const sessionPlugin: FastifyPluginAsync = async (app) => {
  await app.register(cookie);

  const store = new RedisSessionStore(app.redis, "sess:", SESSION_MAX_AGE_MS / 1000);

  // sameSite:"none" yalnızca prod'da: iyzico'nun siteler-arası POST callback'i
  // mevcut oturumu taşıyabilsin. saveUninitialized:false ise callback çerez
  // taşımadığında yeni boş bir gs_sid basıp tarayıcıdaki oturumu ezmesini önler.
  await app.register(fastifySession, sessionRegisterOptions(store));
};

export default fp(sessionPlugin, { name: "session", dependencies: ["redis"] });
