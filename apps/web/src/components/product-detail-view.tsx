import Link from "next/link";
import { apiFetch, apiFetchJson } from "@/lib/api";
import { SITE_ORIGIN } from "@/lib/env";
import type { Category, CustomerProfile, ProductDetail, ProductListItem, ProductQuestion, ProductReviewsResponse, PublicVendorProfile } from "@/lib/types";
import AddToCartButton from "@/app/(site)/urun/[slug]/add-to-cart-button";
import ReviewForm from "@/app/(site)/urun/[slug]/review-form";
import QuestionForm from "@/app/(site)/urun/[slug]/question-form";
import ProductGallery from "@/components/product-gallery";
import VirtualTryOn from "@/components/virtual-tryon";
import FitPanel from "@/components/fit-panel";
import StarRating from "@/components/star-rating";
import ProductCard from "@/components/product-card";
import DwellTracker from "@/components/dwell-tracker";
import ProductCampaignBadge from "@/components/product-campaign-badge";
import FollowButton from "@/components/follow-button";
import FollowerCountStat from "@/components/follower-count-stat";
import QuestionHelpfulButton from "@/components/question-helpful-button";
import { CONDITION_LABELS } from "@/lib/product-condition";

export async function getProduct(slug: string): Promise<ProductDetail | null> {
  const res = await apiFetch(`/products/${slug}`);
  if (!res.ok) return null;
  return res.json();
}

async function getReviews(slug: string): Promise<ProductReviewsResponse> {
  const res = await apiFetch(`/products/${slug}/reviews`);
  if (!res.ok) return { reviews: [], summary: { average: null, total: 0 } };
  return res.json();
}

export async function getQuestions(slug: string): Promise<ProductQuestion[]> {
  const res = await apiFetch(`/products/${slug}/questions`);
  if (!res.ok) return [];
  return res.json();
}

export async function getCurrentCustomer(): Promise<CustomerProfile | null> {
  const res = await apiFetch("/auth/me");
  if (!res.ok) return null;
  return res.json();
}

export async function getCategories(): Promise<Category[]> {
  try {
    return await apiFetchJson<Category[]>("/categories");
  } catch {
    return [];
  }
}

