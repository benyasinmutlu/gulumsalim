import { randomUUID } from "node:crypto";

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

function moneyInCents(value: string): bigint | null {
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match?.[1]) return null;
  return BigInt(match[1]) * 100n + BigInt((match[2] ?? "").padEnd(2, "0"));
}

export function createPublicOrderNumber(): string {
  return `GS-${randomUUID()}`;
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
