import type { Redis } from "ioredis";

const MAX_ENTRIES = 50;
const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 gün

function key(customerId: number) {
  return `viewed:${customerId}`;
}

// Sadece giriş yapmış müşteriler için tutulur (misafir oturumu takip
// etmek için ayrı bir mekanizma - session id bazlı - gerekirdi, bu
// oturumda bilinçli olarak kapsam dışı bırakıldı). Skoru zaman damgası
// olan bir sorted set: aynı ürün tekrar görüntülenirse ZADD otomatik
// olarak en güncel zamana taşır (ZADD varsayılan davranışı).
export async function recordProductView(redis: Redis, customerId: number, productId: number) {
  const k = key(customerId);
  await redis.zadd(k, Date.now(), productId);
  // Liste büyümesin diye en eski görüntülemeler budanır (en yüksek skor =
  // en yeni, ZREMRANGEBYRANK 0'dan itibaren en düşük skorluları siler).
  await redis.zremrangebyrank(k, 0, -MAX_ENTRIES - 1);
  await redis.expire(k, TTL_SECONDS);
}

export async function getRecentlyViewedProductIds(redis: Redis, customerId: number, limit: number): Promise<number[]> {
  const ids = await redis.zrevrange(key(customerId), 0, limit - 1);
  return ids.map((id) => Number(id));
}
