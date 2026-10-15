"""Quiet git-commit wrapper for this repo's lefthook hooks.

Raw ``git commit`` dumps lefthook's per-job execution logs (just / pnpm /
prettier / ruff). This script still runs the same hooks, but prints only
which jobs passed or failed and how to fix failures.
"""

from __future__ import annotations

import os
import re
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path

# lefthook / just / pnpm can emit thousands of lines on a single SKILL.md
# commit. Keep the agent-facing excerpt to a page of signal, not the firehose.
_EXCERPT_MAX_LINES = 20
_EXCERPT_MAX_CHARS = 1600
_STATUS_MAX_LINES = 40
# lefthook sometimes prints the next job's stderr before that job's header.
_LEAKED_BEFORE_HEADER = 5

_ANSI_RE = re.compile(r"\x1b\[[0-9;]*m")
_DURATION_RE = re.compile(r"\s+\([\d.]+ seconds\)\s*$")
_SUMMARY_HEAD_RE = re.compile(r"^summary:\s*\(done in .+\)\s*$", re.IGNORECASE)
_JOB_HEADER_RE = re.compile(r"^[┃│]\s+(.+?)\s+❯\s*$")
_BOX_ONLY_RE = re.compile(r"^[\s─━│┃╭╮╰╯┌┐└┘┄╌━═]+$")
_COMMITTED_RE = re.compile(
    r"^\[(?P<branch>[^\]]+?) (?P<hash>[0-9a-f]{7,})\] (?P<subject>.+)$",
    re.MULTILINE,
)

_SUCCESS_MARKS = ("✓", "✔", "✔️", "√")
_FAIL_MARKS = ("✗", "✘", "🥊", "×")

_FORBIDDEN_GIT_FLAGS = ("--no-verify", "--no-gpg-sign", "-n")

# First matching needle in "failed job name + excerpt" wins.
_REMEDIATIONS: tuple[tuple[tuple[str, ...], str], ...] = (
    (
        ("meta.version bump", "meta.version must be bumped"),
        "meta.version を1つ上げる。一括なら "
        "`just --justfile tools/internal/justfile skill-version-bump`。"
        " 詳細: docs/repo-wide/skill-md-commits.md",
    ),
    (
        ("repo-tools consistency", "unregistered", "requires_repo_tools"),
        "repo-tools.yaml に登録するか frontmatter を直す。"
        " 詳細: docs/repo-wide/repo-tools-config.md",
    ),
    (
        ("lint-commit-message", "subject-case", "commitlint"),
        "件名を `type(scope): subject` に直す。"
        " Start Case / PascalCase / 全大文字は不可。新しい -m でこのスクリプトを再実行する。",
    ),
    (
        ("secrets", "secretlint"),
        "秘密をファイルから除き、履歴に載せない。フックを飛ばして通さない。",
    ),
    (
        ("format Markdown", "format Python", "prettier", "ruff format"),
        "整形失敗ならツールエラーを直す。差分が増えただけなら lefthook が直している。"
        " git status で確認し、意図しないファイルだけ戻す。",
    ),
    (
        (
            "ensure SKILL.md",
            "skill-versions: failed",
            "skill-descriptions: failed",
            "skill-tags: failed",
        ),
        "バックフィルはリポジトリ全体を走査する。"
        " 意図しない SKILL.md 変更は `git checkout -- <path>` で戻してから再コミット。",
    ),
    (
        ("bump registered tool manifest", "bump release tool", "tool-version-bump: failed"),
        "登録済みツールのマニフェスト自動バンプが失敗している。"
        " 詳細: docs/repo-wide/repo-tools-config.md",
    ),
    (
        ("regenerate", "compile gh-aw", "precommit fix"),
        "生成スクリプトのエラーを直す。生成物を手で直さない。"
        " 詳細: docs/repo-wide/lefthook-automation.md",
    ),
)

