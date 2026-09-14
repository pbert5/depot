# Project guidance

- `vendor/depot` is the upstream Depot repository as a Git submodule. Keep it clean and do not casually advance its gitlink.
- The parent repository owns Docker, Compose, networking, scripts, and integration glue; do not fork or casually modify upstream Depot.
- `data/lists` is an independently versioned private submodule for Ash's durable/exportable rosters and collections. Do not invent army data.
- At the start of substantial work, inspect/fetch the parent and both submodules. Treat submodules as independent repositories.
- Use isolated worktrees for mutating workers and Luna sub-agents first when delegation is requested.
- Never commit credentials, tokens, private keys, or `.env.local`.
- Do not broaden network exposure without explicit intent; avoid wildcard host bindings.

## Shared agent and Compose contract

- Sub-agent delegation is the default for substantial work. The lead schedules an explicit dependency DAG, dispatches READY work continuously, integrates green checkpoints, and uses isolated worktrees for mutating workers.
- Blockers do not halt unrelated READY work. Prefer a bounded repair or review worker before the lead takes over. Keep checkpoints pushed frequently and preserve concurrent branches.
- `docker compose` is the development, runtime, build, test, and acceptance authority. Do not require host Node, pnpm, browsers, PostgreSQL clients, local servers, or DevTools installations.
- Browser-visible work uses the disposable Compose-hosted Chrome DevTools MCP. For internal checks, browse `http://depot-web`; the browser container reaches CDP at loopback `127.0.0.1:9222`.
- The internal browser path requires no bridge-to-host Tailscale hairpin. Never publish port 9222 or attach to a personal browser. For final ingress validation, check published `100.110.27.100:19096` separately from the host, a phone, or a real Tailnet peer. Do not put secrets in screenshots or logs.
- Use `gpt-5.6-luna` as the Codex repository-agent default: low for scouts/docs/mechanical checks and medium for implementation, acceptance, integration, and debugging. Every substantial implementation run also keeps a persistent read-only Terra `test-architect`; migration/deployment work keeps a separate read-only Terra `recovery-adviser`; complex rules archaeology may use the bounded read-only Terra `rules-archaeologist`. Terra never mutates repository, Git, runtime, Docker, or database state; Luna remains the mutation authority.

See [docs/agent-workflows.md](docs/agent-workflows.md) for role contracts, dependency examples, repair loop, and canonical commands.
