import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  SESSION_SECRET: z.string().min(32),

  MEILISEARCH_URL: z.string().url(),
  MEILISEARCH_API_KEY: z.string().min(1),

  DISCOVERY_SERVICE_URL: z.string().url(),
  DISCOVERY_SERVICE_SECRET: z.string().min(1),

  IYZICO_API_KEY: z.string().min(1),
  IYZICO_SECRET_KEY: z.string().min(1),
  IYZICO_BASE_URL: z.string().url(),

  // iyzico'nun ödeme sonucu POST-back yapacağı, dışarıdan erişilebilir tam
  // origin (örn. https://www.gulumsalim.com). Callback URL'i bunu kullanır.
  SITE_URL: z.string().url(),

  UPLOADS_DIR: z.string().default("./uploads"),

  // Görsel/video deposu. Varsayılan "local" (UPLOADS_DIR'e yazar, /uploads/..
  // döner). "s3" seçilirse aşağıdaki S3_* değerleri kullanılır (lib/storage.ts).
  // S3'e geçiş SADECE bu env'lerle olur - uygulama kodu değişmeden.
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_URL: z.string().url().optional(),

  // Tum transactional e-postalar (sifremi unuttum, siparis onayi, kargo
  // durumu, sepet hatirlatma, kisiye ozel oneriler) Resend API'si uzerinden
  // gonderiliyor - bkz. lib/mailer.ts. SMTP_FROM adi "Ad <email>" formatinda
  // (orn. "Gulum Salim <info@gulumsalim.com>") - gonderen domain Resend
  // panelinde dogrulanmis olmali, aksi halde gonderim reddedilir.
  RESEND_API_KEY: z.string().min(1),
  SMTP_FROM: z.string().min(1),

  // "Google ile giriş yap" (bkz. auth.service.ts loginWithGoogle/registerWithGoogle).
  // Optional - diğer required env'lerin aksine boşsa uygulama açılmayı
  // reddetmez, sadece /auth/google/* uçları 503 döner (bkz. auth.routes.ts) ve
  // google-signin-button.tsx NEXT_PUBLIC_GOOGLE_CLIENT_ID yoksa butonu hiç
  // göstermez - özellik yapılandırılmamışken sessizce devre dışı kalır.
  GOOGLE_CLIENT_ID: z.string().optional(),
});

// Parsed once at boot. Fails fast with a readable error if the environment
// is misconfigured, instead of surfacing as a confusing runtime error later.
export const env = envSchema.parse(process.env);
export type Env = typeof env;
