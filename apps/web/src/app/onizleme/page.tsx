import Link from "next/link";
import ProductCard from "@/components/product-card";
import type { ProductListItem } from "@/lib/types";

// GEÇİCİ önizleme (API'siz) - GERÇEK anasayfa yapısının (gulumsalim.com /
// (site)/page.tsx) GERÇEK global class'larıyla birebir kopyası. Amaç:
// globals.css elevasyonlarını gerçek sayfayı bozmadan görsel doğrulamak.
// (site) grubunun DIŞINDA olduğundan API'ye bağımlı değil.

const NAMES = ["Çiçekli Elbise", "Saten Gömlek", "Palazzo Pantolon", "Triko Hırka", "İpek Eşarp", "Dantel Bluz", "Blazer Ceket", "Midi Etek", "Kaşmir Kazak", "Tül Etek"];
function mock(i: number): ProductListItem {
  const price = 259.9 + i * 40;
  const onSale = i % 3 === 0;
  return {
    id: i + 1, name: NAMES[i % NAMES.length]!, slug: `urun-${i + 1}`,
    basePrice: price.toFixed(2), compareAtPrice: onSale ? (price * 1.4).toFixed(2) : null,
    createdAt: new Date(Date.now() - i * 3600_000).toISOString(),
    vendorStoreName: ["Moda Butik", "Ela Concept", "Nar Çiçeği", "Beyaz Zambak"][i % 4]!,
    vendorSlug: "magaza", categorySlug: "elbise",
    primaryImageUrl: `https://picsum.photos/seed/gh${i + 1}/500/667`,
    imageUrls: [`https://picsum.photos/seed/gh${i + 1}/500/667`, `https://picsum.photos/seed/ghb${i + 1}/500/667`],
    avgRating: i % 2 === 0 ? 4.6 : null, reviewCount: i * 4,
    viewCount: 120 + i * 20, favoriteCount: 6 + i * 3, purchaseCount: i % 3 === 0 ? 18 + i : 0,
    cartCount: 0, isSecondHand: i === 4,
  };
}
const products = Array.from({ length: 10 }, (_, i) => mock(i));
const CATS = [
  { n: "Elbise", s: "gc-dress" }, { n: "Bluz & Gömlek", s: "gc-blouse" }, { n: "Alt Giyim", s: "gc-pants" },
  { n: "Dış Giyim", s: "gc-coat" }, { n: "Aksesuar", s: "gc-acc" },
];

function ProductRow({ tag, title, subtitle, cta, items }: { tag: string; title: string; subtitle?: string; cta: string; items: ProductListItem[] }) {
  return (
    <section className="products-section">
      <div className="container">
        <div className="section-scroll-shell">
          <div className="section-header section-header-flex">
            <div>
              <span className="section-tag">{tag}</span>
              <h2 className="section-title">{title}</h2>
              {subtitle && <p className="section-subtitle">{subtitle}</p>}
            </div>
            <Link href="/urunler" className="section-cta">{cta} <i className="fas fa-arrow-right" /></Link>
          </div>
          <div className="product-grid hscroll">
            {items.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function HomeReplicaPreview() {
  return (
    <main className="main-content">
      {/* HERO (fallback stili) */}
      <section className="hero-section">
        <div className="hero-slide active" style={{ background: "linear-gradient(135deg,#f7f5f1,#eeebe5 60%,#ebe4da)" }}>
          <div className="hero-content">
            <span className="hero-tag"><i className="fas fa-gem" /> Yeni Sezon</span>
            <h1 className="hero-title">Kadının <span>Gücü</span>,<br />zarafetiyle</h1>
            <p className="hero-subtitle">Özenle seçilmiş butiklerden binlerce parça — tarzını tamamla.</p>
            <div className="hero-actions">
              <Link href="/urunler" className="btn btn-primary btn-lg">Keşfetmeye Başla</Link>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST STRIP */}
      <div className="trust-strip">
        <div className="container">
          <div className="trust-strip-inner">
            {[["fa-shipping-fast", "Hızlı Kargo"], ["fa-undo", "14 Gün İade"], ["fa-lock", "Güvenli Ödeme"], ["fa-headset", "7/24 Destek"]].map(([ic, t]) => (
              <div key={t} className="trust-strip-item"><i className={`fas ${ic}`} /> <strong>{t}</strong></div>
            ))}
          </div>
        </div>
      </div>

      <ProductRow tag="Senin İçin" title="Beğenebileceğin Ürünler" subtitle="Zevkine göre seçtik" cta="Tümünü Gör" items={products.slice(0, 6)} />

      {/* KATEGORİLER */}
      <section className="categories-section">
        <div className="container">
          <div className="section-header">
            <span className="section-tag">Koleksiyonlarımız</span>
            <h2 className="section-title">Kategorilere Göre Alışveriş</h2>
            <p className="section-subtitle">Stilinize en uygun parçaları keşfedin</p>
          </div>
          <div className="category-grid hcat-grid" style={{ display: "flex", gap: 20, overflowX: "auto" }}>
            {CATS.map((c) => (
              <Link key={c.n} href="/urunler" className="hcat-card">
                <div className="hcat-img-wrap">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`https://picsum.photos/seed/${c.s}/300/380`} alt={c.n} className="hcat-img" />
                  <div className="hcat-overlay" />
                  <span className="hcat-name">{c.n}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <ProductRow tag="Fırsatlar" title="İndirimli Ürünler" cta="Tümünü Gör" items={products.slice(3, 9)} />
      <ProductRow tag="Popüler" title="Çok Satanlar" cta="Tümünü Gör" items={products.slice(1, 7)} />

      {/* JOIN CTA */}
      <section className="join-cta-section">
        <div className="container">
          <div className="join-cta-card-wide">
            <div className="join-cta-wide-text">
              <span className="join-cta-eyebrow">Ücretsiz Üyelik</span>
              <h3>Üye Ol, Ayrıcalıkları Kaçırma</h3>
              <Link href="/kayit" className="btn btn-lg join-cta-btn-light">Ücretsiz Üye Ol</Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
