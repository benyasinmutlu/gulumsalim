import { FastifyPluginAsync } from "fastify";
import { findCustomerById, setCustomerAvatar } from "./auth.repository";
import { completeConsentSchema, forgotPasswordSchema, googleLoginSchema, loginSchema, registerSchema, resetPasswordSchema, updateProfileSchema } from "./auth.schemas";
import { GoogleAuthNotConfiguredError, InvalidGoogleTokenError } from "../../lib/google-auth";
import { InvalidImageError, saveImage } from "../../lib/image-upload";
import { deleteObject } from "../../lib/storage";
import { findVendorByCustomerId } from "../vendors/vendor.repository";
import type { SizePrefs } from "../../db/schema/customers";
import {
  completeGoogleConsent,
  deleteCustomerAccount,
  EmailInUseError,
  EmailNotVerifiedError,
  InvalidCredentialsError,
  InvalidResetTokenError,
  InvalidVerificationTokenError,
  loginWithGoogle,
  registerCustomer,
  requestPasswordReset,
  resendCustomerVerificationEmail,
  resetPasswordWithToken,
  updateProfile,
  verifyCustomerCredentials,
  verifyCustomerEmailWithToken,
  WrongCurrentPasswordError,
} from "./auth.service";

function publicCustomer(c: {
  id: number;
  email: string;
  fullName: string;
  phone: string | null;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  sizePrefs: SizePrefs | null;
  membershipConsentAt: Date | null;
  avatarUrl: string | null;
}) {
  return {
    id: c.id,
    email: c.email,
    fullName: c.fullName,
    phone: c.phone,
    age: c.age,
    heightCm: c.heightCm,
    weightKg: c.weightKg,
    sizePrefs: c.sizePrefs ?? null,
    avatarUrl: c.avatarUrl,
    // bkz. auth.service.ts loginWithGoogle yorumu - true ise frontend
    // kullanıcıyı uyelik-tamamla sayfasına yönlendirir.
    needsConsent: c.membershipConsentAt === null,
  };
}

// bkz. olay: 2026-08-01 "bireysel satıcı ile normal satıcının mailleri
// çakışmamalı" - bireysel satıcı hesabının e-postası artık her zaman
// namespaced (bkz. vendor-auth.service.ts becomeIndividualSeller), yani
// müşteri onu ezbere bilemez/giremez. Bu yüzden müşteri girişinde, varsa
// bağlı bireysel satıcı hesabının vendorId'si de oturuma otomatik eklenir -
// satıcı ayrıca /satici/giris'e gidip şifresini hatırlamak zorunda kalmaz,
// "Satıcı Panelim" linki her zaman doğrudan çalışır.
async function attachVendorSession(request: { session: { vendorId?: number } }, customerId: number) {
  const vendor = await findVendorByCustomerId(customerId);
  if (vendor) request.session.vendorId = vendor.id;
}

