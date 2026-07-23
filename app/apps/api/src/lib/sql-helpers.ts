import { getTableName, sql, type AnyColumn } from "drizzle-orm";

// KRİTİK: `sql` template içine gömülen bir Column referansı ("${products.id}"
// gibi), o ifade bir ALT SORGUNUN (nested SELECT) İÇİNDE kullanıldığında
// Drizzle bunu tablo adı olmadan sade "id" olarak render ediyor. Alt
// sorgunun kendi FROM tablosu da (her tabloda olduğu gibi) bir "id"
// sütununa sahipse, Postgres bu niteliksiz "id"yi dışarıdaki tabloya değil
// EN YAKIN (alt sorgunun kendi) tabloya bağlıyor - yani korelasyon hiç
// çalışmıyor, alt sorgu kendi kendine anlamsız bir eşleşme yapıyor.
// (Örnek: "SELECT SUM(stock) FROM product_variants WHERE product_id = id"
// - buradaki "id" products.id değil, product_variants.id'nin kendisi.)
//
// Bu geniş çaplı denetimde ürün puanları/yorum/favori/satış sayıları,
// satıcı takipçi/puan/ürün sayıları, admin finans raporları (gelir/kazanç/
// ödeme) ve müşteri harcama tutarları dahil onlarca yerde bu hatanın
// olduğu tespit edildi. Bir alt sorgu içinde DIŞARIDAKİ tabloya referans
// verilen HER YERDE bu fonksiyon kullanılmalı - normal (alt sorgu
// olmayan) `sql` ifadelerinde gerek yok, orada Drizzle zaten doğru
// niteliyor.
export function outer<T extends AnyColumn>(column: T) {
  // Drizzle'ın Column tipi .table alanını public API'sinde açığa çıkarmıyor,
  // ama runtime'da her zaman mevcut (kendi iç query builder'ı da bunu kullanıyor).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tableName = getTableName((column as any).table);
  return sql.raw(`"${tableName}"."${column.name}"`);
}
