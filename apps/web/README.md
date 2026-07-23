# @gulumsalim/web

Müşteri ve mağaza vitrini. Next.js (App Router, SSR/ISR) — eski PHP sitenin ürün sayfalarındaki SEO yatırımını korumak için sunucu tarafında render ediyor.

## Kurulum

```bash
pnpm install
cp .env.local.example .env.local   # API_URL'i gerekirse değiştir
pnpm dev -p 3001                     # apps/api zaten 3000'de çalışıyorsa
```

`apps/api`'nin ayrıca çalışıyor olması gerekir (bkz. `../api/README.md`) — ana sayfa, API'nin `/healthz` uç noktasını sunucu tarafında çağırıp durumunu gösterir.

## Neden Next.js

Eski PHP sitede ürün sayfalarında canonical URL, Open Graph, JSON-LD gibi ciddi bir SEO altyapısı vardı. Next.js'in Server Component'leri ile ürün/kategori sayfaları sunucuda render edilerek bu SEO yatırımı korunuyor; aynı zamanda modern bir geliştirme deneyimi sağlanıyor.

## Durum

Şu an sadece iskelet: ana sayfa API sağlık durumunu gösteriyor. Ürün/kategori/sepet sayfaları mimari planındaki Faz 1'de eklenecek — bkz. `/Users/yasinmutlu/.claude/plans/moonlit-questing-lantern.md`.
