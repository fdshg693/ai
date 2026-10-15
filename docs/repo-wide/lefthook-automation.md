---
type: Design Decision
title: lefthookによる自動化の最大活用
description: Explains this repository's policy of pushing as much repo-hygiene enforcement as possible into lefthook's pre-commit jobs (regenerating derived files, backfilling SKILL.md defaults, formatting Markdown/Python, blocking on missing meta.version bumps) instead of relying on contributors or agents to remember manual steps. Use when adding a new kind of generated/derived file, a new formatter, or deciding whether a repo-hygiene check belongs in lefthook versus a skill's instructions.
tags: [repo-wide]
generated: { by: reference_agent/cline-glm-5.2, at: 2026-08-09T14:39:30Z }
status: stable
---

# lefthookによる自動化の最大活用

このリポジトリは、リポジトリの衛生（生成物の同期、フォーマット、frontmatterのバージョン管理）をできる限り[`lefthook.yml`](../../lefthook.yml)の`pre-commit`フックへ寄せ、「コミット前に手でXを実行しておく」という運用をスキルの指示として書かない方針を取る。

## 現在の`pre-commit`が自動でやっていること

- `ai-tools.yaml`由来の各種生成ファイルの再生成（`marketplace.json`×2、`skill-catalog.json`、各`CATALOG.md`、Clineルール、Copilot instructions、READMEのAIツール節。詳細は[ai-tools-config](/repo-wide/ai-tools-config.md)）
- `SKILL.md`の`meta.version`/`meta.description`デフォルト値のバックフィル
- `meta.version`が未バンプのままステージされた`SKILL.md`があればコミットをブロック（[skill-meta-fields](/repo-wide/skill-meta-fields.md) / [skill-md-commits](/repo-wide/skill-md-commits.md)参照）
- `repo-tools.yaml`との整合チェック（スキルの`requires_repo_tools`/`requires_install`、およびツール同士の`requires_tools`。`library`辺はworkspace依存と一致）。`**/SKILL.md`・`repo-tools.yaml`・`tools/**/pyproject.toml`がトリガー。影響範囲の列挙（`skill-tool-impact`）はlefthookに繋がない。直すかどうかは判断が要るため、スキル/`tools/` を含むコミットでは[committing](../../meta-plugins/skills/committing/SKILL.md)がエージェントに叩かせる（[skill-tool-relations](/repo-wide/skill-tool-relations.md)）
- `repo-tools.yaml`登録ツールの各フォルダに変更があれば、対応するマニフェスト（Pythonは`pyproject.toml`、Nodeは`package.json`）のpatchバージョンを自動で1つ上げて同じコミットに含める。すでにversionを手動変更しているコミットでは追加バンプしない（[repo-tools-config](/repo-wide/repo-tools-config.md)の消費側4参照）
- ステージ済みMarkdownのPrettier整形、ステージ済みPythonの`ruff format`整形、ステージ済みファイルのsecretlint
- Windowsでは`{staged_files}`の展開がCreateProcessのコマンドライン長制限に当たることがある。マニフェスト自動バンプとsecretlintはgitのステージ済み一覧をスクリプト側で読む（secretlintは分割実行）

`pre-commit`は`piped`で fix → format → check の3段に分け、各段の中は`parallel`で並列実行する（fixerの書き込みとPrettier/ruffが同じファイルを奪い合わないため）。`tools/internal`のPythonタスク群は段ごとに1ジョブ（`tools/internal/precommit`）へまとめ、プロセス内で依存順に実行する。ジョブごとの`powershell`+`uv run`起動コストを避けるためで、新しい決定論的Pythonタスクはlefthookジョブを増やすのではなく`tools/internal/precommit/__main__.py`へ足す。

各ジョブは`glob`で対象を絞り、関係するファイルがステージされたときだけ走る。多くは`stage_fixed: true`のため、再生成・整形後の内容は通常同じコミットへ自動で再ステージされる。成功後に生成物または整形結果が残留した場合は、残留ファイルをステージしてフック付きの追加コミットに含める。追加コミットを省略して作業ツリーへ残さない。

## 「手で実行して」ではなく「フックに任せる」

新しいチェック・再生成ステップを追加するときは、`glob`で対象を絞れる形にできないか先に検討し、できるならlefthookジョブとして実装する。スキルの本文には、lefthookが**既にやっていること**（何が走るか、失敗時の直し方）を書けばよく、同じコマンドを手で実行するよう指示する記述は避ける。判断が要る列挙（`skill-tool-impact`）はこの対象外で、lefthookに無いので[committing](../../meta-plugins/skills/committing/SKILL.md)がコミット前に叩かせる。

エージェントがコミットするときは生の`git commit`を叩かない。[committing](../../meta-plugins/skills/committing/SKILL.md)の同梱ラッパー（`meta-plugins/skills/committing/scripts/commit.py`）が同じフックを走らせ、成功/失敗ジョブと直し方だけを返す。lefthookの実行ログをコンテキストに流さないためであり、衛生処理そのものをフックの外へ出す変更ではない。

## 例外: 有料/外部AI API呼び出しはフック化しない

`skill_meta_field_fill.py`（[skill-meta-fields](/repo-wide/skill-meta-fields.md)、内部でaimを呼びOpenRouter APIを叩く）は、意図的にlefthookへ組み込まれていない。コミットのたびに課金を伴うAI呼び出しが走らないよう、明示呼び出し専用（該当スキルの`disable-model-invocation: true`）に留める。「自動化を最大限に活用する」の対象は、決定論的で無料/低コストな整形・再生成に限る。

## 新しいフォーマッタ/リンタを足す場合

設定はルートの`pyproject.toml`（Python/ruff）や`.prettierrc.json`（Markdown等）のような一箇所にまとめ（ツールごとの個別コピーを作らない）、lefthookに正しい`glob`を持つジョブを1つ追加する。

## 新しい「生成物ペア」（SSOT→生成スクリプト）を足す場合

既存の`ai-tools.yaml`由来ジョブと同じ形で、SSOTファイルと生成トリガーになりうるファイルの両方を`glob`に含めたlefthookジョブを追加する。この設計思想自体は[repo-ssot-pattern](/repo-wide/repo-ssot-pattern.md)参照。

## 関連

- [ai-tools-config](/repo-wide/ai-tools-config.md) — 生成される個々のファイルと生成スクリプトの詳細
- [skill-md-commits](/repo-wide/skill-md-commits.md) — `SKILL.md`をコミットする際にlefthookが実行する内容と、詰まったときの直し方
- [repo-ssot-pattern](/repo-wide/repo-ssot-pattern.md) — SSOT→生成スクリプト→lefthookという一連の設計パターン
- [committing](../../meta-plugins/skills/committing/SKILL.md) — エージェント向けコミット手順（lefthook出力を要約するラッパー付き）

## このドキュメントの位置づけ

`meta-plugins/`はこのリポジトリ自身のメンテナンス用であり、ユーザー向けプラグインではない。既存方針に従い、この内容を`ai-tools.yaml`へ登録しないこと。詳細は[ai-tools-config](/repo-wide/ai-tools-config.md)参照。
