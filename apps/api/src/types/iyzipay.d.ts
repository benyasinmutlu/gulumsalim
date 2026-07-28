// iyzico'nun resmi npm paketi (iyzipay) TypeScript tipleri sağlamıyor -
// eski callback tabanlı bir API sunuyor. Gerçek tip güvenliği
// modules/orders/iyzico.client.ts'deki dar Promise sarmalayıcısında.
declare module "iyzipay" {
  export default class Iyzipay {
    constructor(options: { apiKey: string; secretKey: string; uri: string });
    checkoutFormInitialize: {
      create(request: Record<string, unknown>, callback: (err: Error | null, result: unknown) => void): void;
    };
    checkoutForm: {
      retrieve(request: Record<string, unknown>, callback: (err: Error | null, result: unknown) => void): void;
    };
    refundV2: {
      create(request: Record<string, unknown>, callback: (err: Error | null, result: unknown) => void): void;
    };
  }
}
