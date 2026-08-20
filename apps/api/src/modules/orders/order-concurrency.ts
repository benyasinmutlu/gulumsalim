export interface StockReservationKey {
  productId: number;
  variantId?: number | null;
}

// Tüm checkout transaction'ları stok satırlarını aynı sırada kilitler. Böylece
// [A, B] ve [B, A] sepetlerinin birbirini çapraz bekleyip deadlock üretmesi
// engellenir. Varyant ve ürün tabloları ayrı kilit alanları olarak sıralanır.
export function sortStockReservations<T extends StockReservationKey>(items: readonly T[]): T[] {
  return [...items].sort((left, right) => {
    const leftTable = left.variantId == null ? 1 : 0;
    const rightTable = right.variantId == null ? 1 : 0;
    if (leftTable !== rightTable) return leftTable - rightTable;

    const leftId = left.variantId ?? left.productId;
    const rightId = right.variantId ?? right.productId;
    return leftId - rightId || left.productId - right.productId;
  });
}

// PostgreSQL deadlock ve SERIALIZABLE çatışmaları transaction'ı tamamen geri
// alır; checkout transaction'ında dış servis çağrısı olmadığı için aynı iş en
// baştan güvenle tekrar denenebilir. Sürücü/sarmalayıcı hatayı cause içine
// koyabildiğinden birkaç katmanı kontrollü olarak tarıyoruz.
export function isRetryableTransactionError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
    const candidate = current as { code?: unknown; cause?: unknown };
    if (candidate.code === "40P01" || candidate.code === "40001") return true;
    current = candidate.cause;
  }
  return false;
}

export async function withTransactionRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxAttempts?: number;
    wait?: (attempt: number) => Promise<void>;
  } = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const wait =
    options.wait ??
    ((attempt: number) =>
      new Promise((resolve) => setTimeout(resolve, attempt * 20 + Math.floor(Math.random() * 20))));

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isRetryableTransactionError(error) || attempt === maxAttempts) throw error;
      await wait(attempt);
    }
  }

  throw new Error("Transaction yeniden deneme sınırı geçersiz");
}
