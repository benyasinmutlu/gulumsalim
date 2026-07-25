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
tar --exclude='./node_modules' --exclude='./.git' --exclude='./.next' \
    --exclude='./go' --exclude='./app' --exclude='./.config' --exclude='./audit' \
    --exclude='apps/api/.env' --exclude='apps/web/.env.local' \
    --exclude='services/discovery/.env' --exclude='services/discovery/discovery' \
    -czf /tmp/gulumsalim-deploy.tar.gz .

echo "==> Sunucuya kopyalanıyor..."
scp /tmp/gulumsalim-deploy.tar.gz "$SERVER:/tmp/gulumsalim-deploy.tar.gz"

echo "==> Sunucuda açılıyor ve servisler yeniden başlatılıyor..."
ssh "$SERVER" bash -s <<'REMOTE'
set -euo pipefail
tar -xzf /tmp/gulumsalim-deploy.tar.gz -C /opt/gulumsalim/app
rm -f /tmp/gulumsalim-deploy.tar.gz
chown -R gulumsalim:gulumsalim /opt/gulumsalim/app

cd /opt/gulumsalim/app
# --frozen-lockfile: lockfile package.json ile uyuşmazsa deploy'u fail et,
# sessizce bağımlılık güncelleme ve tekrarlanamaz build (CLAUDE-002). Fail
# ederse lockfile yeniden üretilip commit'lenmeli — bypass edilmemeli.
sudo -u gulumsalim env PATH=/usr/local/bin:/usr/bin:/bin pnpm install --frozen-lockfile
sudo -u gulumsalim env PATH=/usr/local/bin:/usr/bin:/bin pnpm --filter @gulumsalim/web build

cd /opt/gulumsalim/app/services/discovery
sudo -u gulumsalim env PATH=/usr/local/go/bin:/usr/bin:/bin HOME=/opt/gulumsalim go build -o discovery ./cmd/server

systemctl restart gulumsalim-api gulumsalim-web gulumsalim-discovery
systemctl --no-pager status gulumsalim-api gulumsalim-web gulumsalim-discovery
REMOTE

rm -f /tmp/gulumsalim-deploy.tar.gz
echo "==> Tamamlandı."
