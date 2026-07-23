import type { Redis } from "ioredis";
import { findProductsByIds, listActiveProducts } from "../catalog/catalog.repository";
import { findProductCategoryVendor } from "../analytics/events.repository";
import { getDiscoverFeed } from "../discovery/discovery.service";
import { getRecentlyViewedProductIds } from "../../lib/view-history";
import { computeBestSellingProductIds, findNewArrivalProductIds, listActiveSections } from "./homepage-sections.repository";

interface SectionConfig {
  productIds?: number[];
  limit?: number;
  vendorId?: number;
  // admin/homepage-sections.php'deki ürün "sabitleme"/"hariç tutma" ve
  // görsel özelleştirme alanlarının karşılığı - önceki denetimde bunların
  // hiç taşınmadığı, bölüm ayarlarının serbest metin JSON'a indirgendiği
  // tespit edildi.
  pinnedProductIds?: number[];
  excludedProductIds?: number[];
  subtitle?: string;
  titleColor?: string;
}

interface ResolvedSection {
  id: number;
  title: string;
  algoType: string;
  subtitle?: string;
  titleColor?: string;
  products: Awaited<ReturnType<typeof findProductsByIds>>;
}

type ResolvedProducts = Awaited<ReturnType<typeof findProductsByIds>>;

// Algoritmik bir sonuç listesine sabitlenen ürünleri başa ekler (mevcut
// listede varsa oradan çıkarıp başa taşır), hariç tutulanları filtreler.
// Manuel/öne çıkan bölümler zaten tamamen elle kürasyon olduğu için bu
// mantığın dışında tutulur.
async function applyPinningAndExclusion(products: ResolvedProducts, config: SectionConfig): Promise<ResolvedProducts> {
  let result = products;
  if (config.excludedProductIds?.length) {
    const excluded = new Set(config.excludedProductIds);
    result = result.filter((p) => !excluded.has(p.id));
  }
  if (config.pinnedProductIds?.length) {
    const pinnedRows = await findProductsByIds(config.pinnedProductIds);
    const pinnedIds = new Set(config.pinnedProductIds);
    result = [...pinnedRows, ...result.filter((p) => !pinnedIds.has(p.id))];
  }
  return result;
}

// Her algo_type için ürün hesabı burada toplanır - yeni bir bölüm türü
// eklemek yeni bir route değil, yeni bir case gerektirir (bkz. mimari
// planı, homepage_sections.config alanı açıklaması).
export async function resolveHomepageSections(redis: Redis, customerId: number | undefined): Promise<ResolvedSection[]> {
  const sections = await listActiveSections();
  const resolved: ResolvedSection[] = [];

  for (const section of sections) {
    const config = (section.config ?? {}) as SectionConfig;
    const limit = config.limit ?? 8;
    let products: Awaited<ReturnType<typeof findProductsByIds>> = [];

    switch (section.algoType) {
      case "manual":
      case "featured": {
        if (config.productIds?.length) {
          const rows = await findProductsByIds(config.productIds);
          const byId = new Map(rows.map((p) => [p.id, p]));
          products = config.productIds.map((id) => byId.get(id)).filter((p) => p !== undefined);
        }
        break;
      }
      case "new_arrivals": {
        const ids = await findNewArrivalProductIds(limit);
        products = await findProductsByIds(ids);
        break;
      }
      case "best_sellers": {
        const ids = await computeBestSellingProductIds(limit);
        products = await findProductsByIds(ids);
        break;
      }
      case "weekly_best": {
        const ids = await computeBestSellingProductIds(limit, 7);
        products = await findProductsByIds(ids);
        break;
      }
      case "vendor_carousel": {
        if (config.vendorId) {
          products = await listActiveProducts({ vendorId: config.vendorId, limit });
        }
        break;
      }
      case "recently_viewed": {
        if (customerId) {
          const ids = await getRecentlyViewedProductIds(redis, customerId, limit);
          const rows = await findProductsByIds(ids);
          const byId = new Map(rows.map((p) => [p.id, p]));
          products = ids.map((id) => byId.get(id)).filter((p) => p !== undefined);
        }
        break;
      }
      case "related_viewed": {
        if (customerId) {
          const viewedIds = await getRecentlyViewedProductIds(redis, customerId, 10);
          const lastViewed = viewedIds[0];
          if (lastViewed) {
            const info = await findProductCategoryVendor(lastViewed);
            if (info) {
              const rows = await listActiveProducts({ categoryId: info.categoryId, limit: limit + viewedIds.length });
              products = rows.filter((r) => !viewedIds.includes(r.id)).slice(0, limit);
            }
          }
        }
        break;
      }
      case "discover_personalized": {
        const feed = await getDiscoverFeed(customerId, limit);
        products = feed.items;
        break;
      }
      default:
        // promo_banners (ayrı, mevcut bir sistemle zaten sunuluyor) ve
        // trending (kullanılmayan eski değer) burada kasıtlı olarak
        // atlanır - hiçbir ürün grid'i üretmezler.
        break;
    }

    // Sabitleme/hariç tutma yalnızca algoritmik bölümlere uygulanır -
    // manuel/öne çıkan bölümlerde zaten tüm liste elle kürasyon. Sabitlenen
    // ürünler algoritmik sonuçların üstüne eklendiği için toplam limit'i
    // aşabilir - sonuç tekrar limit'e kırpılır (sabitlenenler her zaman
    // başta kaldığı için asla düşürülmezler, limit'i aşmadıkları sürece).
    if (section.algoType !== "manual" && section.algoType !== "featured") {
      products = (await applyPinningAndExclusion(products, config)).slice(0, limit);
    }

    if (products.length > 0) {
      resolved.push({
        id: section.id,
        title: section.title,
        algoType: section.algoType,
        subtitle: config.subtitle,
        titleColor: config.titleColor,
        products,
      });
    }
  }

  return resolved;
}
