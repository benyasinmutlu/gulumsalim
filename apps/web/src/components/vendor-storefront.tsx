import Link from "next/link";
import { apiFetch, apiFetchJson } from "@/lib/api";
import type {
  CustomerProfile,
  ProductListItem,
  PublicVendorCollection,
  PublicVendorReview,
  VendorPromoBanner,
  VendorSocialPost,
  VendorStorefront,
  VendorStoreSlide,
} from "@/lib/types";
import ProductCard from "@/components/product-card";
import FollowButton from "@/components/follow-button";
import FollowerCountStat from "@/components/follower-count-stat";
import VendorComplaintButton from "@/components/vendor-complaint-button";
import VendorReviewForm from "@/components/vendor-review-form";
import StarRating from "@/components/star-rating";
import VendorStoreSlider from "@/components/vendor-store-slider";
import VendorStoreTabs from "@/components/vendor-store-tabs";
import PromoBannerImage from "@/components/promo-banner-image";
import PromoBannerLink from "@/components/promo-banner-link";
import PromoBannerImpression from "@/components/promo-banner-impression";

async function getStorefront(slug: string, cursor?: string): Promise<VendorStorefront | null> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  const res = await apiFetch(`/vendors/${slug}${query}`);
  if (!res.ok) return null;
  return res.json();
}

async function getCollections(slug: string): Promise<PublicVendorCollection[]> {
  try {
    return await apiFetchJson<PublicVendorCollection[]>(`/vendors/${slug}/collections`);
  } catch {
    return [];
  }
}

async function getVendorReviews(slug: string): Promise<PublicVendorReview[]> {
  try {
    return await apiFetchJson<PublicVendorReview[]>(`/vendors/${slug}/reviews`);
  } catch {
    return [];
  }
}

async function getCurrentCustomer(): Promise<CustomerProfile | null> {
  const res = await apiFetch("/auth/me");
  if (!res.ok) return null;
  return res.json();
}

async function getStoreSlides(slug: string): Promise<VendorStoreSlide[]> {
  try {
    return await apiFetchJson<VendorStoreSlide[]>(`/vendors/${slug}/store-slides`);
  } catch {
    return [];
  }
}

async function getSocialPosts(slug: string): Promise<VendorSocialPost[]> {
  try {
    return await apiFetchJson<VendorSocialPost[]>(`/vendors/${slug}/social-posts`);
  } catch {
    return [];
  }
}

async function getSaleProducts(slug: string): Promise<ProductListItem[]> {
  try {
    const res = await apiFetchJson<{ items: ProductListItem[] }>(`/products?vendor=${slug}&saleOnly=true&limit=8`);
    return res.items;
  } catch {
    return [];
  }
}

async function getFavoriteProducts(slug: string): Promise<ProductListItem[]> {
  try {
    return await apiFetchJson<ProductListItem[]>(`/vendors/${slug}/favorites`);
  } catch {
    return [];
  }
}

async function getRecentlyViewedProducts(slug: string): Promise<ProductListItem[]> {
  try {
    return await apiFetchJson<ProductListItem[]>(`/vendors/${slug}/recently-viewed`);
  } catch {
    return [];
  }
}

async function getVendorPromoBanners(slug: string): Promise<VendorPromoBanner[]> {
  try {
    return await apiFetchJson<VendorPromoBanner[]>(`/vendors/${slug}/promo-banners`);
  } catch {
    return [];
  }
}

export async function getVendorMetaTitle(slug: string): Promise<string | null> {
  const storefront = await getStorefront(slug);
  return storefront ? storefront.vendor.storeName : null;
}

