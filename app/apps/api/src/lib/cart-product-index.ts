import type { Redis } from "ioredis";

// bkz. kullanıcı isteği: "satıcı panelinde o satıcının hangi ürünleri
// sepetteyse göster" - sepetin kendisi (bkz. session.ts) tek bir oturum
// JSON blob'unun içinde tutuluyor, tüm oturumları tarayıp kimin sepetinde
// ne var diye bakmak (Redis SCAN + her birini deserialize etmek) hem
// pahalı hem de auth session iç yapısına bağımlı olurdu. Bunun yerine,
// sepet her değiştiğinde (ekle/güncelle/sil - bkz. cart.routes.ts) ayrı,
// hafif bir ters indeks güncellenir: ürün->oturum kümesi. Checkout/sepet
// akışının kendisini HİÇ etkilemez, salt gözlemlenebilirlik içindir.
const TTL_SECONDS = 60 * 60 * 24 * 30; // session ile aynı süre (bkz. plugins/session.ts)

function sessionProductsKey(sessionId: string) {
  return `cart-idx:session:${sessionId}`;
}

function productSessionsKey(productId: number) {
  return `cart-idx:product:${productId}`;
}

export async function syncCartProductIndex(redis: Redis, sessionId: string, productIds: number[]) {
  const sKey = sessionProductsKey(sessionId);
  const previous = await redis.smembers(sKey);
  const previousSet = new Set(previous);
  const nextIds = [...new Set(productIds)];
  const nextIdStrings = new Set(nextIds.map(String));

  const pipeline = redis.pipeline();
  for (const idStr of previous) {
    if (!nextIdStrings.has(idStr)) {
      pipeline.srem(productSessionsKey(Number(idStr)), sessionId);
    }
  }
  for (const id of nextIds) {
    if (!previousSet.has(String(id))) {
      pipeline.sadd(productSessionsKey(id), sessionId);
    }
    pipeline.expire(productSessionsKey(id), TTL_SECONDS);
  }
  pipeline.del(sKey);
  if (nextIds.length > 0) {
    pipeline.sadd(sKey, ...nextIds.map(String));
    pipeline.expire(sKey, TTL_SECONDS);
  }
  await pipeline.exec();
}

export async function getCartCounts(redis: Redis, productIds: number[]): Promise<Map<number, number>> {
  if (productIds.length === 0) return new Map();
  const pipeline = redis.pipeline();
  for (const id of productIds) pipeline.scard(productSessionsKey(id));
  const results = await pipeline.exec();
  const map = new Map<number, number>();
  productIds.forEach((id, i) => {
    const count = (results?.[i]?.[1] as number) ?? 0;
    map.set(id, count);
  });
  return map;
}
