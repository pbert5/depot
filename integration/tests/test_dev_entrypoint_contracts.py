from pathlib import Path


ROOT = Path(__file__).parents[2]


def read(path):
    return (ROOT / path).read_text()


def test_root_entrypoints_use_the_shared_devcontainer_boundary():
    for script in ("run.sh", "dev.sh", "run-codex.sh", "stop.sh", "dev-status.sh", "reset-dev.sh"):
        text = read(script)
        assert "scripts/lib/devcontainer.sh" in text
        assert "devcontainer_exec" in text

    assert 'set -- zsh' in read("dev.sh")
    assert 'devcontainer_exec codex "$@"' in read("run-codex.sh")


def test_devcontainer_library_is_posix_and_idempotent():
    text = read("scripts/lib/devcontainer.sh")
    assert "#!/bin/sh" in text
    assert 'devcontainer up --workspace-folder "$_devcontainer_root"' in text
    assert 'devcontainer exec --workspace-folder "$_devcontainer_root" "$@"' in text
    assert "command -v devcontainer" in text
    assert "bash" not in text.lower()


def test_runtime_refreshes_only_the_safe_development_topology():
    text = read("scripts/dev-runtime.sh")
    assert "compose build --pull=false depot-api depot-web" in text
    assert "--force-recreate" in text
    assert "--wait-timeout 180" in text
    assert "http://127.0.0.1:18086" in text
    assert "DEPOT_TAILSCALE" not in text
    assert "compose down --volumes --remove-orphans" in text
    assert 'project" != "warhammer-dev"' in text
    assert "production" not in text.lower() or "production operators" in text.lower()


def test_reset_needs_explicit_confirmation_and_keeps_tool_volumes():
    text = read("reset-dev.sh")
    runtime = read("scripts/dev-runtime.sh")
    assert '"--yes"' in text
    assert "Persistent Codex and pnpm volumes were not touched." in runtime
    assert "depot-db-data" not in runtime
