// apps/api'nin JSON yanıt şekillerinin ince (hafif) TS karşılıkları.
// Şimdilik elle senkron tutuluyor - packages/shared-contracts'a taşımak
// sözleşme büyüdükçe değerlenecek bir adım (bkz. mimari planı, açık karar 8).

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

export interface ProductDetail {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  basePrice: string;
  compareAtPrice: string | null;
  categoryId: number;
  vendorId: number;
  vendorStoreName: string;
  vendorSlug: string;
  images: ProductImage[];
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
}

export interface VendorProduct {
  id: number;
  vendorId: number;
  categoryId: number;
  name: string;
  slug: string;
  description: string | null;
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
  shippingAddress: { fullName?: string; phone?: string; city?: string; district?: string; addressLine?: string };
}

export interface VendorWallet {
  walletBalance: string;
  totalGross: string;
  totalNet: string;
  totalPaidOut: string;
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
