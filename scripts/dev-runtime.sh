#!/bin/sh
set -eu

# Commands in this file run *inside* the canonical Dev Container.  compose.yaml
# is intentionally the local development topology; production operators use
# their explicit production scripts and compose override.

root=$(git rev-parse --show-toplevel)
cd "$root"

if [ "${COMPOSE_PROJECT_NAME:-warhammer-dev}" != "warhammer-dev" ]; then
    echo "Refusing development runtime with non-development Compose project: ${COMPOSE_PROJECT_NAME}." >&2
    exit 2
fi

parent_revision=$(git rev-parse HEAD)
depot_revision=$(git -C vendor/depot rev-parse HEAD)
export WARHAMMER_PARENT_REVISION="$parent_revision"
export DEPOT_SOURCE_REVISION="$depot_revision"

# .env.local is optional for ordinary development, but supplies the explicit
# host address when --tailscale is requested.
if [ -f .env.local ]; then
    set -a
    . ./.env.local
    set +a
fi

mode_file=".dev-runtime-mode"
dev_mode=local
if [ -f "$mode_file" ]; then
    dev_mode=$(sed -n '1p' "$mode_file")
fi

compose() {
    compose_env_file=""
    [ -f .env.local ] && compose_env_file="--env-file .env.local"
    if [ "$dev_mode" = tailscale-ipv6 ]; then
        docker compose $compose_env_file --project-name warhammer-dev \
            -f compose.yaml -f compose.dev-tailscale-ipv6.yaml "$@"
    elif [ "$dev_mode" = tailscale ]; then
        docker compose $compose_env_file --project-name warhammer-dev \
            -f compose.yaml -f compose.dev-tailscale.yaml "$@"
    else
        docker compose $compose_env_file --project-name warhammer-dev -f compose.yaml "$@"
    fi
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
    echo "Development mode: $dev_mode"
    echo "Depot: http://127.0.0.1:${DEPOT_PORT:-19096}"
    if [ "$dev_mode" = tailscale ] || [ "$dev_mode" = tailscale-ipv6 ]; then
        echo "Depot (Tailscale IPv4): http://${DEPOT_TAILSCALE_IPV4_ADDR}:${DEPOT_PORT:-19096}"
        if [ "$dev_mode" = tailscale-ipv6 ]; then
            echo "Depot (Tailscale IPv6): http://[${DEPOT_TAILSCALE_ADDR}]:${DEPOT_PORT:-19096}"
        fi
    fi
    echo "Development database: Compose-managed warhammer-dev volume (not host-published)"
}

case "${1:-run}" in
    run)
        shift || true
        case "${1:-}" in
            "") dev_mode=local ;;
            --tailscale)
                [ "$#" -eq 1 ] || { echo "run accepts only --tailscale." >&2; exit 64; }
                [ -n "${DEPOT_TAILSCALE_IPV4_ADDR:-}" ] || {
                    echo "--tailscale requires DEPOT_TAILSCALE_IPV4_ADDR in .env.local or the environment." >&2
                    exit 64
                }
                if [ -n "${DEPOT_TAILSCALE_ADDR:-}" ]; then
                    dev_mode=tailscale-ipv6
                else
                    dev_mode=tailscale
                fi
                ;;
            *) echo "run accepts only --tailscale." >&2; exit 64 ;;
        esac
        printf '%s\n' "$dev_mode" > "$mode_file"
        if ! compose config --quiet; then
            echo "Could not render the development Compose configuration for Depot port ${DEPOT_PORT:-19096}." >&2
            exit 1
        fi
        # Docker's normal build cache remains enabled.  Rebuilding before the
        # forced recreate makes the running service reflect this checkout.
        compose build --pull=false depot-api depot-web
        # The canonical local workflow is Depot.  Do not accidentally require
        # the optional Munda/Supabase operator stack just to bring up Depot.
        if ! compose up -d --no-build --force-recreate --remove-orphans --wait --wait-timeout 180 \
            depot-db depot-api depot-web; then
            echo "Development Depot port ${DEPOT_PORT:-19096} could not be bound; if it is occupied, stop the conflicting service and retry." >&2
            exit 1
        fi
        echo "Depot: http://127.0.0.1:${DEPOT_PORT:-19096}"
        if [ "$dev_mode" = tailscale ] || [ "$dev_mode" = tailscale-ipv6 ]; then
            echo "Depot (Tailscale IPv4): http://${DEPOT_TAILSCALE_IPV4_ADDR}:${DEPOT_PORT:-19096}"
            if [ "$dev_mode" = tailscale-ipv6 ]; then
                echo "Depot (Tailscale IPv6): http://[${DEPOT_TAILSCALE_ADDR}]:${DEPOT_PORT:-19096}"
            fi
        fi
        compose ps
        ;;
    stop)
        compose down --remove-orphans
        rm -f "$mode_file"
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
        rm -f "$mode_file"
        echo "Development Compose containers and volumes were removed. Persistent Codex and pnpm volumes were not touched."
        ;;
    *)
        echo "Usage: $0 {run|stop|status|reset --yes}" >&2
        exit 64
        ;;
esac
