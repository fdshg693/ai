"""List the title + description of every concept doc under docs/repo-wide/.

Used as the meta skill's dynamic context injection (`` !`python .../list_repo_meta_docs.py` ``
in SKILL.md) so the routing list is always read live from the actual docs/repo-wide/*.md
files instead of a hand-maintained copy that can drift out of sync when a doc is added,
renamed, or has its description edited.

Only a minimal top-level-key frontmatter scan is done here (no PyYAML
dependency, so this script runs with the plain `python` on PATH and does not
need `uv run`). This is safe for this repo's docs/repo-wide/*.md files today
because their `title`/`description` are single-line scalars; it would need to
grow a real YAML parser if that ever changes.
"""

from __future__ import annotations

import re
from pathlib import Path

TOP_LEVEL_FIELD_RE = re.compile(r"^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$")


def parse_frontmatter(text: str) -> dict[str, str] | None:
    """Return top-level scalar frontmatter fields, or None if there is no frontmatter block."""
    if not text.startswith("---"):
        return None
    end = text.find("\n---", 3)
    if end == -1:
        return None
    fields: dict[str, str] = {}
    for line in text[3:end].splitlines():
        # Skip blank lines, `#` comments, and indented lines (nested keys like
        # generated:'s subfields) — only top-level scalars (title/description) are wanted here.
        if not line or line[0] in (" ", "\t", "#"):
            continue
        match = TOP_LEVEL_FIELD_RE.match(line)
        if match:
            fields[match.group(1)] = strip_yaml_quotes(match.group(2).strip())
    return fields


def strip_yaml_quotes(value: str) -> str:
    """Strip one layer of matching '...'/"..." quoting, as a real YAML parser would."""
    if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
        return value[1:-1]
    return value


def main() -> int:
    script_path = Path(__file__).resolve()
    # script_path: repo-root/meta-plugins/skills/meta/scripts/list_repo_meta_docs.py
    repo_root = script_path.parent.parent.parent.parent.parent
    docs_dir = repo_root / "docs" / "repo-wide"

    if not docs_dir.is_dir():
        print(f"(docs/repo-wide/ ディレクトリが見つかりませんでした: {docs_dir})")
        return 0

    entries: list[tuple[str, str]] = []
    errors: list[str] = []
    for doc_path in sorted(docs_dir.glob("*.md")):
        if doc_path.name == "index.md":
            continue
        try:
            text = doc_path.read_text(encoding="utf-8")
        except OSError as exc:
            errors.append(f"{doc_path.as_posix()}: 読み込み失敗 ({exc})")
            continue
        fields = parse_frontmatter(text)
        if fields is None:
            errors.append(f"{doc_path.as_posix()}: frontmatterの解析に失敗しました")
            continue
        title = fields.get("title", doc_path.stem)
        description = fields.get("description", "(descriptionが未設定)")
        entries.append((title, description))

    entries.sort(key=lambda entry: entry[0])

    if not entries:
        print("(docs/repo-wide/配下に概念ドキュメントが見つかりませんでした)")
    for title, description in entries:
        print(f"- **{title}**: {description}")

    for error in errors:
        print(f"- [ERROR] {error}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
