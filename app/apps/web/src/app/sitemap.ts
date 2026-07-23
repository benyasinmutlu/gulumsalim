import type { MetadataRoute } from "next";
import { apiFetchJson } from "@/lib/api";
import { SITE_ORIGIN } from "@/lib/env";
import { productUrl } from "@/lib/types";
import type { Category, ProductListResponse, PublicVendorListItem } from "@/lib/types";

interface FooterPage {
  slug: string;
  title: string;
}

async function fetchAllProducts(): Promise<ProductListResponse["items"]> {
  const items: ProductListResponse["items"] = [];
  let cursor: string | null = null;
  // Üretimdeki katalog boyutu ne olursa olsun sonsuz döngüye girmesin diye
  // güvenlik sınırı - 50 sayfa x 50 ürün = 2500 ürünlük bir sitemap için
  // fazlasıyla yeterli (gulumsalim.com'un sitemap.php'sindeki tek seferlik
  // tüm-satır sorgusunun cursor tabanlı karşılığı).
  for (let i = 0; i < 50; i++) {
    const query = new URLSearchParams({ limit: "50" });
    if (cursor) query.set("cursor", cursor);
    const res: ProductListResponse = await apiFetchJson<ProductListResponse>(`/products?${query.toString()}`);
    items.push(...res.items);
    if (!res.nextCursor) break;
    cursor = res.nextCursor;
  }
  return items;
}

// gulumsalim.com'daki sitemap.php'nin karşılığı - katalog büyüklüğü tek bir
// dosyayı gerektirecek kadar büyümediği için (bkz. discovery/mimari notları)
// tek dosyalı sitemap.xml yeterli, ayrı index+5 alt-sitemap yapısına gerek yok.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, vendors, pages, products] = await Promise.all([
    apiFetchJson<Category[]>("/categories").catch(() => []),
    apiFetchJson<PublicVendorListItem[]>("/vendors").catch(() => []),
    apiFetchJson<FooterPage[]>("/footer-pages").catch(() => []),
    fetchAllProducts().catch(() => []),
  ]);

  const entries: MetadataRoute.Sitemap = [
    { url: SITE_ORIGIN, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_ORIGIN}/urunler`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_ORIGIN}/magazalar`, changeFrequency: "daily", priority: 0.7 },
  ];

  for (const c of categories) {
    entries.push({ url: `${SITE_ORIGIN}/${c.slug}`, changeFrequency: "weekly", priority: 0.7 });
  }

  for (const v of vendors) {
    entries.push({ url: `${SITE_ORIGIN}/${v.storeSlug}`, changeFrequency: "weekly", priority: 0.6 });
  }

  for (const p of pages) {
    entries.push({ url: `${SITE_ORIGIN}/${p.slug}`, changeFrequency: "monthly", priority: 0.4 });
  }

  for (const p of products) {
    entries.push({
      url: `${SITE_ORIGIN}${productUrl(p)}`,
      lastModified: new Date(p.createdAt),
      changeFrequency: "daily",
      priority: 0.8,
    });
  }

  return entries;
}
