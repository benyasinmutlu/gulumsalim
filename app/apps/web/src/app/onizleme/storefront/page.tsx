import Link from "next/link";
import ProductCard from "@/components/product-card";
import SectionHeading from "@/components/storefront/section-heading";
import type { ProductListItem } from "@/lib/types";
import styles from "@/components/storefront/storefront.module.css";

// GEÇİCİ önizleme (API'siz) - STOREFRONT ("ana dashboard") premium tasarımı.
// Onaylanınca gerçek (site)/page.tsx'e (veya /kesfet'e) bağlanır.

const NAMES = ["Çiçekli Yazlık Elbise", "Saten V-Yaka Gömlek", "Palazzo Pantolon", "Triko Hırka", "İpek Eşarp", "Dantel Bluz", "Blazer Ceket", "Midi Etek"];
function mock(i: number): ProductListItem {
  const price = 259.9 + i * 45;
  const onSale = i % 2 === 0;
  return {
    id: i + 1,
    name: NAMES[i % NAMES.length]!,
    slug: `urun-${i + 1}`,
    basePrice: price.toFixed(2),
    compareAtPrice: onSale ? (price * 1.4).toFixed(2) : null,
    createdAt: new Date(Date.now() - i * 3600_000).toISOString(),
    vendorStoreName: ["Moda Butik", "Ela Concept", "Nar Çiçeği", "Beyaz Zambak"][i % 4]!,
    vendorSlug: "magaza",
    categorySlug: "elbise",
    primaryImageUrl: `https://picsum.photos/seed/gsf${i + 1}/500/667`,
    imageUrls: [`https://picsum.photos/seed/gsf${i + 1}/500/667`, `https://picsum.photos/seed/gsfb${i + 1}/500/667`],
    avgRating: i % 2 === 0 ? 4.6 : null,
    reviewCount: i * 4,
    viewCount: 120 + i * 20,
    favoriteCount: 6 + i * 3,
    purchaseCount: i % 3 === 0 ? 18 + i : 0,
    cartCount: 0,
    isSecondHand: i === 4,
  };
}
const products = Array.from({ length: 8 }, (_, i) => mock(i));

const CATEGORIES = [
  { name: "Elbise", seed: "cat-dress" },
  { name: "Bluz & Gömlek", seed: "cat-blouse" },
  { name: "Alt Giyim", seed: "cat-pants" },
  { name: "Dış Giyim", seed: "cat-coat" },
  { name: "Aksesuar", seed: "cat-acc" },
];

export default function StorefrontPreview() {
  return (
    <div className={styles.page}>
      <div className="container" style={{ paddingTop: "1.75rem" }}>
        {/* ===== KAMPANYA HERO (admin slider'ının premium karşılığı) ===== */}
        <div className={styles.campaign}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="https://picsum.photos/seed/gs-campaign/1600/560" alt="Yeni sezon kampanyası" />
          <div className={styles.campaignOverlay} />
          <div className={styles.campaignText}>
            <div className={styles.headEyebrow}>Yeni Sezon</div>
            <h2>Sonbaharın en zarif parçaları</h2>
            <Link href="/urunler" className={styles.btnPrimary}>
              Alışverişe Başla <i className="fas fa-arrow-right" />
            </Link>
          </div>
        </div>
      </div>

      {/* ===== TRUST BAND ===== */}
      <section className={styles.section} style={{ paddingBottom: 0 }}>
        <div className="container">
          <div className={styles.trust}>
            {[
              { icon: "fa-shipping-fast", t: "Hızlı & Güvenilir Kargo", s: "Siparişlerin özenle yola çıkar" },
              { icon: "fa-undo", t: "14 Gün Koşulsuz İade", s: "Beğenmezsen kolayca iade et" },
              { icon: "fa-lock", t: "Güvenli Ödeme", s: "256-bit SSL ile korunur" },
              { icon: "fa-headset", t: "Yanındayız", s: "Her adımda destek" },
            ].map((it) => (
              <div key={it.t} className={styles.trustItem}>
                <span className={styles.trustIcon}>
                  <i className={`fas ${it.icon}`} />
                </span>
                <div>
                  <b>{it.t}</b>
                  <small>{it.s}</small>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== SENİN İÇİN (kişiselleştirme / discovery) ===== */}
      <section className={styles.section}>
        <div className="container">
          <SectionHeading eyebrow="Senin için" title="Yasin, sana özel seçtik" subtitle="Zevkine ve son gezdiklerine göre." ctaHref="/sana-ozel" />
          <div className={styles.gridWrap}>
            {products.slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </section>

      {/* ===== KATEGORİ BENTO ===== */}
      <section className={`${styles.section} ${styles.sectionAlt}`}>
        <div className="container">
          <SectionHeading eyebrow="Koleksiyonlar" title="Kategorilere göre keşfet" ctaHref="/urunler" />
          <div className={styles.bento}>
            {CATEGORIES.map((c) => (
              <Link key={c.name} href="/urunler" className={styles.bentoTile}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`https://picsum.photos/seed/${c.seed}/600/600`} alt={c.name} />
                <div className={styles.bentoOverlay} />
                <div className={styles.bentoLabel}>
                  <b>{c.name}</b>
                  <span>
                    Keşfet <i className="fas fa-arrow-right" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ===== İNDİRİMLİ ÜRÜNLER ===== */}
      <section className={styles.section}>
        <div className="container">
          <SectionHeading eyebrow="Fırsatlar" title="İndirimli ürünler" ctaHref="/urunler?saleOnly=true" />
          <div className={styles.gridWrap}>
            {products.slice(4, 8).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </section>

      {/* ===== JOIN BAND ===== */}
      <section className={styles.section}>
        <div className="container">
          <div className={`${styles.band} ${styles.grain}`}>
            <div className={styles.bandEyebrow}>Ücretsiz Üyelik</div>
            <h2 className={styles.bandTitle}>Ayrıcalıklar seni bekliyor</h2>
            <p className={styles.bandLede}>
              Üye ol; favorilerini kaydet, siparişini adım adım takip et, mağazaları takip et — öneriler sana göre şekillensin.
            </p>
            <Link href="/kayit" className={styles.bandBtn}>
              Ücretsiz Üye Ol <i className="fas fa-arrow-right" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
