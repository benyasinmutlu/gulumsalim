import { XMLParser } from "fast-xml-parser";

const UPLOAD_NS = "http://kabul.ptt.gov.tr";
const UPLOAD_XSD_NS = "http://kabul.ptt.gov.tr/xsd";
const TRACKING_NS = "http://takip.ptt.gov.tr";
const TRACKING_XSD_NS = "http://takip.ptt.gov.tr/xsd";
const SOAP_NS = "http://www.w3.org/2003/05/soap-envelope";

export const PTT_ENDPOINTS = {
  test: {
    upload: "https://pttws.ptt.gov.tr/PttVeriYuklemeTest/services/Sorgu",
    tracking: "https://pttws.ptt.gov.tr/GonderiTakipV2Test/services/Sorgu",
  },
  production: {
    upload: "https://pttws.ptt.gov.tr/PttVeriYukleme/services/Sorgu",
    tracking: "https://pttws.ptt.gov.tr/GonderiTakipV2/services/Sorgu",
  },
} as const;

export interface PttClientOptions {
  environment: keyof typeof PTT_ENDPOINTS;
  customerId: string;
  password: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  uploadUrl?: string;
  trackingUrl?: string;
}

export interface PttSender {
  name: string;
  address: string;
  city: string;
  district: string;
  phone: string;
  email?: string;
  postalCode?: string;
}

export interface PttRecipient extends PttSender {}

export interface PttPackage {
  weightGrams: number;
  widthCm?: number;
  lengthCm?: number;
  heightCm?: number;
  desi?: number;
}

export interface PttRegistrationInput {
  fileName: string;
  reference: string;
  recipient: PttRecipient;
  sender: PttSender;
  package: PttPackage;
}

export interface PttRegistrationResult {
  // PTT test servisi, barkod aralığı tanımlı olmayan müşterilerde başarılı
  // kabul (kod=1) sırasında barkodu boş bırakıp referans sorgu bağlantısını
  // açıklamada döndürebiliyor. Barkod bu durumda referans takibiyle alınır.
  barcode: string | null;
  code: number;
  description: string;
}

export interface PttTrackingEvent {
  sequence: number | null;
  statusId: string | null;
  description: string;
  location: string | null;
  date: string | null;
}

export interface PttTrackingResult {
  found: boolean;
  barcode: string | null;
  reference: string | null;
  resultCode: number;
  description: string;
  deliveredTo: string | null;
  events: PttTrackingEvent[];
}

export class PttError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly unknownOutcome = false,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "PttError";
  }
}

function escapeXml(value: string | number): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function normalizePttPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  const normalized = digits.startsWith("90") && digits.length === 12 ? digits.slice(2) : digits.startsWith("0") ? digits.slice(1) : digits;
  if (!/^\d{10}$/.test(normalized)) {
    throw new PttError("Telefon numarası PTT için başında 0 olmadan 10 hane olmalı", "PTT_INVALID_PHONE");
  }
  return normalized;
}

function positiveInteger(value: number, name: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new PttError(`${name} sıfırdan büyük olmalı`, "PTT_INVALID_PACKAGE");
  return Math.ceil(value);
}

function element(name: string, value: string | number | undefined): string {
  return value === undefined || value === "" ? "" : `<xsd:${name}>${escapeXml(value)}</xsd:${name}>`;
}

