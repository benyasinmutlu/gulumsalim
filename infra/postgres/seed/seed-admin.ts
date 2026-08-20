// İlk admin hesabını oluşturur. Public bir kayıt formu kasıtlı olarak
// yok - admin hesapları sadece bu script ile, sunucuya doğrudan erişimi
// olan biri tarafından eklenebilir.
//
// Kullanım: ADMIN_USERNAME=admin ADMIN_PASSWORD=güçlü-bir-şifre pnpm db:seed:admin
import bcrypt from "bcryptjs";
import { db, pool } from "../../../apps/api/src/db/client";
import { adminUsers } from "../../../apps/api/src/db/schema/index";

async function main() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  const fullName = process.env.ADMIN_FULL_NAME ?? "Admin";

  if (!username || !password) {
    console.error("ADMIN_USERNAME ve ADMIN_PASSWORD ortam değişkenleri gerekli.");
    console.error("Örnek: ADMIN_USERNAME=admin ADMIN_PASSWORD=... pnpm db:seed:admin");
    process.exit(1);
  }
  if (password.length < 12) {
    console.error("ADMIN_PASSWORD en az 12 karakter olmalı.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await db
    .insert(adminUsers)
    .values({ username, passwordHash, fullName })
    .onConflictDoNothing({ target: adminUsers.username });

  console.log(`Admin "${username}" oluşturuldu (veya zaten vardı).`);
  await pool.end();
}

main().catch((err) => {
  console.error("Admin seed hatası:", err);
  process.exit(1);
});