_DEFAULT_FIX = (
    "エラーを直して必要なら再ステージし、このスクリプトで新しいコミットを行う。"
    " --amend / --no-verify は使わない。"
)
_NEXT_STEP = (
    "直したファイルを git add し、このスクリプトを再実行する。 失敗したコミットを --amend しない。"
)


@dataclass
class HookResult:
    name: str
    ok: bool


@dataclass
class ParsedHooks:
    jobs: list[HookResult] = field(default_factory=list)
    excerpt: str = ""


def strip_ansi(text: str) -> str:
    return _ANSI_RE.sub("", text)


def _is_chrome_line(line: str) -> bool:
    stripped = line.strip()
    if not stripped:
        return True
    if _BOX_ONLY_RE.match(stripped):
        return True
    if _JOB_HEADER_RE.match(stripped):
        return True
    if _SUMMARY_HEAD_RE.match(stripped):
        return True
    if "lefthook" in stripped.lower() and "hook:" in stripped.lower():
        return True
    if _job_from_summary_line(stripped) is not None:
        return True
    return False


def _job_from_summary_line(line: str) -> HookResult | None:
    stripped = line.strip()
    for mark in _SUCCESS_MARKS:
        prefix = f"{mark} "
        if stripped.startswith(prefix):
            return HookResult(_clean_job_name(stripped[len(prefix) :]), True)
    for mark in _FAIL_MARKS:
        prefix = f"{mark} "
        if stripped.startswith(prefix):
            name = stripped[len(prefix) :]
            name = name.split(":", 1)[0]
            return HookResult(_clean_job_name(name), False)
    return None


def _clean_job_name(name: str) -> str:
    return _DURATION_RE.sub("", name).strip()


def _clip_excerpt(lines: list[str]) -> str:
    kept = [line for line in lines if line.strip()][-_EXCERPT_MAX_LINES:]
    excerpt = "\n".join(kept).strip()
    if len(excerpt) > _EXCERPT_MAX_CHARS:
        excerpt = excerpt[-_EXCERPT_MAX_CHARS:]
        cut = excerpt.find("\n")
        if cut != -1:
            excerpt = excerpt[cut + 1 :]
        excerpt = "(truncated)\n" + excerpt
    return excerpt


def _blocks_by_job_header(pre_lines: list[str]) -> list[tuple[str | None, list[str]]]:
    blocks: list[tuple[str | None, list[str]]] = [(None, [])]
    for line in pre_lines:
        header = _JOB_HEADER_RE.match(line.strip())
        if header:
            # Jobs inside a lefthook group print as "<group> ❯ <job> ❯"; keep the job name.
            blocks.append((header.group(1).split("❯")[-1].strip(), []))
            continue
        if _is_chrome_line(line):
            continue
        name, body = blocks[-1]
        body.append(line.rstrip())
        blocks[-1] = (name, body)
    return blocks


def _excerpt_for_failures(pre_lines: list[str], failed_names: list[str]) -> str:
    blocks = _blocks_by_job_header(pre_lines)
    failed = set(failed_names)
    chosen: list[str] = []
    if failed:
        for idx, (name, body) in enumerate(blocks):
            if name not in failed:
                continue
            if idx > 0:
                prev_body = blocks[idx - 1][1]
                chosen.extend(prev_body[-_LEAKED_BEFORE_HEADER:])
            chosen.extend(body)
    if not chosen:
        chosen = [line.rstrip() for line in pre_lines if not _is_chrome_line(line)]
    return _clip_excerpt(chosen)


def parse_lefthook_output(raw: str) -> ParsedHooks:
    text = strip_ansi(raw).replace("\r\n", "\n")
    lines = text.split("\n")
    summary_idx = next(
        (i for i, line in enumerate(lines) if _SUMMARY_HEAD_RE.match(line.strip())),
        None,
    )
    jobs: list[HookResult] = []
    if summary_idx is not None:
        for line in lines[summary_idx + 1 :]:
            job = _job_from_summary_line(line)
            if job is not None:
                jobs.append(job)
        pre = lines[:summary_idx]
    else:
        pre = lines

    failed_names = [job.name for job in jobs if not job.ok]
    return ParsedHooks(jobs=jobs, excerpt=_excerpt_for_failures(pre, failed_names))


