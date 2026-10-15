---
type: Design Decision
title: エージェントフックの正本・生成・配布
description: "Explains how this repository's AI-agent hooks flow from a single source (agent-tooling/agent_tooling/hooks/ scenarios with per-hook hook.yaml, Claude-only hooks included) through a build that inlines each hook into one self-contained file and aggregates generated/catalog.json, to distribution by `skill-tools hooks install/installed/update/remove` via the root repo-hooks.yaml, and how this repository self-installs its own hooks with `just hooks-install` instead of the retired .claude/scripts/hooks_manager.py. Use when adding or changing a hook, when wondering where a hook's source or registration lives, when .claude/hooks or a settings.json hooks entry looks stale, or when another project wants to install hooks from this repo."
tags: [meta-plugins, hooks, tools]
generated: { by: reference_agent/claude-opus-5-5, at: 2026-09-27T00:00:00Z }
status: stable
---

# エージェントフックの正本・生成・配布

## 全体の流れ

```text
agent-tooling/agent_tooling/hooks/scenarios/<id>/hook.yaml   ← 登録イベント・matcher・配布可否・依存（正本）
agent-tooling/agent_tooling/adapters/<agent>/<id>.py         ← 本体（Claude 専用フックの共通処理は adapters/claude/common/）
        │  just --justfile agent-tooling/justfile generate（lefthook も入力変更で再生成）
        ▼
agent-tooling/agent_tooling/hooks/generated/<agent>/<id>.*   ← 相対 import をインライン化した単一ファイル（コミットする生成物）
agent-tooling/agent_tooling/hooks/generated/catalog.json     ← 全 hook.yaml とファイル一覧の集約
        │  repo-hooks.yaml（リポジトリ直下）がカタログの所在を指す
        ▼
skill-tools hooks list / install / installed / update / remove
        │  ファイル配置 + 登録ファイル（.claude/settings.json / .codex/hooks.json / .cursor/hooks.json / .agents/hooks.json）へのマージ + manifest 記録
        ▼
利用先プロジェクト（このリポジトリ自身も `just hooks-install` で同じ経路に乗る）
```

対象エージェントは Claude Code / Codex / Cursor / Antigravity / Kilo。Cline は stdin JSON の command hook 契約が無いため対象外。

## 主要な決定

| 決定                                                                                                                                                           | 理由                                                                                                                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| フックの正本は `agent-tooling/agent_tooling/hooks/` に一本化し、Claude 専用フック（旧 `.claude/hooks/*.py`）も scenario として置く。配布物は `generated/` だけ | 生成→配布の経路を1本にし、skill-tools が読む場所を1箇所にする。共通ヘルパーはビルド時にインライン化されるので配布物に `_lib` が要らない     |
| メタデータは scenario ごとの `hook.yaml` に置き、ビルドが `generated/catalog.json` に集約する。docstring の `<hooks>` 契約は廃止                               | Python を import せずに読めるデータにし、skill-tools が agent-tooling の内部構造に依存しないようにする。二重管理を避ける                    |
| リポジトリ直下の `repo-hooks.yaml` はカタログの所在だけを書く                                                                                                  | `repo-tools.yaml` / `repo-workflows.yaml` と同じ「直下の SSOT を入口にする」入力契約に揃える。GitHub source でも2ファイルの取得で一覧できる |
| CLI は `skill-tools hooks <list\|install\|installed\|update\|remove>`                                                                                          | スキル用 `install` と選択子・オプションの意味が違うので、`workflow` と同じくグループ化する                                                  |
| インストール＝有効化。`enabled` フラグは持たない                                                                                                               | manifest で登録を追跡できれば「入れる/外す」で足りる。旧 `hooks.yml` の中間状態を再発明しない                                               |
| 登録ファイルへは skill-tools が追加したエントリだけをマージ・削除する（所有権は manifest の hash）                                                             | 配布先には利用者自身のフックがある。旧 hooks_manager は `hooks` キーを丸ごと上書きしていた                                                  |
| 非 stdlib 依存は PEP 723 で宣言し `uv run --script` で起動する。リポジトリ構造前提のフックは `distributable: false`                                            | 単一ファイル配布を保ったまま依存付きフックも扱う。固有フックは自己インストールだけに許す                                                    |
| manifest は schema v2（スキル `entries` とフック `hooks`）。スキル・フック両方の書き込み経路が相手側を保持する                                                 | 旧 installer はスキル操作のたびに manifest を丸ごと書き直していたため、そのままではフック記録が消える                                       |
| 初期スコープはプロジェクト単位の登録ファイルのみ                                                                                                               | skill-tools の manifest・lock がプロジェクト単位で設計されているため。ユーザー単位（`~/.claude/settings.json` 等）は将来拡張                |

## このリポジトリ自身への適用（自己インストール）

`.claude/scripts/hooks_manager.py` / `hooks.yml` / sync・reflect は廃止した。このリポジトリも外部プロジェクトと同じ skill-tools 経路でフックを入れる（ドッグフーディング）。

- クローン直後に一度、リポジトリ直下で `just hooks-install`。agent-tooling 側を変えたら `generate` のあと `just hooks-update`。確認は `just hooks-installed`
- 入れるフックと対象エージェントはルート `justfile` の `hooks-install` レシピが列挙する
- skill-tools の設定は `.claude/skill-tools.hooks.yaml` を `--config` で明示し、ルートに `skill-tools.yaml` は置かない。CWD の `skill-tools.yaml` は自動マージされ、直下で打つ全コマンドの source/index を変えてしまうため
- skill-tools はグローバル版ではなく `uv run --project tools/skill-tools` のリポジトリ同梱版を使う（版ずれ防止）
- 成果物（`.claude/hooks/` の配置物、`.skill-tools/`、登録ファイルの変更）はすべて gitignore。`.claude/hooks/` には「インストール先であり正本ではない」旨の `AGENTS.md` だけを残す
- Claude の登録先は `.claude/settings.json`。このリポジトリでは `.claude/.gitignore` の `*settings.json` で既に共有されていないため `settings.local.json` に分けない（外部利用者は `settings_file: local` を選べる）

旧構成からの移行手順（旧エントリの除去と `just hooks-install --overwrite`）は `.claude/hooks/AGENTS.md` に書いてある。

## フックを足す・変えるとき

1. `scenarios/<id>/hook.yaml` と `adapters/<agent>/<id>.py` を書き、`build/build.py` の `ENTRIES` に登録する（書き方・ビルド契約は [agent-tooling/agent_tooling/hooks/AGENTS.md](../../agent-tooling/agent_tooling/hooks/AGENTS.md)）
2. `just --justfile agent-tooling/justfile generate` → `test`
3. このリポジトリで使うなら `just hooks-install`（新規 id はルート `justfile` のレシピにも足す）/ `just hooks-update`
4. スキルがそのフックを前提にするなら、`SKILL.md` の `meta.requires_hooks` に hook id を書く（[skill-meta-fields](/repo-wide/skill-meta-fields.md)）

`.claude/hooks/` や各ツールの登録 JSON を直接編集しない。skill-tools は手編集を drift として検出し、update/remove を止める。

## 関連

- [skill-tools-contract](/repo-wide/skill-tools-contract.md) — `repo-hooks.yaml` / `catalog.json` を含む skill-tools の入力契約
- [repo-ssot-pattern](/repo-wide/repo-ssot-pattern.md) — 直下 SSOT + 生成の方針
- `tools/skill-tools/README.md` — `hooks` サブコマンドの挙動・配置先既定・トランザクション
- `agent-tooling/agent_tooling/hooks/generated/README.md` — `catalog.json` の形式
