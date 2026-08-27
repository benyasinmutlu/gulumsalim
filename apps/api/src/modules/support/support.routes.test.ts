import Fastify from "fastify";
import type Redis from "ioredis";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  configured: vi.fn<() => boolean>(),
  complete: vi.fn(),
  findPublicPageBySlug: vi.fn(),
}));

vi.mock("../content/content.repository", () => ({
  findPublicPageBySlug: mocks.findPublicPageBySlug,
}));

vi.mock("../product-intelligence/enrichment/providers/llm-client", () => {
  class AiNotConfiguredError extends Error {}
  class AiTemporarilyUnavailableError extends Error {}
  return {
    AiNotConfiguredError,
    AiTemporarilyUnavailableError,
    createLlmClient: () => ({
      configured: mocks.configured,
      complete: mocks.complete,
    }),
  };
});

import supportRoutes from "./support.routes";

async function buildApp(redisEval = vi.fn().mockResolvedValue([1, 600])) {
  const app = Fastify();
  app.decorate("redis", { eval: redisEval } as unknown as Redis);
  await app.register(supportRoutes);
  await app.ready();
  return { app, redisEval };
}

describe("support chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findPublicPageBySlug.mockResolvedValue(null);
  });

  it("AI yapılandırılmamışken Redis kotası tüketmeden güvenli yanıt döner", async () => {
    mocks.configured.mockReturnValue(false);
    const { app, redisEval } = await buildApp();
    const response = await app.inject({ method: "POST", url: "/support/chat", payload: { message: "Kargom nerede?" } });

    expect(response.statusCode).toBe(200);
    expect(response.json().aiAvailable).toBe(false);
    expect(redisEval).not.toHaveBeenCalled();
    await app.close();
  });

  it("IP kotasını atomik sayaç sonucuna göre uygular", async () => {
    mocks.configured.mockReturnValue(true);
    const { app } = await buildApp(vi.fn().mockResolvedValue([11, 120]));
    const response = await app.inject({ method: "POST", url: "/support/chat", payload: { message: "İade nasıl yapılır?" } });

    expect(response.statusCode).toBe(429);
    expect(response.headers["retry-after"]).toBe("120");
    expect(mocks.complete).not.toHaveBeenCalled();
    await app.close();
  });

  it("günlük AI bütçe sigortası dolduğunda ücretli çağrı yapmaz", async () => {
    mocks.configured.mockReturnValue(true);
    const redisEval = vi.fn()
      .mockResolvedValueOnce([1, 600])
      .mockResolvedValueOnce([501, 300]);
    const { app } = await buildApp(redisEval);
    const response = await app.inject({ method: "POST", url: "/support/chat", payload: { message: "İade nasıl yapılır?" } });

    expect(response.statusCode).toBe(200);
    expect(response.json().aiAvailable).toBe(false);
    expect(mocks.complete).not.toHaveBeenCalled();
    await app.close();
  });

  it("konuşmayı güvenilmeyen içerik olarak sınırlar ve AI yanıtını döner", async () => {
    mocks.configured.mockReturnValue(true);
    mocks.complete.mockResolvedValue("  Siparişlerim sayfasından takip edebilirsin.  ");
    const { app } = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/support/chat",
      payload: { message: "Siparişimi nasıl takip ederim?", history: [{ role: "assistant", content: "Merhaba" }] },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ reply: "Siparişlerim sayfasından takip edebilirsin.", aiAvailable: true });
    expect(mocks.complete).toHaveBeenCalledWith(expect.objectContaining({
      prompt: expect.stringContaining("<guvenilmeyen_konusma>"),
      maxTokens: 300,
    }));
    await app.close();
  });

  it("sağlayıcı hatasında destek sayfasını bozmadan fallback döner", async () => {
    mocks.configured.mockReturnValue(true);
    mocks.complete.mockRejectedValue(new Error("provider down"));
    const { app } = await buildApp();
    const response = await app.inject({ method: "POST", url: "/support/chat", payload: { message: "Yardım" } });

    expect(response.statusCode).toBe(200);
    expect(response.json().aiAvailable).toBe(false);
    await app.close();
  });
});
