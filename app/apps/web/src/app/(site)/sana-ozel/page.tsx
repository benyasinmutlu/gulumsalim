import Link from "next/link";
import { apiFetchJson } from "@/lib/api";
import type { Category, CustomerProfile, ProductListItem, TopViewedCategory } from "@/lib/types";
import ProductCard from "@/components/product-card";
import HscrollArrows from "@/components/hscroll-arrows";
import { CategoryNavSync } from "@/components/category-nav-context";

interface DiscoverFeed {
  items: ProductListItem[];
  strategy: "personalized" | "cold_start" | "unavailable";
}

interface TrendingFeed {
  mostViewed: ProductListItem[];
  bestSellers: ProductListItem[];
  topCategories: TopViewedCategory[];
}

async function getDiscoverFeed(): Promise<DiscoverFeed> {
  try {
    return await apiFetchJson<DiscoverFeed>("/discover");
  } catch {
    return { items: [], strategy: "unavailable" };
  }
}

async function getTrendingFeed(): Promise<TrendingFeed> {
  try {
    return await apiFetchJson<TrendingFeed>("/discover/trending");
  } catch {
    return { mostViewed: [], bestSellers: [], topCategories: [] };
  }
}

async function getCurrentCustomer(): Promise<CustomerProfile | null> {
  try {
    return await apiFetchJson<CustomerProfile>("/auth/me");
  } catch {
    return null;
  }
}

async function getAllCategories(): Promise<Category[]> {
  try {
    return await apiFetchJson<Category[]>("/categories");
  } catch {
    return [];
  }
}

function ProductRow({ title, subtitle, products }: { title: string; subtitle?: string; products: ProductListItem[] }) {
  if (products.length === 0) return null;
  return (
    <section className="products-section">
      <div className="container">
        <div className="section-scroll-shell">
          <div className="section-header">
            <h2 className="section-title">{title}</h2>
            {subtitle && <p className="section-subtitle">{subtitle}</p>}
          </div>
          <HscrollArrows>
            <div className="product-grid hscroll">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </HscrollArrows>
        </div>
      </div>
    </section>
  );
}

// Anasayfadaki "Senin İçin"/"Beğenebileceğin Ürünler" satırının "Tümünü
// Gör" hedefi - /urunler?sort=... gibi genel bir filtreye değil, kendi
// temiz URL'ine (gulumsalim.com'daki seo_slug mantığının karşılığı).
//
// bkz. kullanıcı isteği: "müşteri giriş yapmışsa yasin, sana özel ürünler
// olsun ... daha önce baktığı favorilediği ya da baktığı kategorilerden
// liste yap ... sonra altında en çok bakılan ürünler kategoriler ...
// diğer bölümler için de algoritma oluştur ... headerın kategorilerini
// gizle filtrenin kategorileri ise listelenen ürünlere göre olsun" -
// kişiselleştirilmiş isim başlığı + altında algoritmik satırlar eklendi,
// header'daki kategori menüsü bu sayfada sadece fiilen listelenen
// ürünlerin kategorileriyle sınırlanıyor (bkz. CategoryNavSync).
export default async function SanaOzelPage() {
  const [feed, trending, customer, allCategories] = await Promise.all([
    getDiscoverFeed(),
    getTrendingFeed(),
    getCurrentCustomer(),
    getAllCategories(),
  ]);

  const firstName = customer?.fullName.split(" ")[0];
  const heading =
    customer && feed.strategy === "personalized"
      ? `${firstName}, Sana Özel`
      : feed.strategy === "personalized"
        ? "Senin İçin"
        : "Sana Özel Ürünler";

  const relevantCategorySlugs = new Set(feed.items.map((p) => p.categorySlug));
  const relevantCategories = allCategories.filter((c) => relevantCategorySlugs.has(c.slug));

  return (
    <main className="main-content">
      <CategoryNavSync categories={relevantCategories} />
      <div className="breadcrumb-bar">
        <div className="container">
          <div className="breadcrumb">
            <Link href="/">Ana Sayfa</Link> <span className="sep">{">"}</span> <span className="current">{heading}</span>
          </div>
        </div>
      </div>

      <div className="container products-page">
        <h1 className="products-page-title">{heading}</h1>
        <p className="section-subtitle" style={{ marginBottom: "1.5rem" }}>
          İlgi alanlarınıza, baktığınız/favorilediğiniz ürün ve kategorilere göre seçildi
        </p>

        {feed.items.length === 0 ? (
          <p className="empty-state">Şu an için önerebileceğimiz bir ürün yok, alışverişe devam ettikçe burası dolacak.</p>
        ) : (
          <div className="product-grid">
            {feed.items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>

      {trending.topCategories.length > 0 && (
        <section className="categories-section">
          <div className="container">
            <div className="section-header">
              <h2 className="section-title">En Çok İlgi Gören Kategoriler</h2>
            </div>
            <HscrollArrows>
              <div className="category-grid hcat-grid">
                {trending.topCategories.map((c) => (
                  <Link key={c.id} href={`/${c.slug}`} className="hcat-card">
                    <div className="hcat-img-wrap">
                      {c.image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.image} alt={c.name} className="hcat-img" />
                      )}
                      <div className="hcat-overlay" />
                      <span className="hcat-name">{c.name}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </HscrollArrows>
          </div>
        </section>
      )}

      <ProductRow title="Çok Satanlar" subtitle="En çok tercih edilen ürünler" products={trending.bestSellers} />
      <ProductRow title="En Çok Bakılan Ürünler" products={trending.mostViewed} />
    </main>
  );
}
