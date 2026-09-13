#!/bin/sh
set -eu
base_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
. "$base_dir/scripts/compose-common.sh"
load_compose_environment "$base_dir"
mkdir -p "$base_dir/runtime/backups/postgres"
stamp=$(date -u +%Y-%m-%dT%H%M%SZ)
target="$base_dir/runtime/backups/postgres/depot-postgres-$stamp.dump"
tmp="$target.tmp"
cd "$base_dir"
compose exec -T depot-db pg_dump -Fc -U "${DEPOT_POSTGRES_USER:-depot}" -d "${DEPOT_POSTGRES_DB:-depot}" > "$tmp"
mv "$tmp" "$target"
echo "Wrote $target"
