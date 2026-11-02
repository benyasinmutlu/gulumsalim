import { FastifyPluginAsync, type FastifyRequest } from "fastify";
import QRCode from "qrcode";
import {
  consumeAdminMfaStep,
  consumeAdminRecoveryCode,
  enableAdminMfa,
  findAdminById,
} from "./admin.repository";
import { adminLoginSchema, adminMfaCodeSchema } from "./admin-auth.schemas";
import { InvalidCredentialsError, verifyAdminCredentials } from "./admin-auth.service";
import {
  buildOtpAuthUri,
  decryptMfaSecret,
  encryptMfaSecret,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  isMfaConfigured,
  verifyTotp,
} from "./admin-mfa";

const PENDING_ADMIN_TTL_MS = 5 * 60 * 1000;

function publicAdmin(a: { id: number; username: string; fullName: string; mfaEnabledAt: Date | null }) {
  return {
    id: a.id,
    username: a.username,
    fullName: a.fullName,
    mfaEnabled: a.mfaEnabledAt !== null,
  };
}

function clearPendingAdmin(request: FastifyRequest) {
  delete request.session.pendingAdminId;
  delete request.session.pendingAdminMfaExpiresAt;
  delete request.session.pendingAdminMfaSecretEncrypted;
}

function pendingAdminId(request: FastifyRequest): number | null {
  const id = request.session.pendingAdminId;
  const expiresAt = request.session.pendingAdminMfaExpiresAt;
  if (!id || !expiresAt || expiresAt <= Date.now()) {
    clearPendingAdmin(request);
    return null;
  }
  return id;
}

async function promoteAdminSession(request: FastifyRequest, adminId: number) {
  // MFA öncesi session ID'si yetkili oturuma taşınmaz. Sepet/müşteri/satıcı
  // kimlikleri bağımsız kullanım senaryosu için korunur.
  await request.session.regenerate(["cart", "customerId", "vendorId"]);
  request.session.adminId = adminId;
  request.session.adminMfaVerified = true;
}

function mfaUnavailableMessage() {
  return { error: { message: "İki aşamalı doğrulama şu anda kullanılamıyor" } };
}

function invalidMfaMessage() {
  return { error: { message: "Doğrulama kodu geçersiz veya daha önce kullanılmış" } };
}

