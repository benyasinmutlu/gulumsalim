// Footer'da gösterilen site tanıtım metni. gulumsalim.com'un footer.php'sindeki
// varsayılan değerle aynı - iletişim bilgisi (e-posta/telefon/sosyal medya)
// eski sitede de hiç doldurulmamıştı (placeholder değerler vardı), bu yüzden
// burada da uydurma veri seed edilmiyor; footer bileşeni eksik alanları
// (eski siteyle aynı mantıkla) koşullu olarak gizler.
import { db, pool } from "../../../apps/api/src/db/client";
import { settings } from "../../../apps/api/src/db/schema/index";

const DEFAULTS: Record<string, string> = {
  footer_about: "Şıklığınızı tamamlayan, her tarza uygun kadın giyim ürünleri.",
};

async function main() {
  for (const [key, value] of Object.entries(DEFAULTS)) {
    await db.insert(settings).values({ key, value }).onConflictDoNothing({ target: settings.key });
  }
  console.log(`${Object.keys(DEFAULTS).length} ayar seed edildi (varsa mevcutlar atlandı).`);
  await pool.end();
}

main().catch((err) => {
  console.error("Ayar seed hatası:", err);
  process.exit(1);
});
