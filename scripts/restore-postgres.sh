#!/bin/sh
set -eu
if [ "$#" -ne 1 ]; then echo "usage: $0 PATH_TO_DUMP" >&2; exit 2; fi
case "$1" in *.dump) ;; *) echo "refusing non-dump path" >&2; exit 2;; esac
dump_path=$(CDPATH= cd -- "$(dirname -- "$1")" && pwd)/$(basename -- "$1")
base_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
. "$base_dir/scripts/compose-common.sh"
load_compose_environment "$base_dir"
cd "$base_dir"
compose exec -T depot-db pg_restore --clean --if-exists --no-owner -U "${DEPOT_POSTGRES_USER:-depot}" -d "${DEPOT_POSTGRES_DB:-depot}" < "$dump_path"
