// =============================================================================
// Ödeme callback güvenlik doğrulaması (port: top-level güvenlik incelemesi).
// =============================================================================
// iyzico callback'i (retrieveCheckoutForm ile server-to-server alınsa da)
// sipariş kaydıyla açıkça eşleştirilir: token siparişin paymentRef'i olmalı,
// basketId siparişin numarası olmalı VE tutarlar (BigInt kuruş — float YOK)
// birebir eşleşmeli. Bu, tamper edilmiş/yanlış-tutarlı bir "success"
// callback'inin siparişi ödenmiş işaretlemesini engeller (defense-in-depth;
// mevcut app/ akışı tutar doğrulaması yapmıyordu).

interface PaymentOrder {
  orderNumber: string;
  paymentRef: string | null;
  subtotal: string;
  total: string;
}

interface PaymentResult {
  status: string;
  paymentStatus: string;
  fraudStatus?: number;
  token: string;
  basketId: string;
  price: string;
  paidPrice: string;
}

interface ProviderItemTransaction {
  itemId?: string;
  paymentTransactionId?: string;
}

interface PaymentOrderItem {
  id: number;
  productId: number;
  paymentItemRef: string | null;
}

export interface VerifiedPaymentItem {
  orderItemId: number;
  paymentTransactionId: string;
}

export function verifyPaymentItemTransactions(
  providerItems: ProviderItemTransaction[] | undefined,
  orderItems: PaymentOrderItem[],
): VerifiedPaymentItem[] | null {
  if (!providerItems || providerItems.length !== orderItems.length || orderItems.length === 0) return null;
  const byProviderId = new Map<string, string>();
  for (const item of providerItems) {
    if (!item.itemId || !item.paymentTransactionId || byProviderId.has(item.itemId)) return null;
    byProviderId.set(item.itemId, item.paymentTransactionId);
  }

  const modern = orderItems.every((item) => item.paymentItemRef);
  const legacyProductIdsAreUnique = new Set(orderItems.map((item) => item.productId)).size === orderItems.length;
  if (!modern && !legacyProductIdsAreUnique) return null;

  const mapped: VerifiedPaymentItem[] = [];
  for (const item of orderItems) {
    const key = modern ? item.paymentItemRef! : String(item.productId);
    const paymentTransactionId = byProviderId.get(key);
    if (!paymentTransactionId) return null;
    mapped.push({ orderItemId: item.id, paymentTransactionId });
  }
  return mapped;
}

// Para string'ini tam sayı kuruşa çevirir. En fazla 2 ondalık; "149.900"
// gibi geçersiz biçimler null döner (reddedilir). Float kullanılmaz.
function moneyInCents(value: string): bigint | null {
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match?.[1]) return null;
  return BigInt(match[1]) * 100n + BigInt((match[2] ?? "").padEnd(2, "0"));
}

export function isVerifiedSuccessfulPayment(result: PaymentResult, order: PaymentOrder): boolean {
  const resultPrice = moneyInCents(result.price);
  const resultPaidPrice = moneyInCents(result.paidPrice);
  const orderSubtotal = moneyInCents(order.subtotal);
  const orderTotal = moneyInCents(order.total);

  return (
    result.status === "success"
    && result.paymentStatus === "SUCCESS"
    // iyzico: yalnizca fraudStatus=1 olan odeme sevk/teslim edilmeli.
    && result.fraudStatus === 1
    && result.token === order.paymentRef
    && result.basketId === order.orderNumber
    && resultPrice !== null
    && resultPrice === orderSubtotal
    && resultPaidPrice !== null
    && resultPaidPrice === orderTotal
  );
}
