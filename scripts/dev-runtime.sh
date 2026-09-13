#!/bin/sh
set -eu

# Commands in this file run *inside* the canonical Dev Container.  compose.yaml
# is intentionally the local development topology; production operators use
# their explicit production scripts and compose override.

root=$(git rev-parse --show-toplevel)
cd "$root"

parent_revision=$(git rev-parse HEAD)
depot_revision=$(git -C vendor/depot rev-parse HEAD)
export WARHAMMER_PARENT_REVISION="$parent_revision"
export DEPOT_SOURCE_REVISION="$depot_revision"

compose() {
    docker compose "$@"
}

require_dev_project() {
    project=$(compose config --format json | jq -r '.name // empty')
    if [ "$project" != "warhammer-dev" ]; then
        echo "Refusing destructive development reset: expected Compose project warhammer-dev, got ${project:-none}." >&2
        return 1
    fi
}

show_status() {
    echo "Dev Container: reachable"
    docker info >/dev/null
    echo "Docker daemon: reachable"
    compose config --quiet
    echo "Development Compose services"
    compose ps --all
    echo
    echo "Source revisions"
    printf '  parent: %s\n' "$parent_revision"
    printf '  Depot:  %s\n' "$depot_revision"

    for service in depot-db depot-api depot-web; do
        container=$(compose ps -q "$service" 2>/dev/null || true)
        if [ -z "$container" ]; then
            printf '  %s: not running\n' "$service"
            continue
        fi
        image=$(docker inspect --format '{{.Image}}' "$container")
        health=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container")
        revision=$(docker inspect --format '{{index .Config.Labels "com.warhammer.depot.revision"}}' "$container")
        printf '  %s: health=%s image=%s depot-revision=%s\n' "$service" "$health" "$image" "$revision"
    done
    echo
    echo "Depot: http://127.0.0.1:18086"
    echo "Development database: Compose-managed warhammer-dev volume (not host-published)"
}

case "${1:-run}" in
    run)
        shift || true
        [ "$#" -eq 0 ] || { echo "run does not accept arguments." >&2; exit 64; }
        # Docker's normal build cache remains enabled.  Rebuilding before the
        # forced recreate makes the running service reflect this checkout.
        compose build --pull=false depot-api depot-web
        # The canonical local workflow is Depot.  Do not accidentally require
        # the optional Munda/Supabase operator stack just to bring up Depot.
        compose up -d --no-build --force-recreate --remove-orphans --wait --wait-timeout 180 \
            depot-db depot-api depot-web
        echo "Depot: http://127.0.0.1:18086"
        compose ps
        ;;
    stop)
        compose down --remove-orphans
        echo "Development runtime stopped; the Dev Container and development database are preserved."
        ;;
    status)
        show_status
        ;;
    reset)
        [ "${2:-}" = "--yes" ] && [ "$#" -eq 2 ] || {
            echo "reset requires exactly --yes." >&2
            exit 64
        }
        require_dev_project
        compose down --volumes --remove-orphans
        echo "Development Compose containers and volumes were removed. Persistent Codex and pnpm volumes were not touched."
        ;;
    *)
        echo "Usage: $0 {run|stop|status|reset --yes}" >&2
        exit 64
        ;;
esac
