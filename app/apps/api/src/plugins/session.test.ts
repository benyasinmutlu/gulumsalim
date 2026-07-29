import Fastify, { type FastifyInstance, type Session } from "fastify";
import cookie from "@fastify/cookie";
import fastifySession from "@fastify/session";
import { afterEach, describe, expect, it } from "vitest";
import { sessionRegisterOptions, type SessionStore } from "./session";

// @fastify/session'ın beklediği callback arayüzünü uygulayan basit
// in-memory store - bu testler için Redis'e gerek yok.
function inMemoryStore(): SessionStore {
  const map = new Map<string, string>();
  return {
    get(id, cb) {
      const data = map.get(id);
      cb(null, data ? (JSON.parse(data) as Session) : null);
    },
    set(id, session, cb) {
      map.set(id, JSON.stringify(session));
      cb();
    },
    destroy(id, cb) {
      map.delete(id);
      cb();
    },
  };
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify();
  await app.register(cookie);
  await app.register(fastifySession, sessionRegisterOptions(inMemoryStore()));

  // login benzeri: session'ı DEĞİŞTİRİR
  app.post("/login", async (req) => {
    req.session.customerId = 42;
    return { ok: true };
  });
  // payment-callback benzeri: session'a HİÇ dokunmaz (iyzico cross-site POST)
  app.post("/payment-callback", async () => ({ ok: true }));
  // korumalı: kimlik yalnız oturumdan
  app.get("/me", async (req) => ({ customerId: req.session.customerId ?? null }));

  await app.ready();
  return app;
}

function sidCookie(res: { cookies: Array<{ name: string; value: string }> }) {
  return res.cookies.find((c) => c.name === "gs_sid");
}

let app: FastifyInstance | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("session cookie behavior (saveUninitialized:false)", () => {
  it("config uses saveUninitialized:false — guards the post-order logout fix", () => {
    expect(sessionRegisterOptions(inMemoryStore()).saveUninitialized).toBe(false);
  });

  it("does NOT set a session cookie for a request that never touches the session", async () => {
    app = await buildApp();
    const res = await app.inject({ method: "POST", url: "/payment-callback" });
    expect(res.statusCode).toBe(200);
    // Bu, ezme (clobber) davranışının kök nedeni: eskiden bu istek yeni boş
    // bir gs_sid basardı. saveUninitialized:false ile hiç çerez yazılmamalı.
    expect(sidCookie(res)).toBeUndefined();
  });

  it("sets a session cookie when the session is actually modified (login)", async () => {
    app = await buildApp();
    const res = await app.inject({ method: "POST", url: "/login" });
    expect(sidCookie(res)?.value).toBeTruthy();
  });

  it("a cross-site callback (cookie not sent) cannot clobber an existing auth session", async () => {
    app = await buildApp();

    // 1) giriş → kimlikli çerez
    const login = await app.inject({ method: "POST", url: "/login" });
    const sid = sidCookie(login)?.value;
    expect(sid).toBeTruthy();

    // 2) iyzico cross-site POST: tarayıcı çerezi GÖNDERMEZ → yanıt Set-Cookie
    //    basmamalı (aksi halde tarayıcıdaki kimlikli çerez ezilirdi)
    const callback = await app.inject({ method: "POST", url: "/payment-callback" });
    expect(sidCookie(callback)).toBeUndefined();

    // 3) kullanıcı siparis-sonucu'na döndüğünde eski çerez hâlâ geçerli →
    //    oturum korunmuş, "çıkış yapmış görünme" yok
    const me = await app.inject({ method: "GET", url: "/me", cookies: { gs_sid: sid! } });
    expect(me.json()).toEqual({ customerId: 42 });
  });
});
