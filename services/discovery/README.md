# services/discovery

Davranışsal event toplama + kişiselleştirilmiş "keşfet" akışı. Go ile yazılmış tek servis — sistemde Go kullanılan tek yer burası.

## Neden ayrı ve neden Go

Node API'nin geri kalanı TypeScript'te kalıyor; bu servis sadece yüksek hacimli event işleme ve sıralama hesaplamasının performans-kritik olduğu tek nokta olduğu için Go'da. Ürün detayını hiç bilmez — sadece sıralanmış ürün ID'si döner, detayı Node/Meilisearch doldurur.

## Kurulum

```bash
export DATABASE_URL=postgres://gulumsalim:changeme@localhost:5432/gulumsalim
export REDIS_URL=redis://localhost:6379
export DISCOVERY_SERVICE_SECRET=<apps/api ile aynı değer>
go run ./cmd/server   # http://127.0.0.1:8081/healthz
```

Sadece `127.0.0.1`'e bağlanır — dışarıya asla açılmaz, sadece `apps/api` çağırır (`X-Internal-Secret` header'ı ile).

## Durum

Şu an iskelet aşamasında: `/healthz` ve `/discover` (her zaman boş `cold_start` yanıtı) var. Gerçek skorlama mantığı (Redis affinity sorted set'leri, Postgres popülerlik rollup'ı, event tüketimi) mimari planındaki Faz 4'te, davranışsal event akışı Faz 1'den itibaren birikmeye başladıktan sonra eklenecek — bkz. `/Users/yasinmutlu/.claude/plans/moonlit-questing-lantern.md` §5.

## Klasör yapısı

- `cmd/server/` — giriş noktası, sadece kablolama
- `internal/config/` — ortam değişkeni okuma
- `internal/api/` — router + handler'lar
- `internal/ingest/`, `internal/scoring/`, `internal/store/` — Faz 4'te eklenecek (event tüketimi, skorlama, Postgres/Redis erişimi)
