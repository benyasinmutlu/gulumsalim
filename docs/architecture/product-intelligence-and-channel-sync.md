# Product Intelligence & Channel Sync — Teknik Mimari

**Durum:** Tasarım (build öncesi onay bekliyor)
**Kapsam:** Ürün girişi (tekli + toplu) formatlama/zenginleştirme motoru (rule + ML + AI), koleksiyon oluşturma yardımı, İkas/Trendyol stok senkronizasyonu, satıcı paneli UI.
**Hedef 3 sütun (her fazda garanti):** **Scalable · Fast · Reliable.**

> Not: Bu döküman "inspect → plan → build" akışının PLAN aşamasıdır. Build, faz onayıyla başlar.

---

## 0. Tasarım İlkeleri

1. **Deterministik ≠ Olasılıksal ayrımı.** Kurallar (rule engine) senkron çalışır ve **validasyonun tek doğruluk kaynağıdır**. ML/AI yalnızca **öneri** üretir; öneriler güven eşiğine göre uygulanır ve satıcı **her zaman ezip geçebilir/geri alabilir**.
2. **AI asla kritik yolda değil.** Ürün kaydı hiçbir zaman AI çağrısını beklemez. Zenginleştirme ya async (kuyruk) ya da satıcının bastığı "✨ Doldur" adımıdır.
3. **Her katman tek başına çalışır.** AI kapalıyken sistem rule+ML ile; ML yokken rule ile tam çalışır. Graceful degradation baştan tasarımda.
4. **Boundary validation.** Tüm dış girdi (form, dosya, webhook, API yanıtı) zod ile sınırda doğrulanır.
5. **Immutable + idempotent.** İşler idempotency anahtarıyla; tekrar çalıştırma güvenli.

---

## 1. Ürün Zenginleştirme Kademesi (Cascade)

```
Katman 0 — RULE ENGINE   (deterministik, <1ms, HEP açık, senkron)
   fiyat/beden/kategori normalizasyon · başlık temizleme · dedupe · validasyon
        ↓ yetmezse (öneri gerekiyorsa)
Katman 1 — ML            (hızlı, ucuz, lokal, opsiyonel)
   başlıktan kategori tahmini · nitelik çıkarımı · yakın-kopya tespiti
        ↓ karmaşıksa
Katman 2 — AI / LLM      (async, cache'li, rate-limitli, fallback'li, opsiyonel)
   açıklama üretimi · başlık/SEO · dağınık metinden yapısal nitelik · çeviri
```

Her zenginleştirme ihtiyacı (ör. açıklama üretimi) için akış:
`AI (açık+bütçe+cache-miss, 8s timeout) → başarısız/kapalı ise ML → ML yok ise RULE → hepsi yoksa ham veri`.
**Sonuç asla kaydı bloklamaz.**

---

## 2. Modül & Dosya Haritası

### 2.1 `apps/api/src/modules/product-intelligence/` (YENİ)

```
product-intelligence/
├── types.ts                     # RawProductInput, NormalizedProduct, FieldValue<T>, Issue, EnrichmentResult
├── normalize/
│   ├── price.ts                 # normalizePrice(raw) -> FieldValue<string>  (bulk toPriceString'ten türetilir + sertleştirilir)
│   ├── size.ts                  # normalizeSizes(raw) -> string[]  + beden taksonomisi (S/M/L, 36-46, "Standart")
│   ├── text.ts                  # normalizeTitle / cleanDescription (casing, whitespace, emoji/spam strip, uzunluk sınırı)
│   ├── category.ts              # resolveCategory(value) -> FieldValue<number>  (slug/name/slugified + cache)
│   └── index.ts                 # normalizeProductInput(raw) -> NormalizedProduct  (orkestrasyon)
├── dedupe/
│   └── fingerprint.ts           # productFingerprint(vendorId, name, attrs) -> string  (kararlı hash, yakın-kopya)
├── enrichment/
│   ├── pipeline.ts              # enrichProduct(normalized, needs, ctx) -> EnrichmentResult  (cascade + fallback + timeout)
│   ├── cache.ts                 # Redis: hash(input) -> enrichment  (idempotency + maliyet)
│   ├── cost-guard.ts            # satıcı/gün AI çağrı+token bütçesi, rate limit, circuit breaker
│   └── providers/
│       ├── provider.ts          # interface EnrichmentProvider
│       ├── rule-provider.ts     # keyword->kategori/nitelik heuristik (HEP açık)
│       ├── ml-provider.ts       # lokal sınıflandırıcı (iskelet; model gelince dolar)
│       ├── ai-provider.ts       # LLM köprüsü (isEnabled()=key varsa)
│       └── llm-client.ts        # provider-agnostik sarmalayıcı (AI_PROVIDER + key env'den; yoksa disabled)
└── __tests__/                   # her saf fonksiyon için birim test (rule katmanı %100)
```

**Çekirdek tipler (`types.ts`):**

