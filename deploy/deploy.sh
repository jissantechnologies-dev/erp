#!/usr/bin/env bash
# Redeploys the current working tree to erp.gvndemo.com.
#
# Idempotent: rebuilds the bundle, ships it, installs deps, applies pending
# migrations and restarts the service. It does NOT touch the live foundry-erp
# service, its nginx site, or the foundry_erp database.
#
#   ./deploy/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

HOST="${ERP_HOST:-root@139.59.73.160}"
KEY="${ERP_SSH_KEY:-$HOME/.ssh/schoolapp_demo}"
REMOTE_DIR=/opt/indus-erp
SSH=(ssh -o BatchMode=yes -o ConnectTimeout=20 -i "$KEY" "$HOST")

echo "==> building bundle"
bash deploy/build-bundle.sh >/dev/null

echo "==> shipping to $HOST:$REMOTE_DIR"
# node_modules is excluded from the bundle and preserved on the server, so a
# redeploy does not reinstall native modules every time.
tar -czf - -C deploy/bundle . | "${SSH[@]}" "mkdir -p $REMOTE_DIR && tar -xzf - -C $REMOTE_DIR"

echo "==> installing deps / migrating / restarting"
"${SSH[@]}" bash -s <<'REMOTE'
set -euo pipefail
cd /opt/indus-erp
set -a; . /etc/indus-erp.env; set +a

npm install --omit=dev --no-audit --no-fund --silent
npx prisma generate --schema apps/api/prisma/schema.prisma >/dev/null
npx prisma migrate deploy --schema apps/api/prisma/schema.prisma

systemctl restart indus-erp
sleep 5
systemctl is-active --quiet indus-erp || { journalctl -u indus-erp -n 30 --no-pager; exit 1; }
echo "service active, $(systemctl show indus-erp -p MemoryCurrent --value | awk '{printf "%.0f MB", $1/1048576}')"
REMOTE

echo "==> smoke test"
"${SSH[@]}" 'curl -s -o /dev/null -w "  static HTTP %{http_code}\n" http://127.0.0.1/ -H "Host: erp.gvndemo.com";
             curl -s -o /dev/null -w "  api    HTTP %{http_code} (401 expected)\n" http://127.0.0.1/api/auth/me -H "Host: erp.gvndemo.com"'
echo "==> done"