// GET /vendors/:slug zaten mağaza sayfası için puan/takipçi/takip-durumu/
// soru sayısını döndürüyor (bkz. public-vendors.routes.ts) - ürün detay
// sayfası için ayrı bir uç açmak yerine bu aynı endpoint'i satıcı özetini
// almak için yeniden kullanıyoruz, döndürdüğü ürün listesini kullanmıyoruz.
async function getVendorSummary(vendorSlug: string): Promise<PublicVendorProfile | null> {
  const res = await apiFetch(`/vendors/${vendorSlug}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { vendor: PublicVendorProfile };
  return data.vendor;
}

async function getRelatedProducts(slug: string): Promise<ProductListItem[]> {
  try {
    return await apiFetchJson<ProductListItem[]>(`/products/${slug}/related`);
  } catch {
    return [];
  }
}

// bkz. denetim raporu madde 19: "Aynı Mağazadan" - kategori bazlı
// "Benzer Ürünler"den (getRelatedProducts) ayrı, satıcının diğer ürünleri.
async function getSameVendorProducts(slug: string): Promise<ProductListItem[]> {
  try {
    return await apiFetchJson<ProductListItem[]>(`/products/${slug}/same-vendor`);
  } catch {
    return [];
  }
}

interface DiscoverFeed {
  items: ProductListItem[];
  strategy: "personalized" | "cold_start" | "unavailable";
}

// bkz. denetim raporu madde 19: "Bunları da Beğenebilirsiniz" - anasayfadaki
// "Sana Özel" ile AYNI kişiselleştirme motoru (bkz. discovery.routes.ts
// GET /discover), burada da yeniden kullanılıyor. Sadece GERÇEKTEN
// kişiselleştirilmiş bir sonuç varsa gösterilir (cold-start'ta hiç
// gösterilmez) - aksi halde "İlginizi Çekebilecek Diğer Ürünler" ile aynı
// şeyi tekrar etmiş, yanıltıcı bir "sana özel" iddiası yapmış olurduk.
async function getDiscoverFeed(): Promise<DiscoverFeed> {
  try {
    return await apiFetchJson<DiscoverFeed>("/discover");
  } catch {
    return { items: [], strategy: "unavailable" };
  }
}

export async function getProductMeta(slug: string) {
  const [product, categories] = await Promise.all([getProduct(slug), getCategories()]);
  if (!product) return null;
  // bkz. denetim raporu: "Canonical URL" hiç yoktu - bu ürüne HEM /urun/{slug}
  // HEM /{kategori}/{slug} üzerinden erişilebiliyor (bkz. app/(site)/urun/
  // [slug]/page.tsx ve app/(site)/[slug]/[product]/page.tsx yorumları), arama
  // motoruna hangisinin "asıl" olduğu söylenmezse içerik ikiye bölünmüş sayılır.
  const category = categories.find((c) => c.id === product.categoryId);
  const canonicalPath = category ? `/${category.slug}/${product.slug}` : `/urun/${product.slug}`;
  const canonical = `${SITE_ORIGIN}${canonicalPath}`;
  return {
    title: `${product.name} | Gülüm Şalım`,
    description: product.description ?? undefined,
    alternates: { canonical },
    twitter: {
      card: "summary_large_image" as const,
      title: product.name,
      description: product.description ?? undefined,
      images: product.images[0]?.url ? [product.images[0].url] : undefined,
    },
    openGraph: {
      title: product.name,
      description: product.description ?? undefined,
      url: canonical,
      images: product.images[0]?.url ? [product.images[0].url] : undefined,
    },
  };
}

// gulumsalim.com'daki product-detail.php'nin karşılığı - hem /urun/{slug}
// (kategorisiz ürünler ya da doğrudan erişim) hem de /{kategori}/{ürün}
// (kategorili ürünlerin asıl SEO URL'i) aynı gövdeyi kullanır.
// `expectedCategorySlug` verilirse (iki segmentli rotadan çağrıldığında)
// ürünün gerçek kategorisiyle eşleşmiyorsa null döner (404 için).
export default async function ProductDetailView({
  slug,
  expectedCategorySlug,
}: {
  slug: string;
  expectedCategorySlug?: string;
}): Promise<React.ReactElement | null> {
  const product = await getProduct(slug);
  if (!product) return null;

  const [{ reviews, summary }, questions, customer, categories, relatedProducts, vendorSummary, sameVendorProducts, discoverFeed] =
    await Promise.all([
      getReviews(slug),
      getQuestions(slug),
      getCurrentCustomer(),
      getCategories(),
      getRelatedProducts(slug),
      getVendorSummary(product.vendorSlug),
      getSameVendorProducts(slug),
      getDiscoverFeed(),
    ]);
  const personalizedProducts =
    discoverFeed.strategy === "personalized" ? discoverFeed.items.filter((p) => p.id !== product.id).slice(0, 8) : [];

  const category = categories.find((c) => c.id === product.categoryId);
  if (expectedCategorySlug && category?.slug !== expectedCategorySlug) return null;

  // Google'ın arama sonuçlarında zengin snippet (yıldız puanı/fiyat/stok
  // rozeti) gösterebilmesi için schema.org Product yapılandırılmış verisi -
  // önceki halinde sadece isim/açıklama/fiyat vardı, puan/stok/marka/görsel
  // eksikti (bkz. kullanıcı geri bildirimi: "seo mantığı olmalı").
  const totalStock = product.variants.length > 0 ? product.variants.reduce((sum, v) => sum + v.stock, 0) : product.stock;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description ?? undefined,
    sku: product.variants[0]?.sku,
    brand: product.brand ? { "@type": "Brand", name: product.brand } : undefined,
    image: product.images.map((img) => img.url),
    offers: {
      "@type": "Offer",
      url: `${SITE_ORIGIN}/${category?.slug ?? "urun"}/${product.slug}`,
      price: product.basePrice,
      priceCurrency: "TRY",
      availability: totalStock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      seller: { "@type": "Organization", name: product.vendorStoreName },
    },
    ...(summary.total > 0 && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: summary.average,
        reviewCount: summary.total,
      },
    }),
  };

  // bkz. denetim raporu: "Breadcrumb ... structured data" - HTML kırıntı
  // izi zaten vardı (aşağıdaki .breadcrumb), Google'ın arama sonuçlarında
  // yol gösterebilmesi için schema.org BreadcrumbList karşılığı yoktu.
  const breadcrumbItems = [
    { name: "Ana Sayfa", url: SITE_ORIGIN },
    ...(category ? [{ name: category.name, url: `${SITE_ORIGIN}/${category.slug}` }] : []),
    { name: product.name, url: `${SITE_ORIGIN}/${category?.slug ?? "urun"}/${product.slug}` },
  ];
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbItems.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };

  const discountPercent = product.compareAtPrice
    ? Math.round((1 - Number(product.basePrice) / Number(product.compareAtPrice)) * 100)
    : null;

  return (
    <main className="main-content">
      <DwellTracker productId={product.id} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <div className="breadcrumb-bar">
        <div className="container">
          <div className="breadcrumb">
            <Link href="/">Ana Sayfa</Link> <span className="sep">{">"}</span>
            {category && (
              <>
                <Link href={`/${category.slug}`}>{category.name}</Link> <span className="sep">{">"}</span>
              </>
            )}
            <span className="current">{product.name}</span>
          </div>
        </div>
      </div>

      <section className="product-detail-section">
        <div className="container">
          <div className="product-detail-grid">
            <ProductGallery productId={product.id} productName={product.name} images={product.images} />

            <div className="product-detail-info">
              <h1 className="detail-name">{product.name}</h1>

              {(product.brand || product.condition) && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                  {product.brand && <span className="st st-muted">{product.brand}</span>}
                  {product.condition && <span className="st st-muted">{CONDITION_LABELS[product.condition]}</span>}
                  {product.isSecondHand && <span className="st st-muted">2. El</span>}
                </div>
              )}

              <div className="detail-vendor-card">
                <Link href={`/${product.vendorSlug}`} className="detail-vendor-link">
                  <span className="detail-vendor-logo">
                    {vendorSummary?.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={vendorSummary.logo} alt="" />
                    ) : (
                      product.vendorStoreName.charAt(0).toLocaleUpperCase("tr-TR")
                    )}
                  </span>
                  <div className="detail-vendor-info">
                    <small>Satıcı</small>
                    <strong>
                      {product.vendorStoreName}
                      {vendorSummary?.isVerified && <i className="fas fa-circle-check detail-vendor-verified" title="Onaylı Mağaza" />}
                    </strong>
                    {vendorSummary && vendorSummary.reviewSummary.total > 0 && (
                      <div className="detail-vendor-rating">
                        <StarRating value={vendorSummary.reviewSummary.average ?? 0} size={12} />
                        {vendorSummary.reviewSummary.average?.toFixed(1)} <em>({vendorSummary.reviewSummary.total} değerlendirme)</em>
                      </div>
                    )}
                  </div>
                  <i className="fas fa-chevron-right detail-vendor-arrow" />
                </Link>

                {vendorSummary && (
                  <div className="detail-vendor-stats">
                    <span>
                      <FollowerCountStat initialCount={vendorSummary.followerCount} /> Takipçi
                    </span>
                    {vendorSummary.city && (
                      <span>
                        <i className="fas fa-location-dot" /> {vendorSummary.city}
                      </span>
                    )}
                    {vendorSummary.answeredQuestionCount > 0 && (
                      <span>
                        <i className="fas fa-circle-question" /> {vendorSummary.answeredQuestionCount} Soru Cevaplandı
                      </span>
                    )}
                    <FollowButton vendorSlug={product.vendorSlug} initialFollowing={vendorSummary.isFollowing} />
                  </div>
                )}
              </div>

              {product.videoUrl && (
                <video
                  src={product.videoUrl}
                  controls
                  playsInline
                  preload="metadata"
                  style={{ width: "100%", borderRadius: 12, background: "#000", marginTop: "0.8rem", display: "block" }}
                />
              )}

              <div style={{ marginTop: "0.8rem" }}>
                <VirtualTryOn productImage={product.images[0]?.url ?? null} productName={product.name} />
              </div>

              {summary.total > 0 && (
                <p style={{ marginTop: "0.6rem", fontSize: "0.85rem" }}>
                  <StarRating value={summary.average ?? 0} size={15} /> {summary.average?.toFixed(1)} / 5 ({summary.total}{" "}
                  değerlendirme)
                </p>
              )}

              <div className="detail-price">
                <span className="price-current">
                  {Number(product.basePrice).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺
                </span>
                {product.compareAtPrice && (
                  <span className="price-old">
                    {Number(product.compareAtPrice).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺
                  </span>
                )}
                {discountPercent !== null && discountPercent > 0 && (
                  <span className="badge badge-sale">%{discountPercent} İndirim</span>
                )}
              </div>

              <ProductCampaignBadge
                productId={product.id}
                categorySlug={category?.slug ?? ""}
                vendorSlug={product.vendorSlug}
                detail
              />

              {product.description && <div className="detail-description">{product.description}</div>}

              {Object.keys(product.attributes ?? {}).length > 0 && (
                <div style={{ marginTop: "1rem", border: "1px solid var(--color-border)", borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ padding: "10px 14px", fontWeight: 700, background: "var(--color-bg-alt)" }}>Ürün Özellikleri</div>
                  {Object.entries(product.attributes).map(([key, value]) => (
                    <div key={key} style={{ display: "grid", gridTemplateColumns: "minmax(100px, 0.8fr) 1.2fr", gap: 12, padding: "9px 14px", borderTop: "1px solid var(--color-border)", fontSize: "0.9rem" }}>
                      <span style={{ color: "var(--color-text-light)" }}>{key}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
              )}

              {product.hasDefect && (
                <div
                  style={{
                    marginTop: "1rem",
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid var(--er)",
                    background: "rgba(226,59,82,.06)",
                  }}
                >
                  <i className="fas fa-triangle-exclamation" style={{ color: "var(--er)", marginTop: 2 }} />
                  <div>
                    <strong style={{ color: "var(--er)" }}>Bu üründe kusur/deformasyon var</strong>
                    {product.defectDescription && <p style={{ margin: "4px 0 0", fontSize: "0.9rem" }}>{product.defectDescription}</p>}
                  </div>
                </div>
              )}

              <FitPanel slug={slug} />

              <AddToCartButton
                productId={product.id}
                variants={product.variants}
                price={Number(product.basePrice)}
                stock={product.stock}
                sizeChart={product.sizeChart}
              />

              <div className="detail-features">
                <div className="feature-item">
                  <i className="fas fa-shipping-fast" /> Hızlı Kargo
                </div>
                <div className="feature-item">
                  <i className="fas fa-undo" /> 14 Gün Koşulsuz İade
                </div>
                <div className="feature-item">
                  <i className="fas fa-shield-alt" /> Güvenli Ödeme
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="products-section" style={{ backgroundColor: "var(--color-bg-alt)" }}>
        <div className="container">
          <div className="reviews-qna-grid">
            <div id="degerlendirmeler">
              <div className="section-header" style={{ textAlign: "left", marginBottom: 20 }}>
                <h2 className="section-title">Değerlendirmeler {reviews.length > 0 && `(${reviews.length})`}</h2>
              </div>

              <div className="review-list">
                {reviews.length === 0 ? (
                  !customer && (
                    <p style={{ fontSize: "0.85rem" }}>
                      Bu ürün için henüz değerlendirme yapılmamış. İlk yorumu siz yazın!
                    </p>
                  )
                ) : (
                  reviews.map((r) => (
                    <div key={r.id} className="review-card">
                      <div className="review-card-head">
                        <strong>{r.customerName}</strong>
                        <StarRating value={r.rating} />
                      </div>
                      {r.comment && <p>{r.comment}</p>}
                      <div className="review-card-date">{new Date(r.createdAt).toLocaleDateString("tr-TR")}</div>
                      {r.vendorReply && (
                        <div className="review-vendor-reply">
                          <strong>
                            <i className="fas fa-store" /> Satıcı Yanıtı:
                          </strong>
                          <p>{r.vendorReply}</p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              <ReviewForm slug={slug} loggedIn={!!customer} />
            </div>

            <div id="sorular">
              <Link
                href={category ? `/${category.slug}/${product.slug}/sorular` : `/urun/${product.slug}/sorular`}
                className="section-header"
                style={{ textAlign: "left", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}
              >
                <h2 className="section-title">Sorular {questions.length > 0 && `(${questions.length})`}</h2>
                <i className="fas fa-chevron-right" style={{ color: "var(--color-text-light)" }} />
              </Link>

              <div className="review-list">
                {questions.length === 0 ? (
                  !customer && <p style={{ fontSize: "0.85rem" }}>Bu ürün hakkında henüz soru sorulmamış.</p>
                ) : (
                  questions.slice(0, 3).map((q) => (
                    <div key={q.id} className="review-card">
                      <strong style={{ fontSize: 13 }}>{q.customerName}</strong>
                      <p>{q.question}</p>
                      {q.answer && (
                        <div className="review-vendor-reply">
                          <strong>
                            <i className="fas fa-store" /> Satıcı Yanıtı:
                          </strong>
                          <p>{q.answer}</p>
                          {customer && (
                            <QuestionHelpfulButton
                              slug={slug}
                              questionId={q.id}
                              initialCount={q.helpfulCount ?? 0}
                              initialVoted={q.hasVoted ?? false}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
                {questions.length > 3 && (
                  <Link
                    href={category ? `/${category.slug}/${product.slug}/sorular` : `/urun/${product.slug}/sorular`}
                    style={{ fontSize: "0.85rem", fontWeight: 600 }}
                  >
                    Tüm soruları gör ({questions.length}) <i className="fas fa-chevron-right" style={{ fontSize: 11 }} />
                  </Link>
                )}
              </div>

              <QuestionForm slug={slug} loggedIn={!!customer} />
            </div>
          </div>
        </div>
      </section>

      {relatedProducts.length > 0 && (
        <section className="products-section">
          <div className="container">
            <div className="section-header" style={{ marginBottom: 20 }}>
              <h2 className="section-title">Benzer Ürünler</h2>
            </div>
            <div className="product-grid">
              {relatedProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* bkz. denetim raporu madde 19: "Bunları da Beğenebilirsiniz" -
          anasayfadaki "Sana Özel" akışının aynısı, sadece cold-start
          olmayan (gerçekten kişiselleştirilmiş) sonuçta gösterilir. */}
      {personalizedProducts.length > 0 && (
        <section className="products-section" style={{ backgroundColor: "var(--color-bg-alt)" }}>
          <div className="container">
            <div className="section-header" style={{ marginBottom: 20 }}>
              <h2 className="section-title">Bunları da Beğenebilirsiniz</h2>
            </div>
            <div className="product-grid">
              {personalizedProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* bkz. denetim raporu madde 19: "Aynı Mağazadan". */}
      {sameVendorProducts.length > 0 && (
        <section className="products-section">
          <div className="container">
            <div className="section-header" style={{ marginBottom: 20 }}>
              <h2 className="section-title">{product.vendorStoreName} Mağazasından</h2>
            </div>
            <div className="product-grid">
              {sameVendorProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
