# Virtual Try-On / Style Lens

## Amaç
Kullanıcının açık rızayla yüklediği tam boy fotoğrafı üzerinde ürünü **yaklaşık** görselleştirmek. Gerçek beden/fit garantisi DEĞİL.

## Kapsam dışı (bu tur — KESİN)
- Gerçek image upload, dış AI servisi, GPU altyapısı, model eğitimi, kalıcı saklama. Bu tur **yalnız domain/API contract + model-adapter + güvenli mock**.

## Veri akışı (hedef)
```
1 upload-session (rıza) → 2 upload (private storage) → 3 validate(MIME/size/decode) + EXIF strip
→ 4 job queued (bounded) → 5 isolated worker: segmentation + garment mask + 2D warp/composite
→ 6 result (private, signed URL, kısa retention) → 7 "yaklaşık görselleştirme" ibaresi → 8 kullanıcı silebilir
```
Adapter sınırı: worker → `TryOnModelAdapter.process()` (mock | gerçek model).

## Trust boundary
- Job **sahipliği**: `TryOnJob.customerId` — yalnız sahibi erişir (IDOR engeli); result ref private storage anahtarı, tahmin edilemez.
- Görsel referansları **private** (`personImageRef`/`resultImageRef` storage key, public URL asla).
- GPU/worker ana API'den **izole** (ayrı servis/kuyruk).

## Bileşenler
- `try-on/contract.ts` — `TryOnJob` + state machine (`canTransition`/`transition`), `validateUploadDescriptor` (MIME allowlist + size), `TryOnModelAdapter` + `mockTryOnAdapter`.
- (Hedef) upload-session endpoint, private object storage, bounded job queue, izole worker, status polling/SSE, deletion endpoint, audit trail.

## API / contract
- Durumlar: `created→uploaded→processing→completed|failed|expired` (keyfi geçiş `InvalidTryOnTransitionError`).
- `validateUploadDescriptor({mime,byteSize}) → {ok}|{ok:false,reason}`; allowlist `image/jpeg|png|webp`, ≤12MB.
- `TryOnModelAdapter.process({jobId,personImageRef,garmentImageRef}) → {resultImageRef, approximate:true, modelVersion}`.

## Failure modes
- Geçersiz/zararlı upload (SVG/HTML spoof, decompression bomb) → validate/worker reddi.
- Model timeout/hata → job `failed`, kullanıcıya anlaşılır mesaj, maliyet limiti.
- Kuyruk dolu → 429/backpressure (bounded queue).
- Sahiplik ihlali (IDOR) → 403.

## Privacy / security (kritik)
- Fotoğraf **public bucket'a gitmez**; varsayılan **kalıcı saklama yok** (kısa retention, `expiresAt`).
- **Rıza olmadan model eğitimi yok**, otomatik training kullanımı yok.
- Loglara image URL / signed token / hassas metadata **düşmez**.
- EXIF (konum vb.) temizlenir. İçerik/kötüye kullanım kontrolü.
- Kullanıcı orijinal + üretilmiş görseli **silebilir** (deletion endpoint + audit).

## Observability
- Job durum sayaçları, süre, hata oranı, kuyruk derinliği, maliyet/iş, try-on completion rate, try-on sonrası conversion uplift (bkz. analytics).

## Test stratejisi
- State machine + upload validation + mock adapter → unit (mevcut: 6 test).
- Uçtan uca job lifecycle mock adapter ile test edilebilir (gerçek AI olmadan).
- IDOR/authz testi worker+endpoint eklenince.

## Rollout
1. Contract + mock ile uçtan uca lifecycle (bu tur — tamam).
2. Private storage + bounded queue + izole worker (mock model).
3. 2D warp/composite prototip; sınırlı beta, feature flag + quota.
4. Pose estimation / gerçek try-on modeli değerlendirme (P4).

## Rollback
- Feature flag kapat; kuyruk drenajı; saklanan görseller retention ile otomatik düşer; manuel silme endpoint'i.

## Açık kararlar
- Object storage sağlayıcısı + signed URL süresi + retention değeri.
- Model sağlayıcı (self-host GPU vs dış API) — maliyet + gizlilik.
- Rıza metni + KVKK aydınlatma; içerik moderasyonu eşiği.
