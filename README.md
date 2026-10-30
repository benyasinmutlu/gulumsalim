# Gülüm Şalım

Çoklu satıcılı kadın giyim pazaryeri. Eski PHP/MySQL sitenin (`gulumsalim.com`) Node.js, Go ve PostgreSQL üzerine yeniden yazımı.

> **Durum:** Geliştirme aşamasında.

## Neler yapıyor

- Satıcılar kendi mağazasını açıp ürünlerini yönetir
- İkinci el ürün satışı
- Sipariş takibi
- iyzico ile online ödeme
- Kullanıcının davranışına göre kişiselleşen "keşfet" akışı

## Repo yapısı

| Klasör | Görevi | Teknoloji |
|---|---|---|
| `apps/web` | Müşteri ve mağaza vitrini (SSR/ISR, SEO öncelikli) | Next.js |
| `apps/api` | Ana backend: REST API, kimlik doğrulama, ödeme, admin ve satıcı iş mantığı | Node.js, Fastify, TypeScript |
| `services/discovery` | Davranış event'lerini toplar, kişiselleştirilmiş keşfet akışını üretir | Go |
| `packages/shared-contracts` | `apps/api` ile `apps/web` arasında paylaşılan API ve event tipleri | TypeScript |
| `infra/` | PostgreSQL migration'ları, nginx ayarları, systemd unit'leri, dağıtım script'leri | — |

## Mimari kararlar

**API ve arayüz ayrı.** API yalnızca JSON döndürür; Next.js kendi sunucusunda SSR yapar. İkisi birbirinden bağımsız dağıtılıp yeniden başlatılabilir.

**Keşfet servisi ayrı ve Go ile yazıldı.** Bu servis görüntüleme, sepet, favori ve satın alma event'lerini işleyip her kullanıcı için ürün sıralaması çıkarır. Node.js'ten ayrı tutmamın iki sebebi var: yüksek hacimli event işleme sitenin geri kalanını yavaşlatmasın, ve sorumluluk sınırı net olsun. Servis yalnızca ürün ID'si döndürür, ürün detayını hiç bilmez. Bedeli iki dil ve iki ayrı dağıtım.

**Tek repo (monorepo).** Her şey tek sunucuya dağıtılıyor ve Node.js ile Go arasındaki event/keşfet sözleşmesi bu aşamada sık değişiyor. Tek repo, iki tarafı aynı PR'da birlikte değiştirmeyi sağlıyor.

## Yerel geliştirme

Gerekenler: Node.js, pnpm, Go ve PostgreSQL.

```bash
pnpm install
cp apps/api/.env.example apps/api/.env   # değerleri doldur

pnpm dev:api                                    # http://localhost:3000/healthz
pnpm dev:web                                    # http://localhost:3001
cd services/discovery && go run ./cmd/server    # http://localhost:8081/healthz
```

Ayrıntılar için her klasörün kendi README'sine bakın.

## Dağıtım

Tek bir Linux sunucuya dağıtılıyor. Dağıtım `infra/scripts/deploy.sh` ile yapılır; servisler systemd ile yönetilir (`infra/systemd/`), önünde nginx çalışır.
