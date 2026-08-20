# @gulumsalim/api

Ana backend. Fastify + TypeScript + Drizzle (PostgreSQL) + Redis.

## Kurulum

```bash
pnpm install
cp .env.example .env   # değerleri doldur (yerelde Postgres/Redis çalışıyor olmalı)
pnpm db:generate         # şema değiştiğinde migration üretir
pnpm db:migrate           # migration'ları veritabanına uygular
pnpm dev                   # http://localhost:3000/healthz
pnpm test                    # birim testleri (vitest, DB gerektirmez)
```

## Testler

`pnpm test`, veritabanı gerektirmeyen saf mantığı kapsar: sepet birleştirme/güncelleme kuralları, keyset pagination cursor kodlama/çözme, satıcı sipariş durum makinesi ve komisyon hesaplama. DB'ye bağlı akışlar (auth, checkout, admin onayları vb.) bu oturumda geçici test verisiyle elle uçtan uca doğrulandı — kalıcı entegrasyon testlerine dönüştürülmesi ayrı bir iş.

## Klasör yapısı

- `src/config/` — ortam değişkeni doğrulama (zod)
- `src/db/` — Drizzle client + şema tanımları (`schema/`), migration'lar `infra/postgres/migrations`'a yazılır
- `src/modules/` — her iş alanı kendi klasöründe: `routes → service → repository` katmanlaması
- `src/plugins/` — Fastify eklentileri (Redis bağlantısı, hata yönetimi, ileride: oturum/CSRF)
- `src/lib/` — modüller arası paylaşılan yardımcılar (örn. keyset pagination)

## Neden bu seçimler

- **Drizzle, Prisma değil:** şema TypeScript olarak tanımlı, ayrı bir DSL dosyası yok — okuması daha kolay.
- **Redis tabanlı oturum, JWT değil:** bir satıcı/admin askıya alındığında erişiminin anında kesilmesi gerekiyor; stateless JWT bunu zaten bir sunucu taraflı kara listeyle taklit etmek zorunda kalırdı.
- `/healthz` hem Postgres hem Redis'e gerçekten bağlanabildiğini kontrol eder — sadece process ayakta mı diye bakmaz.
