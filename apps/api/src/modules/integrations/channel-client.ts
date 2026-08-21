// Kanal client'ları: Trendyol + İkas. PER-VENDOR — kimlik bilgileri artık env'den
// DEĞİL, constructor'a geçirilen (satıcının kendi) creds'ten gelir (bkz.
// credentials.repository). pushStock (dış stok itme) + fetchStocks (reconcile) +
// testConnection (bağlantı doğrulama, connect anında).
//
// NOT: Trendyol API'si iyi belgeli (Basic auth + REST). İkas (OAuth
// client_credentials + GraphQL) hazır; kesin stok mutation alanları GERÇEK
// ANAHTARLA İkas dokümanına karşı doğrulanmalı (aşağıda ⚠️ işaretli).

import type { SalesChannel } from "./inventory-sync";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { IkasCreds, TicimaxCreds, TrendyolCreds } from "./credentials";

export interface ChannelStockUpdate {
  externalBarcode: string;
  /** Kanal stok kaydı barkoddan farklı bir ID istiyorsa (Ticimax varyasyon ID). */
  externalId?: string;
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

async function httpText(url: string, init: RequestInit): Promise<{ status: number; body: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, redirect: "manual", signal: ctrl.signal });
    return { status: res.status, body: await res.text() };
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

// ---------- TİCİMAX ----------
// Ticimax'ın resmi Ürün Servisi WCF/SOAP'tır. StokAdediGuncelle metodu
// varyasyon ID + StokAdedi kabul eder. Sipariş webhook'u Barkod gönderdiği için
// barkod externalBarcode'da, stok metodu için varyasyon ID externalId'de tutulur.
const TICIMAX_NS = "http://tempuri.org/";
const TICIMAX_DATA_NS = "http://schemas.datacontract.org/2004/07/";

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function ticimaxEndpoint(siteUrl: string): string {
  return new URL("/Servis/UrunServis.svc", siteUrl).toString();
}

function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const parts = address.split(".").map(Number);
    const a = parts[0] ?? 0;
    const b = parts[1] ?? 0;
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || a >= 224;
  }
  const normalized = address.toLowerCase();
  return normalized === "::" || normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") ||
    normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb");
}

async function assertPublicTicimaxHost(siteUrl: string): Promise<void> {
  const hostname = new URL(siteUrl).hostname;
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some((item) => isPrivateAddress(item.address))) {
    throw new Error("Ticimax mağaza adresi güvenli bir genel internet adresine çözülmüyor");
  }
}

export function buildTicimaxStockRequest(
  siteUrl: string,
  memberCode: string,
  updates: ChannelStockUpdate[],
): { url: string; headers: Record<string, string>; body: string } {
  const variations = updates.map((update) => {
    const variationIdRaw = update.externalId ?? update.externalBarcode;
    const variationId = Number(variationIdRaw);
    if (!Number.isSafeInteger(variationId) || variationId <= 0) {
      throw new Error(`Geçersiz Ticimax varyasyon ID: ${variationIdRaw}`);
    }
    return `<a:Varyasyon><a:ID>${variationId}</a:ID><a:StokAdedi>${Math.max(0, Math.floor(update.stock))}</a:StokAdedi></a:Varyasyon>`;
  }).join("");
  const body = `<?xml version="1.0" encoding="utf-8"?>` +
    `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>` +
    `<StokAdediGuncelle xmlns="${TICIMAX_NS}"><UyeKodu>${escapeXml(memberCode)}</UyeKodu>` +
    `<urunler xmlns:a="${TICIMAX_DATA_NS}" xmlns:i="http://www.w3.org/2001/XMLSchema-instance">${variations}</urunler>` +
    `</StokAdediGuncelle></s:Body></s:Envelope>`;
  return {
    url: ticimaxEndpoint(siteUrl),
    headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: `"${TICIMAX_NS}IUrunServis/StokAdediGuncelle"` },
    body,
  };
}

function buildTicimaxConnectionRequest(siteUrl: string, memberCode: string) {
  const body = `<?xml version="1.0" encoding="utf-8"?>` +
    `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>` +
    `<SelectParaBirimi xmlns="${TICIMAX_NS}"><UyeKodu>${escapeXml(memberCode)}</UyeKodu><ParaBirimiID>0</ParaBirimiID>` +
    `</SelectParaBirimi></s:Body></s:Envelope>`;
  return {
    url: ticimaxEndpoint(siteUrl),
    headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: `"${TICIMAX_NS}IUrunServis/SelectParaBirimi"` },
    body,
  };
}

function soapFault(body: string): string | null {
  const match = body.match(/<(?:\w+:)?faultstring[^>]*>([\s\S]*?)<\/(?:\w+:)?faultstring>/i);
  return match?.[1]?.replace(/<[^>]+>/g, "").slice(0, 300) ?? null;
}

export class TicimaxClient implements ChannelClient {
  readonly channel: SalesChannel = "ticimax";
  constructor(private readonly creds: TicimaxCreds) {}

  async testConnection(): Promise<TestResult> {
    try {
      await assertPublicTicimaxHost(this.creds.siteUrl);
      const req = buildTicimaxConnectionRequest(this.creds.siteUrl, this.creds.memberCode);
      const { status, body } = await httpText(req.url, { method: "POST", headers: req.headers, body: req.body });
      const fault = soapFault(body);
      if (status >= 200 && status < 300 && !fault && /SelectParaBirimiResponse/i.test(body)) return { ok: true };
      return { ok: false, error: fault ? `Ticimax: ${fault}` : `Ticimax beklenmeyen yanıt: HTTP ${status}` };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Ticimax bağlantısı başarısız" };
    }
  }

  async pushStock(updates: ChannelStockUpdate[]): Promise<PushResult> {
    if (updates.length === 0) return { ok: true };
    try {
      await assertPublicTicimaxHost(this.creds.siteUrl);
      const req = buildTicimaxStockRequest(this.creds.siteUrl, this.creds.memberCode, updates);
      const { status, body } = await httpText(req.url, { method: "POST", headers: req.headers, body: req.body });
      const fault = soapFault(body);
      if (fault) return { ok: false, error: `Ticimax: ${fault}` };
      const match = body.match(/<StokAdediGuncelleResult>(-?\d+)<\/StokAdediGuncelleResult>/i);
      const updatedCount = match ? Number(match[1]) : Number.NaN;
      if (status >= 200 && status < 300 && Number.isFinite(updatedCount) && updatedCount > 0) {
        return { ok: true, ref: String(updatedCount) };
      }
      return { ok: false, error: `Ticimax HTTP ${status}: stok güncellemesi doğrulanamadı` };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Ticimax stok güncellemesi başarısız" };
    }
  }
}

// Satıcının creds'inden kanal client'ı üretir.
export function getChannelClient(channel: SalesChannel, creds: TrendyolCreds | IkasCreds | TicimaxCreds): ChannelClient {
  if (channel === "trendyol") return new TrendyolClient(creds as TrendyolCreds);
  if (channel === "ikas") return new IkasClient(creds as IkasCreds);
  return new TicimaxClient(creds as TicimaxCreds);
}