function soapEnvelope(body: string, namespace: string, xsdNamespace: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<soap:Envelope xmlns:soap="${SOAP_NS}" xmlns:svc="${namespace}" xmlns:xsd="${xsdNamespace}"><soap:Header/><soap:Body>${body}</soap:Body></soap:Envelope>`;
}

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function asString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "object") return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function asNumber(value: unknown, fallback = -1): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const parser = new XMLParser({
  removeNSPrefix: true,
  ignoreAttributes: false,
  parseTagValue: true,
  trimValues: true,
});

function responsePayload(xml: string, responseName: string): Record<string, unknown> {
  let parsed: Record<string, any>;
  try {
    parsed = parser.parse(xml);
  } catch {
    throw new PttError("PTT geçersiz XML yanıtı döndürdü", "PTT_INVALID_XML", false, true);
  }
  const body = parsed?.Envelope?.Body;
  const fault = body?.Fault;
  if (fault) {
    const reason = asString(fault?.Reason?.Text) ?? asString(fault?.faultstring) ?? "PTT SOAP hatası";
    throw new PttError(reason.slice(0, 300), "PTT_SOAP_FAULT");
  }
  const result = body?.[responseName]?.return;
  if (!result || typeof result !== "object") {
    throw new PttError("PTT yanıtında beklenen sonuç alanı yok", "PTT_INVALID_RESPONSE", false, true);
  }
  return result as Record<string, unknown>;
}

export class PttClient {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly uploadUrl: string;
  private readonly trackingUrl: string;

  constructor(private readonly options: PttClientOptions) {
    if (!/^\d+$/.test(options.customerId)) throw new PttError("PTT müşteri numarası geçersiz", "PTT_INVALID_CUSTOMER_ID");
    if (!options.password) throw new PttError("PTT şifresi yapılandırılmamış", "PTT_NOT_CONFIGURED");
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.uploadUrl = options.uploadUrl ?? PTT_ENDPOINTS[options.environment].upload;
    this.trackingUrl = options.trackingUrl ?? PTT_ENDPOINTS[options.environment].tracking;
  }

  private safeMessage(value: string): string {
    return value
      .replaceAll(this.options.customerId, "[PTT_MUSTERI]")
      .replaceAll(this.options.password, "[PTT_SECRET]");
  }

  private payload(xml: string, responseName: string): Record<string, unknown> {
    try {
      return responsePayload(xml, responseName);
    } catch (error) {
      if (error instanceof PttError) {
        throw new PttError(this.safeMessage(error.message), error.code, error.unknownOutcome, error.retryable);
      }
      throw error;
    }
  }

  private async call(url: string, action: string, body: string, mayHaveCommitted: boolean): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url, {
        method: "POST",
        headers: {
          "content-type": `application/soap+xml; charset=UTF-8; action="${action}"`,
          accept: "application/soap+xml, text/xml",
        },
        body,
        signal: controller.signal,
      });
      const text = await response.text();
      if (!response.ok) {
        const retryable = response.status >= 500 || response.status === 408 || response.status === 429;
        throw new PttError(`PTT servisi HTTP ${response.status} döndürdü`, "PTT_HTTP_ERROR", mayHaveCommitted && retryable, retryable);
      }
      return text;
    } catch (error) {
      if (error instanceof PttError) throw error;
      const timedOut = error instanceof Error && error.name === "AbortError";
      throw new PttError(
        timedOut ? "PTT servisi zaman aşımına uğradı" : "PTT servisine ulaşılamadı",
        timedOut ? "PTT_TIMEOUT" : "PTT_NETWORK_ERROR",
        mayHaveCommitted,
        true,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  async registerShipment(input: PttRegistrationInput): Promise<PttRegistrationResult> {
    if (!/^[A-Za-z0-9._-]{1,50}$/.test(input.fileName)) {
      throw new PttError("PTT dosya adı 1-50 güvenli karakterden oluşmalı", "PTT_INVALID_FILE_NAME");
    }
    if (!input.reference || input.reference.length > 100) {
      throw new PttError("PTT müşteri referansı 1-100 karakter olmalı", "PTT_INVALID_REFERENCE");
    }
    const recipientPhone = normalizePttPhone(input.recipient.phone);
    const senderPhone = normalizePttPhone(input.sender.phone);
    const weight = positiveInteger(input.package.weightGrams, "Ağırlık");
    const width = input.package.widthCm == null ? undefined : positiveInteger(input.package.widthCm, "En");
    const length = input.package.lengthCm == null ? undefined : positiveInteger(input.package.lengthCm, "Boy");
    const height = input.package.heightCm == null ? undefined : positiveInteger(input.package.heightCm, "Yükseklik");
    const desi = input.package.desi ?? (width && length && height ? Math.max(1, Math.ceil((width * length * height) / 3000 * 100) / 100) : undefined);

    const dongu = [
      element("aAdres", input.recipient.address),
      element("agirlik", weight),
      element("aliciAdi", input.recipient.name),
      element("aliciEmail", input.recipient.email),
      element("aliciIlAdi", input.recipient.city),
      element("aliciIlceAdi", input.recipient.district),
      element("aliciSms", recipientPhone),
      element("boy", length),
      element("desi", desi),
      element("en", width),
      `<xsd:gondericibilgi>${element("gonderici_adi", input.sender.name)}${element("gonderici_adresi", input.sender.address)}${element("gonderici_email", input.sender.email)}${element("gonderici_il_ad", input.sender.city)}${element("gonderici_ilce_ad", input.sender.district)}${element("gonderici_posta_kodu", input.sender.postalCode)}${element("gonderici_sms", senderPhone)}</xsd:gondericibilgi>`,
      element("musteriReferansNo", input.reference),
      element("odemesekli", "MH"),
      element("yukseklik", height),
    ].join("");
    const payload = soapEnvelope(
      `<svc:kabulEkle2><svc:input><xsd:dongu>${dongu}</xsd:dongu>${element("dosyaAdi", input.fileName)}${element("gonderiTip", "NORMAL")}${element("gonderiTur", "KARGO")}${element("kullanici", "PttWs")}${element("musteriId", this.options.customerId)}${element("sifre", this.options.password)}</svc:input></svc:kabulEkle2>`,
      UPLOAD_NS,
      UPLOAD_XSD_NS,
    );
    const xml = await this.call(this.uploadUrl, "urn:kabulEkle2", payload, true);
    const result = this.payload(xml, "kabulEkle2Response");
    const overallCode = asNumber(result.hataKodu);
    const overallDescription = asString(result.aciklama) ?? "PTT kayıt sonucu alınamadı";
    const row = asArray(result.dongu as Record<string, unknown> | Record<string, unknown>[])[0];
    if (!row) throw new PttError("PTT kabul yanıtında gönderi sonucu yok", "PTT_INVALID_RESPONSE", false, true);
    const rowCode = asNumber(row?.donguHataKodu, overallCode);
    const rowDescription = asString(row?.donguAciklama) ?? overallDescription;
    const barcode = asString(row?.barkod) ?? asString(row?.barkodNo);
    const success = row?.donguSonuc === true || String(row?.donguSonuc).toLowerCase() === "true" || rowCode === 1;
    if (!success) {
      throw new PttError(this.safeMessage(rowDescription).slice(0, 300), `PTT_REGISTER_${rowCode}`);
    }
    return { barcode, code: rowCode, description: rowDescription };
  }

  async trackByReference(reference: string): Promise<PttTrackingResult> {
    const payload = soapEnvelope(
      `<svc:gonderiSorgu_referansNo2><svc:input>${element("kullanici", this.options.customerId)}${element("referansNo", reference)}${element("sifre", this.options.password)}</svc:input></svc:gonderiSorgu_referansNo2>`,
      TRACKING_NS,
      TRACKING_XSD_NS,
    );
    const xml = await this.call(this.trackingUrl, "urn:gonderiSorgu_referansNo2", payload, false);
    return this.parseTracking(xml, "gonderiSorgu_referansNo2Response", reference);
  }

  async trackByBarcode(barcode: string): Promise<PttTrackingResult> {
    const payload = soapEnvelope(
      `<svc:gonderiSorgu2><svc:input>${element("barkod", barcode)}${element("kullanici", this.options.customerId)}${element("sifre", this.options.password)}</svc:input></svc:gonderiSorgu2>`,
      TRACKING_NS,
      TRACKING_XSD_NS,
    );
    const xml = await this.call(this.trackingUrl, "urn:gonderiSorgu2", payload, false);
    return this.parseTracking(xml, "gonderiSorgu2Response", null);
  }

  private parseTracking(xml: string, responseName: string, reference: string | null): PttTrackingResult {
    const result = this.payload(xml, responseName);
    const code = asNumber(result.sonucKodu);
    const description = asString(result.sonucAciklama) ?? "";
    const barcode = asString(result.BARNO);
    const events = asArray(result.dongu as Record<string, unknown> | Record<string, unknown>[]).map((event) => ({
      sequence: event.siraNo == null ? null : asNumber(event.siraNo),
      statusId: asString(event.gonderiDurumId) ?? asString(event.IKODU),
      description: asString(event.ISLEM) ?? "",
      location: asString(event.IMERK),
      date: asString(event.ITARIH),
    }));
    return {
      found: Boolean(barcode) && code >= 0,
      barcode,
      reference: reference ?? asString(result.reserve2),
      resultCode: code,
      description,
      deliveredTo: asString(result.TESALAN),
      events,
    };
  }
}
