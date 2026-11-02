import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encryptMfaSecret, generateTotpCode } from "./admin-mfa";

const mocks = vi.hoisted(() => ({
  findAdminById: vi.fn(),
  enableAdminMfa: vi.fn(),
  consumeAdminMfaStep: vi.fn(),
  consumeAdminRecoveryCode: vi.fn(),
  verifyAdminCredentials: vi.fn(),
}));

vi.mock("./admin.repository", () => ({
  findAdminById: mocks.findAdminById,
  enableAdminMfa: mocks.enableAdminMfa,
  consumeAdminMfaStep: mocks.consumeAdminMfaStep,
  consumeAdminRecoveryCode: mocks.consumeAdminRecoveryCode,
}));

vi.mock("./admin-auth.service", () => ({
  InvalidCredentialsError: class InvalidCredentialsError extends Error {},
  verifyAdminCredentials: mocks.verifyAdminCredentials,
}));

import adminAuthRoutes from "./admin-auth.routes";

const admin = {
  id: 7,
  username: "admin",
  fullName: "Güvenli Admin",
  passwordHash: "unused",
  mfaSecretEncrypted: null,
  mfaRecoveryCodeHashes: [] as string[],
  mfaEnabledAt: null as Date | null,
  mfaLastUsedStep: null as number | null,
  createdAt: new Date(),
};

function createSession() {
  const session: Record<string, unknown> & { regenerate: (preserve?: string[]) => Promise<void> } = {
    async regenerate(preserve = []) {
      const saved = Object.fromEntries(preserve.filter((key) => key in session).map((key) => [key, session[key]]));
      for (const key of Object.keys(session)) if (key !== "regenerate") delete session[key];
      Object.assign(session, saved);
    },
  };
  return session;
}

async function buildTestApp() {
  const app = Fastify({ logger: false });
  const session = createSession();
  app.decorate("loginRateLimit", async () => undefined);
  app.decorate("csrfProtection", async () => undefined);
  app.decorate("requireAdmin", async () => undefined);
  app.decorateRequest("session", null as never);
  app.addHook("onRequest", async (request) => {
    Object.defineProperty(request, "session", { value: session, configurable: true });
  });
  await app.register(adminAuthRoutes);
  await app.ready();
  return { app, session };
}

describe("admin MFA auth routes", () => {
  let app: FastifyInstance | null = null;

  beforeEach(() => {
    process.env.MFA_ENC_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    vi.clearAllMocks();
    mocks.verifyAdminCredentials.mockResolvedValue({ ...admin });
    mocks.findAdminById.mockResolvedValue({ ...admin });
    mocks.enableAdminMfa.mockImplementation(async (_id, encrypted, hashes, step) => ({
      ...admin,
      mfaSecretEncrypted: encrypted,
      mfaRecoveryCodeHashes: hashes,
      mfaEnabledAt: new Date(),
      mfaLastUsedStep: step,
    }));
    mocks.consumeAdminMfaStep.mockResolvedValue(true);
    mocks.consumeAdminRecoveryCode.mockResolvedValue(true);
  });

  afterEach(async () => {
    await app?.close();
    app = null;
  });

  it("does not grant admin access until first-time MFA enrollment succeeds", async () => {
    const testApp = await buildTestApp();
    app = testApp.app;

    const login = await app.inject({
      method: "POST",
      url: "/admin/auth/login",
      payload: { username: "admin", password: "correct-password" },
    });
    expect(login.statusCode).toBe(200);
    expect(login.json()).toEqual({ mfaEnrollmentRequired: true });
    expect(testApp.session.adminId).toBeUndefined();
    expect(testApp.session.pendingAdminId).toBe(admin.id);

    const setup = await app.inject({ method: "POST", url: "/admin/auth/mfa/setup" });
    expect(setup.statusCode).toBe(200);
    const setupBody = setup.json() as { secret: string; qrCodeDataUrl: string };
    expect(setupBody.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);

    const enable = await app.inject({
      method: "POST",
      url: "/admin/auth/mfa/enable",
      payload: { code: generateTotpCode(setupBody.secret) },
    });
    expect(enable.statusCode).toBe(200);
    expect(enable.json().recoveryCodes).toHaveLength(10);
    expect(testApp.session.adminId).toBe(admin.id);
    expect(testApp.session.adminMfaVerified).toBe(true);
    expect(testApp.session.pendingAdminId).toBeUndefined();
  });

  it("requires and consumes a TOTP step for an enrolled admin", async () => {
    const secret = "JBSWY3DPEHPK3PXP";
    const enrolled = {
      ...admin,
      mfaSecretEncrypted: encryptMfaSecret(secret),
      mfaEnabledAt: new Date(),
    };
    mocks.verifyAdminCredentials.mockResolvedValue(enrolled);
    mocks.findAdminById.mockResolvedValue(enrolled);
    const testApp = await buildTestApp();
    app = testApp.app;

    const login = await app.inject({
      method: "POST",
      url: "/admin/auth/login",
      payload: { username: "admin", password: "correct-password" },
    });
    expect(login.json()).toEqual({ mfaRequired: true });
    expect(testApp.session.adminId).toBeUndefined();

    const verify = await app.inject({
      method: "POST",
      url: "/admin/auth/mfa/verify",
      payload: { code: generateTotpCode(secret) },
    });
    expect(verify.statusCode).toBe(200);
    expect(mocks.consumeAdminMfaStep).toHaveBeenCalledOnce();
    expect(testApp.session.adminMfaVerified).toBe(true);
  });

  it("fails closed when the MFA encryption key is unavailable", async () => {
    delete process.env.MFA_ENC_KEY;
    const testApp = await buildTestApp();
    app = testApp.app;
    await app.inject({
      method: "POST",
      url: "/admin/auth/login",
      payload: { username: "admin", password: "correct-password" },
    });
    const setup = await app.inject({ method: "POST", url: "/admin/auth/mfa/setup" });
    expect(setup.statusCode).toBe(503);
    expect(testApp.session.adminId).toBeUndefined();
  });
});
