import { createHash } from "node:crypto";
import { decryptSecret } from "../../lib/crypto-secret";
import { fetchFeed } from "./safe-feed-http";
import { detectMerchantFeedColumns, parseMerchantFeed } from "./merchant-feed.parser";
import type { FeedFieldMapping, FeedFormat } from "./merchant-feed.types";
import {
  applyFeedItems,
  claimOwnedFeedSource,
  countActiveFeedItems,
  createFeedRun,
  finishFeedRun,
  markFeedSourceFailure,
  markFeedSourceSuccess,
  zeroAllSourceStocks,
} from "./merchant-feed.repository";
import { vendorFeedSources } from "../../db/schema/index";
import { createNotification } from "../notifications/notifications.repository";
import { feedFailureAlertLevel, nextFeedRunAt } from "./merchant-feed.stock";

type FeedSourceRow = typeof vendorFeedSources.$inferSelect;

function httpError(status: number): Error {
  if (status === 401 || status === 403) return new Error("Feed erişimi reddedildi; bağlantı yetkisini sağlayıcı panelinden kontrol edin");
  if (status === 404 || status === 410) return new Error("Feed bağlantısı bulunamadı veya kaldırılmış");
  if (status === 429) return new Error("Feed sağlayıcısı istek hızını sınırladı; sistem otomatik olarak geri çekildi");
  return new Error(`Feed sunucusu HTTP ${status} döndürdü`);
}

function retryDate(source: FeedSourceRow, retryAfter?: string): Date {
  const minMs = 15 * 60_000;
  const maxMs = 24 * 60 * 60_000;
  if (retryAfter) {
    const seconds = Number(retryAfter);
    const parsed = Number.isFinite(seconds) ? Date.now() + seconds * 1000 : Date.parse(retryAfter);
    if (Number.isFinite(parsed)) return new Date(Math.min(Date.now() + maxMs, Math.max(Date.now() + minMs, parsed)));
  }
  const failures = Math.min(6, source.consecutiveFailures + 1);
  return new Date(Date.now() + Math.min(maxMs, Math.max(minMs, 5 * 60_000 * 2 ** failures)));
}

function isStale(source: FeedSourceRow): boolean {
  if (!source.lastSuccessAt) return false;
  return Date.now() - source.lastSuccessAt.getTime() >= source.staleAfterMinutes * 60_000;
}

export async function inspectMerchantFeed(input: {
  url: string;
  format: FeedFormat;
  mapping?: FeedFieldMapping;
}) {
  const response = await fetchFeed(input.url);
  if (response.status < 200 || response.status >= 300) throw httpError(response.status);
  const parsed = await parseMerchantFeed(response.body, input.format, input.mapping, response.contentType);
  return {
    ...parsed,
    httpStatus: response.status,
    contentHash: createHash("sha256").update(response.body).digest("hex"),
    etag: response.etag,
    lastModified: response.lastModified,
  };
}

export async function previewMerchantFeed(input: {
  url: string;
  format: FeedFormat;
  mapping?: FeedFieldMapping;
}) {
  const response = await fetchFeed(input.url);
  if (response.status < 200 || response.status >= 300) throw httpError(response.status);
  try {
    const parsed = await parseMerchantFeed(response.body, input.format, input.mapping, response.contentType);
    return { needsMapping: false as const, ...parsed };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Feed eşlenemedi";
    if (input.mapping || !message.includes("alan eşlemesi gerekli")) throw error;
    const detected = await detectMerchantFeedColumns(response.body, input.format, response.contentType);
    return { needsMapping: true as const, ...detected, message };
  }
}

function sourceUrl(source: FeedSourceRow): string {
  try {
    return decryptSecret(source.encryptedUrl);
  } catch {
    throw new Error("Feed bağlantısı çözülemedi; kaynağı yeniden oluşturun");
  }
}

async function completeFeedSuccess(
  source: FeedSourceRow,
  input: { etag?: string; lastModified?: string; contentHash?: string },
) {
  const marked = await markFeedSourceSuccess(source.id, source.leaseToken!, {
    status: source.status,
    ...input,
    nextSyncAt: nextFeedRunAt(Date.now(), source.intervalMinutes),
  });
  if (!marked) throw new Error("Feed lease süresi doldu; sonuç başka bir worker'ın üzerine yazılmadı");

  if (source.consecutiveFailures > 0 || source.status === "error") {
    await createNotification(
      source.vendorId,
      "feed_recovered",
      "Ürün aktarımı yeniden çalışıyor",
      `${source.name} kaynağı başarıyla senkronize edildi.`,
      "/satici/panel/kanallar",
    ).catch(() => undefined);
  }
}

