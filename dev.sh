#!/bin/sh
set -eu

DEVCONTAINER_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
export DEVCONTAINER_ROOT
. "$DEVCONTAINER_ROOT/scripts/lib/devcontainer.sh"

if [ "$#" -eq 0 ]; then
    set -- zsh
fi
devcontainer_exec "$@"
