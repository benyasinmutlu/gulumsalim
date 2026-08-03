ALTER TABLE "vendors" ADD COLUMN "email_verified_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "email_verification_token_hash" text;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "email_verification_expires_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "email_verification_token_hash" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "email_verification_expires_at" timestamp (3) with time zone;--> statement-breakpoint
-- E-posta doğrulaması artık zorunlu (bkz. kullanıcı isteği), ama bu kısıtlama
-- YENİ kayıtlar için geçerli olmalı - zaten var olan gerçek hesapları
-- (bu alan daha önce hiç kullanılmıyordu, hepsi NULL) geriye dönük kilitlemek
-- yıkıcı olurdu. Mevcut tüm satırlar "doğrulanmış" sayılır.
UPDATE "vendors" SET "email_verified_at" = "created_at" WHERE "email_verified_at" IS NULL;--> statement-breakpoint
UPDATE "customers" SET "email_verified_at" = "created_at" WHERE "email_verified_at" IS NULL;