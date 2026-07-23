#!/usr/bin/env bash
# Yerelden sunucuya kod dağıtımı. .env dosyalarına ve node_modules'a
# dokunmaz — sadece kaynak kodu günceller, bağımlılık/derleme adımlarını
# sen tetiklersin (aşağıdaki komutlarla).
#
# Kullanım: ./infra/scripts/deploy.sh
set -euo pipefail

SERVER="root@128.140.120.121"
REMOTE_APP_DIR="/opt/gulumsalim/app"

echo "==> Kod paketleniyor..."
tar --exclude='node_modules' --exclude='.git' --exclude='.next' \
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
sudo -u gulumsalim env PATH=/usr/local/bin:/usr/bin:/bin pnpm install
sudo -u gulumsalim env PATH=/usr/local/bin:/usr/bin:/bin pnpm --filter @gulumsalim/web build

cd /opt/gulumsalim/app/services/discovery
sudo -u gulumsalim env PATH=/usr/local/go/bin:/usr/bin:/bin HOME=/opt/gulumsalim go build -o discovery ./cmd/server

systemctl restart gulumsalim-api gulumsalim-web gulumsalim-discovery
systemctl --no-pager status gulumsalim-api gulumsalim-web gulumsalim-discovery
REMOTE

rm -f /tmp/gulumsalim-deploy.tar.gz
echo "==> Tamamlandı."
