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
  token: string;
  basketId: string;
  price: string;
  paidPrice: string;
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
    && result.token === order.paymentRef
    && result.basketId === order.orderNumber
    && resultPrice !== null
    && resultPrice === orderSubtotal
    && resultPaidPrice !== null
    && resultPaidPrice === orderTotal
  );
}