// gulumsalim.com'daki .htaccess'teki "/magaza/{slug} -> /{slug}" kalıcı
// yönlendirmesinin karşılığı: mağaza sayfası artık kök seviyede temiz bir
// URL'de yaşıyor (bkz. (site)/[slug]/page.tsx), bu bileşen o sayfa ile
// eski /magaza/[slug] uyumluluk yönlendirmesinin ortak gövdesi.
export default async function VendorStorefrontView({ slug, cursor }: { slug: string; cursor?: string }) {
  const [storefront, collections, reviews, customer] = await Promise.all([
    getStorefront(slug, cursor),
    getCollections(slug),
    getVendorReviews(slug),
    getCurrentCustomer(),
  ]);
  if (!storefront) return null;

  const { vendor, products } = storefront;
  const collectionsSection = vendor.storeLayout?.find((s) => s.type === "collections");
  const showCollections = (collectionsSection?.visible ?? true) && collections.length > 0;

  const sliderSection = vendor.storeLayout?.find((s) => s.type === "slider");
  const showSlider = sliderSection?.visible ?? false;

  const socialSection = vendor.storeLayout?.find((s) => s.type === "social");
  const showSocial = socialSection?.visible ?? false;

  const discountSection = vendor.storeLayout?.find((s) => s.type === "discount");
  const showDiscount = discountSection?.visible ?? true;

  const favoritesSection = vendor.storeLayout?.find((s) => s.type === "favorites");
  const showFavorites = (favoritesSection?.visible ?? true) && !!customer;

  const recentlyViewedSection = vendor.storeLayout?.find((s) => s.type === "recently_viewed");
  const showRecentlyViewed = (recentlyViewedSection?.visible ?? true) && !!customer;

  const productsSection = vendor.storeLayout?.find((s) => s.type === "products");
  const showProductsTab = productsSection?.visible ?? true;

  const aboutSection = vendor.storeLayout?.find((s) => s.type === "about");
  const showAboutTab = aboutSection?.visible ?? true;

  const [slides, socialPosts, saleProducts, favoriteProducts, recentlyViewedProducts, promoBanners] = await Promise.all([
    showSlider ? getStoreSlides(slug) : Promise.resolve([]),
    showSocial ? getSocialPosts(slug) : Promise.resolve([]),
    showDiscount ? getSaleProducts(slug) : Promise.resolve([]),
    showFavorites ? getFavoriteProducts(slug) : Promise.resolve([]),
    showRecentlyViewed ? getRecentlyViewedProducts(slug) : Promise.resolve([]),
    getVendorPromoBanners(slug),
  ]);

  const socialLinks: { key: string; label: string; icon: string; href: string }[] = [
    vendor.whatsapp && { key: "whatsapp", label: "WhatsApp", icon: "fa-whatsapp", href: `https://wa.me/${vendor.whatsapp.replace(/\D/g, "")}` },
    vendor.instagram && { key: "instagram", label: "Instagram", icon: "fa-instagram", href: vendor.instagram },
    vendor.facebook && { key: "facebook", label: "Facebook", icon: "fa-facebook", href: vendor.facebook },
    vendor.twitter && { key: "twitter", label: "Twitter / X", icon: "fa-twitter", href: vendor.twitter },
    vendor.youtube && { key: "youtube", label: "YouTube", icon: "fa-youtube", href: vendor.youtube },
    vendor.tiktok && { key: "tiktok", label: "TikTok", icon: "fa-tiktok", href: vendor.tiktok },
  ].filter((v): v is { key: string; label: string; icon: string; href: string } => Boolean(v));

  const showAbout = Boolean(vendor.about || vendor.city || socialLinks.length > 0);

  // bkz. kullanıcı isteği (mockup): mağaza istatistik satırında "Mağaza
  // Açık X Yıl" - vendors.createdAt zaten var, yeni bir alan gerekmedi.
  // Server component'te tek isteğin sabit zamanında hesaplanır.
  // eslint-disable-next-line react-hooks/purity
  const vendorYears = Math.floor((Date.now() - new Date(vendor.createdAt).getTime()) / (365 * 24 * 60 * 60 * 1000));

  const reviewsBlock = (
    <div className="vstore-section">
      <div className="vstore-section-title">
        <i className="fas fa-star" /> Mağaza Değerlendirmeleri {vendor.reviewSummary.total > 0 && `(${vendor.reviewSummary.total})`}
      </div>
      <div className="reviews-qna-grid">
        <div className="review-list">
          {reviews.length === 0 ? (
            <p style={{ fontSize: "0.85rem" }}>Bu mağaza için henüz değerlendirme yapılmamış.</p>
          ) : (
            reviews.map((r) => (
              <div key={r.id} className="review-card">
                <div className="review-card-head">
                  <strong>{r.customerName}</strong>
                  <StarRating value={r.rating} />
                </div>
                {r.comment && <p>{r.comment}</p>}
                <div className="review-card-date">{new Date(r.createdAt).toLocaleDateString("tr-TR")}</div>
              </div>
            ))
          )}
        </div>
        <VendorReviewForm vendorSlug={slug} loggedIn={!!customer} />
      </div>
    </div>
  );

  const collectionsGrid = (
    <div className="collection-grid">
      {collections.map((c) => (
        <Link key={c.id} href={`/${slug}/koleksiyon/${c.slug}`} className="collection-card">
          <div className="collection-cover">
            {c.coverImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.coverImage} alt={c.name} loading="lazy" decoding="async" />
            ) : (
              <i className="fas fa-layer-group" />
            )}
          </div>
          <div className="collection-info">
            <div>{c.name}</div>
          </div>
        </Link>
      ))}
    </div>
  );

  // Vitrin: slider + indirimli ürünler + koleksiyon önizlemesi + sosyal medya -
  // vendor-store.php'deki varsayılan (ilk açılan) sekmenin birebir karşılığı.
  const vitrinContent = (
    <>
      {showSlider && slides.length > 0 && <VendorStoreSlider slides={slides} />}

      {saleProducts.length > 0 && (
        <div className="vstore-section">
          <div className="vstore-section-title">
            <i className="fas fa-tags" /> İndirimli Ürünler
          </div>
          <div className="product-grid">
            {saleProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}

      {showCollections && (
        <div className="vstore-section">
          <div className="vstore-section-title">
            <i className="fas fa-layer-group" /> Koleksiyonlarımız
          </div>
          {collectionsGrid}
        </div>
      )}

      {favoriteProducts.length > 0 && (
        <div className="vstore-section">
          <div className="vstore-section-title">
            <i className="fas fa-heart" /> Sevdikleriniz
          </div>
          <div className="product-grid">
            {favoriteProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}

      {recentlyViewedProducts.length > 0 && (
        <div className="vstore-section">
          <div className="vstore-section-title">
            <i className="fas fa-clock-rotate-left" /> Son Baktıklarınız
          </div>
          <div className="product-grid">
            {recentlyViewedProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}

      {showSocial && socialPosts.length > 0 && (
        <div className="vstore-section">
          <div className="vstore-section-title">
            <i className="fas fa-share-nodes" /> Sosyal Medya
          </div>
          <div className="vstore-social-grid">
            {socialPosts.map((p) => (
              <a key={p.id} href={p.postUrl} target="_blank" rel="noreferrer" className="vstore-social-item">
                {p.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover" }} loading="lazy" decoding="async" />
                )}
                <div className={`vstore-social-badge ${p.platform}`}>
                  <i className={`fab fa-${p.platform}`} /> {p.caption || p.platform}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </>
  );

  const productsContent = (
    <>
      {products.items.length === 0 ? (
        <p className="empty-state">Bu mağazada henüz ürün yok.</p>
      ) : (
        <div className="product-grid">
          {products.items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}

      {products.nextCursor && (
        <Link href={`/${slug}?cursor=${products.nextCursor}`} className="btn btn-secondary" style={{ marginTop: "1.5rem" }}>
          Sonraki sayfa
        </Link>
      )}
    </>
  );

  const collectionsContent =
    collections.length === 0 ? <p className="empty-state">Bu mağazanın henüz koleksiyonu yok.</p> : collectionsGrid;

  // bkz. kullanıcı isteği (mockup): mağaza sayfasında ayrı bir "Kampanyalar"
  // sekmesi - satıcının onaylanmış/aktif banner'ları (bkz.
  // vendor-promo-banners.repository.ts listActiveVendorPromoBanners).
  const campaignsContent = (
    <div className="promo-grid">
      {promoBanners.map((b) => (
        <PromoBannerImpression key={b.id} bannerId={b.id}>
          <PromoBannerLink bannerId={b.id} href={b.resolvedLink ?? "/urunler"} className="promo-card">
            <PromoBannerImage className="promo-card-img" images={[b.image, ...(b.extraImages ?? [])]} rotateSeconds={b.rotateSeconds} alt={b.title} />
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
  );

  // bkz. kullanıcı isteği (mockup): "Mağaza Hakkında" altında Hızlı Kargo/
  // Güvenli Ödeme/Kolay İade rozetleri - ürün detay sayfasındaki
  // (.detail-features) aynı sitesel güven rozetleri. Mağazaya özgü bir veri
  // değil (tüm satıcılar aynı platform garantilerine tabi), bu yüzden
  // showAbout (bio/şehir/sosyal medya doluluğu) şartından BAĞIMSIZ olarak
  // her zaman gösterilir - bio yazmamış bir satıcının sayfası bu rozetler
  // olmadan kalmasın diye.
  const trustBadges = (
    <div className="detail-features" style={{ marginTop: 16 }}>
      <div className="feature-item">
        <i className="fas fa-shipping-fast" /> Hızlı Kargo
      </div>
      <div className="feature-item">
        <i className="fas fa-shield-alt" /> Güvenli Ödeme
      </div>
      <div className="feature-item">
        <i className="fas fa-undo" /> Kolay İade
      </div>
    </div>
  );

  const aboutContent = showAbout ? (
    <div className="vstore-about-grid">
      <div className="vstore-about-card">
        <h3>
          <i className="fas fa-circle-info" style={{ color: "var(--color-primary)", marginRight: 8 }} /> {vendor.storeName} Hakkında
        </h3>
        {vendor.about ? (
          <p style={{ lineHeight: 1.8, whiteSpace: "pre-line" }}>{vendor.about}</p>
        ) : (
          <p className="empty-state" style={{ padding: 0 }}>Bu mağaza henüz bir tanıtım yazısı eklemedi.</p>
        )}
        {trustBadges}
      </div>
      <div className="vstore-about-card">
        <h3>İletişim &amp; Sosyal Medya</h3>
        <div className="vstore-about-row">
          <i className="fas fa-box" /> {vendor.productCount} ürün
        </div>
        <div className="vstore-about-row">
          <i className="fas fa-users" /> {vendor.followerCount} takipçi
        </div>
        {vendor.city && (
          <div className="vstore-about-row">
            <i className="fas fa-location-dot" /> {vendor.city}
          </div>
        )}
        {vendor.reviewSummary.total > 0 && (
          <div className="vstore-about-row">
            <i className="fas fa-star" /> {vendor.reviewSummary.average?.toFixed(1)} ({vendor.reviewSummary.total} değerlendirme)
          </div>
        )}
        {socialLinks.length > 0 && (
          <div className="vstore-social-icons">
            {socialLinks.map((s) => (
              <a key={s.key} href={s.href} target="_blank" rel="noreferrer" title={s.label} className={`vstore-social-icon-btn ${s.key}`}>
                <i className={`fab ${s.icon}`} />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  ) : (
    <div>
      <p className="empty-state">Bu mağaza henüz bir tanıtım yazısı eklemedi.</p>
      {trustBadges}
    </div>
  );

  return (
    <main className="main-content">
      {/* bkz. kullanıcı isteği (mockup): "mağaza sayfasını mockup'taki gibi
          sade yap" - önceki gradyanlı/glassmorphism "hero" banner yerine,
          mockup'ın MODA&CO örneğindeki gibi düz beyaz zeminli, sade bir
          başlık satırı (avatar + isim + satır içi istatistikler + Takip Et). */}
      <div className="vendor-header">
        <div className="container">
          <div className="vendor-header-row">
            <div className="vendor-avatar-flat">
              {vendor.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={vendor.logo} alt={vendor.storeName} />
              ) : (
                vendor.storeName.charAt(0)
              )}
            </div>
            <div className="vendor-header-info">
              <div className="vendor-header-name-row">
                <h1>{vendor.storeName}</h1>
                {vendor.isVerified && (
                  <i className="fas fa-circle-check vendor-verified-check" title="Doğrulanmış Mağaza" />
                )}
                {vendor.vendorType === "individual" && (
                  <span className="badge-individual-tag" title="Bireysel Satıcı">
                    Bireysel Satıcı
                  </span>
                )}
              </div>
              <div className="vendor-header-stats">
                {/* bkz. kullanıcı isteği (tasarım brief'i, 2026-08-02):
                    "4'lü performans göstergesi (Toplam Ürün, Değerlendirme,
                    Hızlı Gönderim, Mağaza Yaşı)" - "Toplam Ürün" eksikti,
                    eklendi. Diğer üç mevcut istatistik (Takipçi, Başarılı
                    Satıcı) gerçek/anlamlı veri olduğu için kaldırılmadı. */}
                <span>
                  <i className="fas fa-box" /> {vendor.productCount} Ürün
                </span>
                {vendor.reviewSummary.total > 0 && (
                  <span>
                    <i className="fas fa-star" /> {vendor.reviewSummary.average?.toFixed(1)} Ortalama Puan
                  </span>
                )}
                <span>
                  <FollowerCountStat initialCount={vendor.followerCount} /> Takipçi
                </span>
                <span title={`Katılım: ${new Date(vendor.createdAt).toLocaleDateString("tr-TR", { year: "numeric", month: "long" })}`}>
                  {vendorYears > 0 ? `${vendorYears} Yıl` : "Yeni"} Mağaza
                </span>
                {vendor.successRate !== null && <span>%{vendor.successRate} Başarılı Satıcı</span>}
                {/* bkz. denetim raporu madde 14: "Satış sayısı ... gösterilebilsin" -
                    önceden sadece türetilmiş successRate vardı, ham sayı yoktu. */}
                {vendor.salesCount > 0 && (
                  <span>
                    <i className="fas fa-bag-shopping" /> {vendor.salesCount} Satış
                  </span>
                )}
              </div>
            </div>
            <div className="vendor-header-actions">
              <FollowButton vendorSlug={vendor.storeSlug} initialFollowing={vendor.isFollowing} />
              <Link href={`/hesabim/mesajlarim?vendorId=${vendor.id}`} className="btn btn-secondary btn-sm" title="Mesaj Gönder">
                <i className="fas fa-envelope" />
              </Link>
              <VendorComplaintButton vendorSlug={vendor.storeSlug} loggedIn={!!customer} />
            </div>
          </div>
        </div>
      </div>

      {/* Mağaza adına tıklayan ziyaretçi ürünleri ikinci kez sekme aramadan
          doğrudan görür. Vitrin/koleksiyon/kampanya sekmeleri korunur. */}
      <VendorStoreTabs
        productCount={products.items.length}
        reviewCount={vendor.reviewSummary.total}
        vitrin={vitrinContent}
        products={productsContent}
        collections={collectionsContent}
        campaigns={campaignsContent}
        reviews={reviewsBlock}
        about={aboutContent}
        showProducts={showProductsTab}
        showAbout={showAboutTab}
        showCampaigns={promoBanners.length > 0}
        defaultTab="products"
      />
    </main>
  );
}
