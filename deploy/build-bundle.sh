#!/usr/bin/env bash
# Builds a deployable bundle in deploy/bundle/.
#
# The bundle mirrors the npm-workspace layout rather than vendoring
# node_modules, because argon2 and the Prisma query engine are native and must
# be installed on the target platform. `npm install` on the server then resolves
# @erp/shared through the workspace link.
set -euo pipefail
cd "$(dirname "$0")/.."

OUT=deploy/bundle
rm -rf "$OUT"
mkdir -p "$OUT"/{packages/shared,apps/api,web}

echo "==> building workspaces"
npm run build --silent

echo "==> staging api"
cp -r apps/api/dist              "$OUT/apps/api/dist"
cp -r apps/api/prisma            "$OUT/apps/api/prisma"
cp    apps/api/package.json      "$OUT/apps/api/package.json"

echo "==> staging shared (compiled, no sources)"
cp -r packages/shared/dist       "$OUT/packages/shared/dist"
cp    packages/shared/package.json "$OUT/packages/shared/package.json"

echo "==> staging web (static, served by nginx)"
cp -r apps/web/dist/.            "$OUT/web/"

echo "==> minimal root manifest for workspace resolution"
cat > "$OUT/package.json" <<'JSON'
{
  "name": "indus-erp-deploy",
  "private": true,
  "workspaces": ["packages/*", "apps/api"],
  "scripts": {
    "start": "node apps/api/dist/main.js",
    "migrate": "prisma migrate deploy --schema apps/api/prisma/schema.prisma",
    "seed": "node --experimental-strip-types apps/api/prisma/seed.ts"
  }
}
JSON

# The seed is TypeScript and tsx is a devDependency, so it is not run on the
# server by default; provisioning seeds via a one-off tsx invocation instead.
cp package-lock.json "$OUT/package-lock.json" 2>/dev/null || true

echo "==> bundle contents"
du -sh "$OUT"
find "$OUT" -maxdepth 3 -type d | sed "s|^$OUT|  .|" | head -20