def match_remediation(job_name: str, excerpt: str) -> str:
    haystack = f"{job_name}\n{excerpt}".lower()
    for needles, fix in _REMEDIATIONS:
        if any(needle.lower() in haystack for needle in needles):
            return fix
    return _DEFAULT_FIX


def parse_commit_success(raw: str) -> tuple[str, str] | None:
    match = _COMMITTED_RE.search(strip_ansi(raw))
    if match is None:
        return None
    return match.group("hash"), match.group("subject")


def format_report(
    *,
    exit_code: int,
    raw: str,
    hooks: ParsedHooks,
    status: str,
    hook_installed: bool,
) -> str:
    committed = parse_commit_success(raw) if exit_code == 0 else None
    lines: list[str] = []
    if exit_code == 0 and committed is not None:
        lines.append("RESULT: committed")
        lines.append(f"HASH: {committed[0]}")
        lines.append(f"SUBJECT: {committed[1]}")
    elif exit_code == 0:
        lines.append("RESULT: committed")
    else:
        lines.append(f"RESULT: failed (exit {exit_code})")

    lines.append("")
    lines.append("HOOKS:")
    if hooks.jobs:
        for job in hooks.jobs:
            mark = "OK  " if job.ok else "FAIL"
            lines.append(f"  {mark}  {job.name}")
    elif hook_installed:
        if exit_code == 0:
            lines.append("  (lefthook ran, no matching jobs — or summary was empty)")
        else:
            lines.append("  (lefthook summary を解析できなかった)")
    else:
        lines.append("  (lefthook hook が未インストール。`lefthook install` を先に実行する)")

    failed = [job for job in hooks.jobs if not job.ok]
    if exit_code != 0:
        if hooks.excerpt:
            lines.append("")
            lines.append("EXCERPT:")
            lines.extend(f"  {line}" if line else "" for line in hooks.excerpt.split("\n"))
        elif not hooks.jobs:
            fallback = strip_ansi(raw).strip()
            if fallback:
                lines.append("")
                lines.append("OUTPUT:")
                clipped = fallback.split("\n")[-_EXCERPT_MAX_LINES:]
                text = "\n".join(clipped)
                if len(text) > _EXCERPT_MAX_CHARS:
                    text = text[-_EXCERPT_MAX_CHARS:]
                lines.extend(f"  {line}" if line else "" for line in text.split("\n"))
        lines.append("")
        lines.append("FAILED:")
        if failed:
            for job in failed:
                lines.append(f"  - {job.name}")
                lines.append(f"    fix: {match_remediation(job.name, hooks.excerpt)}")
        else:
            lines.append("  - (job name unknown)")
            lines.append(f"    fix: {match_remediation('', hooks.excerpt)}")
        lines.append(f"    next: {_NEXT_STEP}")
    else:
        lines.append("")
        lines.append(
            "NOTE: lefthook 後に生成物・整形結果が残留した場合は、そのファイルだけをステージして"
            " このラッパーで追加コミットする。"
        )

    if status.strip():
        lines.append("")
        lines.append("STATUS:")
        status_lines = status.replace("\r\n", "\n").strip().split("\n")
        lines.extend(f"  {line}" for line in status_lines[:_STATUS_MAX_LINES])
        extra = len(status_lines) - _STATUS_MAX_LINES
        if extra > 0:
            lines.append(f"  ... ({extra} more)")
    return "\n".join(lines) + "\n"


def _run_git(args: list[str], cwd: Path, check: bool = True) -> subprocess.CompletedProcess[bytes]:
    return subprocess.run(
        ["git", *args],
        cwd=cwd,
        check=check,
        capture_output=True,
    )


