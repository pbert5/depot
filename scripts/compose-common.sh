#!/bin/sh

# Shared, non-secret Compose setup for operator scripts. This file is sourced
# by scripts and intentionally does not execute Docker commands on its own.

compose_root() {
    CDPATH= cd -- "$(dirname -- "$0")/.."
}

load_compose_environment() {
    root=$1
    [ -f "$root/.env.local" ] || {
        echo "Missing .env.local; copy .env.local.example and set deployment values." >&2
        return 1
    }

    # Compose reads these files too; exporting them makes the revision labels
    # identical for config, build, recreate, and status commands.
    set -a
    . "$root/.env.local"
    if [ -f "$root/runtime/munda-supabase/env" ]; then
        . "$root/runtime/munda-supabase/env"
    fi
    set +a

    export WARHAMMER_PARENT_REVISION=$(git -C "$root" rev-parse HEAD)
    export DEPOT_SOURCE_REVISION=$(git -C "$root/vendor/depot" rev-parse HEAD)
    export MUNDA_SOURCE_REVISION=$(git -C "$root/vendor/mundamanager" rev-parse HEAD)
}

compose() {
    # Operator scripts intentionally select the secure production overlay.
    # Plain `docker compose` remains the localhost-only development topology.
    project_name=${COMPOSE_PROJECT_NAME:-warhammer}
    if [ -f runtime/munda-supabase/env ]; then
        docker compose --project-name "$project_name" --env-file .env.local --env-file runtime/munda-supabase/env \
            -f compose.yaml -f compose.production.yaml "$@"
    else
        docker compose --project-name "$project_name" --env-file .env.local \
            -f compose.yaml -f compose.production.yaml "$@"
    fi
}
