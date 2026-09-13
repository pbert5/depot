#!/bin/sh

# Shared host-side boundary for the persistent Warhammer Dev Container.  Root
# entrypoints source this file; project commands always execute in the
# container, never by relying on host Node, pnpm, or Codex installations.

devcontainer_require() {
    if ! command -v devcontainer >/dev/null 2>&1; then
        echo "devcontainer CLI is required. Install it, then retry (Docker must also be running)." >&2
        return 127
    fi
}

devcontainer_workspace() {
    if [ -n "${DEVCONTAINER_ROOT:-}" ]; then
        printf '%s\n' "$DEVCONTAINER_ROOT"
        return 0
    fi

    git -C "$(dirname -- "$0")" rev-parse --show-toplevel 2>/dev/null || {
        echo "Could not locate the Warhammer repository root." >&2
        return 1
    }
}

ensure_devcontainer() {
    devcontainer_require || return $?
    _devcontainer_root=$(devcontainer_workspace) || return $?

    # `up` is idempotent: the CLI reuses the existing worktree-specific
    # container when its configuration has not changed.
    devcontainer up --workspace-folder "$_devcontainer_root" >/dev/null
}

devcontainer_exec() {
    [ "$#" -gt 0 ] || {
        echo "devcontainer_exec requires a command." >&2
        return 64
    }
    _devcontainer_root=$(devcontainer_workspace) || return $?
    ensure_devcontainer || return $?
    devcontainer exec --workspace-folder "$_devcontainer_root" "$@"
}
