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

  // Sifremi unuttum e-postalari icin (bkz. lib/mailer.ts) - info@gulumsalim.com
  // kutusu uzerinden STARTTLS ile gonderiliyor.
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().min(1),
  SMTP_PASS: z.string().min(1),
  SMTP_FROM: z.string().min(1),
});

// Parsed once at boot. Fails fast with a readable error if the environment
// is misconfigured, instead of surfacing as a confusing runtime error later.
export const env = envSchema.parse(process.env);
export type Env = typeof env;
