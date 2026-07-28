import type { Redis } from "ioredis";
import { findProductsByIds, listActiveProducts } from "../catalog/catalog.repository";
import { findProductCategoryVendor } from "../analytics/events.repository";
import { getDiscoverFeed } from "../discovery/discovery.service";
import { getRecentlyViewedProductIds } from "../../lib/view-history";
import { listActivePromoBanners } from "../content/content.repository";
import {
  computeBestSellingProductIds,
  findActiveSectionBySlug,
  findNewArrivalProductIds,
  listActiveSections,
  listSectionBanners,
} from "./homepage-sections.repository";

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
  // İkinci re-audit turunda eklenen görsel özelleştirme alanları (bkz.
  // admin/homepage-sections.php: title_font/anim_style/bg_style/
  // subtitle_color/bg_color/banner_layout/show_title) - hepsi mevcut
  // `config` JSONB'sinde tutulur, ayrı kolon gerekmez.
  titleFont?: "display" | "sans" | "italic";
  animStyle?: "fade-up" | "zoom-in" | "slide-left" | "fade";
  bgStyle?: "plain" | "alt";
  subtitleColor?: string;
  bgColor?: string;
  bannerLayout?: "grid" | "stack";
  showTitle?: boolean;
}

type ResolvedBanners = Awaited<ReturnType<typeof listSectionBanners>>;
type ResolvedProducts = Awaited<ReturnType<typeof findProductsByIds>>;
type SectionRow = Awaited<ReturnType<typeof listActiveSections>>[number];

interface ResolvedSection {
  id: number;
  title: string;
  algoType: string;
  sortOrder: number;
  subtitle?: string;
  titleColor?: string;
  titleFont?: string;
  animStyle?: string;
  bgStyle?: string;
  subtitleColor?: string;
  bgColor?: string;
  bannerLayout?: string;
  showTitle?: boolean;
  seoSlug?: string | null;
  products: ResolvedProducts;
  banners?: ResolvedBanners;
}

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

// Her algo_type için ürün/banner hesabı burada toplanır - yeni bir bölüm
// türü eklemek yeni bir route değil, yeni bir case gerektirir. `limitOverride`
// dedicated SEO sayfasının (resolveSectionBySlug) homepage satırındaki küçük
// limit yerine çok daha geniş bir liste istemesi için kullanılır.
async function resolveOneSection(
  section: SectionRow,
  redis: Redis,
  customerId: number | undefined,
  limitOverride?: number,
): Promise<ResolvedSection | null> {
  const config = (section.config ?? {}) as SectionConfig;
  const limit = limitOverride ?? config.limit ?? 8;
  let products: ResolvedProducts = [];

  if (section.algoType === "promo_banners") {
    const curated = await listSectionBanners(section.id);
    const banners: ResolvedBanners =
      curated.length > 0
        ? curated
        : (await listActivePromoBanners()).map((b) => ({
            id: b.id,
            title: b.title,
            image: b.image,
            linkUrl: b.linkUrl,
            linkType: b.linkType,
            animStyle: b.animStyle,
            subtitle: b.subtitle,
            buttonText: b.buttonText,
            textColor: b.textColor,
            rotateSeconds: b.rotateSeconds,
            extraImages: b.extraImages,
            resolvedLink: b.resolvedLink,
          }));
    if (banners.length === 0) return null;
    return {
      id: section.id,
      title: section.title,
      algoType: section.algoType,
      sortOrder: section.sortOrder,
      subtitle: config.subtitle,
      titleColor: config.titleColor,
      titleFont: config.titleFont,
      animStyle: config.animStyle,
      bgStyle: config.bgStyle,
      subtitleColor: config.subtitleColor,
      bgColor: config.bgColor,
      bannerLayout: config.bannerLayout,
      showTitle: config.showTitle,
      seoSlug: section.seoSlug,
      products: [],
      banners,
    };
  }

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
    // "Seçili Mağazanın Ürünleri" - vendor_carousel'den farkı, sabit bir
    // kaydırma şeridi değil o mağazanın tüm kataloğunun (limit'e kadar)
    // vitrin olarak gösterilmesi; genelde vendor_carousel'e göre çok daha
    // yüksek bir limit ile kurulur.
    case "vendor_products": {
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
      // trending (kullanılmayan eski değer) burada kasıtlı olarak
      // atlanır - hiçbir ürün grid'i üretmez.
      break;
  }

  // Sabitleme/hariç tutma yalnızca algoritmik bölümlere uygulanır - manuel/
  // öne çıkan bölümlerde zaten tüm liste elle kürasyon. Sabitlenen ürünler
  // algoritmik sonuçların üstüne eklendiği için toplam limit'i aşabilir -
  // sonuç tekrar limit'e kırpılır (sabitlenenler her zaman başta kaldığı
  // için asla düşürülmezler, limit'i aşmadıkları sürece).
  if (section.algoType !== "manual" && section.algoType !== "featured") {
    products = (await applyPinningAndExclusion(products, config)).slice(0, limit);
  }

  if (products.length === 0) return null;

  return {
    id: section.id,
    title: section.title,
    algoType: section.algoType,
    sortOrder: section.sortOrder,
    subtitle: config.subtitle,
    titleColor: config.titleColor,
    titleFont: config.titleFont,
    animStyle: config.animStyle,
    bgStyle: config.bgStyle,
    subtitleColor: config.subtitleColor,
    bgColor: config.bgColor,
    bannerLayout: config.bannerLayout,
    showTitle: config.showTitle,
    seoSlug: section.seoSlug,
    products,
  };
}

export async function resolveHomepageSections(redis: Redis, customerId: number | undefined): Promise<ResolvedSection[]> {
  const sections = await listActiveSections();
  const resolved: ResolvedSection[] = [];
  for (const section of sections) {
    const one = await resolveOneSection(section, redis, customerId);
    if (one) resolved.push(one);
  }
  return resolved;
}

// [slug]/page.tsx zincirinin 3. adımı: bir bölümün kendi kök-seviye SEO
// sayfası - homepage satırındaki küçük limit yerine geniş bir liste
// (60'a kadar) döner.
export async function resolveSectionBySlug(
  redis: Redis,
  customerId: number | undefined,
  slug: string,
): Promise<ResolvedSection | null> {
  const section = await findActiveSectionBySlug(slug);
  if (!section) return null;
  return resolveOneSection(section, redis, customerId, 60);
}

const PREVIEW_LIMIT = 4;

// homepage-preview-render.php'nin karşılığı - admin panelde henüz
// kaydedilmemiş form değerleriyle (algoType/config) canlı önizleme.
// sectionId verilirse (düzenleme modu) promo_banners'ın bölüme özel
// kürasyonu da yansıtılır; yeni/kaydedilmemiş bir bölüm için (sectionId
// yok) her zaman tüm onaylı bannerlara düşer.
export async function previewSectionConfig(
  redis: Redis,
  customerId: number | undefined,
  algoType: string,
  config: Record<string, unknown>,
  sectionId?: number,
): Promise<{ products: ResolvedProducts; banners?: ResolvedBanners }> {
  const fakeSection = {
    id: sectionId ?? 0,
    title: "",
    algoType,
    config,
    sortOrder: 0,
    isActive: true,
    seoSlug: null,
  } as SectionRow;
  const resolved = await resolveOneSection(fakeSection, redis, customerId, PREVIEW_LIMIT);
  return { products: resolved?.products ?? [], banners: resolved?.banners };
}
