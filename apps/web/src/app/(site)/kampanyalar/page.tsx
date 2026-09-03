import type { Metadata } from "next";
import Link from "next/link";
import { apiFetchJson } from "@/lib/api";
import type { ActiveCampaign, Category, ProductListItem, ResolvedHomepageSection } from "@/lib/types";
import TitleBackgroundIcons from "@/components/title-background-icons";
import PromoBannerImage from "@/components/promo-banner-image";
import PromoBannerLink from "@/components/promo-banner-link";
import PromoBannerImpression from "@/components/promo-banner-impression";
import CategoryDealShelf from "@/components/category-deal-shelf";

export const metadata: Metadata = {
  title: "Kampanyalar | Gülüm Şalım",
  description: "Gülüm Şalım'daki tüm kampanyaları ve kategori bazlı indirimleri keşfedin.",
};

async function getCategories(): Promise<Category[]> {
  try {
    return await apiFetchJson<Category[]>("/categories");
  } catch {
    return [];
  }
}

async function getHomepageSections(): Promise<ResolvedHomepageSection[]> {
  try {
    return await apiFetchJson<ResolvedHomepageSection[]>("/homepage-sections");
  } catch {
    return [];
  }
}

async function getSaleProducts(): Promise<ProductListItem[]> {
  try {
    const res = await apiFetchJson<{ items: ProductListItem[] }>("/products?saleOnly=true&limit=50");
    return res.items;
  } catch {
    return [];
  }
}

async function getActiveCampaigns(): Promise<ActiveCampaign[]> {
  try {
    return await apiFetchJson<ActiveCampaign[]>("/campaigns");
  } catch {
    return [];
  }
}

// bkz. kullanıcı isteği (2026-08-02): "kampanyalar bölümüne düzenleme getir" -
// nav'daki "Kampanyalar" linki önceden sadece /urunler?saleOnly=true'ya
// gidiyordu, ayrı bir sayfa/deneyim yoktu. Yeni bir "kampanya" veritabanı
// tablosu/admin CRUD'u eklemek yerine (büyük, ayrı bir iş), MEVCUT iki veri
// kaynağı birleştiriliyor: admin'in zaten yönetebildiği homepage promo_banners
// bölümleri (tam kampanya banner'ları) + kategoriye göre gruplanmış GERÇEK
// indirimli ürünler (bkz. category-deal-shelf.tsx - "1 ÜRÜNDE İNDİRİM" rozetli
// fotoğraf kartı yerine, her kategori için ürünlerin kendisini gösteren raf).
// bkz. kullanıcı isteği (2026-08-02): "kampanyalar sayfası aynı kalsın,
// sadece anasayfa için" - anasayfadaki önizleme artık tüm ürünleri
// gösteriyor (bkz. (site)/page.tsx), ama bu sayfa kasıtlı olarak SADECE
// indirimli ürünlerle sınırlı kalıyor (adı zaten "Kampanyalar").
export default async function CampaignsPage() {
  const [categories, sections, saleProducts, activeCampaigns] = await Promise.all([
    getCategories(),
    getHomepageSections(),
    getSaleProducts(),
    getActiveCampaigns(),
  ]);

  const banners = sections.filter((s) => s.algoType === "promo_banners").flatMap((s) => s.banners ?? []);

  const productsByCategory = new Map<string, ProductListItem[]>();
  for (const p of saleProducts) {
    const list = productsByCategory.get(p.categorySlug);
    if (list) list.push(p);
    else productsByCategory.set(p.categorySlug, [p]);
  }
  const categoryShelves = categories
    .filter((c) => productsByCategory.has(c.slug))
    .map((c) => ({ category: c, products: productsByCategory.get(c.slug)! }))
    .sort((a, b) => b.products.length - a.products.length);

  return (
    <main className="main-content">
      <TitleBackgroundIcons icon="fa-bullhorn" />
      <div className="container products-page">
        <h1 className="products-page-title">Kampanyalar</h1>

        {banners.length === 0 && categoryShelves.length === 0 && activeCampaigns.length === 0 ? (
          <div className="empty-state empty-state-card">
            <i className="fas fa-tag" aria-hidden />
            <h2>Yeni kampanyalar hazırlanıyor</h2>
            <p>Bu sırada yeni gelen ve fiyatı düşen ürünleri keşfedebilirsiniz.</p>
            <Link href="/urunler?sort=newest" className="btn btn-primary">
              Ürünleri Keşfet
            </Link>
          </div>
        ) : (
          <>
            {activeCampaigns.length > 0 && (
              <section className="vstore-section campaign-list-section">
                <div className="vstore-section-title">
                  <i className="fas fa-bullhorn" /> Aktif Kampanyalar
                </div>
                <div className="discount-tiers-grid">
                  {activeCampaigns.map((campaign) => (
                    <article key={campaign.id} className="discount-tier-card">
                      <div className="discount-tier-percent">
                        {campaign.type === "percent" ? `%${campaign.value}` : <i className="fas fa-truck" aria-hidden />}
                      </div>
                      <strong className="discount-tier-label">{campaign.name}</strong>
                      <span className="campaign-card-meta">
                        {[
                          campaign.type === "free_shipping" ? "Ücretsiz Kargo" : null,
                          campaign.minOrderAmount ? `${campaign.minOrderAmount.toLocaleString("tr-TR")} ₺ üzeri` : null,
                          campaign.endsAt ? `${new Date(campaign.endsAt).toLocaleDateString("tr-TR")} tarihine kadar` : null,
                        ].filter(Boolean).join(" · ")}
                      </span>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {banners.length > 0 && (
              <section className="vstore-section" style={{ marginBottom: 32 }}>
                <div className="vstore-section-title">
                  <i className="fas fa-star" /> Öne Çıkan Kampanyalar
                </div>
                <div className="promo-grid">
                  {banners.map((b) => (
                    <PromoBannerImpression key={b.id} bannerId={b.id}>
                      <PromoBannerLink bannerId={b.id} href={b.resolvedLink ?? "/urunler"} className="promo-card">
                        <PromoBannerImage
                          className="promo-card-img"
                          images={[b.image, ...(b.extraImages ?? [])]}
                          rotateSeconds={b.rotateSeconds}
                          alt={b.title}
                        />
                        <div className="promo-card-overlay" />
                        <div className="promo-content" style={{ color: b.textColor ?? undefined }}>
                          <h3 style={{ color: b.textColor ?? undefined }}>{b.title}</h3>
                          {b.subtitle && <p>{b.subtitle}</p>}
                          {b.buttonText && <span className="btn btn-sm btn-primary promo-cta">{b.buttonText}</span>}
                        </div>
                      </PromoBannerLink>
                    </PromoBannerImpression>
                  ))}
                </div>
              </section>
            )}

            {categoryShelves.length > 0 && (
              <section className="vstore-section">
                <div className="vstore-section-title">
                  <i className="fas fa-tags" /> Kategoriye Göre Kampanyalar
                </div>
                {categoryShelves.map(({ category, products }) => (
                  <CategoryDealShelf
                    key={category.id}
                    category={category}
                    products={products}
                    href={`/${category.slug}?saleOnly=true`}
                  />
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
