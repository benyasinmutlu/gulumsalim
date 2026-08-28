import { createHash } from "node:crypto";
import { detectMerchantFeedColumns, parseMerchantFeed } from "../modules/integrations/merchant-feed.parser";
import { fetchFeed, validateFeedUrl } from "../modules/integrations/safe-feed-http";
import { feedFieldMappingSchema, feedFormatSchema, type FeedFieldMapping } from "../modules/integrations/merchant-feed.types";

type VerificationOutput = Record<string, unknown> & { status: string };

function write(output: VerificationOutput) {
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

function safeError(error: unknown, rawUrl?: string): string {
  let message = error instanceof Error ? error.message : "Feed doğrulanamadı";
  if (rawUrl) {
    message = message.split(rawUrl).join("[feed-url]");
    try {
      const parsed = new URL(rawUrl);
      if (parsed.search) message = message.split(parsed.search).join("?[redacted]");
    } catch {
      // URL doğrulaması asıl akışta kullanıcıya güvenli hata verecek.
    }
  }
  return message.slice(0, 500);
}

function readMapping(): FeedFieldMapping | undefined {
  const raw = process.env.MERCHANT_FEED_MAPPING_JSON?.trim();
  if (!raw) return undefined;
  if (raw.length > 20_000) throw new Error("MERCHANT_FEED_MAPPING_JSON çok büyük");
  return feedFieldMappingSchema.parse(JSON.parse(raw));
}

async function main() {
  if (process.env.MERCHANT_FEED_AUTHORIZED !== "true") {
    throw new Error("Yalnız izinli kaynaklar doğrulanabilir; MERCHANT_FEED_AUTHORIZED=true gerekli");
  }
  const rawUrl = process.env.MERCHANT_FEED_URL?.trim();
  if (!rawUrl || rawUrl.length > 2_048) throw new Error("MERCHANT_FEED_URL gerekli ve en fazla 2048 karakter olmalı");
  const url = validateFeedUrl(rawUrl);
  const format = feedFormatSchema.parse(process.env.MERCHANT_FEED_FORMAT?.trim() || "auto");
  const mapping = readMapping();
  const response = await fetchFeed(rawUrl);
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Feed sunucusu HTTP ${response.status} döndürdü`);
  }

  try {
    const parsed = await parseMerchantFeed(response.body, format, mapping, response.contentType);
    const positiveStock = parsed.items.filter((item) => item.available && item.stock > 0).length;
    write({
      status: "valid",
      host: url.hostname,
      format: parsed.format,
      bytes: response.body.length,
      itemCount: parsed.items.length,
      positiveStockItems: positiveStock,
      zeroStockItems: parsed.items.length - positiveStock,
      mapping: parsed.mapping,
      contentSha256: createHash("sha256").update(response.body).digest("hex"),
      conditionalHeaders: {
        etag: Boolean(response.etag),
        lastModified: Boolean(response.lastModified),
      },
    });
  } catch (error) {
    const message = safeError(error, rawUrl);
    if (!mapping && message.includes("eşlemesi gerekli")) {
      const detected = await detectMerchantFeedColumns(response.body, format, response.contentType);
      write({
        status: "mapping_required",
        host: url.hostname,
        format: detected.format,
        bytes: response.body.length,
        columns: detected.columns,
        sampleRowCount: detected.sample.length,
        message,
      });
      process.exitCode = 3;
      return;
    }
    throw error;
  }
}

main().catch((error) => {
  write({ status: "error", message: safeError(error, process.env.MERCHANT_FEED_URL) });
  process.exitCode = 1;
});
