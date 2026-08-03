import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { InvalidImageError, saveImage } from "../../lib/image-upload";
import { findVendorByCustomerId, findVendorById, updateVendorProfile } from "./vendor.repository";
import {
  becomeIndividualSellerSchema,
  updateVendorProfileSchema,
  vendorForgotPasswordSchema,
  vendorLoginSchema,
  vendorRegisterSchema,
  vendorResetPasswordSchema,
} from "./vendor-auth.schemas";
import {
  becomeIndividualSeller,
  closeVendorSelfAccount,
  CustomerNotFoundError,
  EmailInUseError,
  EmailNotVerifiedError,
  InvalidCredentialsError,
  InvalidResetTokenError,
  InvalidVerificationTokenError,
  registerVendor,
  requestVendorPasswordReset,
  resendVendorVerificationEmail,
  resetVendorPasswordWithToken,
  SlugInUseError,
  updateVendorAccount,
  VendorBannedError,
  VendorClosedError,
  VendorHasOpenOrdersError,
  VendorNotFoundError,
  verifyVendorCredentials,
  verifyVendorEmailWithToken,
  WrongCurrentPasswordError,
} from "./vendor-auth.service";

function publicVendor(v: {
  id: number;
  storeName: string;
  storeSlug: string;
  email: string;
  status: string;
  vendorType: string;
  fullName: string;
  phone: string | null;
  logo: string | null;
  about: string | null;
  coverImage: string | null;
  city: string | null;
  whatsapp: string | null;
  instagram: string | null;
  facebook: string | null;
  twitter: string | null;
  youtube: string | null;
  tiktok: string | null;
  website: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  bankName: string | null;
  bankIban: string | null;
  bankAccountHolder: string | null;
  taxId: string | null;
  legalAddress: string | null;
}) {
  const {
    id, storeName, storeSlug, email, status, vendorType, fullName, phone, logo, about, coverImage, city,
    whatsapp, instagram, facebook, twitter, youtube, tiktok, website, seoTitle, seoDescription,
    bankName, bankIban, bankAccountHolder, taxId, legalAddress,
  } = v;
  return {
    id, storeName, storeSlug, email, status, vendorType, fullName, phone, logo, about, coverImage, city,
    whatsapp, instagram, facebook, twitter, youtube, tiktok, website, seoTitle, seoDescription,
    bankName, bankIban, bankAccountHolder, taxId, legalAddress,
  };
}

