# Warhammer Depot

Private self-hosted deployment of Ash's [Depot fork](https://github.com/pbert5/depot), with personal Warhammer data kept in a separate private submodule.

This repository is the deployment layer. See `AGENTS.md` for project boundaries and the deployment documentation for the Docker workflow.

## Clone and update

Clone all pinned dependencies with:

```sh
git clone --recurse-submodules https://github.com/pbert5/warhammer-depot.git
```

For an existing checkout, initialize and update the pinned commits with:

```sh
git submodule sync --recursive
git submodule update --init --recursive
```

## Development environment

Warhammer uses a persistent Dev Container as its canonical development
environment. The repository scripts start or reuse it through the Dev
Container CLI, so the host needs only Git, Docker, and `devcontainer` (Docker
Desktop, WSL, Linux, and macOS are supported). Node, pnpm, Codex, and project
tools run inside the container; source remains in the host checkout.

From the repository root, the usual workflow is:

```sh
./run.sh                 # build current source and start local Depot
./dev.sh zsh             # open the canonical development shell
./dev.sh pnpm test       # run a command in the container
./run-codex.sh           # run Codex with persistent ~/.codex
./stop.sh                # stop the development runtime, retaining its DB
./dev-status.sh          # inspect the development environment
```

The local development Depot UI is always
`http://127.0.0.1:18086`. Its Compose project and database volume are separate
from production. `docker compose up -d` from the repository root is the
supported local-development invocation and does not require Tailscale. The
production stack remains an explicit deployment workflow with its existing
configured ports (normally Depot `19096`) and restricted Tailscale bindings;
do not use the development volume for production data.

VS Code may attach to the same Dev Container, but is optional and does not own
the environment. Terminal users and CI use the same repository-owned
`devcontainer up` / `devcontainer exec` boundary. `./reset-dev.sh --yes` is
the explicit destructive operation for development-only containers and state;
it never removes production volumes, backups, the pnpm store, or Codex home.

The Depot submodule tracks Ash's fork at `https://github.com/pbert5/depot.git` (currently the same pinned commit as upstream). Private lists are maintained at `https://github.com/pbert5/warhammer-lists.git` and are accessed over HTTPS using the GitHub CLI credential helper.

## Deployment

The parent repository builds the pinned Depot submodule as a production nginx
image. The image uses Node 24, pnpm 10.20.0, `pnpm install --frozen-lockfile`,
and `pnpm build`. The upstream build generates Wahapedia data and places it in
`packages/web/dist/data`, which is served as static JSON.

Reference CSVs are kept in the parent-owned, hashed snapshot at
`data/depot-source/`. Normal image and Compose test builds validate and use
that snapshot without network access. To intentionally fetch a new snapshot,
run the isolated Compose refresh service:

```sh
DEPOT_POSTGRES_PASSWORD=cache-test \
DEPOT_TAILSCALE_IPV4_ADDR=127.0.0.1 DEPOT_TAILSCALE_ADDR=127.0.0.1 \
docker compose --profile data run --rm depot-data-refresh
```

The refresh stages every expected CSV, records its URL, timestamp, size, and
SHA-256 in `manifest.json`, validates the staged directory, and swaps it into
place only after validation. A failed download therefore leaves the previous
known-good snapshot untouched.

### First deployment

Build from the `vendor/depot` commit recorded by the parent repository's
gitlink; that gitlink is the authoritative deployment input. The historical
parity oracle `6d424fc55820d773bb20866a999750d9462f16e1` is for parity
comparison only and must not replace the parent gitlink before building.
Private `data/lists` remains a separate submodule and is not copied into the
image.

```sh
cp .env.local.example .env.local
# Set DEPOT_TAILSCALE_ADDR to the host's address from `tailscale ip -6`.
./scripts/build.sh
./scripts/up.sh
./scripts/smoke.sh
```

`scripts/build.sh` validates the rendered Compose file and builds only the
requested services without pulling floating base tags; frozen lockfiles and
OCI revision labels make the checked-out inputs and built images auditable.
`up.sh` intentionally does not build Depot,
so restarts reuse the existing image. After a build, use
`./scripts/recreate.sh` to replace containers without removing the named
`depot-db-data` volume. `./scripts/status.sh` prints health, revision proof,
and the network-guard state without exposing credentials.

### Binding and access

Compose publishes the same container port three times: explicitly on
`127.0.0.1`, the host's specific Tailscale IPv4 address, and its specific
Tailscale IPv6 address. Set `DEPOT_TAILSCALE_IPV4_ADDR` from `tailscale ip -4`
and `DEPOT_TAILSCALE_ADDR` from `tailscale ip -6` (without brackets). Compose
refuses to start if either address is not configured, avoiding accidental
wildcard exposure. `DEPOT_PORT` defaults to `19096`.

Stop the service with:

```sh
./scripts/down.sh
```

The supported topology is a small launcher on `19095`, Depot on `19096`, and
Munda Manager on `19097`. Depot's mutable rosters and collections are stored
by its internal Node API in the named `depot-db-data` PostgreSQL volume;
Wahapedia reference data remains generated and static in the Depot web image.
Normal saves never require GitHub or the private lists repository.

