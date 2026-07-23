import { FastifyPluginAsync } from "fastify";
import { InvalidImageError, saveImage } from "../../lib/image-upload";
import { findVendorById, updateVendorProfile } from "./vendor.repository";
import { updateVendorProfileSchema, vendorLoginSchema, vendorRegisterSchema } from "./vendor-auth.schemas";
import {
  EmailInUseError,
  InvalidCredentialsError,
  registerVendor,
  SlugInUseError,
  updateVendorAccount,
  VendorBannedError,
  verifyVendorCredentials,
  WrongCurrentPasswordError,
} from "./vendor-auth.service";

function publicVendor(v: {
  id: number;
  storeName: string;
  storeSlug: string;
  email: string;
  status: string;
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
}) {
  const {
    id, storeName, storeSlug, email, status, fullName, phone, logo, about, coverImage, city,
    whatsapp, instagram, facebook, twitter, youtube, tiktok, website, seoTitle, seoDescription,
    bankName, bankIban, bankAccountHolder,
  } = v;
  return {
    id, storeName, storeSlug, email, status, fullName, phone, logo, about, coverImage, city,
    whatsapp, instagram, facebook, twitter, youtube, tiktok, website, seoTitle, seoDescription,
    bankName, bankIban, bankAccountHolder,
  };
}

const vendorAuthRoutes: FastifyPluginAsync = async (app) => {
  app.post("/vendor/auth/register", { preHandler: app.csrfProtection }, async (request, reply) => {
    const input = vendorRegisterSchema.parse(request.body);
    try {
      const vendor = await registerVendor(input);
      request.session.vendorId = vendor.id;
      return reply.status(201).send(publicVendor(vendor));
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

  app.post("/vendor/auth/login", { preHandler: app.csrfProtection }, async (request, reply) => {
    const input = vendorLoginSchema.parse(request.body);
    try {
      const vendor = await verifyVendorCredentials(input);
      request.session.vendorId = vendor.id;
      return reply.send(publicVendor(vendor));
    } catch (err) {
      if (err instanceof InvalidCredentialsError) {
        return reply.status(401).send({ error: { message: "E-posta veya şifre hatalı" } });
      }
      if (err instanceof VendorBannedError) {
        return reply.status(403).send({ error: { message: "Bu satıcı hesabı yasaklanmış" } });
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
