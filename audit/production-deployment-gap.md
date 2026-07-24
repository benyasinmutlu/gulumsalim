# Production Deployment Gap

**Tarih:** 2026-07-25 · Local (`feature/personalized-discover-integration`) vs Production (salt-okunur keşif).
Sınıflandırma: **P0 blocker · P1 high · P2 medium · info**.

## Özet
Production, güvenlik düzeltmeleri **öncesi** (2026-07-19/21 artifact) bir kodu, **33-migration** şemasıyla çalıştırıyor. TLS prod'da çözülmüş; ama repo'daki güvenlik fix'lerinin hiçbiri deploy edilmemiş. En kritik nokta: **konsolidasyon top-level (20-migration) ağaçta yapıldı, production 33-migration ağacında** → fix'ler doğrudan deploy edilemez, önce kanonik ağaca taşınmalı.

## P0 — Blocker
| # | Gap | Kanıt | Aksiyon |
|---|---|---|---|
| P0-1 | **Kanonik-ağaç uyuşmazlığı.** Production DB=33 migration + `packages/`; güvenlik/discover işi top-level 20-migration ağaçta. | drizzle migrations=33; products.brand/view_count/promo_banner_clicks VAR; server'da `packages/` var | Kanonik ağacı (33-migration, `app/`+packages) belirle; güvenlik fix'lerini (rate-limit, trustProxy, checkout, discovery) ve discover v1'i **oraya cherry-pick/port et**; sonra deploy. `migration-drift-decision.md` **Seçenek A** artık kanıtlı. |
| P0-2 | **Güvenlik fix'leri deploy edilmemiş.** trustProxy bypass, login rate-limit, checkout/callback hardening, session fixation, discovery timeouts/ack/readyz, systemd sandbox, nginx header — hiçbiri prod'da. | artifact 07-19; /readyz=404; nginx header yok | Kanonik ağaca taşındıktan sonra guarded rollout (`personalized-discover-rollout.md`). |

## P1 — High
| # | Gap | Kanıt | Aksiyon |
|---|---|---|---|
| P1-1 | **nginx güvenlik header'ları + HSTS yok** (TLS aktif olduğu halde). | nginx -T'de add_header/Strict-Transport yok | CLAUDE-007 + HSTS ekle (TLS zaten var → HSTS güvenli). |
| P1-2 | **Para/stok CHECK constraint yok** (chk_%=0). | pg_constraint | `infra/postgres/manual/0001` detection→NOT VALID→VALIDATE (canlı 33-migration şemada). |
| P1-3 | **API 0.0.0.0:3000'e bind** (firewalld bloke ediyor ama). | ss :3000 = 0.0.0.0; firewalld 3000 yok | API'yi 127.0.0.1'e bind et (Fastify listen host) — defense-in-depth. |
| P1-4 | **Rate-limit bypass canlı** (trustProxy:true + XFF). | eski API kodu | trustProxy:loopback fix'ini deploy et (P0-2 içinde). |

## P2 — Medium
| # | Gap | Kanıt | Aksiyon |
|---|---|---|---|
| P2-1 | **Valkey maxmemory=0 / noeviction** — sınırsız bellek. | INFO memory | maxmemory + policy (allkeys-lru veya volatile-lru) ayarla; affinity TTL zaten var. |
| P2-2 | **cockpit internete açık** (firewalld allow). | firewall-cmd | Gerekli değilse cockpit'i kapat veya IP allowlist. |
| P2-3 | **deploy.sh atomik/rollback'siz + junk taşıyor** (repo fix'i deploy edilmemiş). | repo | Fix'lenmiş deploy.sh'i (frozen-lockfile, exclude) kanonik ağaçta kullan; atomik release ekle. |

## Informational
- TLS **çözülmüş** (Let's Encrypt, ylina.life, Oct 2026). CLAUDE-001 prod'da kapalı.
- Go 1.26.5 **kurulu** → Go build/test/-race blocker'ı "toolchain yok" değil; CI/staging'de koşulabilir.
- Veri küçük (8 müşteri, 7 sipariş) → collaborative aggregate henüz gereksiz (bkz. `collaborative-aggregate-production-plan.md`).
- Servisler stabil (NRestarts=0), log'da hata yok, dumps/ boş.

## Production'da repository'de bulunmayan değişiklikler
- Certbot-managed TLS (nginx 443 + Let's Encrypt cert) — repo'da yok (repo :80-only + prod-tls template'i var).
- 33-migration şeması + `packages/shared-contracts` — repo top-level'de yok (yalnız `app/` alt-ağaçta 33 migration).
- **Öneri:** Prod nginx TLS bloğunu ve packages/ kaynağını repo'ya geri al (reconcile) ki tek kaynak-of-truth olsun.

## Rollback yöntemi (mevcut)
- Kod: artifact tar (git yok) → önceki tar yedeği gerekir; şu an **rollback artifact'ı belirsiz** (P0 risk — deploy öncesi snapshot şart).
- DB: migration ileri-yönlü, down yok → `pg_dump` snapshot zorunlu.
- nginx/systemd: `/etc/` altındaki dosyalar → değişiklik öncesi kopya.
