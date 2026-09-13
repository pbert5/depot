#!/bin/sh
set -eu

DEVCONTAINER_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
export DEVCONTAINER_ROOT
. "$DEVCONTAINER_ROOT/scripts/lib/devcontainer.sh"

devcontainer_exec ./scripts/dev-runtime.sh run "$@"