Depot portable backups are produced automatically under the ignored
`runtime/backups/depot/` bind mount. Run `./scripts/backup-depot.sh` for an
explicit JSON snapshot and `./scripts/backup-postgres.sh` for a custom-format
database dump. Restore SQL dumps only after review with
`./scripts/restore-postgres.sh path/to/file.dump`.

JSON is the canonical versioned `depot-user-data` format (format version 1);
the API also exports/imports the same bundle as safe YAML. Existing
`depot-offline` IndexedDB roster and collection stores are retained as a
recovery source and copied once the API is available; the migration marker is
stored in IndexedDB and no old data is deleted automatically.

For deterministic browser checks, copy `.env.e2e.example` to `.env.e2e` and
run `./scripts/e2e.sh`. This uses a separate Compose project, a dedicated
Depot database volume, and loopback-only ports. The parent Depot API is wired
to the reserved E2E UUID
`00000000-0000-0000-0000-000000000002`; a Compose bootstrap service inserts
that users row after the API migration. It is intentionally distinct from
Depot's default `...0001` identity. The E2E database and host bindings are
namespaced and never use the normal project volume or Tailscale bindings.

For a non-destructive checkout and Codex environment check, run
`./scripts/codex-doctor.sh`. It reports PASS/WARN/FAIL for the repository,
tools, agents, plugin, Compose MCP service, and a focused doctor contract test.
Set `CODEX_DOCTOR_MCP=1` when the browser tools image already exists and a
transport startup probe is desired.

`./scripts/purge-e2e.sh` is a dry-run by default. Use
`./scripts/purge-e2e.sh --apply` to remove only the reserved parent's rosters
and collections. The script verifies the bootstrap row before mutation and
the zero-document postcondition afterward; it never removes a volume and
refuses non-`warhammer-e2e*` project names.

Munda Manager is pinned as `vendor/mundamanager` and remains on its own
Supabase/Postgres schema. `./scripts/up.sh` downloads the pinned Supabase CLI
release (with a checksum), starts the checked-in local project and seed files,
generates an ignored runtime credential file, builds Munda with the current
public anon key, and starts the application. The browser uses the restricted
`http://localhost:54321` gateway; container-side server calls use Docker's
`host.docker.internal` route. Set `MUNDA_ACCEPTANCE_EMAIL` and
`MUNDA_ACCEPTANCE_PASSWORD` in `.env.local` only when an ephemeral local test
user should be created automatically. Local email confirmation is disabled in
the CLI project only. No SES, Discord, or hosted webhook is required.

Use `./scripts/down.sh` to stop both stacks while retaining their volumes.
`RESET_MUNDA_LOCAL_CONFIRM=RESET ./scripts/reset-munda-local.sh` is the
explicit destructive local database reset. The committed placeholder
Turnstile values are only for private local development; production auth
semantics remain unchanged.

The application ports are published only on `127.0.0.1`, the configured
Tailscale IPv4, and the configured Tailscale IPv6. PostgreSQL and the Depot
API are internal Compose services and are not published to the host.

Normal interactive start from the canonical checkout:

```sh
cd /mypool/code/warhammer
git switch main
git pull --ff-only
git submodule update --init --recursive
./scripts/codex-doctor.sh
codex
```

Worker changes belong in isolated worktrees. Browser acceptance uses the
repository Chrome DevTools plugin backed by disposable Compose Chromium;
Docker Compose remains the runtime and test authority.

### Supabase publication guard

Supabase CLI publishes its local gateway and PostgreSQL ports on wildcard
Docker host bindings. `scripts/up.sh` applies a tagged, idempotent host
iptables/ip6tables guard after the Docker network is up. Because Docker uses
the userland proxy on this host, the guard is installed in both `INPUT` and
`DOCKER-USER`: 54321 permits loopback, `tailscale0`, and only this project's
Munda host-gateway path; 54322 permits loopback only. No default policy,
unrelated chain, or other Docker publication is changed. `scripts/down.sh`
removes only the tagged project rules.

The guard requires root/CAP_NET_ADMIN. For host reboot persistence, the host
owner should add a root-owned NixOS oneshot ordered after Docker, for example:

```nix
systemd.services.warhammer-depot-network-guard = {
  wantedBy = [ "multi-user.target" ];
  after = [ "docker.service" ];
  wants = [ "docker.service" ];
  serviceConfig = {
    Type = "oneshot";
    RemainAfterExit = true;
    WorkingDirectory = "/home/ash/documents/code/warhammer";
    ExecStart = "/home/ash/documents/code/warhammer/scripts/apply-network-guard.sh";
    ExecStop = "/home/ash/documents/code/warhammer/scripts/remove-network-guard.sh";
  };
};
```

Do not add this snippet to the repository automatically: `/etc/nixos` is the
host's authoritative configuration. Until it is installed there, run
`./scripts/up.sh` after boot and verify with
`./scripts/check-network-guard.sh`.

### nginx routing

`/data/` is served only when the requested generated file exists and otherwise
returns 404. All other missing paths fall back to `index.html` for React
BrowserRouter direct navigation.
