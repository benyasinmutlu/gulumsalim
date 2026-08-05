// Kanal client'ları: Trendyol + İkas. Dış stok itme (pushStock) ve reconcile
// için stok çekme (fetchStocks). API anahtarı YOKSA isConfigured()=false ->
// pipeline bu kanalı atlar, sistem hata vermez. Anahtar gelince gövdeler
// gerçek HTTP çağrısı yapar.
//
// NOT: Trendyol API'si iyi belgeli (Basic auth + REST) - yüksek güven. İkas
// (OAuth + GraphQL) yapısı hazır; kesin mutation alanları GERÇEK ANAHTARLA
// İkas dokümanına karşı doğrulanmalı (aşağıda işaretli).

import type { SalesChannel } from "./inventory-sync";

export interface ChannelStockUpdate {
  externalBarcode: string;
  stock: number;
}

export interface PushResult {
  ok: boolean;
  ref?: string; // batchRequestId vb.
  error?: string;
}

export interface ChannelClient {
  readonly channel: SalesChannel;
  isConfigured(): boolean;
  pushStock(updates: ChannelStockUpdate[]): Promise<PushResult>;
  fetchStocks?(barcodes: string[]): Promise<ChannelStockUpdate[]>;
}

export class NotConfiguredError extends Error {
  constructor(channel: string) {
    super(`${channel} entegrasyonu yapılandırılmadı (API anahtarı eksik).`);
    this.name = "NotConfiguredError";
  }
}

const HTTP_TIMEOUT_MS = 15000;

