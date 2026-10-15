#!/usr/bin/env python3
"""Freeze the initial version of a plan folder into its own snapshot/ subfolder.

Usage:
    uv run .claude/plans/snapshot_plan.py .claude/plans/<plan-name>
    python .claude/plans/snapshot_plan.py .claude/plans/<plan-name>

Why this exists:
    Plan files are edited while the plan is executed. Because they are updated in
    place, the initial plan can become hard to recover. This script copies the
    plan files that sit directly under a plan folder (`00-overview.md`, `01-*.md`,
    ... for multi-step plans) into `<plan-folder>/snapshot/` verbatim.

    After the snapshot is taken, `snapshot/` is frozen: never edit it. Keep
    editing only the plan files in the parent folder. The frozen copy is the
    AS-IS initial plan, so the live plan can be rewritten freely.

    Take the snapshot once, right after the initial plan review and before the
    first execution step. `--force` re-takes it (allowed only before execution
    starts). `rough/` and `progress/` are not copied: the snapshot is only about
    the initial plan.

Only the standard library is used, so this script also runs with plain `python`.
"""

import argparse
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

SNAPSHOT_DIR_NAME = "snapshot"
MANIFEST_NAME = "README.md"

MANIFEST_TEMPLATE = """# snapshot/ - `{plan_name}` の初版プラン凍結コピー

> これは `{plan_name}` の初版プランを {created} に凍結したコピーです。**編集しないでください。**
> 実装中に更新するのは親フォルダ側のプラン（`../*.md`）です。
>
> 初版との差分は、プランフォルダを cwd にして次で確認できます。
>
> ```bash
> git diff --no-index snapshot/00-overview.md 00-overview.md
> ```

## 凍結時点のファイル

{files}
"""


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "plan_dir",
        type=Path,
        help="スナップショットを取るプランフォルダ（例: .claude/plans/<plan-name>）",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="既存の snapshot/ を作り直す（実行着手前のみ許可される想定）",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    plan_dir = args.plan_dir

    if not plan_dir.is_dir():
        print(f"error: plan folder not found: {plan_dir}", file=sys.stderr)
        return 1

    plan_files = sorted(path for path in plan_dir.glob("*.md") if path.is_file())
    if not plan_files:
        print(
            f"error: no plan files (*.md) directly under: {plan_dir}",
            file=sys.stderr,
        )
        return 1

    snapshot_dir = plan_dir / SNAPSHOT_DIR_NAME
    if snapshot_dir.exists():
        if not args.force:
            print(
                f"error: {snapshot_dir} already exists. snapshot/ is immutable; "
                "use --force only if execution has not started yet.",
                file=sys.stderr,
            )
            return 1
        shutil.rmtree(snapshot_dir)

    snapshot_dir.mkdir(parents=True)
    for path in plan_files:
        shutil.copy2(path, snapshot_dir / path.name)

    manifest = MANIFEST_TEMPLATE.format(
        plan_name=plan_dir.name,
        created=datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
        files="\n".join(f"- `{path.name}`" for path in plan_files),
    )
    (snapshot_dir / MANIFEST_NAME).write_text(manifest, encoding="utf-8")

    print(f"snapshot created: {snapshot_dir}")
    for path in plan_files:
        print(f"  frozen: {path.name}")
    print("\nkeep editing the plan files in the parent folder; do not edit snapshot/.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
