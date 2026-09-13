"""Executable contracts for the terminal-first local development interface.

These tests intentionally use a fake ``devcontainer`` executable.  They check
the public repository wrappers without needing host Node, pnpm, or a Docker
daemon, which is the portability promise made by the wrappers themselves.
"""

import os
import subprocess
from pathlib import Path


ROOT = Path(__file__).parents[2]


def read(path):
    return (ROOT / path).read_text()


def run_script(script, *args, path=None, **extra_env):
    env = os.environ.copy()
    env.update(extra_env)
    # Deliberately omit /usr/local/bin, where a real devcontainer binary is
    # commonly installed, so missing-tool coverage is deterministic.
    if path is not None:
        env["PATH"] = str(path)
    return subprocess.run(
        [str(ROOT / script), *args],
        cwd=ROOT,
        env=env,
        text=True,
        capture_output=True,
        check=False,
    )


def install_fake_devcontainer(directory, log):
    fake = directory / "devcontainer"
    fake.write_text(
        "#!/bin/sh\n"
        "set -eu\n"
        "printf '%s\\n' \"$*\" >> \"$DEVCONTAINER_LOG\"\n"
        "case \"${1:-}\" in\n"
        "  up) exit 0 ;;\n"
        "  exec)\n"
        "    shift\n"
        "    while [ $# -gt 0 ]; do\n"
        "      case \"$1\" in\n"
        "        --workspace-folder) shift 2 ;;\n"
        "        --) shift; break ;;\n"
        "        -*) shift ;;\n"
        "        *) break ;;\n"
        "      esac\n"
        "    done\n"
        "    exec \"$@\" ;;\n"
        "  *) echo \"unexpected devcontainer command: $1\" >&2; exit 64 ;;\n"
        "esac\n"
    )
    fake.chmod(0o755)


def test_dev_compose_is_safe_default_and_production_is_explicit():
    dev = read("compose.yaml")
    production = read("compose.prod.yaml")

    # A plain command from a fresh checkout is local development, without any
    # machine-specific Tailscale or secret setup.
    assert "DEPOT_TAILSCALE" not in dev
    assert "DEPOT_POSTGRES_PASSWORD:?" not in dev
    assert "warhammer-dev" in dev
    assert "18086" in dev
    assert 'host_ip: "127.0.0.1"' in dev
    assert "depot-db-data" in dev
    assert "ports:" not in dev.split("  depot-api:", 1)[1].split("\n  ", 1)[0]

    # The operator topology retains the deliberate network bindings and is
    # selected explicitly rather than becoming a hidden local prerequisite.
    assert "DEPOT_TAILSCALE_IPV4_ADDR:?" in production
    assert "DEPOT_TAILSCALE_ADDR:?" in production
    assert "DEPOT_POSTGRES_PASSWORD:?" in production
    assert 'host_ip: "127.0.0.1"' in production
    assert "19096" in production


def test_runtime_scripts_are_present_and_executable():
    for name in (
        "run.sh",
        "dev.sh",
        "run-codex.sh",
        "stop.sh",
        "dev-status.sh",
        "reset-dev.sh",
        "scripts/lib/devcontainer.sh",
        "scripts/dev-runtime.sh",
    ):
        path = ROOT / name
        assert path.is_file(), name
        assert os.access(path, os.X_OK), name


def test_dev_wrapper_starts_then_forwards_arguments_and_exit_status(tmp_path):
    log = tmp_path / "devcontainer.log"
    install_fake_devcontainer(tmp_path, log)

    result = run_script(
        "dev.sh",
        "sh",
        "-c",
        "[ \"$1\" = \"two words\" ] && exit 37",
        "ignored-zero",
        "two words",
        path=tmp_path,
        DEVCONTAINER_LOG=str(log),
    )

    assert result.returncode == 37, result.stderr
    calls = log.read_text().splitlines()
    assert any(call.startswith("up ") or call == "up" for call in calls)
    exec_call = next(call for call in calls if call.startswith("exec "))
    assert "--workspace-folder" in exec_call
    assert str(ROOT) in exec_call
    assert "two words" in exec_call


def test_missing_devcontainer_has_a_concise_actionable_error():
    result = run_script("dev.sh", "true", path="/usr/bin:/bin")
    assert result.returncode != 0
    assert "devcontainer" in result.stderr.lower()
    assert "install" in result.stderr.lower() or "required" in result.stderr.lower()


def test_codex_wrapper_is_a_thin_devcontainer_exec_wrapper():
    text = read("run-codex.sh")
    assert "codex" in text
    assert '"$@"' in text
    assert "devcontainer" in text or "devcontainer_exec" in text


def test_run_runtime_contract_preserves_data_and_refreshes_images():
    runtime = read("scripts/dev-runtime.sh")
    run = read("run.sh")
    stop = read("stop.sh")
    reset = read("reset-dev.sh")

    assert "build" in runtime and "depot-api" in runtime and "depot-web" in runtime
    assert "--force-recreate" in runtime
    assert "--no-cache" not in runtime
    assert "--wait" in runtime
    assert "18086" in run or "18086" in runtime
    assert "down" in stop
    assert "--volumes" not in stop

    # Reset must require an explicit non-interactive acknowledgement and must
    # refuse production resource names before passing a destructive command.
    assert "--yes" in reset
    assert "warhammer-dev" in reset
    assert "depot-db-data" in reset
    assert "production" in reset.lower() or "reject" in reset.lower()
    assert "warhammer-codex" not in reset

