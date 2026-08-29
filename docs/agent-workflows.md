# Agent workflows

Use roles `repo-scout`, `frontend-ui`, `persistence-data`, `compose-runtime`,
`browser-acceptance`, `test-verifier`, `integration-reviewer`, and
`docs-maintainer`. The lead schedules a dependency DAG; mutating workers use
isolated worktrees and repository failures become assigned repair tasks.

```bash
docker compose up -d --build
docker compose --profile test run --rm depot-test pnpm test
docker compose --profile test run --rm depot-test pnpm typecheck
docker compose --profile test run --rm depot-test pnpm build
docker compose --profile test run --rm depot-test pnpm --filter @depot/web test:e2e
docker compose run --rm --no-deps -T chrome-devtools-mcp

# Isolated production-web E2E project (removes only its own resources)
docker compose -p depot-e2e -f compose.yaml -f compose.e2e.yaml --profile e2e run --rm depot-e2e pnpm --filter @depot/web test:e2e
docker compose -p depot-e2e -f compose.yaml -f compose.e2e.yaml down -v
```

Use Chrome DevTools MCP for actual DOM, focus, console, network, interaction,
and 390x844/360px responsive evidence. CDP remains container-local and the
browser profile is disposable.