const vendorAuthRoutes: FastifyPluginAsync = async (app) => {
  // bkz. kullanıcı isteği: "email doğrulamayı zorunlu olmalı" - kayıt artık
  // otomatik giriş yapmıyor, doğrulama e-postası gönderiliyor.
  app.post("/vendor/auth/register", { preHandler: app.csrfProtection }, async (request, reply) => {
    const input = vendorRegisterSchema.parse(request.body);
    try {
      const vendor = await registerVendor(input);
      return reply.status(201).send({ email: vendor.email, verificationRequired: true });
    } catch (err) {
      if (err instanceof EmailInUseError) {
        return reply.status(409).send({ error: { message: "Bu e-posta adresi zaten kayıtlı" } });
      }
      if (err instanceof SlugInUseError) {
        return reply.status(409).send({ error: { message: "Bu mağaza adresi zaten kullanılıyor" } });
      }
      throw err;
    }
  });

  app.post("/vendor/auth/login", { preHandler: [app.loginRateLimit, app.csrfProtection] }, async (request, reply) => {
    const input = vendorLoginSchema.parse(request.body);
    try {
      const vendor = await verifyVendorCredentials(input);
      await request.session.regenerate(["cart", "customerId", "adminId"]);
      request.session.vendorId = vendor.id;
      return reply.send(publicVendor(vendor));
    } catch (err) {
      if (err instanceof InvalidCredentialsError) {
        return reply.status(401).send({ error: { message: "E-posta veya şifre hatalı" } });
      }
      if (err instanceof VendorBannedError) {
        return reply.status(403).send({ error: { message: "Bu satıcı hesabı yasaklanmış" } });
      }
      if (err instanceof VendorClosedError) {
        return reply.status(403).send({ error: { message: "Bu satıcı hesabı kapatılmış" } });
      }
      if (err instanceof EmailNotVerifiedError) {
        return reply.status(403).send({ error: { message: "Giriş yapmadan önce e-posta adresinizi doğrulamalısınız", code: "email_not_verified" } });
      }
      throw err;
    }
  });

  app.post("/vendor/auth/resend-verification", { preHandler: app.csrfProtection }, async (request, reply) => {
    const { email } = z.object({ email: z.string().email() }).parse(request.body);
    await resendVendorVerificationEmail(email);
    return reply.send({ ok: true });
  });

  app.get("/vendor/auth/verify-email", async (request, reply) => {
    const { token } = request.query as { token?: string };
    if (!token) return reply.redirect("/e-posta-dogrulama?status=error&role=satici");
    try {
      await verifyVendorEmailWithToken(token);
      return reply.redirect("/e-posta-dogrulama?status=ok&role=satici");
    } catch (err) {
      if (err instanceof InvalidVerificationTokenError) {
        return reply.redirect("/e-posta-dogrulama?status=error&role=satici");
      }
      throw err;
    }
  });

  // bkz. olay: 2026-08-01 "vergi nosu ve diğer bilgileri girdiğinde tekrar
  // tekrar ürünleri satışa çıkar demesin" - /hesabim/satici-ol ve
  // account-nav.tsx bu ucu kullanarak müşterinin zaten bir satıcı hesabı
  // olup olmadığını kontrol eder; session.vendorId'ye güvenmiyoruz çünkü o
  // sadece become-individual-seller'ı ÇAĞIRDIĞI oturumda dolu olur - farklı
  // bir oturumda (ör. yeniden giriş) müşterinin zaten var olan mağazasını
  // görmesi için doğrudan customerId ile DB'den bakılır.
  app.get("/my/vendor", { preHandler: app.requireCustomer }, async (request, reply) => {
    const vendor = await findVendorByCustomerId(request.session.customerId!);
    if (!vendor) return reply.status(404).send({ error: { message: "Satıcı hesabı bulunamadı" } });
    return reply.send(publicVendor(vendor));
  });

  // bkz. kullanıcı isteği: "bireysel olarak müşteri olarak kayıt olan
  // kişilerde satış yapabilsin 2. el ürün letgo dolap gibi" - giriş yapmış
  // bir müşteri tek tıkla (admin onayı beklemeden) bireysel satıcı olur;
  // aynı oturuma vendorId de eklenir, ayrıca satıcı girişi yapmasına
  // gerek kalmaz (bkz. sessionPlugin: customerId/vendorId aynı çerezde
  // bağımsız alanlar olarak durabilir).
  app.post(
    "/my/become-individual-seller",
    { preHandler: [app.requireCustomer, app.csrfProtection] },
    async (request, reply) => {
      try {
        const input = becomeIndividualSellerSchema.parse(request.body);
        const vendor = await becomeIndividualSeller(request.session.customerId!, input);
        request.session.vendorId = vendor.id;
        return reply.status(201).send(publicVendor(vendor));
      } catch (err) {
        if (err instanceof CustomerNotFoundError) {
          return reply.status(404).send({ error: { message: "Müşteri bulunamadı" } });
        }
        throw err;
      }
    },
  );

  // bkz. auth.routes.ts /auth/forgot-password (müşteri eşdeğeri) - aynı
  // enumeration koruması.
  app.post("/vendor/auth/forgot-password", { preHandler: app.csrfProtection }, async (request, reply) => {
    const { email } = vendorForgotPasswordSchema.parse(request.body);
    await requestVendorPasswordReset(email);
    return reply.send({ ok: true });
  });

  app.post("/vendor/auth/reset-password", { preHandler: app.csrfProtection }, async (request, reply) => {
    const { token, password } = vendorResetPasswordSchema.parse(request.body);
    try {
      await resetVendorPasswordWithToken(token, password);
      return reply.send({ ok: true });
    } catch (err) {
      if (err instanceof InvalidResetTokenError) {
        return reply.status(400).send({ error: { message: "Bağlantının süresi dolmuş veya geçersiz, lütfen tekrar deneyin" } });
      }
      throw err;
    }
  });

  app.post("/vendor/auth/logout", { preHandler: app.csrfProtection }, async (request, reply) => {
    delete request.session.vendorId;
    return reply.send({ ok: true });
  });

  // bkz. auth.routes.ts /auth/logout - düz link tabanlı, JS'e bağımlı değil.
  app.get("/vendor/auth/logout", async (request, reply) => {
    delete request.session.vendorId;
    return reply.redirect("/satici/giris");
  });

  app.get("/vendor/auth/me", { preHandler: app.requireVendor }, async (request, reply) => {
    const vendor = await findVendorById(request.session.vendorId!);
    if (!vendor) {
      return reply.status(404).send({ error: { message: "Satıcı bulunamadı" } });
    }
    return reply.send(publicVendor(vendor));
  });

  // vendor/store.php (Mağaza Profili) + vendor/settings.php (Ayarlar) formlarının
  // birleşik karşılığı - hangi sayfa hangi alt küme alanı gönderirse yalnızca
  // onlar güncellenir.
  app.patch("/vendor/auth/me", { preHandler: [app.requireVendor, app.csrfProtection] }, async (request, reply) => {
    const input = updateVendorProfileSchema.parse(request.body);
    try {
      const vendor = await updateVendorAccount(request.session.vendorId!, input);
      return reply.send(publicVendor(vendor));
    } catch (err) {
      if (err instanceof WrongCurrentPasswordError) {
        return reply.status(400).send({ error: { message: "Mevcut şifrenizi hatalı girdiniz" } });
      }
      throw err;
    }
  });

  // bkz. kullanıcı isteği (2026-08-02): "satıcı üyelik iptali olacak" -
  // bekleyen siparişi varsa engellenir, ürünü hiç yoksa kalıcı silinir,
  // varsa "closed" durumuna alınıp ürünleri pasife düşer (bkz.
  // vendor-auth.service.ts closeVendorSelfAccount).
  app.delete("/vendor/auth/me", { preHandler: [app.requireVendor, app.csrfProtection] }, async (request, reply) => {
    try {
      await closeVendorSelfAccount(request.session.vendorId!);
      await request.session.destroy();
      return reply.send({ ok: true });
    } catch (err) {
      if (err instanceof VendorHasOpenOrdersError) {
        return reply.status(409).send({
          error: { message: "Bekleyen/tamamlanmamış siparişleriniz olduğu için hesabınızı kapatamazsınız. Önce bu siparişleri tamamlayın." },
        });
      }
      if (err instanceof VendorNotFoundError) {
        return reply.status(404).send({ error: { message: "Satıcı bulunamadı" } });
      }
      throw err;
    }
  });

  // Mağaza Profili sayfasındaki logo/kapak görseli yükleme - store-layout
  // slider yüklemesiyle aynı desen (bkz. admin-sliders.routes.ts).
  for (const field of ["logo", "coverImage"] as const) {
    const path = field === "logo" ? "/vendor/profile/logo" : "/vendor/profile/cover";
    app.post(path, { preHandler: [app.requireVendor, app.csrfProtection] }, async (request, reply) => {
      const file = await request.file();
      if (!file) {
        return reply.status(400).send({ error: { message: "Görsel dosyası gerekli" } });
      }
      const buffer = await file.toBuffer();
      try {
        const url = await saveImage(`vendors/${request.session.vendorId}`, buffer, file.mimetype);
        const vendor = await updateVendorProfile(request.session.vendorId!, { [field]: url });
        return reply.send(publicVendor(vendor));
      } catch (err) {
        if (err instanceof InvalidImageError) {
          return reply.status(400).send({ error: { message: err.message } });
        }
        throw err;
      }
    });
  }
};

export default vendorAuthRoutes;
