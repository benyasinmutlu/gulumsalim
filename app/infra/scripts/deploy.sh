#!/usr/bin/env bash
# Yerelden sunucuya kod dağıtımı. .env dosyalarına ve node_modules'a
# dokunmaz — sadece kaynak kodu günceller, bağımlılık/derleme adımlarını
# sen tetiklersin (aşağıdaki komutlarla).
#
# Kullanım: ./infra/scripts/deploy.sh
set -Eeuo pipefail

SERVER="root@128.140.120.121"
REMOTE_APP_DIR="/opt/gulumsalim/app"

# NOT (CLAUDE-002): Bu script hâlâ yerinde-üzerine-açma yapar; atomik değildir
# ve rollback yoktur. Önerilen hedef: sürümlü release dizini + `current`
# symlink swap (bkz. infra-release-checklist.md). Migration'lar burada
# çalıştırılmaz — kod deploy'undan ÖNCE elle koşulmalı:
#   ssh $SERVER 'cd /opt/gulumsalim/app/apps/api && sudo -u gulumsalim pnpm db:migrate'

echo "==> Kod paketleniyor..."
# go/ (module cache), app/ (deploy edilmeyen ikiz ağaç), .config/ (kullanıcı
# config'i) ve audit/ prod'a gönderilmez (CLAUDE-002, CLAUDE-010, CLAUDE-021).
#
# ÖNEMLİ: kök seviyesindeki ./app twin-tree'sini `--exclude='./app'` ile
# hariç tutmuyoruz - bu desen çapalanmamış (GNU tar'da --anchored, bsdtar'da
# hiç desteklenmiyor) olduğu için yol içinde HERHANGİ bir yerde geçen "app"
# adlı dizini de eşleştirir; apps/web/src/app/ (Next.js'in TÜM sayfa/route
# dizini!) tam olarak buna denk düşer ve sessizce deploy dışı kalırdı (bkz.
# olay: apps/web/src/app hiç güncellenmiyormuş, sayfalar haftalarca eski
# kalmış). Bunun yerine twin-tree'yi (varsa) tar'lamadan önce fiziksel olarak
# kenara alıyoruz - tar implementasyonundan bağımsız, sağlam bir çözüm.
TWIN_TREE_STASH=""
if [ -d ./app ]; then
  TWIN_TREE_STASH=$(mktemp -d)
  mv ./app "$TWIN_TREE_STASH/app"
fi
restore_twin_tree() {
  if [ -n "$TWIN_TREE_STASH" ]; then
    mv "$TWIN_TREE_STASH/app" ./app
    rmdir "$TWIN_TREE_STASH"
  fi
}
trap restore_twin_tree EXIT

tar --exclude='./node_modules' --exclude='./.git' --exclude='./.next' \
    --exclude='./go' --exclude='./.config' --exclude='./audit' \
    --exclude='apps/api/.env' --exclude='apps/web/.env.local' \
    --exclude='services/discovery/.env' --exclude='services/discovery/discovery' \
    -czf /tmp/gulumsalim-deploy.tar.gz .

restore_twin_tree
trap - EXIT

echo "==> Sunucuya kopyalanıyor..."
scp /tmp/gulumsalim-deploy.tar.gz "$SERVER:/tmp/gulumsalim-deploy.tar.gz"

echo "==> Sunucuda açılıyor ve servisler yeniden başlatılıyor..."
ssh "$SERVER" bash -s <<'REMOTE'
set -euo pipefail
tar -xzf /tmp/gulumsalim-deploy.tar.gz -C /opt/gulumsalim/app
rm -f /tmp/gulumsalim-deploy.tar.gz
# NOT: /opt/gulumsalim/app artık bir release dizinine (/opt/gulumsalim/releases/<rev>)
# sembolik bağlantı - "chown -R" komut satırındaki sembolik bağlantı argümanlarını
# VARSAYILAN OLARAK takip etmez (-H/-L olmadan), yani gerçek release dizininin
# İÇİNE hiç inmez ve tar'dan gelen orijinal (yerel makine) sahiplik bilgisi kalır
# - bu da gulumsalim kullanıcısının pnpm install sırasında EACCES almasına yol
# açar (bkz. olay: 2026-07-29). "-H" ile üstteki sembolik bağlantı takip edilir.
#
# NOT (bkz. olay: 2026-08-01): yerel makinedeki pnpm store'da zaman zaman
# hedefi olmayan (dangling) symlink'ler birikiyor (ör. kaldırılmış bir
# bağımlılığın .pnpm/node_modules altındaki linki) - tar bunları olduğu gibi
# arşivler, chown -R bunlara rastlayınca "cannot dereference" ile başarısız
# olur ve set -e altında TÜM deploy'u (pnpm install/build/restart hiç
# çalışmadan) durdurur. Bu chown tamamen en-iyi-çaba bir sahiplik düzeltmesi
# - birkaç kırık symlink'te başarısız olması pnpm install/build'i bozmaz
# (o paketler zaten kullanılmıyor), bu yüzden script'i durdurmasına izin
# verilmiyor.
if ! chown -R -H gulumsalim:gulumsalim /opt/gulumsalim/app; then
  echo "UYARI: chown bazı dosyalarda başarısız oldu (muhtemelen bozuk/dangling symlink) - devam ediliyor" >&2
fi

cd /opt/gulumsalim/app
# --frozen-lockfile: lockfile package.json ile uyuşmazsa deploy'u fail et,
# sessizce bağımlılık güncelleme ve tekrarlanamaz build (CLAUDE-002). Fail
# ederse lockfile yeniden üretilip commit'lenmeli — bypass edilmemeli.
sudo -u gulumsalim env PATH=/usr/local/bin:/usr/bin:/bin pnpm install --frozen-lockfile
sudo -u gulumsalim env PATH=/usr/local/bin:/usr/bin:/bin pnpm --filter @gulumsalim/web build

cd /opt/gulumsalim/app/services/discovery
# NOT: /opt/gulumsalim (gulumsalim kullanıcısının HOME'u) içindeki .git deposu
# root'a ait - gulumsalim kullanıcısı için "dubious ownership" hatası verir
# (git config --global --add safe.directory çözümü de HOME yazma izni olmadığı
# için başarısız olur, bkz. olay: 2026-07-29). -buildvcs=false ile Go'nun VCS
# damgalama adımı tamamen atlanır, build hash/versiyon zaten deploy.sh dışında
# takip edilmiyor.
sudo -u gulumsalim env PATH=/usr/local/go/bin:/usr/bin:/bin HOME=/opt/gulumsalim go build -buildvcs=false -o discovery ./cmd/server

systemctl restart gulumsalim-api gulumsalim-web gulumsalim-discovery
systemctl --no-pager status gulumsalim-api gulumsalim-web gulumsalim-discovery
REMOTE

rm -f /tmp/gulumsalim-deploy.tar.gz
echo "==> Tamamlandı."