```ts
export interface FieldValue<T> {
  value: T | null;
  source: "input" | "rule" | "ml" | "ai";
  confidence: number; // 0..1
}
export interface Issue { field: string; level: "error" | "warn"; message: string; }

export interface RawProductInput {
  name?: string; basePrice?: string; compareAtPrice?: string;
  category?: string; description?: string; brand?: string;
  stock?: string; sizes?: string; barcode?: string; [k: string]: string | undefined;
}
export interface NormalizedProduct {
  name: FieldValue<string>;
  basePrice: FieldValue<string>;
  compareAtPrice: FieldValue<string>;
  categoryId: FieldValue<number>;
  description: FieldValue<string>;
  brand: FieldValue<string>;
  stock: FieldValue<number>;
  sizes: string[];
  barcode: FieldValue<string>;
  fingerprint: string;
  issues: Issue[];        // error -> kaydı blokla, warn -> satıcıya göster
}
```

**Zenginleştirme sağlayıcı arayüzü (`providers/provider.ts`):**

```ts
export interface EnrichmentProvider {
  readonly name: "rule" | "ml" | "ai";
  isEnabled(): boolean;
  suggestCategory?(p: NormalizedProduct): Promise<FieldValue<number> | null>;
  generateDescription?(p: NormalizedProduct): Promise<FieldValue<string> | null>;
  cleanTitle?(p: NormalizedProduct): Promise<FieldValue<string> | null>;
  extractAttributes?(p: NormalizedProduct): Promise<Record<string, string>>;
  seoMeta?(p: NormalizedProduct): Promise<{ title: string; description: string } | null>;
}
```

`ai-provider.isEnabled()` = `llmClient.configured()`. Key yoksa `false` → pipeline onu atlar. **Sistem çalışmaya devam eder.**

### 2.2 `apps/api/src/lib/queue/` (YENİ — scale için)

```
lib/queue/
├── queue.ts        # BullMQ queue factory, mevcut Redis bağlantısını kullanır
├── queues.ts       # tanımlı kuyruklar: product-enrichment, bulk-import, channel-stock-sync, image-processing
└── workers/
    ├── index.ts            # in-process worker başlatıcı (ölçek büyüyünce ayrı gulumsalim-worker servisi)
    ├── enrichment.worker.ts
    ├── bulk-import.worker.ts
    └── channel-sync.worker.ts
```

- Toplu içe aktarma 5000 satırı bloklamaz: satır/batch başına enrichment kuyruğa girer, endpoint `jobId` + ilerleme döner.
- Worker'lar önce **in-process** (basit), ölçek gelince **ayrı systemd servisi** olarak bölünebilir — kod bu ayrımı destekleyecek şekilde yazılır (worker'lar saf fonksiyon + kuyruk tüketicisi).

### 2.3 `apps/api/src/modules/integrations/` (YEREL TEMEL → deploy edilecek)

```
integrations/
├── inventory-sync.ts       # ZATEN VAR (yerel): saf çekirdek (tampon, reconcile diff, outbox, backoff) + 13 test
├── channel-client.ts       # ZATEN VAR (yerel): Trendyol/İkas iskelet client
├── inventory-sync.repository.ts   # YENİ: atomik düşüm (UPDATE..WHERE stock>=qty), listing CRUD, outbox drain
├── integrations.routes.ts         # YENİ: /webhooks/trendyol, /webhooks/ikas (HMAC doğrulamalı), satıcı listing yönetimi
└── reconcile.job.ts               # YENİ: periyodik mutabakat (scheduled-emails deseniyle)
```

Şema (YENİ, `db/schema/integrations.ts` — yerelde hazır): `channel_listings`, `stock_sync_outbox` + enum'lar. **Migration drizzle ile üretilip prod'a uygulanacak** (hot-patch YOK).

---

## 3. Stok Senkronizasyonu (İkas/Trendyol)

**Model:** Gülüm Şalım DB = tek gerçek kaynak; kanallar uydu.

| Yön | Akış |
|-----|------|
| İçeri (satış→düş) | Webhook/polling → barkoddan listing bul → **atomik** merkez düşüm → diğer kanallara outbox |
| Dışarı (stok değişti→it) | Merkez stok değişince `buildOutboxEvents` → outbox → worker rate-limitli push |
| Kendi satışımız | `order.repository.ts decrementOrderItemStock` içine outbox tetikleyicisi eklenir |

**Eşleme anahtarı:** `product_variants.barcode` (yeni sütun) veya mevcut `sku` → `channel_listings.external_barcode`.
**Aşırı-satış koruması:** güvenlik tamponu (`exposedStock`) + atomik düşüm + transactional outbox + reconcile job (15-30 dk).
**Güvenlik:** webhook'lar HMAC imza doğrulaması; idempotency (işlenen sipariş id dedupe).
**Blokaj:** Trendyol (supplierId+key+secret) / İkas (OAuth) anahtarları — gelince `channel-client.pushStock` gövdeleri dolar; o ana kadar `isConfigured()=false`, sistem hata vermez.

---

## 4. Koleksiyon Oluşturma (tekli + toplu + AI-destekli)