def _decode(proc: subprocess.CompletedProcess[bytes]) -> str:
    merged = (proc.stdout or b"") + (proc.stderr or b"")
    return merged.decode("utf-8", errors="replace")


def find_repo_root(cwd: Path) -> Path:
    proc = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"],
        cwd=cwd,
        capture_output=True,
        check=False,
    )
    if proc.returncode != 0:
        raise RuntimeError(
            "git リポジトリの中で実行する。"
            f" ({_decode(proc).strip() or 'git rev-parse --show-toplevel failed'})"
        )
    return Path(_decode(proc).strip())


def hooks_use_lefthook(repo_root: Path) -> bool:
    proc = subprocess.run(
        ["git", "rev-parse", "--git-path", "hooks/pre-commit"],
        cwd=repo_root,
        capture_output=True,
        check=False,
    )
    if proc.returncode != 0:
        return False
    hook_path = Path(_decode(proc).strip())
    if not hook_path.is_absolute():
        hook_path = repo_root / hook_path
    try:
        text = hook_path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return False
    return "lefthook" in text.lower()


def _has_message_arg(git_args: list[str]) -> bool:
    message_flags = {
        "-m",
        "--message",
        "-F",
        "--file",
        "-C",
        "--reuse-message",
        "-c",
        "--reedit-message",
        "--fixup",
        "--squash",
    }
    for arg in git_args:
        name = arg.split("=", 1)[0]
        if name in message_flags:
            return True
    return False


def _refuse_forbidden(git_args: list[str]) -> str | None:
    for arg in git_args:
        name = arg.split("=", 1)[0]
        if name in _FORBIDDEN_GIT_FLAGS:
            return f"拒否: `{name}` は使わない。フックを直してからこのスクリプトを再実行する。"
    return None


def commit(git_args: list[str], cwd: Path | None = None) -> tuple[int, str, str]:
    repo_root = find_repo_root(cwd or Path.cwd())
    refused = _refuse_forbidden(git_args)
    if refused:
        return 2, refused + "\n", ""
    if not _has_message_arg(git_args):
        return 2, "拒否: `-m`（または `-F` / `--fixup` 等）が必要。エディタは開かない。\n", ""

    env = os.environ.copy()
    # lefthook 2.1.12+ respects this. 2.1.9 still prints execution logs;
    # the report formatter hides them either way.
    env.setdefault("LEFTHOOK_OUTPUT", "summary,failure")

    proc = subprocess.run(
        ["git", "commit", *git_args],
        cwd=repo_root,
        env=env,
        capture_output=True,
    )
    raw = _decode(proc)
    hooks = parse_lefthook_output(raw)
    status_proc = _run_git(["status", "--short"], repo_root, check=False)
    status = _decode(status_proc)
    report = format_report(
        exit_code=proc.returncode,
        raw=raw,
        hooks=hooks,
        status=status,
        hook_installed=hooks_use_lefthook(repo_root),
    )
    return proc.returncode, report, raw