export async function syncClaimedFeedSource(source: FeedSourceRow) {
  if (!source.leaseToken) throw new Error("Feed kaynağı worker lease'i olmadan çalıştırılamaz");
  const runId = await createFeedRun(source.id);
  let httpStatus: number | undefined;
  let retryAfter: string | undefined;
  try {
    const response = await fetchFeed(sourceUrl(source), { etag: source.lastEtag, lastModified: source.lastModified });
    httpStatus = response.status;
    retryAfter = response.retryAfter;
    if (response.status === 304) {
      await finishFeedRun(runId, { status: "unchanged", httpStatus: 304, contentHash: source.lastContentHash ?? undefined });
      await completeFeedSuccess(source, {
        etag: response.etag ?? source.lastEtag ?? undefined,
        lastModified: response.lastModified ?? source.lastModified ?? undefined,
        contentHash: source.lastContentHash ?? undefined,
      });
      return { status: "unchanged" as const, itemCount: 0 };
    }
    if (response.status < 200 || response.status >= 300) throw httpError(response.status);

    const contentHash = createHash("sha256").update(response.body).digest("hex");
    if (source.lastContentHash && source.lastContentHash === contentHash) {
      await finishFeedRun(runId, { status: "unchanged", httpStatus: response.status, contentHash });
      await completeFeedSuccess(source, {
        etag: response.etag ?? source.lastEtag ?? undefined,
        lastModified: response.lastModified ?? source.lastModified ?? undefined,
        contentHash,
      });
      return { status: "unchanged" as const, itemCount: 0 };
    }

    const parsed = await parseMerchantFeed(
      response.body,
      source.format as FeedFormat,
      source.fieldMapping as FeedFieldMapping,
      response.contentType,
    );
    const activeCount = await countActiveFeedItems(source.id);
    if (activeCount >= 20 && parsed.items.length < Math.ceil(activeCount * 0.5)) {
      throw new Error(`Feed ürün sayısı olağandışı düştü (${activeCount} → ${parsed.items.length}); mevcut katalog korunarak senkron durduruldu`);
    }
    const counts = await applyFeedItems(source, parsed.items);
    await finishFeedRun(runId, {
      status: "success",
      httpStatus: response.status,
      contentHash,
      itemCount: parsed.items.length,
      ...counts,
    });
    await completeFeedSuccess(source, {
      etag: response.etag,
      lastModified: response.lastModified,
      contentHash,
    });
    return { status: "success" as const, itemCount: parsed.items.length, ...counts };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Feed senkronizasyonu başarısız";
    const hardHttpFailure = httpStatus !== undefined && [401, 403, 404, 410].includes(httpStatus);
    const repeatedInvalidFeed = source.consecutiveFailures + 1 >= 3 && !httpStatus;
    const permanent = hardHttpFailure || repeatedInvalidFeed || source.consecutiveFailures + 1 >= 5;
    const zeroed = hardHttpFailure || isStale(source) ? await zeroAllSourceStocks(source.id, source.leaseToken) : 0;
    await finishFeedRun(runId, {
      status: message.includes("olağandışı düştü") ? "rejected" : "error",
      httpStatus,
      error: message,
      deactivatedCount: zeroed,
    });
    const marked = await markFeedSourceFailure(source.id, source.leaseToken, {
      previousStatus: source.status,
      error: message,
      nextAttemptAt: retryDate(source, retryAfter),
      permanent,
      resetContentHash: zeroed > 0,
    });
    const alertLevel = feedFailureAlertLevel(source.consecutiveFailures, permanent, zeroed);
    if (marked && alertLevel) {
      const critical = alertLevel === "critical";
      await createNotification(
        source.vendorId,
        critical ? "feed_error" : "feed_warning",
        critical ? "Ürün aktarımı durduruldu" : "Ürün aktarımında geçici sorun",
        critical
          ? `${source.name}: ${message}${zeroed > 0 ? ` Güvenlik için ${zeroed} ürünün stoğu sıfırlandı.` : ""}`
          : `${source.name}: ${message} Sistem otomatik olarak yeniden deneyecek.`,
        "/satici/panel/kanallar",
      ).catch(() => undefined);
    }
    throw new Error(message);
  }
}

export async function syncOwnedFeedSource(vendorId: number, sourceId: number) {
  const source = await claimOwnedFeedSource(vendorId, sourceId);
  if (!source) throw new Error("Kaynak şu anda başka bir senkron işlemi tarafından kullanılıyor");
  return syncClaimedFeedSource(source);
}
