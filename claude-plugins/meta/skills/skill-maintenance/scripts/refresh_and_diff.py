"""Refresh Claude documentation snapshots and write semantic unified diffs.

The two source scripts stamp their output with the current fetch time. This
helper removes those volatile lines before comparing the files so a refresh
with unchanged content is reported as unchanged.

The diff is computed against this script's own record of each target's
content as of its last run (stored under STATE_DIR_RELATIVE), not against
the live output file's current content. If the live output was changed
through some other route between runs (a direct run of the generator, a
manual edit, a git checkout, ...), diffing against it would either hide the
change (if it happened to match the latest fetch) or resurrect changes
already reviewed in a prior run (if it reverted to an older state). Diffing
against our own last-seen record avoids both, at the accepted cost of
occasionally re-reporting a change that was already picked up by whatever
other route touched the output.

Each target's diff is written to its own file under a diff folder instead of
one combined patch, so a caller can hand individual files to a subagent for
summarization rather than loading the full diff content directly.
"""

from __future__ import annotations

import difflib
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path


FETCHED_AT_RE = re.compile(r"^\s*fetched_at:\s*.*$", re.MULTILINE)
DIFF_DIR_RELATIVE = Path("temp/skill-maintenance/diff")
STATE_DIR_RELATIVE = Path("claude-plugins/meta/skills/skill-maintenance/state")


@dataclass(frozen=True)
class Target:
    label: str
    script: Path
    output: Path


@dataclass(frozen=True)
class RunResult:
    target: Target
    returncode: int
    output: str


def find_repo_root(script_path: Path) -> Path:
    """Resolve the repo root from this script's fixed location.

    This script always lives at <repo_root>/claude-plugins/meta/skills/skill-maintenance/scripts/,
    so the root is derived by a fixed number of parent hops rather than searching
    for a .git directory (this repo isn't always a git checkout).
    """
    return script_path.parents[5]


def slugify(label: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", label.lower()).strip("-")


def normalize(text: str) -> str:
    """Remove fetch timestamps while preserving all semantic content."""
    return FETCHED_AT_RE.sub("", text).replace("\r\n", "\n")


def read_normalized(path: Path) -> str:
    if not path.is_file():
        return ""
    return normalize(path.read_text(encoding="utf-8"))


def state_path(state_dir: Path, target: Target) -> Path:
    return state_dir / f"{slugify(target.label)}.snapshot"


def read_baseline(state_dir: Path, target: Target) -> str:
    """Read this target's content as of this script's last run.

    Falls back to the target's current live output on a first run (no prior
    state file yet), so the first diff after adopting this mechanism reports
    "no change" rather than manufacturing a diff against an empty baseline.
    """
    path = state_path(state_dir, target)
    if path.is_file():
        return normalize(path.read_text(encoding="utf-8"))
    return read_normalized(target.output)


def write_baseline(state_dir: Path, target: Target, content: str) -> None:
    state_path(state_dir, target).write_text(content, encoding="utf-8")


def run_generator(target: Target, repo_root: Path) -> RunResult:
    # Use `uv run` so the project's .venv (with yaml/requests etc.) is picked
    # up regardless of which Python interpreter launched this script.
    command = ["uv", "run", "--project", str(repo_root), "python", str(target.script), "--force"]
    completed = subprocess.run(
        command,
        cwd=target.script.parent,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    output = "\n".join(
        part for part in (completed.stdout.strip(), completed.stderr.strip()) if part
    )
    return RunResult(target, completed.returncode, output)


def build_diff(target: Target, before: str, after: str, relative_path: Path) -> str:
    if before == after:
        return ""
    relative = relative_path.as_posix()
    lines = difflib.unified_diff(
        before.splitlines(keepends=True),
        after.splitlines(keepends=True),
        fromfile=f"before/{relative}",
        tofile=f"after/{relative}",
    )
    return "".join(lines)


def main() -> int:
    script_path = Path(__file__).resolve()
    repo_root = find_repo_root(script_path)

    targets = [
        Target(
            "Claude CLI help",
            repo_root / "claude-plugins/meta/skills/claude-cli-docs/generate_claude_help_yaml.py",
            repo_root / "claude-plugins/meta/skills/claude-cli-docs/output/help_result.yaml",
        ),
        Target(
            "Claude Code reference",
            repo_root
            / "claude-plugins/meta/skills/claude-code-docs/download_claude_code_reference.py",
            repo_root / "claude-plugins/meta/skills/claude-code-docs/output/llms.txt",
        ),
        Target(
            "Claude Code full reference",
            repo_root
            / "claude-plugins/meta/skills/claude-code-docs/download_claude_code_reference.py",
            repo_root / "claude-plugins/meta/skills/claude-code-docs/output/llms-full.txt",
        ),
    ]

    state_dir = repo_root / STATE_DIR_RELATIVE
    state_dir.mkdir(parents=True, exist_ok=True)
    before = {target.output: read_baseline(state_dir, target) for target in targets}

    results: list[RunResult] = []
    # The downloader updates both reference files in one invocation. Run it only
    # once even though both outputs are represented as separate diff targets.
    for target in targets[:2]:
        if not target.script.is_file():
            results.append(RunResult(target, 1, f"script not found: {target.script}"))
            continue
        if any(result.target.script == target.script for result in results):
            continue
        results.append(run_generator(target, repo_root))

    diff_dir = repo_root / DIFF_DIR_RELATIVE
    diff_dir.mkdir(parents=True, exist_ok=True)
    # Clear the previous run's diff files so a caller never mistakes a stale
    # file for this run's output.
    for stale in diff_dir.glob("*.diff"):
        stale.unlink()

    written: list[Path] = []
    for target in targets:
        relative_path = target.output.relative_to(repo_root)
        after = read_normalized(target.output)
        diff = build_diff(target, before[target.output], after, relative_path)
        if diff:
            diff_path = diff_dir / f"{slugify(target.label)}.diff"
            diff_path.write_text(diff, encoding="utf-8")
            written.append(diff_path.relative_to(repo_root))
        # Record this run's content as the baseline for the next run, regardless
        # of whether it changed, so the next diff starts from what we just saw.
        write_baseline(state_dir, target, after)

    print("Claude documentation refresh")
    for result in results:
        status = "OK" if result.returncode == 0 else f"FAILED ({result.returncode})"
        print(f"- {result.target.label}: {status}")
        if result.output:
            print(result.output)
    print(f"- Diff folder: {DIFF_DIR_RELATIVE.as_posix()}/ ({len(written)} file(s))")
    for path in written:
        print(f"  - {path.as_posix()}")
    print(f"- Semantic changes: {'yes' if written else 'no'}")

    # Keep diff files available even when one source is unavailable, so the
    # skill can process a successful source without hiding the failure.
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
