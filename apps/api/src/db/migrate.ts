import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./client";

async function main() {
  await migrate(db, { migrationsFolder: "../../infra/postgres/migrations" });
  await pool.end();
  console.log("Migration'lar uygulandı.");
}

main().catch((err) => {
  console.error("Migration başarısız:", err);
  process.exit(1);
});
