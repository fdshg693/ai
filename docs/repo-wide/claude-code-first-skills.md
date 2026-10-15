---
type: Design Decision
title: Claude Code中心のスキル方針
description: Explains this repository's policy that most SKILL.md content is written for Claude Code specifically (exploiting its frontmatter mechanisms like allowed-tools, disable-model-invocation, dynamic `!command` context injection, and this repo's own meta block) and only appears for another AI tool as a meta-skill about using that tool itself, not a ported copy. Use when deciding whether a skill belongs under claude-plugins/meta or a specialized claude-plugins/ plugin only, whether to port an existing Claude Code skill to cline-plugins/codex-plugins/copilot-plugins/cursor-plugins, or why those folders look sparser than claude-plugins.
tags: [claude-code, cline, codex, copilot, cursor, antigravity, repo-wide]
generated: { by: reference_agent/cline-glm-5.2, at: 2026-08-09T14:39:30Z }
status: stable
---

# Claude Code中心のスキル方針

このリポジトリのスキルの大部分はClaude Code向けに書かれており、他のAIコーディングツール（Cline/Codex/Copilot/Cursor/Antigravity）向けフォルダには、原則としてその**ツール自体の使い方に関するメタスキルだけ**が置かれる。1個のタスク向けスキルを全ツールへ機械的にポートする方針ではない。

## 実態の比較

- `claude-plugins/*/skills/` — このリポジトリの大半のタスク特化スキルの本体（`writing-hooks`、`ai-tools-config`、`claude-mechanisms`、`proposing-flow`等）
- `.cline/skills/`、`codex-plugins/meta/skills/`、`copilot-plugins/meta/` — ほぼ`<tool>-cli-docs`・`<tool>-docs`・`<tool>-sdk-docs`・`<tool>-skill-writer`/`plugin-writer`/`rule-writer`のような、**そのツール自体を使うためのメタスキル**のみ

## なぜポートしないか

Claude CodeのSKILL.mdフロントマターには他ツールの機構では1:1に再現できない仕組みがある。

- `disable-model-invocation`（モデルによる自動起動を止め、明示呼び出し専用にする）
- `allowed-tools`（そのスキル実行中に使えるツールを絞る）
- `` !`command` `` 形式の動的コンテキスト注入（スキル読み込み時にコマンドを実行し結果を埋め込む）
- `meta:`ブロック（Claude Code自体の機能ではなく、このリポジトリ独自の運用。詳細は[skill-meta-fields](/repo-wide/skill-meta-fields.md)）

これらの仕組みを前提にしたスキルをそのまま他ツールへコピーしても、その挙動（明示呼び出し限定、ツール制限、事前注入）は再現されず、静かに壊れる。

## 横断が必要な内容は「生成」で扱う

このリポジトリでは、複数ツールに同じ内容を持たせたい場合もスキルを手でポートするのではなく、共通のソースから生成する。`.clinerules/agents-*.md`と`.github/instructions/*.instructions.md`は各プラグインの`AGENTS.md`から生成される（SKILL.mdの内容からではない。詳細は[ai-tools-config](/repo-wide/ai-tools-config.md)）。

## 判断の目安

「これをCline/Codex/Copilotにも追加して」と言われたら、まず次を切り分ける。

1. 対象が**そのツール自体の使い方**（CLIオプション、SDK、プラグインの書き方等）についてのガイドなら、`<tool>-*`のメタスキルとして追加する
2. 対象がClaude-Code特有の仕組みに依存したワークフロースキルなら、基本的にポートしない。どうしても必要なら、Claude Code専用の仕組みを取り除き、そのツール自身の流儀で書き直す

`ai-tools.yaml`の`skills_layout`（`subdir`/`direct`）はあくまで各ツールが実際に使うSKILL.md配置形式の違いを表すフィールドであり、Claude Code側のレイアウトをコピーしたものではない（[ai-tools-config](/repo-wide/ai-tools-config.md)参照）。

## 関連

- [ai-tools-config](/repo-wide/ai-tools-config.md) — `AGENTS.md`からのCline/Copilot向け生成、`skills_layout`の意味
- [tool-companion-skills](/repo-wide/tool-companion-skills.md) — 便利ツールへの使い方スキル併設もデフォルトはClaude Code向け
- [skill-improving-meta-skills](/repo-wide/skill-improving-meta-skills.md) — 各ツールが持つ「スキルを書くためのスキル」自体もツールごとに独立している

## このドキュメントの位置づけ

`meta-plugins/`はこのリポジトリ自身のメンテナンス用であり、ユーザー向けプラグインではない。既存方針に従い、この内容を`ai-tools.yaml`へ登録しないこと。詳細は[ai-tools-config](/repo-wide/ai-tools-config.md)参照。
