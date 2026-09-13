#!/bin/sh
set -eu

DEVCONTAINER_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
export DEVCONTAINER_ROOT
. "$DEVCONTAINER_ROOT/scripts/lib/devcontainer.sh"

if [ "${1:-}" != "--yes" ] || [ "$#" -ne 1 ]; then
    echo "This deletes only the warhammer-dev Compose containers and volumes." >&2
    echo "It never selects the production depot-db-data volume or production backups." >&2
    echo "Re-run as: ./reset-dev.sh --yes" >&2
    exit 64
fi
devcontainer_exec ./scripts/dev-runtime.sh reset --yes
