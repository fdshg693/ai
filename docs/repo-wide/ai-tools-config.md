---
type: Design Decision
title: リポジトリのAIツール設定・生成ファイル規約
description: Explains how this repository's AI-tool plugin/marketplace/skill-catalog files (marketplace.json, skill-catalog.json, CATALOG.md, Cline rules, Copilot instructions, README's tool section) are generated from ai-tools.yaml and regenerated. Use when adding/removing a Claude/Codex/Copilot/Cline plugin, when a generated file (marked "DO NOT EDIT MANUALLY") looks stale or wrong, or when asked how this repo's marketplace/catalog files are kept in sync.
tags: [repo-wide]
generated: { by: reference_agent/cline-glm-5.2, at: 2026-08-09T14:39:30Z }
status: stable
---

# リポジトリのAIツール設定・生成ファイル規約

このリポジトリ自身（AIコーディングツールの設定・プラグイン群）をメンテナンスするための規約。**ユーザーのプロジェクトではなく、このリポジトリ自体の構造**を対象とする。

> **このドキュメントの位置づけ**: `meta-plugins/` はリポジトリ直下に置かれ、`claude-plugins/` 配下のプラグイン群とは異なり**意図的に`ai-tools.yaml`へ登録しない**。`ai-tools.yaml`に登録されたプラグインは`.claude-plugin/marketplace.json`（他人がこのリポジトリをmarketplaceとして追加すればインストール可能）とskills-siteの公開カタログの両方に載る。skills-siteは`ai-tools.yaml`登録ルート配下しかスキャンしないため、`ai-tools.yaml`へ登録しない限りエラーにも公開対象にもならない。`meta-plugins`はこのリポジトリ以外では意味を持たない内容（`tools/internal/`のパス等が前提）のため、どちらにも載せない。新しいドキュメントをこの下に追加する場合も、`ai-tools.yaml`へは登録しないこと。逆に、`ai-tools.yaml`には登録しつつskills-siteだけから外したい場合は`skills-site/site-overrides.yaml`を使う（`.claude/rules/skill-publication.md`参照）。

## SSOT: `ai-tools.yaml`

リポジトリ直下の `ai-tools.yaml` が、「どのAIツールがどのプラグインを持ち、マーケットプレイス定義・スキルカタログがどこにあるか」の単一の情報源（SSOT）。

- 各ツール（`claude-code` / `cline` / `codex` / `copilot` / `cursor` / `antigravity`）ごとに `plugins`（登録プラグイン一覧）、`marketplace`（出力先・メタデータ）、`skill_catalog`、`readme`（README生成用の説明文）等を持つ
- プラグイン一覧は `rglob` 等での自動検出ではなく、`ai-tools.yaml` に**明示的に列挙**する方針（同名プラグインの重複登録などのdriftを防ぐため、人が編集するファイル側にリストを置いてdiffに残す）
- 読み込みは必ず `tools/internal/plugin_meta/util/ai_tools_config.py` の `load_tool(tool_key)` / `load_config()` 経由。`generate_*.py` にパスやメタデータをハードコードしない

## 生成される関係にあるファイル

以下はすべて `ai-tools.yaml` から生成される「派生ファイル」で、ファイル冒頭に `DO NOT EDIT MANUALLY` の注記が入る。**直接編集せず、`ai-tools.yaml` を直して再生成する**。

| 生成物                                                                            | 生成スクリプト                     |
| --------------------------------------------------------------------------------- | ---------------------------------- |
| `.claude-plugin/marketplace.json`（Claude Code）                                  | `generate_marketplace.py`          |
| `.agents/plugins/marketplace.json`（Codex）                                       | `generate_codex_marketplace.py`    |
| `copilot-plugins/meta/plugin.json` / `.github/plugin/marketplace.json`（Copilot） | `generate_copilot_marketplace.py`  |
| `.claude-plugin/skill-catalog.json`                                               | `generate_skill_catalog.py`        |
| 各プラグインの `skills/CATALOG.md`                                                | `generate_skills_catalog_md.py`    |
| `README.md` の `<!-- BEGIN/END: ai-tools-section -->` 節                          | `generate_readme_tools_section.py` |

いずれも `tools/internal/plugin_meta/generate/generate_*.py` にあり、`from plugin_meta.util.ai_tools_config import REPO_ROOT, load_tool` で設定を読み、対象ファイルを**丸ごと再生成**（マージではない）する。

