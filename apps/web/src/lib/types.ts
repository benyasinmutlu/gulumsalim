// apps/api'nin JSON yanıt şekillerinin ince (hafif) TS karşılıkları.
// Şimdilik elle senkron tutuluyor - packages/shared-contracts'a taşımak
// sözleşme büyüdükçe değerlenecek bir adım (bkz. mimari planı, açık karar 8).

export interface FollowedVendor {
  id: number;
  storeName: string;
  storeSlug: string;
  logo: string | null;
  productCount: number;
}

export interface CustomerOrderListItem {
  id: number;
  orderNumber: string;
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded";
  paymentStatus: "pending" | "paid" | "failed" | "refunded";
  total: string;
  createdAt: string;
  itemCount: number;
  previewImages: string[];
}

export interface PendingReviewItem {
  orderItemId: number;
  orderNumber: string;
  productId: number;
  productName: string;
  productSlug: string;
  imageUrl: string | null;
}

export interface CustomerOrderDetail {
  id: number;
  orderNumber: string;
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded";
  paymentStatus: "pending" | "paid" | "failed" | "refunded";
  paymentProvider: string;
  subtotal: string;
  shippingFee: string;
  total: string;
  shippingAddress: Record<string, unknown>;
  orderNote: string | null;
  createdAt: string;
  items: {
    id: number;
    productNameSnapshot: string;
    unitPrice: string;
    quantity: number;
    total: string;
    vendorStatus: string;
    vendorStoreName: string;
    productId: number;
    productSlug: string;
    productImage: string | null;
    trackingCarrier: string | null;
    trackingNumber: string | null;
    shippedAt: string | null;
  }[];
}

export interface CustomerRefund {
  id: number;
  orderItemId: number;
  reason: string;
  photos: string[];
  status: "pending" | "approved" | "rejected" | "item_received" | "refunding" | "refunded";
  vendorNote: string | null;
  returnTrackingCarrier: string | null;
  returnTrackingNumber: string | null;
  returnShippedAt: string | null;
  receivedByVendorAt: string | null;
  refundedAt: string | null;
  requestedAt: string;
  productNameSnapshot: string;
  orderNumber: string;
  vendorStoreName: string;
}

export interface CustomerReview {
  id: number;
  rating: number;
  comment: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  productId: number;
  productName: string;
  productSlug: string;
}

export interface CustomerQuestion {
  id: number;
  productId: number;
  productName: string;
  productSlug: string;
  question: string;
  answer: string | null;
  createdAt: string;
}

export interface CustomerAddress {
  id: number;
  customerId: number;
  fullName: string;
  phone: string;
  city: string;
  district: string;
  addressLine: string;
  zipCode: string | null;
  isDefault: boolean;
  createdAt: string;
}

export interface TopViewedCategory {
  id: number;
  name: string;
  slug: string;
  image: string | null;
  totalViews: number;
}

