# Consolidation Preflight — FAZ 0

**Tarih:** 2026-07-24 · **İnceleyen:** Claude Opus 4.8 (release integrator)
**Amaç:** İki inceleme branch'indeki doğrulanmış düzeltmeleri tek temiz release branch'inde birleştirmeden önce durum tespiti + güvenli yedekleme.

## Git kimliği
- Config'te mevcut: `user.name = itu.itis23.bakla22`, `user.email = bakla22.itu.edu.tr`.
- ⚠️ Yapılandırılmış e-posta **bozuk** (`@` yok). Proje sahibi yeni konsolidasyon commit'leri için gerçek GitHub kimliğini verdi: **`bahadirbakla@gmail.com`**. Repo-local config bu e-postaya güncellendi (`user.name = "Bahadir Bakla"` — yalnızca e-postadan çıkarım; sahibi düzeltebilir). **Geçmiş commit author'ları değiştirilmedi** (history rewrite yok); yalnızca yeni commit'ler bu kimliği taşır.

## Branch durumu (değişiklik öncesi)
| Branch | Tip | İçerik |
|---|---|---|
| `main` | base | `38cb008` (origin/main) |
| `review/gpt56` | worktree `.worktrees/gpt56` | `a840f82` ← 29ade4b ← d27e9f5 ← 3ffaa26 ← d4c1aa0 ← 38cb008 |
| `review/claude-opus` | ana worktree | `039f3a7` ← 433fa32 ← 38ef8b9 ← **fc30214** ← 38cb008 |

## Duplicate / misplaced commit doğrulaması
- **`fc30214`** yalnızca `review/claude-opus`'ta. `git patch-id --stable`:
  - `fc30214` → `5a8fcbd6058c6b761d8242316354ba47a4c0be87`
  - `d4c1aa0` → `5a8fcbd6058c6b761d8242316354ba47a4c0be87`
  - **BİREBİR AYNI** → `fc30214` konsolidasyona **alınmayacak** (d4c1aa0 zaten alınır).

## Stash doğrulaması (apply/drop YOK)
- `stash@{0}: gpt56-auth-transfer` — internal WIP commit'leri `fc30214` üzerine kurulu.
- `git patch-id --stable`:
  - stash → `ed65ddacfaf3920179292ebaf8a89330d08d098d`
  - `3ffaa26` → `e460a654d59915c776db227634d87b53254b637e`
  - **FARKLI** → stash, 3ffaa26 ile aynı dosyalara dokunuyor ama içerik farklı (auth işinin erken/divergent iterasyonu). **Korundu, uygulanmadı/düşürülmedi.** İçerik yedeği: `../gpt56-stash-backup.patch`. Karar sahibinde.

## Oluşturulan yedek ref'ler
| Ref | Hedef |
|---|---|
| `backup/review-gpt56-before-consolidation` (branch) | `a840f82` |
| `backup/review-claude-before-consolidation` (branch) | `039f3a7` |
| `backup/pre-consolidation-main` (tag) | `38cb008` |
- Ek patch yedekleri: `../gpt56-{uncommitted,staged,stash}-backup.patch`.

## Konsolidasyon planı
- Taban: **`main`** (`38cb008`) — repo'da `master` yok, dev tabanı doğrulandı.
- Yeni branch: **`release/yasin-secure-foundation`** (mevcut değildi).
- Cherry-pick sırası (`-x` ile izlenebilir): `d4c1aa0 → 3ffaa26 → d27e9f5 → 29ade4b → 38ef8b9 → 433fa32 → 039f3a7`. **`fc30214` atlanır.**
- Hiçbir branch silinmedi, reset/rebase/force/amend/stash-drop yapılmadı.
