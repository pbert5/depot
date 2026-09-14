#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"
[ -f .env.e2e ] || { echo "Missing .env.e2e; copy .env.e2e.example." >&2; exit 1; }
set -a
. ./.env.e2e
set +a

case "${COMPOSE_PROJECT_NAME:-}" in
    warhammer-e2e|warhammer-e2e-*) ;;
    *) echo "COMPOSE_PROJECT_NAME must be warhammer-e2e or warhammer-e2e-*" >&2; exit 2 ;;
esac
[ "${WARHAMMER_E2E_PARENT_USER_ID:-}" = 00000000-0000-0000-0000-000000000002 ] || {
    echo "WARHAMMER_E2E_PARENT_USER_ID must be the reserved disposable Depot identity" >&2
    exit 2
}

compose() {
    docker compose --project-name "$COMPOSE_PROJECT_NAME" --env-file .env.e2e \
        -f compose.yaml -f compose.e2e.yaml "$@"
}

compose config --quiet
compose --profile e2e up -d --build --wait --wait-timeout 180 depot-db depot-api depot-web
compose --profile e2e run --rm --no-deps depot-e2e-bootstrap
./scripts/purge-e2e.sh --apply
compose --profile e2e run --rm depot-e2e pnpm --dir /app/packages/web exec playwright test
echo "Isolated Depot E2E passed for Compose project $COMPOSE_PROJECT_NAME"
