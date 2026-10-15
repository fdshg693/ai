---
type: Design Decision
title: メタスキル層とdocs/repo-wide/の運用判断
description: Explains how to decide whether new repo-maintenance guidance belongs as a new concept doc under docs/repo-wide/, should be integrated into an existing doc, or warrants keeping/extending the meta skill (meta-plugins/skills/meta/) that routes to these docs. Use when adding maintenance knowledge about this repository and unsure where it should live.
tags: [repo-wide]
generated: { by: reference_agent/cline-glm-5.2, at: 2026-08-09T14:39:30Z }
status: draft
---

# メタスキル層とdocs/repo-wide/の運用判断

このリポジトリには、タスクそのものをこなすのではなく、**他のスキル・ドキュメントの品質・鮮度を保つ**ためのメタ的な知識が複数の粒度で存在する。新しいメンテナンスガイダンスを書くとき、それをどこに置くべきか — `docs/repo-wide/` 配下の新規概念ドキュメントか、既存ドキュメントへの統合か、`meta-plugins/skills/meta/` スキルの拡張か — を判断するための指針をまとめる。

## 現在の構成

`docs/repo-wide/` 配下の概念ドキュメント群が、このリポジトリ自身のメンテナンスに関する設計判断・規約・運用知識を担う。`meta-plugins/skills/meta/` は唯一残ったスキルで、これらのドキュメントへのルーティング（どのdocがどのタスクに該当するかを提示する）役割を持つ。

これらはもと `meta-plugins/skills/` 配下の個別メタスキルとして分散していたが、同じ内容が複数スキルに分散・重複管理されるのを避けるため、OKF概念ドキュメントへ一括移行した。ルーティングだけはスキル機構（動的コンテキスト注入 `!command`）が必要なため `meta-plugins/skills/meta/` に残している。

## Claude Code側のメタスキル

Claude Codeの `claude-plugins/meta/skills/` 配下には、スキルの品質を保つためのメタスキルが別途存在する。これらは `docs/repo-wide/` ではなくClaude Codeのスキル機構に依存するため、そちらに残る。

- [claude-plugins/meta/skills/writing-skill](../../claude-plugins/meta/skills/writing-skill/SKILL.md)（+ `writing-skill-complex`） — 新規作成・編集・評価。あらゆる`SKILL.md`が満たすべきチェックリストの一次情報源
- [claude-plugins/meta/skills/skill-maintenance](../../claude-plugins/meta/skills/skill-maintenance/SKILL.md) — Claude CLI/Claude Code公式ドキュメントのスナップショットを更新し、意味のある差分を検出して依存スキルへ伝播させる
- `audit-skills`（Workflow） — 多数のスキルを一括でベストプラクティス採点する

## 他ツールにも同種のメタスキルがある

Cline（`cline-skill-writer`）、Codex（`codex-skill-authoring`）、Copilot（`copilot-plugins/meta/writing-skills`）にも、それぞれ自分のツール向けの「スキルの書き方スキル」がある。これは[claude-code-first-skills](/repo-wide/claude-code-first-skills.md)の方針どおり、**そのツール自身のスキル機構についてのスキル**であり、Claude Codeの`writing-skill`をポートしたものではない。

## 新しいメンテナンスガイダンスをどこに置くか

新しいリポジトリメンテナンス知識を書くとき、次の順で判断する。

1. **既存の `docs/repo-wide/` ドキュメントに統合できるか** — 新しい内容が既存docの主題の延長・補足であれば、新規docを作らず既存docに追記する。ドキュメント数が増えるほど関連性が見えにくくなる。
2. **独立した新規docが妥当か** — 既存docのどれにも属さない新しい主題（新しい設計判断、新しい規約領域）であれば、`docs/repo-wide/<name>.md` として新規作成する。OKF frontmatter（`type`/`title`/`description`/`tags`/`generated`）を必ず付ける。作成後は `docs/repo-wide/index.md` と `meta-plugins/skills/meta/` のキーワード表にも反映する。
3. **`meta-plugins/skills/meta/` スキルの拡張が必要か** — ルーティングのキーワード表に新しい選択肢を追加するだけであれば、`meta-plugins/skills/meta/SKILL.md` の「選び方」セクションを編集する。スキルの動的コンテキスト注入（`!command`）やfrontmatter機構（`allowed-tools`等）を前提とする内容であれば、docsではなくスキルとして書くべき可能性があるが、その判断は慎重に — docs化できる内容はdocs化する方が二重管理を防げる。

## メタ的な知識自体もベストプラクティスに従う

`docs/repo-wide/` 配下のドキュメントだからといって特別扱いはしない。内容がSKILL.mdの品質に関わるものであれば[writing-skill](../../claude-plugins/meta/skills/writing-skill/SKILL.md)のチェックリストを、SSOT・生成パターンに関わるものであれば[repo-ssot-pattern](/repo-wide/repo-ssot-pattern.md)の指針を参照する。

## 関連

- [writing-skill](../../claude-plugins/meta/skills/writing-skill/SKILL.md) — 新規作成・編集・評価の共通チェックリスト（SKILL.md向け）
- [skill-meta-fields](/repo-wide/skill-meta-fields.md) / [skill-md-commits](/repo-wide/skill-md-commits.md) — `meta:`ブロックというこのリポジトリ独自の観点に絞った知識（docs化済み）
- [claude-code-first-skills](/repo-wide/claude-code-first-skills.md) — 他ツールのメタスキルとの棲み分け
- [repo-ssot-pattern](/repo-wide/repo-ssot-pattern.md) — 同じ「ドリフトを防ぐ」発想を生成ファイル側に適用したもの

## このドキュメントの位置づけ

`meta-plugins/`はこのリポジトリ自身のメンテナンス用であり、ユーザー向けプラグインではない。既存方針に従い、この内容を`ai-tools.yaml`へ登録しないこと。詳細は[ai-tools-config](/repo-wide/ai-tools-config.md)参照。
