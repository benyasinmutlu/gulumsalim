import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isIP, type LookupFunction } from "node:net";

const MAX_REDIRECTS = 3;
export const MAX_FEED_BYTES = 10 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 20_000;

export type FeedHttpResult = {
  status: number;
  body: Buffer;
  etag?: string;
  lastModified?: string;
  retryAfter?: string;
  contentType?: string;
};

function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase();
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  const candidate = mapped ?? normalized;
  if (isIP(candidate) === 4) {
    const [a = 0, b = 0] = candidate.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224;
  }
  if (isIP(candidate) === 6) {
    return candidate === "::" || candidate === "::1" ||
      candidate.startsWith("fc") || candidate.startsWith("fd") ||
      /^fe[89ab]/.test(candidate) || candidate.startsWith("ff");
  }
  return true;
}

export function validateFeedUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Geçerli bir HTTPS feed bağlantısı girin");
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) {
    throw new Error("Feed bağlantısı kullanıcı bilgisi içermeyen HTTPS adresi olmalı");
  }
  if (!host || isIP(host) || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    throw new Error("Yerel/IP feed adresleri kullanılamaz");
  }
  return url;
}

async function resolvePublicHost(hostname: string): Promise<{ address: string; family: number }> {
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new Error("Feed adresi güvenli bir genel internet adresine çözülmüyor");
  }
  return addresses[0]!;
}

export function createPinnedLookup(resolved: { address: string; family: number }): LookupFunction {
  // Node 20 bazı TLS yollarında tek adres callback'i, Node 24 ise
  // autoSelectFamily nedeniyle options.all=true ile adres dizisi bekliyor.
  // Her iki durumda da önceden güvenliği doğrulanmış aynı IP'yi döndürerek
  // DNS rebinding penceresini kapalı tutarız.
  return ((_hostname: string, options: unknown, callback: (...args: unknown[]) => void) => {
    const wantsAll = Boolean(options && typeof options === "object" && "all" in options && (options as { all?: boolean }).all);
    if (wantsAll) {
      callback(null, [{ address: resolved.address, family: resolved.family }]);
      return;
    }
    callback(null, resolved.address, resolved.family);
  }) as LookupFunction;
}

async function requestOnce(url: URL, headers: Record<string, string>): Promise<FeedHttpResult & { location?: string }> {
  const resolved = await resolvePublicHost(url.hostname);
  const pinnedLookup = createPinnedLookup(resolved);

  return new Promise((resolve, reject) => {
    const req = request(url, {
      method: "GET",
      headers: {
        Accept: "application/xml,text/xml,application/json,text/csv,text/plain;q=0.8,*/*;q=0.5",
        "Accept-Encoding": "identity",
        "User-Agent": "GulumSalim-FeedSync/1.0 (+https://gulumsalim.com)",
        ...headers,
      },
      lookup: pinnedLookup,
      servername: url.hostname,
      timeout: REQUEST_TIMEOUT_MS,
    }, (response) => {
      const status = response.statusCode ?? 0;
      const chunks: Buffer[] = [];
      let bytes = 0;
      response.on("data", (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        bytes += buffer.length;
        if (bytes > MAX_FEED_BYTES) {
          response.destroy(new Error("Feed dosyası 10 MB sınırını aşıyor"));
          return;
        }
        chunks.push(buffer);
      });
      response.on("end", () => resolve({
        status,
        body: Buffer.concat(chunks),
        etag: typeof response.headers.etag === "string" ? response.headers.etag : undefined,
        lastModified: typeof response.headers["last-modified"] === "string" ? response.headers["last-modified"] : undefined,
        retryAfter: typeof response.headers["retry-after"] === "string" ? response.headers["retry-after"] : undefined,
        contentType: typeof response.headers["content-type"] === "string" ? response.headers["content-type"] : undefined,
        location: typeof response.headers.location === "string" ? response.headers.location : undefined,
      }));
      response.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new Error("Feed sunucusu zaman aşımına uğradı")));
    req.on("error", reject);
    req.end();
  });
}

export async function fetchFeed(
  rawUrl: string,
  conditional?: { etag?: string | null; lastModified?: string | null },
): Promise<FeedHttpResult> {
  let url = validateFeedUrl(rawUrl);
  const headers: Record<string, string> = {};
  if (conditional?.etag) headers["If-None-Match"] = conditional.etag;
  if (conditional?.lastModified) headers["If-Modified-Since"] = conditional.lastModified;

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    const result = await requestOnce(url, headers);
    if (![301, 302, 303, 307, 308].includes(result.status)) return result;
    if (!result.location || redirects === MAX_REDIRECTS) throw new Error("Feed bağlantısı çok fazla veya geçersiz yönlendirme döndürdü");
    url = validateFeedUrl(new URL(result.location, url).toString());
  }
  throw new Error("Feed bağlantısı alınamadı");
}
