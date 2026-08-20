// Kanal client'ları: Trendyol + İkas. PER-VENDOR — kimlik bilgileri artık env'den
// DEĞİL, constructor'a geçirilen (satıcının kendi) creds'ten gelir (bkz.
// credentials.repository). pushStock (dış stok itme) + fetchStocks (reconcile) +
// testConnection (bağlantı doğrulama, connect anında).
//
// NOT: Trendyol API'si iyi belgeli (Basic auth + REST). İkas (OAuth
// client_credentials + GraphQL) hazır; kesin stok mutation alanları GERÇEK
// ANAHTARLA İkas dokümanına karşı doğrulanmalı (aşağıda ⚠️ işaretli).

import type { SalesChannel } from "./inventory-sync";
import type { IkasCreds, TrendyolCreds } from "./credentials";

export interface ChannelStockUpdate {
  externalBarcode: string;
  stock: number;
}

export interface PushResult {
  ok: boolean;
  ref?: string;
  error?: string;
}

export interface TestResult {
  ok: boolean;
  error?: string;
}

export interface ChannelClient {
  readonly channel: SalesChannel;
  pushStock(updates: ChannelStockUpdate[]): Promise<PushResult>;
  testConnection(): Promise<TestResult>;
  fetchStocks?(barcodes: string[]): Promise<ChannelStockUpdate[]>;
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
// V2 base. Eski "sapigw" 15 Eylül 2026'da kapanıyor. Env ile override edilebilir.
const TRENDYOL_BASE = process.env.TRENDYOL_API_BASE ?? "https://apigw.trendyol.com/integration";

// SAF (test edilebilir): push isteğinin url/header/body'sini kurar - ağ yok.
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
  constructor(private readonly creds: TrendyolCreds) {}

  private basic(): string {
    return Buffer.from(`${this.creds.apiKey}:${this.creds.apiSecret}`).toString("base64");
  }

  async testConnection(): Promise<TestResult> {
    // Basit yetki testi: satıcı adreslerini çek. 2xx = geçerli; 401/403 = red.
    const { status } = await httpJson(`${TRENDYOL_BASE}/sellers/${this.creds.supplierId}/addresses`, {
      method: "GET",
      headers: { Authorization: `Basic ${this.basic()}`, "User-Agent": `${this.creds.supplierId} - SelfIntegration` },
    });
    if (status >= 200 && status < 300) return { ok: true };
    if (status === 401 || status === 403) return { ok: false, error: "Kimlik bilgileri reddedildi (API Key/Secret/Supplier ID kontrol edin)." };
    return { ok: false, error: `Trendyol beklenmeyen yanıt: HTTP ${status}` };
  }

  async pushStock(updates: ChannelStockUpdate[]): Promise<PushResult> {
    if (updates.length === 0) return { ok: true };
    const req = buildTrendyolPushRequest(this.creds.supplierId, this.creds.apiKey, this.creds.apiSecret, updates);
    const { status, body } = await httpJson(req.url, { method: "POST", headers: req.headers, body: req.body });
    if (status >= 200 && status < 300) {
      const ref = (body as { batchRequestId?: string })?.batchRequestId;
      return { ok: true, ref };
    }
    return { ok: false, error: `Trendyol HTTP ${status}: ${JSON.stringify(body).slice(0, 200)}` };
  }

  async fetchStocks(barcodes: string[]): Promise<ChannelStockUpdate[]> {
    const out: ChannelStockUpdate[] = [];
    for (const barcode of barcodes) {
      const { status, body } = await httpJson(
        `${TRENDYOL_BASE}/product/sellers/${this.creds.supplierId}/products?barcode=${encodeURIComponent(barcode)}`,
        { method: "GET", headers: { Authorization: `Basic ${this.basic()}`, "User-Agent": `${this.creds.supplierId} - SelfIntegration` } },
      );
      if (status >= 200 && status < 300) {
        const item = (body as { content?: { barcode: string; quantity: number }[] })?.content?.[0];
        if (item) out.push({ externalBarcode: item.barcode, stock: item.quantity });
      }
    }
    return out;
  }
}

// ---------- İKAS ----------
// OAuth token: mağazaya-özel subdomain (https://<store>.myikas.com/api/admin/oauth/token),
// client_credentials. GraphQL ortak: api.myikas.com/api/v1/admin/graphql.
const IKAS_GRAPHQL_URL = "https://api.myikas.com/api/v1/admin/graphql";

export class IkasClient implements ChannelClient {
  readonly channel: SalesChannel = "ikas";
  private cachedToken: { token: string; expiresAt: number } | null = null;
  constructor(private readonly creds: IkasCreds) {}

  private tokenUrl(): string {
    return `https://${this.creds.storeName}.myikas.com/api/admin/oauth/token`;
  }

  private async getToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 30_000) return this.cachedToken.token;
    const { status, body } = await httpJson(this.tokenUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "client_credentials", client_id: this.creds.clientId, client_secret: this.creds.clientSecret }).toString(),
    });
    if (status < 200 || status >= 300) throw new Error(`İkas token HTTP ${status}`);
    const t = body as { access_token?: string; expires_in?: number };
    if (!t.access_token) throw new Error("İkas token yanıtı geçersiz");
    this.cachedToken = { token: t.access_token, expiresAt: Date.now() + (t.expires_in ?? 3600) * 1000 };
    return t.access_token;
  }

  async testConnection(): Promise<TestResult> {
    try {
      await this.getToken(); // token alınabiliyorsa creds geçerli
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "İkas bağlantısı başarısız (Client ID/Secret/Mağaza adı kontrol edin)." };
    }
  }

  async pushStock(updates: ChannelStockUpdate[]): Promise<PushResult> {
    if (updates.length === 0) return { ok: true };
    let token: string;
    try {
      token = await this.getToken();
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "İkas token alınamadı" };
    }
    // ⚠️ DOĞRULANACAK: İkas stok mutation alan adları gerçek anahtarla teyit edilmeli.
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

// Satıcının creds'inden kanal client'ı üretir.
export function getChannelClient(channel: SalesChannel, creds: TrendyolCreds | IkasCreds): ChannelClient {
  return channel === "trendyol" ? new TrendyolClient(creds as TrendyolCreds) : new IkasClient(creds as IkasCreds);
}
