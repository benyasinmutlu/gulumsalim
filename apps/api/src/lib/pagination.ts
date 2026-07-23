// Keyset (cursor) pagination yardımcıları. OFFSET kullanmıyoruz: 1M+
// satırlık tablolarda OFFSET N, N büyüdükçe yavaşlar (Postgres N satırı
// tarayıp atmak zorunda kalır) - keyset her zaman aynı hızda, doğrudan
// indeksten devam eder.
export interface Cursor {
  createdAt: string; // ISO 8601
  id: number;
}

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function decodeCursor(value: string): Cursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (typeof parsed.id !== "number" || typeof parsed.createdAt !== "string") return null;
    return parsed as Cursor;
  } catch {
    return null;
  }
}
