// Kanal client SÖZLEŞMESİ + Trendyol/İkas iskeletleri. Gerçek HTTP çağrıları
// buraya gelir; şu an API anahtarı YOK -> env'den okur, yoksa net "configured
// değil" hatası verir (prod'da sessizce patlamaz). Anahtar gelince gövdeler
// doldurulur.

import type { SalesChannel } from "./inventory-sync";

export interface ChannelOrderLine {
  externalBarcode: string;
  quantity: number;
}

export interface ChannelStockUpdate {
  externalBarcode: string;
  stock: number;
}

// Her kanal bu arayüzü uygular. Böylece inventory-sync bir kanalın detayını
// bilmeden çalışır (repository/adapter deseni).
export interface ChannelClient {
  readonly channel: SalesChannel;
  isConfigured(): boolean;
  // Dışa stok itme (batch). Trendyol'da price-and-inventory async batch,
  // İkas'ta stok mutation'ı. batchRequestId/sonuç döner.
  pushStock(updates: ChannelStockUpdate[]): Promise<{ ok: boolean; ref?: string; error?: string }>;
  // Kanaldan sipariş satırlarını çek (polling yolu; webhook varsa route kullanır).
  fetchNewOrderLines?(sinceIso: string): Promise<ChannelOrderLine[]>;
  // Reconcile için kanaldaki güncel stokları çek.
  fetchStocks?(barcodes: string[]): Promise<ChannelStockUpdate[]>;
}

class NotConfiguredError extends Error {
  constructor(channel: string) {
    super(`${channel} entegrasyonu yapılandırılmadı (API anahtarı eksik). .env'e anahtarları ekleyin.`);
    this.name = "NotConfiguredError";
  }
}

// --- TRENDYOL ---
// Gerekli env: TRENDYOL_SUPPLIER_ID, TRENDYOL_API_KEY, TRENDYOL_API_SECRET.
// Ürün eşleşme anahtarı = barcode. Stok/fiyat güncelleme uç noktası:
//   POST /suppliers/{supplierId}/products/price-and-inventory  (async, batch).
export class TrendyolClient implements ChannelClient {
  readonly channel: SalesChannel = "trendyol";
  private supplierId = process.env.TRENDYOL_SUPPLIER_ID;
  private apiKey = process.env.TRENDYOL_API_KEY;
  private apiSecret = process.env.TRENDYOL_API_SECRET;

  isConfigured(): boolean {
    return Boolean(this.supplierId && this.apiKey && this.apiSecret);
  }

  async pushStock(updates: ChannelStockUpdate[]): Promise<{ ok: boolean; ref?: string; error?: string }> {
    if (!this.isConfigured()) throw new NotConfiguredError("Trendyol");
    // TODO(anahtar gelince): Basic auth (apiKey:apiSecret), body:
    //   { items: updates.map(u => ({ barcode: u.externalBarcode, quantity: u.stock })) }
    // POST .../suppliers/{supplierId}/products/price-and-inventory -> batchRequestId.
    // Rate limit'e uy, batchRequestId ile durum takibi yap.
    throw new NotConfiguredError("Trendyol");
  }
}

// --- İKAS ---
// Gerekli env: IKAS_STORE_ID (client id), IKAS_CLIENT_SECRET (OAuth app).
// Admin GraphQL API + webhooks. Stok saveProductStockLocations mutation'ı ile.
export class IkasClient implements ChannelClient {
  readonly channel: SalesChannel = "ikas";
  private clientId = process.env.IKAS_CLIENT_ID;
  private clientSecret = process.env.IKAS_CLIENT_SECRET;

  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  async pushStock(updates: ChannelStockUpdate[]): Promise<{ ok: boolean; ref?: string; error?: string }> {
    if (!this.isConfigured()) throw new NotConfiguredError("İkas");
    // TODO(anahtar gelince): OAuth client-credentials ile token al, GraphQL
    //   saveProductStockLocations mutation'ı ile stok güncelle.
    throw new NotConfiguredError("İkas");
  }
}

// Kayıtlı client'lar. inventory-sync buradan çeker.
export function getChannelClients(): ChannelClient[] {
  return [new TrendyolClient(), new IkasClient()];
}

export function getConfiguredChannels(): SalesChannel[] {
  return getChannelClients()
    .filter((c) => c.isConfigured())
    .map((c) => c.channel);
}
