#!/bin/sh
set -eu

DEVCONTAINER_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
export DEVCONTAINER_ROOT
. "$DEVCONTAINER_ROOT/scripts/lib/devcontainer.sh"

[ "$#" -eq 0 ] || { echo "Usage: ./stop.sh" >&2; exit 64; }
devcontainer_exec ./scripts/dev-runtime.sh stop
