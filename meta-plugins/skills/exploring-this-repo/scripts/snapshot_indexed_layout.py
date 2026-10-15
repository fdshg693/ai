"""Print this repo's CodeGraph map plus top-level names the index does not see.

Used as the exploring-this-repo skill's dynamic context injection so an agent
gets the indexed tree without a wide `codegraph explore`. Disk-only folders
(typical: docs/, most SKILL.md trees) are listed separately; their purpose
is in README.md, not in the graph.

Runs with the plain `python` on PATH (stdlib only).
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

# Tree depth 2 shows package / plugin names without dumping every indexed file
# (this repo is ~500 files; depth 2 is a few dozen lines).
FILES_MAX_DEPTH = 2
# Cold start was ~2s in measurement; 30s leaves room for a busy disk.
CODEGRAPH_TIMEOUT_SEC = 30
SKIP_TOP_LEVEL = {".git", "node_modules", "temp", ".codegraph", ".textgraph", "__pycache__"}
# 地図に出しても次の一手にならないローカル生成物・秘密ファイル。
SKIP_UNINDEXED = SKIP_TOP_LEVEL | {
    ".env",
    ".env.example",
    ".pytest_cache",
    ".ruff_cache",
    ".venv",
}


def repo_root_from_script() -> Path:
    # scripts/snapshot_indexed_layout.py -> exploring-this-repo -> skills -> meta-plugins -> root
    return Path(__file__).resolve().parents[4]


def codegraph_executable() -> str | None:
    # Windows の npm グローバルは `codegraph.cmd`。which の戻りをそのまま渡す。
    found = shutil.which("codegraph")
    if found:
        return found
    if sys.platform == "win32":
        return shutil.which("codegraph.cmd")
    return None


def run_codegraph(
    executable: str, repo_root: Path, args: list[str]
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [executable, *args],
        cwd=repo_root,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=CODEGRAPH_TIMEOUT_SEC,
        check=False,
    )


def indexed_top_level_names(executable: str, repo_root: Path) -> set[str] | None:
    result = run_codegraph(executable, repo_root, ["files", "--json", "--no-metadata"])
    if result.returncode != 0:
        return None
    try:
        payload = json.loads(result.stdout)
    except json.JSONDecodeError:
        return None
    names: set[str] = set()
    for item in payload:
        path = item.get("path") if isinstance(item, dict) else None
        if not path:
            continue
        names.add(Path(path).parts[0])
    return names


def disk_top_level_dirs(repo_root: Path) -> list[str]:
    names: list[str] = []
    for entry in sorted(repo_root.iterdir(), key=lambda p: p.name.lower()):
        if not entry.is_dir() or entry.name in SKIP_UNINDEXED:
            continue
        names.append(entry.name)
    return names


def main() -> int:
    repo_root = repo_root_from_script()
    executable = codegraph_executable()
    if executable is None:
        print(
            "codegraph が PATH にありません。`npm i -g @colbymchenry/codegraph` のあと `codegraph init`。"
        )
        print()
        print("## On disk (index unavailable)")
        for name in disk_top_level_dirs(repo_root):
            print(f"- {name}")
        return 0

    print("## Index status")
    status = run_codegraph(executable, repo_root, ["status"])
    if status.returncode != 0:
        print(status.stderr.strip() or status.stdout.strip() or "codegraph status に失敗しました。")
        print("未初期化ならリポジトリルートで `codegraph init`。")
        return 0
    print(status.stdout.rstrip())
    print()

    print(f"## Indexed layout (max-depth {FILES_MAX_DEPTH})")
    files = run_codegraph(
        executable,
        repo_root,
        ["files", "--max-depth", str(FILES_MAX_DEPTH), "--no-metadata"],
    )
    if files.returncode != 0:
        print(files.stderr.strip() or "codegraph files に失敗しました。")
        return 0
    print(files.stdout.rstrip())
    print()

    indexed = indexed_top_level_names(executable, repo_root)
    print("## On disk but not in the index")
    if indexed is None:
        print("(indexed top-level の比較に失敗しました。`codegraph files --json` を確認)")
        return 0
    missing = [name for name in disk_top_level_dirs(repo_root) if name not in indexed]
    if not missing:
        print("(なし)")
    else:
        for name in missing:
            print(f"- {name}")
        print()
        print(
            "未索引のトップレベルディレクトリ。用途は README.md。ルートの Markdown / lockfile もグラフ外。"
        )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except subprocess.TimeoutExpired:
        print(f"codegraph が {CODEGRAPH_TIMEOUT_SEC}s 以内に終わりませんでした。", file=sys.stderr)
        raise SystemExit(1)
