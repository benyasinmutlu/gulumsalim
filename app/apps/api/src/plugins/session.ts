import fp from "fastify-plugin";
import { FastifyPluginAsync } from "fastify";
import cookie from "@fastify/cookie";
import fastifySession from "@fastify/session";
import type { Session } from "fastify";
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
  }
}

// Redis tabanlı oturum: bir hesap (müşteri/satıcı/admin) yasaklanır/
// silinirse erişimi anında kesilebilir (session store'dan tek satır
// silmek yeterli) — stateless JWT bunu bir gölge kara liste olmadan
// yapamazdı.
export const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;

// @fastify/session'ın beklediği minimal store arayüzü (get/set/destroy).
// RedisSessionStore (prod) ve testlerdeki in-memory store bunu uygular.
export interface SessionStore {
  get(sessionId: string, callback: (err: Error | null, result?: Session | null) => void): void;
  set(sessionId: string, session: Session, callback: (err?: Error | null) => void): void;
  destroy(sessionId: string, callback: (err?: Error | null) => void): void;
}

// Oturum kayıt seçenekleri tek bir yerde - prod eklentisi ve testler AYNI
// yapılandırmayı kullanır (davranış kayması olmaz).
//
// saveUninitialized:false — "sipariş sonrası çıkış yapmış görünme" bug'ının
// kök çözümü: iyzico'nun /payment-callback'e yaptığı cross-site POST'ta
// sameSite=lax çerezi (gs_sid) tarayıcı tarafından GÖNDERİLMEZ. Bu istek
// session'ı değiştirmez; saveUninitialized:true iken @fastify/session yine de
// YENİ boş bir oturum üretip yanıta `Set-Cookie: gs_sid=...` basar ve
// tarayıcıdaki KİMLİKLİ çerezi ezerdi → siparis-sonucu'na dönünce kullanıcı
// çıkış yapmış görünürdü. false: çerez yalnız oturum gerçekten değiştiğinde
// (login, sepet, CSRF secret) yazılır. Misafir sepeti session'ı mutate
// ettiği için korunmaya devam eder; boş/dokunulmamış oturumlar çerez yazmaz.
export function sessionRegisterOptions(store: SessionStore) {
  return {
    store,
    secret: env.SESSION_SECRET,
    cookieName: "gs_sid",
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: SESSION_MAX_AGE_MS,
    },
  };
}

const sessionPlugin: FastifyPluginAsync = async (app) => {
  await app.register(cookie);

  const store = new RedisSessionStore(app.redis, "sess:", SESSION_MAX_AGE_MS / 1000);

  await app.register(fastifySession, sessionRegisterOptions(store));
};

export default fp(sessionPlugin, { name: "session", dependencies: ["redis"] });
