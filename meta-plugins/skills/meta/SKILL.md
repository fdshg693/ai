---
# 同梱: scripts/list_repo_meta_docs.py — docs/repo-wide/*.mdのfrontmatterをスキャンし、
# title/descriptionの一覧をこのSKILL.md読み込み時に動的注入する（手書きの一覧は持たない）
name: meta
description: "Points to the single most relevant concept doc under docs/repo-wide/ for a given repository-maintenance task (SKILL.md quality checklist, meta: frontmatter fields, SSOT+regeneration pattern, tools/ directory layout, lefthook/justfile wiring, aim automation, GitHub Actions lifecycle, etc.). Use when starting work under meta-plugins/, or hitting a skill/tooling drift, staleness, or consistency question and unsure which existing doc already covers it, before writing new one-off guidance."
meta:
  tag: []
  requires_repo_tools: none
  requires_env: none
  dependencies: none
  requires_install: none
  requires_hooks: none
  requires_skills: none
  status: experimental
  description: no description
  version: 1.1.8
---

!`python ${CLAUDE_SKILL_DIR}/scripts/list_repo_meta_docs.py`

# repo-wide配下のメンテナンス資料選択

`docs/repo-wide/`には、このリポジトリ自身のメンテナンスを扱う複数の概念ドキュメント（OKF）が並んでいる。新しい判断ロジックをその場で書く前に、まず上の一覧（このスキル読み込み時にスクリプトが`docs/repo-wide/*.md`から生成した最新の`title`/`description`）から既存ドキュメントが対象を既にカバっていないか確認する。

## 選び方

1. 上の一覧の`description`を読み、対象タスクのキーワード（触ろうとしているファイル・症状・操作）に最も一致する1件を選ぶ。
2. 複数該当しそうな場合は、対象がどの事実・仕組みについてかで絞り込む。
   - `SKILL.md`の`meta:`フィールドの意味・埋め方 → `skill-meta-fields`
   - `SKILL.md`をコミットした時のlefthook挙動（生成物再生成・バージョンバンプ） → `skill-md-commits`
   - このリポジトリでコミットする手順そのもの（何をステージするか、件名、フック失敗時） → `committing`スキル（方針の正本は`lefthook-automation`）
   - 複数ファイルに渡って一致させたい事実をSSOT+生成で管理するパターン全般 → `repo-ssot-pattern`（`ai-tools.yaml`固有の話なら`ai-tools-config`）
   - `tools/`配下の新規スクリプト・CLIの置き方 → `tools-directory-layout`（Pythonパッケージ化の要否は`uv-workspace`）
   - 環境変数・設定ファイル（レイヤー設定 / `.env`）の優先順位・置き場所、版数SSOT、`--version`規約（ツールの作り方・呼び方） → `tool-conventions`
   - スキルまたは tools/ CLI を変えたときの影響範囲（どの下流を見るか） → `changing-skills-and-tools`スキル（辺の意味・変更時に見る場所の正本は`skill-tool-relations`）
   - スキルとツールの依存関係の辺の意味・宣言場所 → `skill-tool-relations`
   - `skill-tools`（リポジトリ横断のスキル検索・配置CLI）に載せるための登録・配置規約、`skill-tools list-skills`/`search`がカタログエラーで止まる → `skill-tools-contract`
   - 便利ツールに使い方スキルを併設するかの判断、使い方FB（`skill-tools --fb`）の残し方 → `tool-companion-skills`
   - lefthook/justfileのレシピ追加・挙動 → `lefthook-automation` / `justfile-conventions`
   - `aim`系ツールで単純作業を自動化すべきか → `aim-automation`
   - スキルをClaude Code以外（Cline/Codex/Copilot等）へポートすべきか → `claude-code-first-skills`
   - GitHub Actionsのリリース・デプロイ・issue/PR自動化の仕組み → `gh-actions-lifecycle`
   - 新しいメンテナンスガイダンスをdocs/repo-wide/の新規docにするか既存docに統合するかの判断 → `skill-improving-meta-skills`
   - このリポジトリの地図・どこに何があるか → `exploring-this-repo`スキル（索引に載るコードと載らない docs/スキルの振り分け）
3. 一覧のどれにも合致しなければ、無理に既存ドキュメントへ寄せない。新規ドキュメントとして追加すべきかの判断・配置基準は[skill-improving-meta-skills](../../../docs/repo-wide/skill-improving-meta-skills.md)と[writing-skill](../../../claude-plugins/meta/skills/writing-skill/SKILL.md)を使う。

## 一覧が期待と違うとき

一覧生成スクリプトは`docs/repo-wide/`配下の`*.md`（`index.md`は除く）だけを対象にする。新しいドキュメントを追加したのに出てこない場合、そのfrontmatterが`---`で始まり`title`/`description`がトップレベルのキーになっているかを確認する。`[ERROR]`行が出た場合は該当`.md`のfrontmatterを直接確認する。

## 関連

- [skill-improving-meta-skills](../../../docs/repo-wide/skill-improving-meta-skills.md) — docs/repo-wide/配下の運用判断、新規doc追加の判断基準
- [writing-skill](../../../claude-plugins/meta/skills/writing-skill/SKILL.md) — 新規スキルのフロントマター・チェックリスト

## このスキルの位置づけ

`meta-plugins/`はこのリポジトリ自身のメンテナンス用であり、ユーザー向けプラグインではない。既存方針に従い、このスキルを`ai-tools.yaml`へ登録しないこと。
