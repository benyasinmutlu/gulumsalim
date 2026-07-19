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

export function initializeCheckoutForm(request: Record<string, unknown>): Promise<CheckoutFormInitResult> {
  return new Promise((resolve, reject) => {
    iyzipay.checkoutFormInitialize.create(request, (err, result) => {
      if (err) reject(err);
      else resolve(result as CheckoutFormInitResult);
    });
  });
}

export interface CheckoutFormRetrieveResult {
  status: string;
  paymentStatus: string;
  token: string;
  basketId: string;
  price: string;
  paidPrice: string;
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