def self_test() -> int:
    sample = """
╭──────────────────────────────────────╮
│ lefthook  v2.1.9   hook:  pre-commit │
╰──────────────────────────────────────╯
┃  ok-job ❯
ok-stdout

fail-stderr
┃  fail-job ❯
fail-stdout

exit status 1
  ────────────────────────────────────
summary: (done in 0.15 seconds)
✓ ok-job (0.03 seconds)
✗ fail-job (0.04 seconds)
"""
    hooks = parse_lefthook_output(sample)
    assert [job.name for job in hooks.jobs] == ["ok-job", "fail-job"], hooks.jobs
    assert hooks.jobs[0].ok and not hooks.jobs[1].ok
    assert "fail-stdout" in hooks.excerpt
    assert "ok-job ❯" not in hooks.excerpt
    assert "lefthook" not in hooks.excerpt.lower()
    assert split_argv(["-m", "feat(x): y"])[3] == ["-m", "feat(x): y"]
    assert split_argv(["--full-output", "-m", "x"])[0] is True
    assert split_argv(["--no-verify", "-m", "x"])[3] == ["--no-verify", "-m", "x"]

    colored = (
        "summary: (done in 1.00 seconds)\n"
        "\x1b[32m✔️ check SKILL.md meta.version bump (0.10 seconds)\x1b[m\n"
    )
    bumped = parse_lefthook_output(colored)
    assert len(bumped.jobs) == 1
    assert bumped.jobs[0].name == "check SKILL.md meta.version bump"
    assert bumped.jobs[0].ok

    fix = match_remediation("check SKILL.md meta.version bump", "meta.version must be bumped")
    assert "skill-version-bump" in fix

    grouped = """
┃  check ❯ tools/internal precommit check ❯
meta.version must be bumped when SKILL.md content changes:
[precommit] skill-version-bump-check: FAILED (1) in 0.09s
  ────────────────────────────────────
summary: (done in 1.00 seconds)
✗ check (0.50 seconds)
  ✗ tools/internal precommit check (0.40 seconds)
"""
    grouped_hooks = parse_lefthook_output(grouped)
    assert "meta.version must be bumped" in grouped_hooks.excerpt, grouped_hooks.excerpt
    fix = match_remediation("tools/internal precommit check", grouped_hooks.excerpt)
    assert "skill-version-bump" in fix
    fix = match_remediation(
        "tools/internal precommit fix", "[precommit] tool-version-bump: FAILED (1)"
    )
    assert "マニフェスト" in fix

    report = format_report(
        exit_code=1,
        raw=sample,
        hooks=hooks,
        status=" M lefthook.yml",
        hook_installed=True,
    )
    assert "RESULT: failed" in report
    assert "FAIL  fail-job" in report
    assert "OK    ok-job" in report
    assert "EXCERPT:" in report
    assert "STATUS:" in report
    print("self-test: ok")
    return 0


_USAGE = """\
git commit を lefthook フック付きで実行し、成功/失敗ジョブと直し方だけを返す。

  python meta-plugins/skills/committing/scripts/commit.py -m "type(scope): subject"

ラッパー自身のフラグは先頭だけ見る。それ以降は git commit に渡す。
  --full-output   lefthook 生ログも報告の後に出す（通常は不要）
  -h, --help      この説明
"""


def split_argv(argv: list[str]) -> tuple[bool, bool, bool, list[str]]:
    """Return (full_output, self_test, show_help, git_args).

    argparse は ``-m`` / ``--no-verify`` を未知オプションとして拒否するので、
    自前フラグは先頭からのみ剥がし、残りを git に渡す。
    """
    full_output = False
    self_test = False
    show_help = False
    i = 0
    while i < len(argv):
        arg = argv[i]
        if arg in ("-h", "--help"):
            show_help = True
            i += 1
            continue
        if arg == "--full-output":
            full_output = True
            i += 1
            continue
        if arg == "--self-test":
            self_test = True
            i += 1
            continue
        if arg == "--":
            return full_output, self_test, show_help, argv[i + 1 :]
        return full_output, self_test, show_help, argv[i:]
    return full_output, self_test, show_help, []


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    full_output, want_self_test, show_help, git_args = split_argv(argv)
    if want_self_test:
        return self_test()
    if show_help:
        sys.stdout.write(_USAGE)
        return 0

    try:
        exit_code, report, raw = commit(git_args)
    except RuntimeError as exc:
        sys.stderr.write(f"{exc}\n")
        return 2

    sys.stdout.write(report)
    if full_output and raw:
        sys.stdout.write("\n--- lefthook raw ---\n")
        sys.stdout.write(strip_ansi(raw))
        if not raw.endswith("\n"):
            sys.stdout.write("\n")
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
