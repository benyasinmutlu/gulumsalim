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
  avgRating: number | null;
  reviewCount: number;
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
  brand: string | null;
  basePrice: string;
  compareAtPrice: string | null;
  categoryId: number;
  vendorId: number;
  vendorStoreName: string;
  vendorSlug: string;
  images: ProductImage[];
  variants: ProductVariant[];
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
}

export interface CartResponse {
  items: CartItem[];
  subtotal: string;
}

export interface CustomerProfile {
  id: number;
  email: string;
  fullName: string;
  phone: string | null;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
}

export interface ApiErrorBody {
  error: { message: string; details?: unknown };
}

export interface VendorProfile {
  id: number;
  storeName: string;
  storeSlug: string;
  email: string;
  status: "pending" | "active" | "suspended" | "banned";
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
}

export interface VendorProduct {
  id: number;
  vendorId: number;
  categoryId: number;
  name: string;
  slug: string;
  description: string | null;
  brand: string | null;
  basePrice: string;
  compareAtPrice: string | null;
  status: "draft" | "active" | "inactive" | "rejected";
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
  unitPrice: string;
  quantity: number;
  total: string;
  vendorStatus: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
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

export interface VendorDashboardData {
  stats: VendorDashboardStats;
  recentOrders: VendorDashboardRecentOrder[];
}

export interface VendorPayout {
  id: number;
  vendorId: number;
  amount: string;
  iban: string | null;
  note: string | null;
  status: "pending" | "paid" | "rejected";
  requestedAt: string;
  processedAt: string | null;
  rejectionReason: string | null;
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
  createdAt: string;
  productCount: string;
}

export interface AdminVendorsResponse {
  vendors: AdminVendorRow[];
  counts: Record<string, number>;
}

export interface AdminPayoutRow {
  id: number;
  vendorId: number;
  vendorStoreName: string;
  amount: string;
  iban: string | null;
  note: string | null;
  status: "pending" | "paid" | "rejected";
  requestedAt: string;
  processedAt: string | null;
  rejectionReason: string | null;
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
  bankIban: string | null;
  walletBalance: string;
  grossRevenue: string;
  netEarnings: string;
  totalPaid: string;
  productCount: number;
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
  isVerified: boolean;
  productCount: number;
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

export interface PublicVendorProfile {
  id: number;
  storeName: string;
  storeSlug: string;
  logo: string | null;
  storeLayout: VendorStoreLayoutSection[];
  isFollowing: boolean;
  isVerified: boolean;
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
  rating: number;
  comment: string | null;
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
  customerId: number;
  vendorId: number;
  reason: string;
  status: "pending" | "approved" | "rejected";
  adminNote: string | null;
  requestedAt: string;
  processedAt: string | null;
}

export interface ResolvedHomepageCollection {
  id: number;
  title: string;
  subtitle: string | null;
  textColor: string | null;
  linkUrl: string | null;
  products: ProductListItem[];
}

export interface ResolvedHomepageSection {
  id: number;
  title: string;
  algoType: string;
  subtitle?: string;
  titleColor?: string;
  products: ProductListItem[];
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
  image: string | null;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
}

export interface AdminProductRow {
  id: number;
  name: string;
  slug: string;
  basePrice: string;
  status: "draft" | "active" | "inactive" | "rejected";
  createdAt: string;
  vendorId: number;
  vendorStoreName: string;
  categoryName: string;
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
}

export interface AdminRefundRow {
  id: number;
  reason: string;
  status: "pending" | "approved" | "rejected";
  adminNote: string | null;
  requestedAt: string;
  processedAt: string | null;
  vendorStoreName: string;
  customerName: string;
  orderNumber: string;
  productNameSnapshot: string;
  total: string;
}

export interface VendorRefund {
  id: number;
  orderItemId: number;
  reason: string;
  status: "pending" | "approved" | "rejected";
  adminNote: string | null;
  requestedAt: string;
  processedAt: string | null;
}

export interface ContactMessage {
  id: number;
  name: string;
  email: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface VendorConversation {
  vendorId: number;
  vendorStoreName: string;
  unreadCount: number;
  lastMessage: string | null;
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

export interface VendorCollection {
  id: number;
  vendorId: number;
  name: string;
  slug: string;
  description: string | null;
  coverImage: string | null;
  sortOrder: number;
  isActive: boolean;
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
  type: "collections" | "products" | "about" | "slider" | "social";
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
  dailySales: { day: string; total: string }[];
  topProducts: { productId: number; name: string; totalQuantity: number; totalRevenue: string }[];
}

export interface BulkImportRowResult {
  row: number;
  name: string;
  status: "created" | "skipped";
  reason?: string;
}