export interface Category {
  id: number;
  parentId: number | null;
  name: string;
  slug: string;
  icon: string | null;
  image: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface ProductListItem {
  id: number;
  name: string;
  slug: string;
  basePrice: string;
  compareAtPrice: string | null;
  createdAt: string;
  vendorStoreName: string;
  vendorSlug: string;
  categorySlug: string;
  primaryImageUrl: string | null;
  imageUrls?: string[];
  avgRating: number | null;
  reviewCount: number;
  // Toplumsal kanıt (social proof) sayaçları - bkz. kullanıcı isteği: "kaç
  // müşteri favorilemiş kaç müşteri bakmış kaç kişi satın almış kaç
  // kişinin sepetinde". cartCount canlı Redis indeksinden geldiği için
  // (bkz. lib/cart-product-index.ts) diğerlerine göre daha oynak olabilir.
  viewCount: number;
  favoriteCount: number;
  purchaseCount: number;
  cartCount: number;
  // bkz. kullanıcı isteği: "bireysel olarak müşteri olarak kayıt olan
  // kişilerde satış yapabilsin 2. el ürün letgo dolap gibi"
  isSecondHand?: boolean;
  vendorIsIndividual?: boolean;
}

// gulumsalim.com'daki productUrl() helper'ının karşılığı: kategorili
// ürünler için /{kategori}/{ürün} (asıl SEO URL'i), yoksa /urun/{slug}.
export function productUrl(product: Pick<ProductListItem, "slug" | "categorySlug">): string {
  return product.categorySlug ? `/${product.categorySlug}/${product.slug}` : `/urun/${product.slug}`;
}

export interface ProductListResponse {
  items: ProductListItem[];
  nextCursor: string | null;
}

export interface ProductImage {
  url: string;
  isPrimary: boolean;
  sortOrder: number;
}

export interface ProductVariant {
  id: number;
  sku: string;
  size: string | null;
  color: string | null;
  priceOverride: string | null;
  stock: number;
}

export interface ProductDetail {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  attributes: Record<string, string>;
  brand: string | null;
  basePrice: string;
  compareAtPrice: string | null;
  categoryId: number;
  vendorId: number;
  vendorStoreName: string;
  vendorSlug: string;
  videoUrl?: string | null;
  images: ProductImage[];
  variants: ProductVariant[];
  // bkz. kullanıcı isteği (2026-08-03): "kurumsal satıcıların stokları
  // zorunlu olarak girilmeli bireysel satıcıların ise stoğu 1 olacak" -
  // varyantı olmayan ürünlerde stok kaynağı budur (bkz.
  // add-to-cart-button.tsx, variants.length > 0 iken variant.stock kullanılır).
  stock: number;
}

export interface CartItem {
  productId: number;
  productName: string;
  productSlug: string;
  variantId?: number;
  variantLabel?: string;
  image: string | null;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
  // bkz. kullanıcı isteği: "stok durumu sürekli kontrol ettirilmeli" -
  // varyantsız ürünlerde stok kavramı olmadığı için undefined.
  availableStock?: number;
}

export interface CartStockNotice {
  productName: string;
  variantLabel?: string;
  availableStock: number;
}

export interface CartShippingRow {
  storeName: string;
  fee: string;
  free: boolean;
}

export interface CartResponse {
  items: CartItem[];
  subtotal: string;
  shippingFee: string;
  // Satıcı-bazlı kargo kırılımı (her satıcı için ayrı ücret) - müşteriye
  // "hangi mağazadan ne kadar kargo" göstermek için.
  shippingBreakdown: CartShippingRow[];
  freeShippingThreshold: number;
  // Kupon session'da kayıtlı kalabilir; kampanya daha avantajlıysa tahsilatta
  // yalnız aşağıdaki discountSource ile belirtilen kaynak uygulanır.
  couponCode: string | null;
  appliedCouponCode: string | null;
  campaignId: number | null;
  discountSource: "coupon" | "campaign" | null;
  discountAmount: string;
  total: string;
  stockNotices: CartStockNotice[];
}

export interface FeaturedCoupon {
  code: string;
  type: "percent" | "fixed";
  value: string;
  minOrderAmount: string | null;
}

export interface AdminCoupon {
  id: number;
  code: string;
  type: "percent" | "fixed";
  value: string;
  minOrderAmount: string | null;
  maxUsesTotal: number | null;
  maxUsesPerCustomer: number;
  usedCount: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  isFeatured: boolean;
  createdAt: string;
}

export interface SizePrefs {
  kadinBeden?: string[];
  ayakkabiNo?: number[];
  cocukBeden?: string[];
}

export interface CustomerProfile {
  id: number;
  email: string;
  fullName: string;
  phone: string | null;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  sizePrefs: SizePrefs | null;
  // true = Google ile anında açılmış hesap, Üyelik Sözleşmesi/KVKK onayı
  // henüz tamamlanmadı (bkz. google-signin-button.tsx, uyelik-tamamla/page.tsx).
  needsConsent: boolean;
  // Google ile kayıtta otomatik dolar, müşteri kendi fotoğrafını yükleyerek
  // değiştirebilir (bkz. profile-form.tsx, POST /auth/me/avatar).
  avatarUrl: string | null;
}

export interface ApiErrorBody {
  error: { message: string; code?: string; details?: unknown };
}

export interface VendorProfile {
  id: number;
  storeName: string;
  storeSlug: string;
  email: string;
  status: "pending" | "active" | "suspended" | "banned";
  vendorType?: "business" | "individual";
  fullName: string;
  phone: string | null;
  logo: string | null;
  about: string | null;
  coverImage: string | null;
  city: string | null;
  whatsapp: string | null;
  instagram: string | null;
  facebook: string | null;
  twitter: string | null;
  youtube: string | null;
  tiktok: string | null;
  website: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  bankName: string | null;
  bankIban: string | null;
  bankAccountHolder: string | null;
  taxId: string | null;
  legalAddress: string | null;
}

export interface VendorProduct {
  id: number;
  vendorId: number;
  categoryId: number;
  name: string;
  slug: string;
  description: string | null;
  attributes: Record<string, string>;
  brand: string | null;
  basePrice: string;
  compareAtPrice: string | null;
  status: "draft" | "pending" | "active" | "inactive" | "rejected";
  freeShipping: boolean;
  isSecondHand?: boolean;
  viewCount: number;
  favoriteCount: number;
  cartCount: number;
  // Varyantı olan üründe variant toplamı, varyantsız üründe products.stock
  // (bkz. kullanıcı isteği 2026-08-03: "kurumsal satıcıların stokları
  // zorunlu ... bireysel satıcıların ise stoğu 1 olacak").
  totalStock: number;
  hasVariants: boolean;
  primaryImageUrl: string | null;
  videoUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VendorProductImage {
  id: number;
  productId: number;
  url: string;
  isPrimary: boolean;
  sortOrder: number;
}

export interface VendorProductVariant {
  id: number;
  sku: string;
  size: string | null;
  color: string | null;
  priceOverride: string | null;
  stock: number;
}

export interface VendorOrderItem {
  id: number;
  orderId: number;
  orderNumber: string;
  productId: number;
  productNameSnapshot: string;
  productImageUrl: string | null;
  variantSize: string | null;
  variantColor: string | null;
  unitPrice: string;
  quantity: number;
  total: string;
  vendorStatus: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  trackingCarrier: string | null;
  trackingNumber: string | null;
  shippedAt: string | null;
  orderCreatedAt: string;
  shippingAddress: { fullName?: string; phone?: string; city?: string; district?: string; addressLine?: string; zipCode?: string };
  orderNote: string | null;
  customerEmail: string;
}

export interface VendorWallet {
  walletBalance: string;
  totalGross: string;
  totalNet: string;
  totalPaidOut: string;
  pendingEarnings: string;
  commissionRate: number;
  bankName: string | null;
  bankIban: string | null;
  bankAccountHolder: string | null;
}

export interface AdminCampaign {
  id: number;
  name: string;
  type: "percent" | "free_shipping";
  scope: "all" | "category" | "vendor" | "product";
  scopeId: number | null;
  value: string;
  minOrderAmount: string | null;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface ActiveCampaign {
  id: number;
  name: string;
  type: "percent" | "free_shipping";
  scope: "all" | "category" | "vendor" | "product";
  scopeId: number | null;
  value: number;
  minOrderAmount: number | null;
  startsAt: string | null;
  endsAt: string | null;
  scopeSlug?: string | null;
}

export interface CampaignVendor {
  vendorId: number;
  storeName: string;
  storeSlug: string;
  logo: string | null;
  campaignLabel: string;
  campaignName: string;
}

export interface VendorEarning {
  id: number;
  orderItemId: number;
  orderNumber: string | null;
  productName: string | null;
  netAmount: string;
  createdAt: string;
}

export interface VendorFinanceRefund {
  id: number;
  orderNumber: string | null;
  reason: string;
  status: "pending" | "approved" | "rejected";
  amount: string;
  requestedAt: string;
}

export interface VendorDashboardStats {
  todaySales: string;
  monthSales: string;
  totalOrders: number;
  pendingOrders: number;
  productCount: number;
  avgRating: number | null;
  reviewCount: number;
  lowStockCount: number;
  followerCount: number;
  storeViewCount: number;
}

export interface VendorDashboardRecentOrder {
  id: number;
  orderNumber: string;
  productNameSnapshot: string;
  total: string;
  vendorStatus: string;
  createdAt: string;
  customerName: string;
}

export interface DailySalesPoint {
  date: string;
  total: string;
}

export interface OrderStatusCount {
  status: string;
  count: number;
}

// bkz. kullanıcı isteği (mockup): istatistik kartlarının yanında önceki
// döneme göre değişim yüzdesi - null, ya önceki dönemde veri olmadığı
// (bölme sıfıra) ya da (ziyaretçi sayısı gibi) hiç hesaplanamayan bir
// metrik olduğu anlamına gelir; asla 0 ile karıştırılmamalı.
export interface PeriodComparison {
  revenueChangePercent: number | null;
  orderCountChangePercent: number | null;
}

export interface VendorDashboardData {
  stats: VendorDashboardStats;
  recentOrders: VendorDashboardRecentOrder[];
  salesTimeSeries: DailySalesPoint[];
  orderStatusBreakdown: OrderStatusCount[];
  periodComparison: PeriodComparison;
}

export interface VendorPayout {
  id: number;
  vendorId: number;
  amount: string;
  iban: string | null;
  accountHolder: string | null;
  note: string | null;
  status: "pending" | "paid" | "rejected";
  requestedAt: string;
  processedAt: string | null;
  rejectionReason: string | null;
  transferReference: string | null;
}

export interface AdminProfile {
  id: number;
  username: string;
  fullName: string;
}

export interface AdminVendorRow {
  id: number;
  storeName: string;
  storeSlug: string;
  email: string;
  fullName: string;
  phone: string | null;
  status: "pending" | "active" | "suspended" | "banned";
  vendorType: "business" | "individual";
  isVerified: boolean;
  createdAt: string;
  commissionRate: string | null;
  productCount: string;
  pendingProductCount: string;
}

export interface AdminVendorsResponse {
  vendors: AdminVendorRow[];
  counts: Record<string, number>;
  typeCounts: Record<string, number>;
}

export interface AdminPayoutRow {
  id: number;
  vendorId: number;
  vendorStoreName: string;
  amount: string;
  iban: string | null;
  accountHolder: string | null;
  note: string | null;
  status: "pending" | "paid" | "rejected";
  requestedAt: string;
  processedAt: string | null;
  rejectionReason: string | null;
  transferReference: string | null;
}

export interface AdminFinanceStats {
  platformGrossRevenue: string;
  platformCommissionRevenue: string;
  vendorNetEarnings: string;
  pendingPayoutTotal: string;
  paidPayoutTotal: string;
  vendorBalanceTotal: string;
}

export interface AdminVendorFinanceSummary {
  id: number;
  storeName: string;
  storeSlug: string;
  logo: string | null;
  bankIban: string | null;
  walletBalance: string;
  grossRevenue: string;
  netEarnings: string;
  totalPaid: string;
  productCount: number;
  avgRating: string | null;
  lowStockCount: number;
}

export interface AdminFinanceOverview {
  stats: AdminFinanceStats;
  vendorSummaries: AdminVendorFinanceSummary[];
}

export interface AdminPage {
  id: number;
  slug: string;
  title: string;
  content: string;
  showInFooter: boolean;
  sortOrder: number;
  updatedAt: string;
}

export interface FooterPage {
  slug: string;
  title: string;
}

export interface SiteSettings {
  site_name?: string;
  site_email?: string;
  site_phone?: string;
  site_whatsapp?: string;
  site_instagram?: string;
  site_facebook?: string;
  site_address?: string;
  footer_about?: string;
  site_logo?: string;
  color_primary?: string;
  color_primary_dark?: string;
  color_secondary?: string;
  color_accent?: string;
  shipping_cost?: string;
  free_shipping_limit?: string;
  meta_title?: string;
  meta_description?: string;
  contact_intro?: string;
  contact_hours?: string;
  ga_measurement_id?: string;
  gtm_container_id?: string;
  meta_pixel_id?: string;
  hero_height_desktop?: string;
  hero_height_mobile?: string;
  hero_interval_ms?: string;
}

export interface AdminSlider {
  id: number;
  image: string;
  linkUrl: string | null;
  title: string | null;
  subtitle: string | null;
  buttonText: string | null;
  textColor: string | null;
  textPosition: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface AdminPromoBanner {
  id: number;
  title: string;
  image: string;
  linkUrl: string | null;
  linkType: "url" | "category" | "vendor";
  animStyle: string | null;
  subtitle: string | null;
  buttonText: string | null;
  textColor: string | null;
  rotateSeconds: number | null;
  sortOrder: number;
  isActive: boolean;
  vendorId: number | null;
  status: "pending" | "approved" | "rejected";
  rejectionNote: string | null;
}

export interface PublicVendorListItem {
  id: number;
  storeName: string;
  storeSlug: string;
  logo: string | null;
  coverImage: string | null;
  isVerified: boolean;
  createdAt: string;
  productCount: number;
  followerCount: number;
  avgRating: number | null;
}

export interface SearchMatches {
  categories: { id: number; name: string; slug: string }[];
  vendors: { id: number; storeName: string; storeSlug: string; logo: string | null }[];
}

export interface PublicVendorReview {
  id: number;
  rating: number;
  comment: string | null;
  createdAt: string;
  customerName: string;
}

export interface AdminVendorReviewRow {
  id: number;
  vendorId: number;
  vendorStoreName: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  customerName: string;
}

export interface AdminVendorComplaintRow {
  id: number;
  vendorId: number;
  vendorStoreName: string;
  customerName: string;
  reason: string;
  message: string;
  status: "pending" | "reviewed" | "dismissed";
  adminNote: string | null;
  createdAt: string;
}

export interface PublicVendorProfile {
  id: number;
  storeName: string;
  storeSlug: string;
  logo: string | null;
  storeLayout: VendorStoreLayoutSection[];
  isFollowing: boolean;
  isVerified: boolean;
  vendorType: "business" | "individual";
  reviewSummary: { average: number | null; total: number };
  about: string | null;
  coverImage: string | null;
  city: string | null;
  whatsapp: string | null;
  instagram: string | null;
  facebook: string | null;
  twitter: string | null;
  youtube: string | null;
  tiktok: string | null;
  website: string | null;
  productCount: number;
  followerCount: number;
  createdAt: string;
  successRate: number | null;
  answeredQuestionCount: number;
}

export interface VendorPromoBanner {
  id: number;
  title: string;
  image: string;
  linkUrl: string | null;
  subtitle: string | null;
  buttonText: string | null;
  textColor: string | null;
  extraImages?: string[];
  resolvedLink?: string | null;
  rotateSeconds?: number | null;
  animStyle?: string | null;
}

export interface PublicVendorCollection {
  id: number;
  name: string;
  slug: string;
  coverImage: string | null;
}

export interface VendorStorefront {
  vendor: PublicVendorProfile;
  products: ProductListResponse;
}

export interface ProductReview {
  id: number;
  rating: number;
  comment: string | null;
  createdAt: string;
  customerName: string;
  vendorReply: string | null;
}

export interface VendorReview {
  id: number;
  productId: number;
  productName: string;
  rating: number;
  comment: string | null;
  status: "pending" | "approved" | "rejected";
  vendorReply: string | null;
  createdAt: string;
  customerName: string;
}

export interface AdminQuestionRow {
  id: number;
  productId: number;
  productName: string;
  productSlug: string;
  vendorStoreName: string;
  question: string;
  answer: string | null;
  createdAt: string;
  customerName: string;
}

export interface ProductReviewsResponse {
  reviews: ProductReview[];
  summary: { average: number | null; total: number };
}

export interface ProductQuestion {
  id: number;
  question: string;
  answer: string | null;
  createdAt: string;
  customerName: string;
}

export interface AdminPendingReview {
  id: number;
  productId: number;
  productName: string;
  productSlug: string;
  vendorStoreName: string;
  rating: number;
  comment: string | null;
  vendorReply: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  customerName: string;
}

export interface VendorQuestion {
  id: number;
  productId: number;
  productName: string;
  question: string;
  answer: string | null;
  createdAt: string;
  customerName: string;
}

export interface VendorRefund {
  id: number;
  orderItemId: number;
  reason: string;
  photos: string[];
  status: "pending" | "approved" | "rejected" | "item_received" | "refunding" | "refunded";
  vendorNote: string | null;
  returnTrackingCarrier: string | null;
  returnTrackingNumber: string | null;
  returnShippedAt: string | null;
  receivedByVendorAt: string | null;
  refundedAt: string | null;
  requestedAt: string;
  productNameSnapshot: string;
  orderNumber: string;
  customerEmail: string;
}

export interface ResolvedHomepageCollection {
  id: number;
  title: string;
  subtitle: string | null;
  textColor: string | null;
  linkUrl: string | null;
  products: ProductListItem[];
  sortOrder: number;
}

export interface ResolvedHomepageSectionBanner {
  id: number;
  title: string;
  image: string;
  linkUrl: string | null;
  linkType?: "url" | "category" | "vendor";
  animStyle?: string | null;
  resolvedLink?: string | null;
  subtitle: string | null;
  buttonText: string | null;
  textColor: string | null;
  rotateSeconds?: number | null;
  extraImages?: string[];
}

export interface AdminPromoBannerImage {
  id: number;
  bannerId: number;
  image: string;
  sortOrder: number;
}

export interface ResolvedHomepageSection {
  id: number;
  title: string;
  algoType: string;
  sortOrder: number;
  subtitle?: string;
  titleColor?: string;
  titleFont?: "display" | "sans" | "italic";
  animStyle?: "fade-up" | "zoom-in" | "slide-left" | "fade";
  bgStyle?: "plain" | "alt";
  subtitleColor?: string;
  bgColor?: string;
  bannerLayout?: "grid" | "stack";
  showTitle?: boolean;
  seoSlug?: string | null;
  endsAt?: string;
  categorySlug?: string;
  saleOnly?: boolean;
  products: ProductListItem[];
  banners?: ResolvedHomepageSectionBanner[];
}

export interface AdminHomepageCollection {
  id: number;
  title: string;
  subtitle: string | null;
  textColor: string | null;
  linkType: "category" | "vendor" | "url" | null;
  linkValue: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface HomepageCollectionProductRow {
  id: number;
  name: string;
  slug: string;
  basePrice: string;
  sortOrder: number;
  membershipId: number;
}

export interface AdminHomepageSection {
  id: number;
  title: string;
  algoType: string;
  config: Record<string, unknown>;
  sortOrder: number;
  isActive: boolean;
  seoSlug: string | null;
}

export type SearchSuggestion =
  | {
      kind: "product";
      id: number;
      name: string;
      slug: string;
      basePrice: string;
      categorySlug: string;
      primaryImageUrl: string | null;
    }
  | { kind: "category"; id: number; name: string; slug: string }
  | { kind: "vendor"; id: number; storeName: string; storeSlug: string; logo: string | null };

export interface AdminCategory {
  id: number;
  parentId: number | null;
  name: string;
  slug: string;
  icon: string | null;
  iconColor: string | null;
  image: string | null;
  sortOrder: number;
  isActive: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string | null;
  productCount: number;
  childCount: number;
}

export interface AdminProductRow {
  id: number;
  name: string;
  slug: string;
  basePrice: string;
  compareAtPrice: string | null;
  status: "draft" | "pending" | "active" | "inactive" | "rejected";
  viewCount: number;
  createdAt: string;
  vendorId: number;
  vendorStoreName: string;
  vendorSlug: string;
  categoryName: string;
  image: string | null;
  totalStock: number;
  hasVariants: boolean;
  favoriteCount: number;
}

export interface AdminCustomerRow {
  id: number;
  email: string;
  fullName: string;
  phone: string | null;
  emailVerifiedAt: string | null;
  createdAt: string;
  isGuest: boolean;
  orderCount: number;
  city: string | null;
  district: string | null;
  totalSpent: string;
}

export interface AdminOrderRow {
  id: number;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  total: string;
  createdAt: string;
  customerName: string;
  customerEmail: string;
}

export interface AdminOrderDetail extends AdminOrderRow {
  paymentProvider: string;
  subtotal: string;
  shippingFee: string;
  shippingAddress: Record<string, unknown>;
  orderNote: string | null;
  items: {
    id: number;
    productNameSnapshot: string;
    unitPrice: string;
    quantity: number;
    total: string;
    vendorStatus: string;
    vendorStoreName: string;
    productId: number;
    trackingCarrier: string | null;
    trackingNumber: string | null;
    shippedAt: string | null;
  }[];
}

export interface AdminDashboardStats {
  totalRevenue: string;
  totalOrders: number;
  totalActiveProducts: number;
  totalCustomers: number;
  pendingOrders: number;
  lowStockCount: number;
}

export interface AdminDashboardRecentOrder {
  id: number;
  orderNumber: string;
  status: string;
  total: string;
  createdAt: string;
  customerName: string;
}

export interface AdminDashboardLowStockProduct {
  id: number;
  name: string;
  basePrice: string;
  totalStock: number;
  primaryImageUrl: string | null;
}

export interface AdminDashboardMostViewedProduct {
  id: number;
  name: string;
  basePrice: string;
  viewCount: number;
  vendorStoreName: string;
  primaryImageUrl: string | null;
}

export interface AdminDashboardData {
  stats: AdminDashboardStats;
  recentOrders: AdminDashboardRecentOrder[];
  lowStockProducts: AdminDashboardLowStockProduct[];
  mostViewedProducts: AdminDashboardMostViewedProduct[];
  salesTimeSeries: DailySalesPoint[];
  orderStatusBreakdown: OrderStatusCount[];
  periodComparison: PeriodComparison;
}

// bkz. kullanıcı isteği: "admin panelden anlık sitede kaç kişi var
// görebilmeliyim ve bunun gibi bir çok detayı analizi ... hangi üründe
// nerde kaç saniye duruldu hangilerine en çok tıklanıldı" - GET
// /admin/dashboard/live (bkz. live-analytics-panel.tsx, periyodik çekilir).
export interface AdminLiveActivePage {
  path: string;
  count: number;
}

export interface AdminLiveProductStat {
  productId: number;
  productName: string;
  primaryImageUrl: string | null;
  categoryName: string;
  categorySlug: string;
  count?: number;
  quantity?: number;
  avgSeconds?: number;
}

export interface AdminLiveTopCategory {
  categoryName: string;
  categorySlug: string;
  totalViews: number;
}

export interface AdminLiveTodaySummary {
  orders: number;
  revenue: string;
  newCustomers: number;
}

export interface AdminDashboardLiveData {
  onlineNow: number;
  activePages: AdminLiveActivePage[];
  visitorsToday: number;
  visitorsLast7Days: { date: string; count: number }[];
  topViewedToday: AdminLiveProductStat[];
  topPurchasedToday: AdminLiveProductStat[];
  topCategoriesToday: AdminLiveTopCategory[];
  avgDwellToday: AdminLiveProductStat[];
  todaySummary: AdminLiveTodaySummary;
}

// bkz. kullanıcı isteği (2026-08-02): "kategoriler sayfalar koleksiyonlar
// mağazalar kampanyalar ... çok önemli bunlar ... bu datalar kaydedilsin" -
// GET /admin/content-analytics?period=day|week|month (bkz.
// icerik-analitigi/page.tsx). content-analytics.repository.ts'teki
// HydratedContentStat ile birebir aynı şekil.
export interface AdminContentStat {
  contentId: number;
  name: string;
  subtitle: string | null;
  href: string | null;
  primaryImageUrl: string | null;
  total: number;
  count: number;
}

export interface AdminBannerStat {
  id: number;
  title: string;
  image: string;
  views: number;
  clicks: number;
}

export interface AdminContentAnalyticsData {
  period: "day" | "week" | "month";
  products: {
    views: AdminContentStat[];
    purchases: AdminContentStat[];
    favorites: AdminContentStat[];
    cartAdds: AdminContentStat[];
    dwell: AdminContentStat[];
  };
  categories: AdminContentStat[];
  collections: AdminContentStat[];
  vendors: AdminContentStat[];
  homepageSections: { views: AdminContentStat[]; dwell: AdminContentStat[] };
  banners: AdminBannerStat[];
  searchQueries: { query: string; count: number }[];
}

export interface AdminRefundRow {
  id: number;
  reason: string;
  photos: string[];
  status: "pending" | "approved" | "rejected" | "item_received" | "refunding" | "refunded";
  vendorNote: string | null;
  adminNote: string | null;
  returnTrackingCarrier: string | null;
  returnTrackingNumber: string | null;
  returnShippedAt: string | null;
  receivedByVendorAt: string | null;
  refundedAt: string | null;
  requestedAt: string;
  vendorStoreName: string;
  customerName: string;
  orderNumber: string;
  productNameSnapshot: string;
  total: string;
}

export interface ContactMessage {
  id: number;
  name: string;
  email: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface AdminSiteFeedbackRow {
  id: number;
  customerId: number | null;
  rating: number | null;
  category: string | null;
  message: string;
  pageUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface VendorConversation {
  vendorId: number;
  vendorStoreName: string;
  vendorLogo: string | null;
  unreadCount: number;
  lastMessage: string | null;
  lastSender: "admin" | "vendor" | null;
  lastMessageAt: string | null;
}

export interface ThreadMessage {
  id: number;
  vendorId: number;
  sender: "admin" | "vendor";
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface CustomerThreadMessage {
  id: number;
  vendorId: number;
  customerId: number;
  sender: "customer" | "vendor";
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface VendorSideCustomerConversation {
  customerId: number;
  customerName: string;
  unreadCount: number;
  lastMessage: string | null;
  lastMessageAt: string | null;
}

export interface CustomerSideVendorConversation {
  vendorId: number;
  vendorStoreName: string;
  vendorStoreSlug: string;
  vendorLogo: string | null;
  unreadCount: number;
  lastMessage: string | null;
  lastMessageAt: string | null;
}

export interface VendorNotification {
  id: number;
  vendorId: number;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface CustomerNotification {
  id: number;
  customerId: number;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface VendorCollection {
  id: number;
  vendorId: number;
  name: string;
  slug: string;
  description: string | null;
  coverImage: string | null;
  sortOrder: number;
  isActive: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  createdAt: string;
}

export interface VendorCollectionProduct {
  id: number;
  productId: number;
  name: string;
  slug: string;
  basePrice: string;
  sortOrder: number;
  imageUrl: string | null;
}

export interface VendorStoreLayoutSection {
  type: "collections" | "products" | "about" | "slider" | "social" | "discount" | "favorites" | "recently_viewed";
  visible: boolean;
}

export interface VendorStoreSlide {
  id: number;
  image: string;
  title: string | null;
  subtitle: string | null;
  buttonText: string | null;
  linkUrl: string | null;
  sortOrder: number;
}

export interface VendorSocialPost {
  id: number;
  platform: "instagram" | "tiktok" | "youtube";
  postUrl: string;
  image: string | null;
  caption: string | null;
  sortOrder: number;
}

export interface VendorReportData {
  totalRevenue: string;
  netEarnings: string;
  monthRevenue: string;
  totalOrders: number;
  totalQuantity: number;
  monthlySales: { month: string; total: string }[];
  topProducts: { productId: number; name: string; totalQuantity: number; totalRevenue: string }[];
}

export interface BulkImportRowResult {
  row: number;
  name: string;
  status: "created" | "skipped" | "valid"; // "valid" = dryRun önizlemede eklenmeye hazır
  reason?: string;
}
