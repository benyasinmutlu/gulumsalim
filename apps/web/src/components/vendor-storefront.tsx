import Link from "next/link";
import { apiFetch, apiFetchJson } from "@/lib/api";
import type {
  CustomerProfile,
  ProductListItem,
  PublicVendorCollection,
  PublicVendorReview,
  VendorSocialPost,
  VendorStorefront,
  VendorStoreSlide,
} from "@/lib/types";
import ProductCard from "@/components/product-card";
import FollowButton from "@/components/follow-button";
import VendorReviewForm from "@/components/vendor-review-form";
import StarRating from "@/components/star-rating";
import VendorStoreSlider from "@/components/vendor-store-slider";
import VendorStoreTabs from "@/components/vendor-store-tabs";

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

  const [slides, socialPosts, saleProducts] = await Promise.all([
    showSlider ? getStoreSlides(slug) : Promise.resolve([]),
    showSocial ? getSocialPosts(slug) : Promise.resolve([]),
    getSaleProducts(slug),
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
              <img src={c.coverImage} alt={c.name} />
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
                  <img src={p.image} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover" }} />
                )}
                <div className={`vstore-social-badge ${p.platform}`}>
                  <i className={`fab fa-${p.platform}`} /> {p.caption || p.platform}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {reviewsBlock}
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

  const aboutContent = showAbout ? (
    <>
      {vendor.about && <p style={{ marginBottom: 16, lineHeight: 1.7 }}>{vendor.about}</p>}
      {vendor.city && (
        <p style={{ marginBottom: 16, color: "var(--color-text-light)" }}>
          <i className="fas fa-location-dot" /> {vendor.city}
        </p>
      )}
      {socialLinks.length > 0 && (
        <div className="vstore-social-grid">
          {socialLinks.map((s) => (
            <a key={s.key} href={s.href} target="_blank" rel="noreferrer" className="vstore-social-item">
              <div className={`vstore-social-badge ${s.key}`}>
                <i className={`fab ${s.icon}`} /> {s.label}
              </div>
            </a>
          ))}
        </div>
      )}
    </>
  ) : (
    <p className="empty-state">Bu mağaza henüz bir tanıtım yazısı eklemedi.</p>
  );

  return (
    <main className="main-content">
      <div className="vendor-hero">
        {vendor.coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={vendor.coverImage} alt="" className="vendor-hero-bg" />
        )}
        <div className="vendor-hero-content">
          <div className="vendor-avatar">
            {vendor.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={vendor.logo} alt={vendor.storeName} />
            ) : (
              vendor.storeName.charAt(0)
            )}
          </div>
          <div className="vendor-hero-info">
            {vendor.isVerified && (
              <span className="vendor-badge">
                <i className="fas fa-badge-check" /> Doğrulanmış Mağaza
              </span>
            )}
            <h1>{vendor.storeName}</h1>
            <div className="vendor-stats">
              <div className="vendor-stat-item">
                <div className="val">{vendor.productCount}</div>
                <div className="lbl">Ürün</div>
              </div>
              <div className="vendor-stat-item">
                <div className="val">{vendor.followerCount}</div>
                <div className="lbl">Takipçi</div>
              </div>
              {vendor.reviewSummary.total > 0 && (
                <div className="vendor-stat-item">
                  <div className="val">★ {vendor.reviewSummary.average?.toFixed(1)}</div>
                  <div className="lbl">{vendor.reviewSummary.total} Değerlendirme</div>
                </div>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <FollowButton vendorSlug={vendor.storeSlug} initialFollowing={vendor.isFollowing} />
            <Link href={`/hesabim/mesajlarim?vendorId=${vendor.id}`} className="btn btn-secondary">
              <i className="fas fa-envelope" /> Mesaj Gönder
            </Link>
          </div>
        </div>
      </div>

      <VendorStoreTabs
        productCount={products.items.length}
        vitrin={vitrinContent}
        products={productsContent}
        collections={collectionsContent}
        about={aboutContent}
      />
    </main>
  );
}