// Kasıtlı olarak public bir /admin/auth/register yok - admin hesapları
// sadece infra/postgres/seed/seed-admin.ts ile sunucuya elle eklenir.
const adminAuthRoutes: FastifyPluginAsync = async (app) => {
  app.post("/admin/auth/login", { preHandler: [app.loginRateLimit, app.csrfProtection] }, async (request, reply) => {
    const input = adminLoginSchema.parse(request.body);
    try {
      const admin = await verifyAdminCredentials(input);
      await request.session.regenerate(["cart", "customerId", "vendorId"]);
      request.session.pendingAdminId = admin.id;
      request.session.pendingAdminMfaExpiresAt = Date.now() + PENDING_ADMIN_TTL_MS;
      reply.header("Cache-Control", "no-store");
      return reply.send(admin.mfaEnabledAt ? { mfaRequired: true } : { mfaEnrollmentRequired: true });
    } catch (err) {
      if (err instanceof InvalidCredentialsError) {
        return reply.status(401).send({ error: { message: "Kullanıcı adı veya şifre hatalı" } });
      }
      throw err;
    }
  });

  app.post("/admin/auth/mfa/setup", { preHandler: app.csrfProtection }, async (request, reply) => {
    const adminId = pendingAdminId(request);
    if (!adminId) return reply.status(401).send({ error: { message: "Giriş süresi doldu, tekrar giriş yapın" } });
    if (!isMfaConfigured()) return reply.status(503).send(mfaUnavailableMessage());

    const admin = await findAdminById(adminId);
    if (!admin || admin.mfaEnabledAt) {
      clearPendingAdmin(request);
      return reply.status(409).send({ error: { message: "İki aşamalı doğrulama kurulumu başlatılamadı" } });
    }

    const secret = generateTotpSecret();
    const encryptedSecret = encryptMfaSecret(secret);
    const otpauthUri = buildOtpAuthUri(secret, admin.username);
    request.session.pendingAdminMfaSecretEncrypted = encryptedSecret;
    reply.header("Cache-Control", "no-store");
    return reply.send({
      secret,
      otpauthUri,
      qrCodeDataUrl: await QRCode.toDataURL(otpauthUri, { errorCorrectionLevel: "M", margin: 1, width: 240 }),
    });
  });

  app.post("/admin/auth/mfa/enable", { preHandler: [app.loginRateLimit, app.csrfProtection] }, async (request, reply) => {
    const adminId = pendingAdminId(request);
    const encryptedSecret = request.session.pendingAdminMfaSecretEncrypted;
    if (!adminId || !encryptedSecret) {
      return reply.status(401).send({ error: { message: "Giriş süresi doldu, tekrar giriş yapın" } });
    }
    if (!isMfaConfigured()) return reply.status(503).send(mfaUnavailableMessage());

    const { code } = adminMfaCodeSchema.parse(request.body);
    if (!/^\d{6}$/.test(code)) return reply.status(401).send(invalidMfaMessage());

    let step: number | null = null;
    try {
      step = verifyTotp(code, decryptMfaSecret(encryptedSecret));
    } catch (err) {
      request.log.error({ err }, "Admin MFA kurulum sırrı çözülemedi");
      return reply.status(503).send(mfaUnavailableMessage());
    }
    if (step === null) return reply.status(401).send(invalidMfaMessage());

    const recoveryCodes = generateRecoveryCodes();
    const admin = await enableAdminMfa(adminId, encryptedSecret, recoveryCodes.map(hashRecoveryCode), step);
    if (!admin) return reply.status(409).send({ error: { message: "İki aşamalı doğrulama zaten etkin" } });

    await promoteAdminSession(request, adminId);
    reply.header("Cache-Control", "no-store");
    return reply.send({ admin: publicAdmin(admin), recoveryCodes });
  });

  app.post("/admin/auth/mfa/verify", { preHandler: [app.loginRateLimit, app.csrfProtection] }, async (request, reply) => {
    const adminId = pendingAdminId(request);
    if (!adminId) return reply.status(401).send({ error: { message: "Giriş süresi doldu, tekrar giriş yapın" } });
    if (!isMfaConfigured()) return reply.status(503).send(mfaUnavailableMessage());

    const { code } = adminMfaCodeSchema.parse(request.body);
    const admin = await findAdminById(adminId);
    if (!admin?.mfaEnabledAt || !admin.mfaSecretEncrypted) {
      clearPendingAdmin(request);
      return reply.status(401).send(invalidMfaMessage());
    }

    let accepted = false;
    if (/^\d{6}$/.test(code)) {
      try {
        const step = verifyTotp(code, decryptMfaSecret(admin.mfaSecretEncrypted));
        accepted = step !== null && await consumeAdminMfaStep(adminId, step);
      } catch (err) {
        request.log.error({ err }, "Admin MFA sırrı çözülemedi");
        return reply.status(503).send(mfaUnavailableMessage());
      }
    } else {
      accepted = await consumeAdminRecoveryCode(adminId, hashRecoveryCode(code));
    }

    if (!accepted) return reply.status(401).send(invalidMfaMessage());
    await promoteAdminSession(request, adminId);
    reply.header("Cache-Control", "no-store");
    return reply.send(publicAdmin(admin));
  });

  app.post("/admin/auth/logout", { preHandler: app.csrfProtection }, async (request, reply) => {
    await request.session.regenerate(["cart", "customerId", "vendorId"]);
    return reply.send({ ok: true });
  });

  // bkz. auth.routes.ts /auth/logout - düz link tabanlı, JS'e bağımlı değil.
  app.get("/admin/auth/logout", async (request, reply) => {
    await request.session.regenerate(["cart", "customerId", "vendorId"]);
    return reply.redirect("/admin/giris");
  });

  app.get("/admin/auth/me", { preHandler: app.requireAdmin }, async (request, reply) => {
    const admin = await findAdminById(request.session.adminId!);
    if (!admin) return reply.status(404).send({ error: { message: "Admin bulunamadı" } });
    return reply.send(publicAdmin(admin));
  });
};

export default adminAuthRoutes;
