---
type: Repo Convention
title: SKILL.md変更のコミット手順とpre-commitフックの挙動
description: Explains what this repository's lefthook pre-commit hook does whenever a commit touches any SKILL.md (regenerating skill-catalog.json/CATALOG.md, backfilling meta.version/meta.description defaults, blocking on a missing meta.version bump), and how to get such a commit through cleanly. Use when a commit touching SKILL.md files fails in lefthook, when the pre-commit hook produces a much larger diff than expected, or when asked how to bump meta.version across many skills at once.
tags: [repo-wide]
generated: { by: reference_agent/cline-glm-5.2, at: 2026-08-09T14:39:30Z }
status: stable
---

# SKILL.md変更のコミット手順とpre-commitフックの挙動

`**/SKILL.md`にマッチするファイルをステージしてコミットすると、`lefthook.yml`の`pre-commit`フックが複数のステップを自動実行する。挙動を知らずにコミットすると、想定より大きい差分が生まれたり、コミット自体が失敗したりする。このドキュメントはその挙動と対処法をまとめる。エージェントがコミットするときは生の`git commit`ではなく[committing](../../meta-plugins/skills/committing/SKILL.md)のラッパーを使い、lefthook生ログではなく成功/失敗ジョブと直し方だけを読む。

## pre-commitフックが自動でやること

`SKILL.md`をステージした状態で`git commit`すると、次が順に走る（`lefthook.yml`参照）。

1. **生成物の再生成**（`stage_fixed: true`、成功すれば自動でステージに追加される）
   - `skill-catalog.json` / 各プラグインの `CATALOG.md`（詳細は[ai-tools-config](/repo-wide/ai-tools-config.md)）
   - `copilot-plugins/meta/**/SKILL.md`が対象なら`plugin.json`/`marketplace.json`も
2. **meta.version / meta.description / meta.tag のデフォルト値バックフィル**（`stage_fixed: true`）
   - `just skill-versions` / `just skill-descriptions` / `just skill-tags` が**リポジトリ全体**の`SKILL.md`を走査し、値が空のフィールドに`1.0.0`/`no description`/`[]`を補完する。ステージされていない他のスキルにも波及するため、コミット後の差分が「自分が触った分」より大きくなるのは想定内。
3. **meta.versionバンプチェック（ブロッキング、自動修正なし）**
   - `skill/check/check_skill_version_bump.py`が、ステージ済みの各`SKILL.md`をHEADと比較し、「`meta.version`以外の内容が変わったのに`meta.version`が変わっていない」ファイルがあればコミットを拒否する。

## meta.versionバンプで止まったときの直し方

```bash
just --justfile tools/internal/justfile skill-version-bump
```

引数なしで実行すると、`check_skill_version_bump.py`が拒否する対象（ステージ済みで未バンプのファイル）を自動検出して一括バンプする（末尾の数値セグメントのみ+1、`1.2.3-beta`のような接尾辞は落として`1.2.4`にする。`tools/internal/skill/set/bump_skill_versions.py`参照）。特定ファイルだけバンプしたい場合はパスを直接渡す。

手でバンプしてもよい（`meta.version`を1つ上げるだけ）。

## 往復を減らすための事前実行

多数の`SKILL.md`を一度に触るコミットでは、`git commit`を叩く前に次を手動実行しておくと、pre-commitフックでの失敗→修正→再コミットの往復を減らせる。

```bash
just --justfile tools/internal/justfile skill-versions
just --justfile tools/internal/justfile skill-descriptions
just --justfile tools/internal/justfile skill-tags
just --justfile tools/internal/justfile skill-catalog
just --justfile tools/internal/justfile skills-catalog-md
just --justfile tools/internal/justfile skill-version-bump
git add -A
git status   # 差分の全体像を確認してからコミットする
git commit -m "..."
```

## 落とし穴

- **`find_skill_md_files`（`tools/internal/skill/util/skill_frontmatter.py`）はvendor/buildディレクトリを除外している**（`node_modules` / `.venv` / `venv` / `.git` / `__pycache__` / `dist` / `.astro` / `generated`）。新しいビルド出力ディレクトリ配下に`SKILL.md`のコピーが生成されるようになった場合（新しい静的サイトのビルド先など）、`skill-versions`/`skill-descriptions`実行時に`PermissionError`等でクラッシュすることがある。原因を都度追わず、まず`EXCLUDED_DIRECTORY_NAMES`に該当ディレクトリ名を追加する。
- **バックフィルはリポジトリ全体を走査する**ため、無関係なスキルへの副作用込みで1コミットになる。意図しない変更が混ざっていないか、コミット前に`git status`/`git diff`で全体を確認する。
- **失敗したコミットでもファイルへの書き込みは残る**ことがある（バックフィルまでは成功し、後段のバンプチェックだけ失敗する等）。再コミットする前に必ず`git status`を再確認し、`git add`をやり直す。
- **git add -A を避けて自分の変更だけステージしたい場合でも**、バックフィルステップはステージ有無に関係なくリポジトリ全体を書き換えるため、その分の変更はどのみち作業ツリーに残る。完全に無視したい場合は該当ファイルだけ`git checkout --`で戻す。

## 関連

- [ai-tools-config](/repo-wide/ai-tools-config.md) — マーケットプレイス・スキルカタログ生成の詳細
- [skill-meta-fields](/repo-wide/skill-meta-fields.md) — `meta:`ブロックの新7フィールド運用
- `.claude/rules/skill-meta-fields.md` — `meta.version`SSOT・バンプ運用のルール本文
- [committing](../../meta-plugins/skills/committing/SKILL.md) — このリポジトリ全体のコミット手順（ステージ対象・件名・フック失敗時）

## このドキュメントの位置づけ

`meta-plugins/`はこのリポジトリ自身のメンテナンス用であり、ユーザー向けプラグインではない。既存方針に従い、この内容を`ai-tools.yaml`へ登録しないこと。
