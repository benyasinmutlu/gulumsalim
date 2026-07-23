# Gülüm Şalım

Çoklu satıcılı kadın giyim pazaryeri. Eski PHP/MySQL sitenin (`gulumsalim.com`) Node.js + Go + PostgreSQL üzerine yeniden yazımı.

Mimari kararların tam gerekçesi için: `/Users/yasinmutlu/.claude/plans/moonlit-questing-lantern.md`

## Bu repo neyi içeriyor

| Klasör | Ne | Dil |
|---|---|---|
| `apps/api` | Ana backend (REST API, auth, ödeme, admin/satıcı iş mantığı) | Node.js + Fastify + TypeScript |
| `apps/web` | Müşteri ve mağaza vitrini (SSR/ISR, SEO kritik) | Next.js |
| `services/discovery` | Davranışsal event toplama + kişiselleştirilmiş "keşfet" akışı | Go |
| `packages/shared-contracts` | API/event tipleri, `apps/api` ve `apps/web` arasında paylaşılır | TypeScript |
| `infra/` | Postgres migration'ları, nginx config'i, systemd unit'leri, deploy script'leri | — |

## Neden bu şekilde bölündü

- **`apps/api` ve `apps/web` ayrı:** API saf JSON döndürür, Next.js kendi sunucusunda SSR yapar. İkisi de bağımsız deploy edilip yeniden başlatılabilir.
- **`services/discovery` neden Go ve neden ayrı:** Sistemde Go kullanılan tek yer burası — davranışsal event'leri (görüntüleme/sepet/favori/satın alma) işleyip kişiselleştirilmiş ürün sıralaması üretir. Node'dan ayrı tutulmasının sebebi performans (yüksek hacimli event işleme) ve net bir sorumluluk sınırı: bu servis sadece ürün ID'si döndürür, ürün detayını hiç bilmez.
- **Neden monorepo:** Tek sunucuya deploy ediliyor, Node↔Go event/discover sözleşmesi erken aşamada sık değişecek, tek repo bunu atomik PR'larla yönetmeyi kolaylaştırıyor.

## Yerel geliştirme

```bash
pnpm install
cp apps/api/.env.example apps/api/.env   # değerleri doldur
pnpm dev:api     # http://localhost:3000/healthz
pnpm dev:web     # http://localhost:3001
cd services/discovery && go run ./cmd/server   # http://localhost:8081/healthz
```

Detaylar için her klasörün kendi README'sine bakın.

## Sunucu

Hetzner VPS, AlmaLinux 10.2, `128.140.120.121`. Dağıtım: `infra/scripts/deploy.sh`, servisler systemd ile yönetilir (`infra/systemd/`). Geçiş stratejisi ve aşamalı yapım sırası plan dosyasında.