async function httpJson(url: string, init: RequestInit): Promise<{ status: number; body: unknown }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    return { status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

// ---------- TRENDYOL ----------
// Gerekli env: TRENDYOL_SUPPLIER_ID, TRENDYOL_API_KEY, TRENDYOL_API_SECRET.
// Eşleşme anahtarı = barcode. Stok/fiyat: POST .../products/price-and-inventory
// (async batch -> batchRequestId).

// Yeni entegrasyon base'i (V2). Eski "api.trendyol.com/sapigw" 15 Eylül 2026'da
// kapanıyor. Env ile override edilebilir (staging: stageapigw.trendyol.com/integration).
const TRENDYOL_BASE = process.env.TRENDYOL_API_BASE ?? "https://apigw.trendyol.com/integration";

// SAF (test edilebilir): push isteğinin url/header/body'sini kurar - ağ yok.
// Not: supplierId = sellerId (Trendyol V2 yeniden adlandırdı, değer aynı).
export function buildTrendyolPushRequest(
  supplierId: string,
  apiKey: string,
  apiSecret: string,
  updates: ChannelStockUpdate[],
): { url: string; headers: Record<string, string>; body: string } {
  const token = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
  return {
    url: `${TRENDYOL_BASE}/inventory/sellers/${supplierId}/products/price-and-inventory`,
    headers: {
      Authorization: `Basic ${token}`,
      "Content-Type": "application/json",
      "User-Agent": `${supplierId} - SelfIntegration`,
    },
    body: JSON.stringify({ items: updates.map((u) => ({ barcode: u.externalBarcode, quantity: Math.max(0, Math.floor(u.stock)) })) }),
  };
}

export class TrendyolClient implements ChannelClient {
  readonly channel: SalesChannel = "trendyol";
  private supplierId = process.env.TRENDYOL_SUPPLIER_ID;
  private apiKey = process.env.TRENDYOL_API_KEY;
  private apiSecret = process.env.TRENDYOL_API_SECRET;

  isConfigured(): boolean {
    return Boolean(this.supplierId && this.apiKey && this.apiSecret);
  }

  async pushStock(updates: ChannelStockUpdate[]): Promise<PushResult> {
    if (!this.isConfigured()) throw new NotConfiguredError("Trendyol");
    if (updates.length === 0) return { ok: true };
    const req = buildTrendyolPushRequest(this.supplierId!, this.apiKey!, this.apiSecret!, updates);
    const { status, body } = await httpJson(req.url, { method: "POST", headers: req.headers, body: req.body });
    if (status >= 200 && status < 300) {
      const ref = (body as { batchRequestId?: string })?.batchRequestId;
      return { ok: true, ref };
    }
    return { ok: false, error: `Trendyol HTTP ${status}: ${JSON.stringify(body).slice(0, 200)}` };
  }

  async fetchStocks(barcodes: string[]): Promise<ChannelStockUpdate[]> {
    if (!this.isConfigured()) throw new NotConfiguredError("Trendyol");
    const out: ChannelStockUpdate[] = [];
    const token = Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString("base64");
    // Trendyol V2: barkodla ürün sorgusu (sayfalı). Basit sürüm: her barkodu tek tek.
    for (const barcode of barcodes) {
      const { status, body } = await httpJson(`${TRENDYOL_BASE}/product/sellers/${this.supplierId}/products?barcode=${encodeURIComponent(barcode)}`, {
        method: "GET",
        headers: { Authorization: `Basic ${token}`, "User-Agent": `${this.supplierId} - SelfIntegration` },
      });
      if (status >= 200 && status < 300) {
        const item = (body as { content?: { barcode: string; quantity: number }[] })?.content?.[0];
        if (item) out.push({ externalBarcode: item.barcode, stock: item.quantity });
      }
    }
    return out;
  }
}

// ---------- İKAS ----------
// Gerekli env: IKAS_CLIENT_ID, IKAS_CLIENT_SECRET, IKAS_STORE_NAME.
// OAuth token endpoint'i MAĞAZAYA ÖZEL subdomain'dedir (ikas.dev auth dokümanı
// ile doğrulandı): https://<store_name>.myikas.com/api/admin/oauth/token.
// GraphQL ise ortak: https://api.myikas.com/api/v1/admin/graphql. Token
// client-credentials ile alınır, Bearer olarak kullanılır.

const IKAS_GRAPHQL_URL = "https://api.myikas.com/api/v1/admin/graphql";

export class IkasClient implements ChannelClient {
  readonly channel: SalesChannel = "ikas";
  private clientId = process.env.IKAS_CLIENT_ID;
  private clientSecret = process.env.IKAS_CLIENT_SECRET;
  private storeName = process.env.IKAS_STORE_NAME;
  private cachedToken: { token: string; expiresAt: number } | null = null;

  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret && this.storeName);
  }

  private tokenUrl(): string {
    return `https://${this.storeName}.myikas.com/api/admin/oauth/token`;
  }

  private async getToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 30_000) return this.cachedToken.token;
    const { status, body } = await httpJson(this.tokenUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "client_credentials", client_id: this.clientId!, client_secret: this.clientSecret! }).toString(),
    });
    if (status < 200 || status >= 300) throw new Error(`İkas token HTTP ${status}`);
    const t = body as { access_token?: string; expires_in?: number };
    if (!t.access_token) throw new Error("İkas token yanıtı geçersiz");
    this.cachedToken = { token: t.access_token, expiresAt: Date.now() + (t.expires_in ?? 3600) * 1000 };
    return t.access_token;
  }

  async pushStock(updates: ChannelStockUpdate[]): Promise<PushResult> {
    if (!this.isConfigured()) throw new NotConfiguredError("İkas");
    if (updates.length === 0) return { ok: true };
    const token = await this.getToken();
    // ⚠️ DOĞRULANACAK: İkas stok mutation'ı. saveProductStockLocations tipik
    // şekildir; kesin alan adları İkas Admin API dokümanına göre ayarlanmalı.
    const mutation = `mutation SaveStock($input: [ProductStockLocationInput!]!) { saveProductStockLocations(input: $input) { productId stockCount } }`;
    const variables = { input: updates.map((u) => ({ barcode: u.externalBarcode, stockCount: Math.max(0, Math.floor(u.stock)) })) };
    const { status, body } = await httpJson(IKAS_GRAPHQL_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: mutation, variables }),
    });
    if (status >= 200 && status < 300 && !(body as { errors?: unknown[] })?.errors) return { ok: true };
    return { ok: false, error: `İkas HTTP ${status}: ${JSON.stringify(body).slice(0, 200)}` };
  }
}

// Kayıtlı client'lar (yeni kanal eklenince buraya).
export function getChannelClients(): ChannelClient[] {
  return [new TrendyolClient(), new IkasClient()];
}

export function getChannelClient(channel: SalesChannel): ChannelClient {
  return channel === "trendyol" ? new TrendyolClient() : new IkasClient();
}

export function getConfiguredChannels(): SalesChannel[] {
  return getChannelClients()
    .filter((c) => c.isConfigured())
    .map((c) => c.channel);
}
