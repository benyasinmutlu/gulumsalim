import { randomUUID } from "node:crypto";
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
export async function initializeCheckoutForm(request: Record<string, unknown>): Promise<CheckoutFormInitResult> {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await createCheckoutForm(request);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      const isRetryable = typeof code === "string" && RETRYABLE_CODES.has(code);
      if (!isRetryable || attempt === maxAttempts) throw err;
      await new Promise((r) => setTimeout(r, 300 * attempt));
    }
  }
  throw new Error("unreachable");
}

export interface CheckoutFormRetrieveResult {
  status: string;
  paymentStatus: string;
  token: string;
  basketId: string;
  price: string;
  paidPrice: string;
  // Basarili odemede iyzico'nun urettigi islem kimligi - refundV2.create
  // bir odemeyi token'la degil bu ID ile geri alir (bkz. refundPayment).
  paymentId?: string;
  errorMessage?: string;
}

export function retrieveCheckoutForm(token: string): Promise<CheckoutFormRetrieveResult> {
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
  errorMessage?: string;
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
