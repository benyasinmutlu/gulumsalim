import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import Iyzipay from "iyzipay";
import { env } from "../../config/env";

const iyzipay = new Iyzipay({
  apiKey: env.IYZICO_API_KEY,
  secretKey: env.IYZICO_SECRET_KEY,
  uri: env.IYZICO_BASE_URL,
});

export interface CheckoutFormInitResult {
  status: string;
  token: string;
  checkoutFormContent: string;
  paymentPageUrl?: string;
  errorMessage?: string;
}

function createCheckoutForm(request: Record<string, unknown>): Promise<CheckoutFormInitResult> {
  return new Promise((resolve, reject) => {
    iyzipay.checkoutFormInitialize.create(request, (err, result) => {
      if (err) reject(err);
      else resolve(result as CheckoutFormInitResult);
    });
  });
}

const RETRYABLE_CODES = new Set(["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "EPIPE"]);

// iyzico'nun sandbox uç noktası zaman zaman TLS bağlantısını sıfırlıyor
// (ECONNRESET) - VPS'ten manuel curl/openssl testlerinde de görüldü, aynı
// istek bir sonraki denemede sorunsuz geçiyor. Bu, ödeme adımı olduğu için
// (sepet -> ödeme dönüşümünün tek noktası) sessizce başarısız olmaması adına
// kısa bir backoff ile birkaç kez yeniden denenir.
async function withNetworkRetry<T>(operation: () => Promise<T>, maxAttempts = 3): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (err) {
      const code = (err as { code?: string })?.code;
      const isRetryable = typeof code === "string" && RETRYABLE_CODES.has(code);
      if (!isRetryable || attempt === maxAttempts) throw err;
      await new Promise((r) => setTimeout(r, 300 * attempt));
    }
  }
  throw new Error("unreachable");
}

export function initializeCheckoutForm(request: Record<string, unknown>): Promise<CheckoutFormInitResult> {
  return withNetworkRetry(() => createCheckoutForm(request));
}

export interface CheckoutFormRetrieveResult {
  status: string;
  paymentStatus: string;
  fraudStatus?: number;
  token: string;
  basketId: string;
  price: string;
  paidPrice: string;
  paymentId?: string;
  currency?: string;
  conversationId?: string;
  signature?: string;
  itemTransactions?: Array<{
    itemId?: string;
    paymentTransactionId?: string;
    price?: string;
    paidPrice?: string;
  }>;
  // Basarili odemede iyzico'nun urettigi islem kimligi - refundV2.create
  // bir odemeyi token'la degil bu ID ile geri alir (bkz. refundPayment).
  errorMessage?: string;
}

function trimDecimalZeros(value: string): string {
  if (!value.includes(".")) return value;
  const trimmed = value.replace(/0+$/, "").replace(/\.$/, "");
  return trimmed || "0";
}

// iyzico CF Retrieve resmi imza sirasi:
// paymentStatus:paymentId:currency:basketId:conversationId:paidPrice:price:token
export function verifyCheckoutFormSignature(result: CheckoutFormRetrieveResult, secretKey = env.IYZICO_SECRET_KEY): boolean {
  const { paymentStatus, paymentId, currency, basketId, conversationId, paidPrice, price, token, signature } = result;
  if (!paymentStatus || !paymentId || !currency || !basketId || conversationId == null || !paidPrice || !price || !token || !signature) return false;
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
  const payload = [paymentStatus, paymentId, currency, basketId, conversationId, trimDecimalZeros(String(paidPrice)), trimDecimalZeros(String(price)), token].join(":");
  const expected = Buffer.from(createHmac("sha256", secretKey).update(payload).digest("hex"), "hex");
  const supplied = Buffer.from(signature, "hex");
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

function retrieveCheckoutFormOnce(token: string): Promise<CheckoutFormRetrieveResult> {
  return new Promise((resolve, reject) => {
    iyzipay.checkoutForm.retrieve({ locale: "tr", token }, (err, result) => {
      if (err) reject(err);
      else resolve(result as CheckoutFormRetrieveResult);
    });
  });
}

export interface RefundResult {
  status: string;
  paymentId?: string;
  price?: string;
  currency?: string;
  conversationId?: string;
  signature?: string;
  retryable?: boolean;
  errorMessage?: string;
}

export function verifyRefundSignature(result: RefundResult, secretKey = env.IYZICO_SECRET_KEY): boolean {
  const { paymentId, price, currency, conversationId, signature } = result;
  if (!paymentId || !price || !currency || conversationId == null || !signature || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const payload = [paymentId, trimDecimalZeros(String(price)), currency, conversationId].join(":");
  const expected = Buffer.from(createHmac("sha256", secretKey).update(payload).digest("hex"), "hex");
  const supplied = Buffer.from(signature, "hex");
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

export function refundItemPayment(params: { paymentTransactionId: string; price: string; ip: string }): Promise<RefundResult> {
  return new Promise((resolve, reject) => {
    const refund = (iyzipay as unknown as {
      refund: { create: (request: Record<string, unknown>, callback: (err: unknown, result: unknown) => void) => void };
    }).refund;
    refund.create(
      {
        locale: "tr",
        conversationId: randomUUID(),
        paymentTransactionId: params.paymentTransactionId,
        price: params.price,
        currency: "TRY",
        ip: params.ip,
      },
      (err: unknown, result: unknown) => {
        if (err) reject(err);
        else resolve(result as RefundResult);
      },
    );
  });
}

// Mutabakat sorgusunda gecici ag hatasi siparisi pending birakmasin.
export function retrieveCheckoutForm(token: string): Promise<CheckoutFormRetrieveResult> {
  return withNetworkRetry(() => retrieveCheckoutFormOnce(token));
}

// bkz. kullanıcı isteği: "ürün satıcıya teslim edildiğinden emin
// olduğumuzda müşteriye parasını iade edeceğiz" - admin-refunds.service.ts
// bu fonksiyonu, satıcı iade edilen ürünü fiziksel olarak aldığını
// işaretledikten SONRA çağırır, sipariş oluşturulurken değil.
export function refundPayment(params: { paymentId: string; price: string; ip: string }): Promise<RefundResult> {
  return new Promise((resolve, reject) => {
    iyzipay.refundV2.create(
      {
        locale: "tr",
        conversationId: randomUUID(),
        paymentId: params.paymentId,
        price: params.price,
        currency: "TRY",
        ip: params.ip,
      },
      (err, result) => {
        if (err) reject(err);
        else resolve(result as RefundResult);
      },
    );
  });
}
