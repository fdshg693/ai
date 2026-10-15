---
type: Repo Convention
title: tools/配下のディレクトリ構成規約
description: Explains the directory conventions this repo uses for convenience scripts under tools/ — one directory per tool (or a grouping subfolder for related tools, e.g. tools/aim-use/), its own README/AGENTS.md/CLAUDE.md import chain, turning it into a globally installable CLI via a package manifest entrypoint, and the expectation that first-class tools expose version metadata and --version. Use when adding a new script/tool to tools/, deciding whether it needs its own subfolder or a real package, or wiring up its CLAUDE.md.
tags: [tools, repo-wide]
generated: { by: reference_agent/cline-glm-5.2, at: 2026-08-09T14:39:30Z }
status: stable
---

# tools/配下のディレクトリ構成規約

このリポジトリの`tools/`配下は、便利スクリプト・CLIごとに1ディレクトリを割り当てる方針で構成されている。新しいスクリプトを追加する際は、既存ツール（`tools/aim`、`tools/tav-cli`、`tools/schedule`等）と同じ形に揃える。

## 配置単位

- 基本は`tools/`直下に1ツール1ディレクトリ（`tools/aim`、`tools/ctx7`、`tools/mslearn`、`tools/my-agents`等）
- 関連する複数ツールをまとめたい場合は1段グループ化する（`tools/aim-use/aim-summarize`は`tools/aim`を利用するラッパー、`tools/internal/ai-usage`はこのリポジトリ内部専用ツール群の1つ）
- Pythonパッケージ化が不要なディレクトリもある（`tools/infra`はBicep+スクリプト、`tools/sandbox`は実験用）。すべてを無理に`uv`ワークスペースへ載せる必要はない（判断基準は[uv-workspace](/repo-wide/uv-workspace.md)参照）

## 各ツールディレクトリの最低限の構成

- `README.md` — 人間向け。何をするツールか、セットアップ（APIキー等）、使い方、ファイル構成
- `AGENTS.md` — 中身は`@./README.md`の1行のみ
- `CLAUDE.md` — 中身は`@./AGENTS.md`の1行のみ

この`CLAUDE.md → AGENTS.md → README.md`という参照チェーンは、リポジトリルート自体の`CLAUDE.md → AGENTS.md → README.md`と同じ形。同じ説明文を複数箇所に重複させず、人間が読むREADME.mdをそのままAIツールへの指示としても使い回す。新しいツールを追加したら、このチェーンを必ず用意する。

## 実装スタイルの選び方

- **単一モジュール**: 小さく状態を持たないCLIなら1ファイル+`[tool.setuptools] py-modules = [...]`で十分（`tools/aim/aim_cli.py`）
- **パッケージ+tests/**: 内部構造やユニットテストを持つ規模になったら、パッケージディレクトリ＋`tests/`に分ける（`tools/schedule/ai_schedule/*.py` + `tools/schedule/tests/`、`tools/tav-cli/tav_core/`）

最初から過剰にパッケージ化せず、複雑さが増えたタイミングで単一モジュールからパッケージへ切り出す。

## グローバルCLI化

ツール自身のマニフェストでエントリポイントを定義する（Pythonなら`pyproject.toml`の`[project.scripts]`、Nodeなら`package.json`の`bin`。例: `aim = "aim_cli:main"`、`tav = "tav_cli:main"`）。インストールコマンド（`uv tool install --editable tools/<name>`や`pnpm add -g .`）はツールのREADME.mdに明記し、複数ツールをまとめてインストールしたい場合は`docs/integrations/justfile`にレシピを足す（[justfile-conventions](/repo-wide/justfile-conventions.md)参照）。first-class CLIにしたら、そのマニフェストに`version`を持たせ、公開エントリポイントは`--version`で`<command> <version>`を返すようにする。詳細は[tool-conventions](/repo-wide/tool-conventions.md)を参照。

## 使い方スキルを併設するかの判断

ツールを作った時点で、CLIとしての使い方に迷いが生じそうなら（フラグの意味、enum値の選び方、ログの意味論など）、対応する使い方スキルを検討する。使い方FBは各ツールの`--fb`ではなく`skill-tools --fb`が受ける。判断基準・置き場所は[tool-companion-skills](/repo-wide/tool-companion-skills.md)を参照。

## 関連

- [uv-workspace](/repo-wide/uv-workspace.md) — Pythonパッケージとしてのワークスペース管理（`uv sync`/`uv tool install`の使い分け）
- [tool-companion-skills](/repo-wide/tool-companion-skills.md) — ツールに使い方スキルを併設する方針と置き場所。FBは `skill-tools --fb`
- [skill-tool-relations](/repo-wide/skill-tool-relations.md) — グループフォルダはツール→ツールの辺の代わりにしない。依存は `repo-tools.yaml` の `requires_tools` に書く
- [justfile-conventions](/repo-wide/justfile-conventions.md) — インストール・実行コマンドをjustfileレシピとして揃える規約
- [tool-conventions](/repo-wide/tool-conventions.md) — 版数SSOT、`--version`、設定の読み込み（レイヤー設定 / 固定パス`.env`）の規約

## このドキュメントの位置づけ

`meta-plugins/`はこのリポジトリ自身のメンテナンス用であり、ユーザー向けプラグインではない。既存方針に従い、この内容を`ai-tools.yaml`へ登録しないこと。詳細は[ai-tools-config](/repo-wide/ai-tools-config.md)参照。
