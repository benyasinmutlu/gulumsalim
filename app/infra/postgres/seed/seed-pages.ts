// gulumsalim.com'un about.php/contact.php sayfalarındaki gerçek metinden
// aktarılmış içerik (FTP ile indirilip incelendi, 2026-07-20). Bu sayfalar
// eski sitede ayrı sabit-kodlu route'lardı; burada genel CMS `pages`
// tablosuna taşınıp footer/top-bar linklerinin dolu bir hedefi olması
// sağlanıyor.
import { db, pool } from "../../../apps/api/src/db/client";
import { pages } from "../../../apps/api/src/db/schema/index";

const PAGES = [
  {
    slug: "hakkimizda",
    title: "Hakkımızda",
    content: `Bizim Hikayemiz

Gülüm Şalım, kadın giyiminde şıklığı, zarafeti ve konforu bir araya getirmek amacıyla yola çıkan genç ve dinamik bir markadır. Her kadının kendini özel ve güvende hissetmesini sağlayacak modern tasarımları en kaliteli kumaşlarla buluşturuyoruz.

Modayı yakından takip eden tasarım ekibimizle her sezon benzersiz, dikişi ve kalıbı kusursuz koleksiyonlar sunuyoruz. Cildinize dost, doğal elyaf ve nefes alabilen pamuk/keten dokumaları tercih ederek uzun ömürlü kıyafetler üretiyoruz.

Sadece satış anında değil, kargo teslimatından kolay iade süreçlerine kadar her aşamada %100 yanınızdayız. Kredi kartı verilerinizin güvenliği için uluslararası PCI-DSS standartlarında iyzico altyapısını kullanıyoruz.`,
    sortOrder: 1,
  },
  {
    slug: "iletisim",
    title: "İletişim",
    content: `Bize Ulaşın

Sorularınız, önerileriniz ya da sipariş süreçlerinizle ilgili her konuda size yardımcı olmaktan mutluluk duyarız.

Destek ekibimiz hafta içi 09:00 - 18:00 saatleri arasında hizmet vermektedir.`,
    sortOrder: 2,
  },
];

async function main() {
  for (const p of PAGES) {
    await db.insert(pages).values(p).onConflictDoNothing({ target: pages.slug });
  }
  console.log(`${PAGES.length} sayfa seed edildi (varsa mevcutlar atlandı).`);
  await pool.end();
}

main().catch((err) => {
  console.error("Sayfa seed hatası:", err);
  process.exit(1);
});