- **Mevcut:** manuel satıcı koleksiyonları + admin anasayfa koleksiyonları.
- **Eklenecek:**
  - `POST /vendor/collections/bulk-assign` — filtre/seçimle çoklu ürün ekleme.
  - `suggestCollections(products)` — nitelik kümeleme (rule) ile temalı gruplar ("Yazlık Elbiseler"); opsiyonel AI ile isimlendirme. Aynı provider arayüzü arkasında (AI kapalı → sadece rule kümeleme).
  - Toplu içe aktarmada opsiyonel `collection` sütunu → otomatik koleksiyon oluştur/ata.

---

## 5. Satıcı Paneli UI (Faz 5)

- **Ürün formu:** "✨ AI ile doldur" butonu → enrichment endpoint → açıklama/etiket/kategori önerisi **güven rozetiyle** dolar; satıcı düzenler/onaylar. **Bloklamaz.**
- **Toplu içe aktarma:** mevcut eşleme ekranına "zenginleştir" anahtarı + iş-tabanlı ilerleme çubuğu.
- **Stok/Kanal paneli:** barkod alanı, ürün başına kanal anahtarları (Trendyol/İkas aç/kapa), sync durumu rozetleri, son-senkron zamanı, hata mesajı, "yeniden senkronize et" butonu, merkez stok panosu.
- **Koleksiyon oluşturucu:** filtreyle ürün seç → koleksiyon; AI/rule "öneri" çipleri.

---

## 6. Üç Sütun — Somut Garantiler

**Scalable**
- Tüm ağır/AI/toplu iş **BullMQ kuyruğunda**; API stateless; worker'lar yatay bölünebilir.
- Kategori cache; batch DB; keyset pagination (mevcut); Meilisearch (mevcut) arama ölçeği.

**Fast**
- Rule katmanı senkron <1ms; ürün kaydı **AI beklemez**; enrichment cache (Redis); DB index'leri (mevcut); S3/CDN görseller.

**Reliable**
- Cascade fallback; transactional outbox (kanal push); idempotency anahtarları; exponential backoff retry; AI için **cost guard + circuit breaker**; her katman opsiyonel (graceful degradation); modül başına test.

---

## 7. Veri Modeli Eklemeleri

| Tablo/Sütun | Amaç |
|-------------|------|
| `product_variants.barcode` (nullable) | Kanal eşleme anahtarı |
| `channel_listings` | Ürün↔kanal eşleme (yerelde hazır) |
| `stock_sync_outbox` | Güvenilir dışa-itme (yerelde hazır) |
| `product_enrichment` (opsiyonel) | AI önerilerinin cache/audit'i (productId, field, suggestion, source, confidence, appliedAt) |
| `settings.ai_provider` veya env | AI sağlayıcı konfigürasyonu |

---

## 8. Fazlar & Kabul Kriterleri

| Faz | İçerik | Engel | Kabul (AC) |
|-----|--------|-------|------------|
| **1** | `product-intelligence/normalize/*` + testler; tekli+toplu giriş ikisi de bu modülü kullanır | Yok | Tek kaynak normalizasyon; rule testleri %100; davranış regresyonu yok |
| **2** | `lib/queue` (BullMQ) + enrichment pipeline iskeleti + rule-provider + **disabled** ai-provider | Yok | Enrichment endpoint rule-önerisi döner; AI-kapalı yol çalışır; job'lar işlenir |
| **3** | ai-provider bağlanır (llm-client) | AI key | Açıklama/nitelik/SEO üretimi + fallback + cost guard + cache |
| **4** | Stok entegrasyonu deploy (migration+modül+webhook+outbox worker+reconcile) | İkas/Trendyol key | Webhook merkez düşürür; outbox push; reconcile; testler |
| **5** | Satıcı paneli UI (stok/kanal panosu, üründe AI-asistan, koleksiyon oluşturucu) | Faz 1-4 | Uçtan uca akışlar; görsel regresyon |

---

## 9. Riskler & Kararlar

- **AI key (ertelendi):** arayüz "kapalı" kurulur, gelince tek env ile açılır.
- **İkas/Trendyol key (ertelendi):** client iskeleti hazır, gelince gövde dolar.
- **Migration prod'a nasıl:** drizzle-kit generate → gözden geçir → uygula. Hot-patch YOK.
- **Worker deploy modeli:** başta in-process, ölçekte ayrı `gulumsalim-worker` systemd servisi (kod buna hazır yazılır).
- **⚠️ Sunucu/git ıraksaması:** Sunucu kodu git'ten sapmış (Mac hot-patch'ler git'e girmiyor). Bu sistem düzgün kalması için deploy'un git-tabanlı hale getirilmesi ÖNERİLİR; aksi halde her Mac deploy bu modülleri silebilir. Bu, Faz 1'den önce çözülmesi gereken bir operasyonel karardır.

---

## 10. Önerilen Başlangıç

**Faz 1 — `product-intelligence/normalize/*` + testler.** Engelsiz, güvenli, her şeyin temeli. Mevcut toplu-içe-aktarma mantığını (fiyat/beden/kategori) tek, test edilmiş, tekli girişin de kullandığı bir modüle çıkarır. Regresyon riski düşük, değer yüksek.
