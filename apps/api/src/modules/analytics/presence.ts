import type { Redis } from "ioredis";

// bkz. kullanıcı isteği (2026-08-02): "admin panelden anlık sitede kaç kişi
// var görebilmeliyim ... hangi üründe kaç kişi var" - GERÇEKTEN anlık/canlı
// olan (şu an online, şu an hangi sayfada, günlük tekil ziyaretçi
// yaklaşık-sayımı) burada Redis'te kalır. Ürün/kategori/koleksiyon/mağaza/
// anasayfa bölümü için "ne zaman ne kadar" (gün/hafta/ay, kalıcı) izleme
// bkz. content-analytics.repository.ts (Postgres, TTL yok) - bu dosyada
// önceden yaşayan günlük view/purchase/dwell sayaçları oraya taşındı.

// Heartbeat ~25 sn'de bir gönderiliyor (bkz. presence-heartbeat.tsx) - 90 sn
// pencere, art arda en fazla 2 kayıp ping'e tolerans tanır.
const ONLINE_WINDOW_MS = 90_000;
const DAILY_TTL_SECONDS = 60 * 60 * 24 * 9; // 9 gün - "son 7 gün" grafiği için yeterli tampon

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateKeyDaysAgo(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

export async function recordPresencePing(redis: Redis, sessionId: string, path?: string): Promise<void> {
  const now = Date.now();
  const pipeline = redis.pipeline();
  pipeline.zadd("presence:site", now, sessionId);
  pipeline.expire("presence:site", Math.ceil(ONLINE_WINDOW_MS / 1000) + 30);
  pipeline.pfadd(`visitors:daily:${todayKey()}`, sessionId);
  pipeline.expire(`visitors:daily:${todayKey()}`, DAILY_TTL_SECONDS);
  if (path) {
    pipeline.zadd(`presence:page:${path}`, now, sessionId);
    pipeline.expire(`presence:page:${path}`, Math.ceil(ONLINE_WINDOW_MS / 1000) + 30);
    pipeline.sadd("presence:active-paths", path);
  }
  await pipeline.exec();
}

export async function getOnlineCount(redis: Redis): Promise<number> {
  const cutoff = Date.now() - ONLINE_WINDOW_MS;
  await redis.zremrangebyscore("presence:site", "-inf", cutoff);
  return redis.zcard("presence:site");
}

export async function getActivePages(redis: Redis): Promise<{ path: string; count: number }[]> {
  const paths = await redis.smembers("presence:active-paths");
  if (paths.length === 0) return [];
  const cutoff = Date.now() - ONLINE_WINDOW_MS;
  const results: { path: string; count: number }[] = [];
  for (const path of paths) {
    const key = `presence:page:${path}`;
    await redis.zremrangebyscore(key, "-inf", cutoff);
    const count = await redis.zcard(key);
    if (count > 0) {
      results.push({ path, count });
    } else {
      await redis.srem("presence:active-paths", path);
    }
  }
  return results.sort((a, b) => b.count - a.count);
}

export async function getVisitorsToday(redis: Redis): Promise<number> {
  return redis.pfcount(`visitors:daily:${todayKey()}`);
}

export async function getVisitorsLast7Days(redis: Redis): Promise<{ date: string; count: number }[]> {
  const results: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = dateKeyDaysAgo(i);
    const count = await redis.pfcount(`visitors:daily:${date}`);
    results.push({ date, count });
  }
  return results;
}