`AGENTS.md` から派生する `.clinerules/*.md`・`.github/instructions/*.instructions.md`・`.agents/rules/*.md` は、ここ（`tools/internal`・lefthook）では生成しない。`AGENTS.md` を1つ変えるたびに大量の生成差分がコミットに混ざるのを避けるため、[tools/agents-rules](../../tools/agents-rules/README.md) CLI に切り出して手動実行にした（出力先は引き続き `ai-tools.yaml` の `rules_from_agents_md` / `instructions_from_agents_md` を読む）。

補足で `skills-site/scripts/source-registry.mjs` も `ai-tools.yaml` から公開対象を導出する（詳細は`.claude/rules/skill-publication.md`参照）。

## 再生成方法

`tools/internal/justfile` にレシピが揃っている（`tools/internal`をcwdとして実行される想定）。

```
just --justfile tools/internal/justfile marketplace              # .claude-plugin/marketplace.json
just --justfile tools/internal/justfile codex-marketplace
just --justfile tools/internal/justfile copilot-marketplace
just --justfile tools/internal/justfile skill-catalog
just --justfile tools/internal/justfile skills-catalog-md
just --justfile tools/internal/justfile readme-tools-section
just --justfile tools/internal/justfile generate                 # 上記すべてをまとめて実行
just --justfile tools/internal/justfile skill-versions            # meta.versionが空のSKILL.mdに1.0.0を補完
```

**手で毎回叩く必要は基本ない** — `lefthook.yml` の `pre-commit` に、関連ファイルのglobをトリガーとして各レシピが登録済み（例: `**/.claude-plugin/plugin.json` か `ai-tools.yaml` の変更で `marketplace` レシピが自動実行され、`stage_fixed: true` で再生成結果がそのままコミットに含まれる）。コミット時に生成物がstaleにならない設計なので、通常はコミットに任せればよい。手動実行が要るのは、コミット前に生成結果を確認したい場合や、コミットを跨がず単発で確認したい場合。

## 新しいClaude Codeプラグインを追加する手順

1. `claude-plugins/<name>/.claude-plugin/plugin.json`（`name`/`version`/`description`）と、必要なら `claude-plugins/<name>/skills/<skill>/SKILL.md` を作成
2. `ai-tools.yaml` の `tools.claude-code.plugins` に `- path: claude-plugins/<name>` / `kind: plugin` / `skills_layout: subdir` を追記（**アルファベット順**を維持）
3. `.claude-plugin/marketplace.json` と `.claude-plugin/skill-catalog.json`、対象プラグインの `skills/CATALOG.md` を再生成（上記コマンド、またはコミット時のlefthookに任せる）

Codex/Copilotプラグインを追加する場合も同様に、まず該当ツールの `plugins`（Copilotは`kind: plugin`エントリが単一である前提、`generate_copilot_marketplace.py`参照）を `ai-tools.yaml` に追記してから再生成する。

## 落とし穴

- `ai-tools.yaml` を更新せずにプラグインフォルダだけ作っても、マーケットプレイスやスキルカタログには載らない（`generate_*.py`は`ai-tools.yaml`列挙分しか見ない）
- 生成ファイルを直接編集しても、次のコミットでlefthookが上書きする
- `skills_layout` は `subdir`（`<plugin>/skills/`配下にSKILL.md）と `direct`（`<plugin>`直下にSKILL.md、Copilot/Cursorが該当）の2種類。プラグインの実態に合わせて正しく指定する
- Copilotの `generate_copilot_marketplace.py` はスキル一覧を `copilot-plugins/meta` 配下のフォルダ名から自動検出する（`ai-tools.yaml`には列挙しない）。他ツールとは挙動が異なる点に注意

## 関連

- [repo-ssot-pattern](/repo-wide/repo-ssot-pattern.md) — `ai-tools.yaml`というSSOTが従う設計パターン全体
- [lefthook-automation](/repo-wide/lefthook-automation.md) — 生成物の再生成をコミット時に自動実行する仕組み
- [skill-md-commits](/repo-wide/skill-md-commits.md) — `SKILL.md`コミット時のpre-commitフック（catalog再生成を含む）
- [claude-code-first-skills](/repo-wide/claude-code-first-skills.md) — `skills_layout`の意味、他ツールへのポート方針
- `.claude/rules/ai-tools-config.md` — このSSOT運用のルール本文（AIエージェント向け、パス限定なし）
- `.claude/rules/skill-publication.md` — `skills-site`側の公開規約（`ai-tools.yaml`からの導出、ZIP生成時の除外規則等）