const authRoutes: FastifyPluginAsync = async (app) => {
  // Frontend, mutasyon isteklerinden önce bu token'ı alıp header'da geri
  // gönderir (bkz. plugins/csrf.ts). Kendisi bir mutasyon olmadığı için
  // CSRF korumasına tabi değil.
  app.get("/auth/csrf-token", async (request, reply) => {
    return reply.send({ csrfToken: await reply.generateCsrf() });
  });

  // bkz. kullanıcı isteği: "email doğrulamayı zorunlu olmalı" - kayıt artık
  // otomatik giriş yapmıyor, doğrulama e-postası gönderiliyor ve müşteri
  // bağlantıya tıklayana kadar giriş yapamıyor (bkz. /auth/login).
  app.post("/auth/register", { preHandler: app.csrfProtection }, async (request, reply) => {
    const input = registerSchema.parse(request.body);
    try {
      const customer = await registerCustomer(input);
      return reply.status(201).send({ email: customer.email, verificationRequired: true });
    } catch (err) {
      if (err instanceof EmailInUseError) {
        return reply.status(409).send({ error: { message: "Bu e-posta adresi zaten kayıtlı" } });
      }
      throw err;
    }
  });

  app.post("/auth/login", { preHandler: [app.loginRateLimit, app.csrfProtection] }, async (request, reply) => {
    const input = loginSchema.parse(request.body);
    try {
      const customer = await verifyCustomerCredentials(input);
      await request.session.regenerate(["cart", "vendorId", "adminId"]);
      request.session.customerId = customer.id;
      await attachVendorSession(request, customer.id);
      return reply.send(publicCustomer(customer));
    } catch (err) {
      if (err instanceof InvalidCredentialsError) {
        return reply.status(401).send({ error: { message: "E-posta veya şifre hatalı" } });
      }
      if (err instanceof EmailNotVerifiedError) {
        return reply.status(403).send({ error: { message: "Giriş yapmadan önce e-posta adresinizi doğrulamalısınız", code: "email_not_verified" } });
      }
      throw err;
    }
  });

  // bkz. kullanıcı isteği: "google ile giriş yap a tıklayınca direkt kayıt
  // yapılsın" - tek uç hem giriş hem kayıt (bkz. auth.service.ts
  // loginWithGoogle). Yeni açılan hesaplarda needsConsent true döner,
  // frontend (google-signin-button.tsx) bu durumda /uyelik-tamamla'ya
  // yönlendirir.
  app.post("/auth/google/login", { preHandler: [app.loginRateLimit, app.csrfProtection] }, async (request, reply) => {
    const input = googleLoginSchema.parse(request.body);
    try {
      const customer = await loginWithGoogle(input.idToken);
      await request.session.regenerate(["cart", "vendorId", "adminId"]);
      request.session.customerId = customer.id;
      await attachVendorSession(request, customer.id);
      return reply.send(publicCustomer(customer));
    } catch (err) {
      if (err instanceof GoogleAuthNotConfiguredError) {
        return reply.status(503).send({ error: { message: "Google ile giriş şu anda kullanılamıyor" } });
      }
      if (err instanceof InvalidGoogleTokenError) {
        return reply.status(401).send({ error: { message: "Google doğrulaması başarısız oldu" } });
      }
      throw err;
    }
  });

  // bkz. auth.service.ts completeGoogleConsent - Google ile anında açılan
  // hesabın girişten hemen sonra tamamladığı zorunlu Üyelik Sözleşmesi/KVKK
  // onayı (bkz. uyelik-tamamla/page.tsx).
  app.post("/auth/complete-consent", { preHandler: [app.requireCustomer, app.csrfProtection] }, async (request, reply) => {
    const input = completeConsentSchema.parse(request.body);
    const customer = await completeGoogleConsent(request.session.customerId!, {
      marketingConsent: input.marketingConsent,
      analyticsConsent: input.analyticsConsent,
      phone: input.phone,
    });
    return reply.send(publicCustomer(customer));
  });

  // bkz. kullanıcı isteği: dogrulama e-postasi kaybolur/suresi dolarsa
  // yeniden gonderilebilsin - e-posta enumeration'a karsi her zaman ayni
  // genel yanit doner (bkz. forgot-password ile ayni desen).
  app.post("/auth/resend-verification", { preHandler: app.csrfProtection }, async (request, reply) => {
    const { email } = forgotPasswordSchema.parse(request.body);
    await resendCustomerVerificationEmail(email);
    return reply.send({ ok: true });
  });

  // Dogrulama baglantisina tiklama - e-postadan gelen bir GET, JS/CSRF'e
  // bagli degil. Basari/hata durumuna gore musteri tarafi bir sonuc
  // sayfasina yonlendirilir.
  app.get("/auth/verify-email", async (request, reply) => {
    const { token } = request.query as { token?: string };
    if (!token) return reply.redirect("/e-posta-dogrulama?status=error");
    try {
      await verifyCustomerEmailWithToken(token);
      return reply.redirect("/e-posta-dogrulama?status=ok");
    } catch (err) {
      if (err instanceof InvalidVerificationTokenError) {
        return reply.redirect("/e-posta-dogrulama?status=error");
      }
      throw err;
    }
  });

  // E-posta kayıtlı olsun olmasın her zaman aynı genel yanıt döner - hangi
  // e-postaların sistemde kayıtlı olduğunu dışarıya sızdırmamak için
  // (bkz. auth.service.ts requestPasswordReset).
  app.post("/auth/forgot-password", { preHandler: app.csrfProtection }, async (request, reply) => {
    const { email } = forgotPasswordSchema.parse(request.body);
    await requestPasswordReset(email);
    return reply.send({ ok: true });
  });

  app.post("/auth/reset-password", { preHandler: app.csrfProtection }, async (request, reply) => {
    const { token, password } = resetPasswordSchema.parse(request.body);
    try {
      await resetPasswordWithToken(token, password);
      return reply.send({ ok: true });
    } catch (err) {
      if (err instanceof InvalidResetTokenError) {
        return reply.status(400).send({ error: { message: "Bağlantının süresi dolmuş veya geçersiz, lütfen tekrar deneyin" } });
      }
      throw err;
    }
  });

  app.post("/auth/logout", { preHandler: app.csrfProtection }, async (request, reply) => {
    await request.session.destroy();
    return reply.send({ ok: true });
  });

  // gulumsalim.com'daki /hesabim?logout=1 bağlantısının birebir karşılığı:
  // düz bir <a href> - JS/fetch/CSRF token'a hiç bağımlı değil, tıklanınca
  // tarayıcı zaten normal bir sayfa navigasyonu yapıyor. POST+fetch tabanlı
  // sürüm bazı tarayıcı/önbellek koşullarında sessizce başarısız
  // görünebiliyordu (bkz. logout-button.tsx yorumu) - bu yüzden buton bu
  // uca yönlendiren bir linke çevrildi.
  app.get("/auth/logout", async (request, reply) => {
    await request.session.destroy();
    return reply.redirect("/");
  });

  app.get("/auth/me", { preHandler: app.requireCustomer }, async (request, reply) => {
    const customer = await findCustomerById(request.session.customerId!);
    if (!customer) {
      return reply.status(404).send({ error: { message: "Kullanıcı bulunamadı" } });
    }
    return reply.send(publicCustomer(customer));
  });

  app.patch("/auth/me", { preHandler: [app.requireCustomer, app.csrfProtection] }, async (request, reply) => {
    const input = updateProfileSchema.parse(request.body);
    try {
      const customer = await updateProfile(request.session.customerId!, input);
      return reply.send(publicCustomer(customer));
    } catch (err) {
      if (err instanceof WrongCurrentPasswordError) {
        return reply.status(400).send({ error: { message: "Mevcut şifrenizi hatalı girdiniz" } });
      }
      throw err;
    }
  });

  // bkz. kullanıcı isteği (2026-08-02): "müşteri ... üyelik iptali olacak" -
  // sipariş/değerlendirme izi olmayan hesap kalıcı silinir, olan hesap
  // anonimleştirilir (bkz. auth.service.ts deleteCustomerAccount). Her iki
  // durumda da oturum hemen sonlandırılır.
  app.delete("/auth/me", { preHandler: [app.requireCustomer, app.csrfProtection] }, async (request, reply) => {
    await deleteCustomerAccount(request.session.customerId!);
    await request.session.destroy();
    return reply.send({ ok: true });
  });

  // bkz. kullanıcı isteği: "googledaki resmini de profil resmi olarak
  // alcak ve de bunu değiştirebilecek" - Google ile gelen profil fotoğrafı
  // burada değiştirilir; satıcı logo yüklemesiyle aynı desen (bkz.
  // vendor-auth.routes.ts /vendor/profile/logo).
  app.post("/auth/me/avatar", { preHandler: [app.requireCustomer, app.csrfProtection] }, async (request, reply) => {
    const file = await request.file();
    if (!file) {
      return reply.status(400).send({ error: { message: "Görsel dosyası gerekli" } });
    }
    const buffer = await file.toBuffer();
    try {
      const previous = await findCustomerById(request.session.customerId!);
      const url = await saveImage(`customers/${request.session.customerId}`, buffer, file.mimetype);
      const customer = await setCustomerAvatar(request.session.customerId!, url);
      if (previous?.avatarUrl) await deleteObject(previous.avatarUrl);
      return reply.send(publicCustomer(customer));
    } catch (err) {
      if (err instanceof InvalidImageError) {
        return reply.status(400).send({ error: { message: err.message } });
      }
      throw err;
    }
  });
};

export default authRoutes;
