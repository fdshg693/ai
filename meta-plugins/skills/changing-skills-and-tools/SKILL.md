---
# 前提: リポジトリルートから tools/internal/justfile のレシピを叩けること。
# 方針の正本は docs/repo-wide/skill-tool-relations.md。このスキルは影響範囲スクリプトと正本への誘導だけを書く。
# 同梱スクリプトは置かない。決定論は tools/internal/skill/query/list_skill_tool_impact.py。
# 起動時に全グラフを注入しない。対象が決まってからスクリプトを叩く。
# ai-tools.yaml には登録しない。
name: changing-skills-and-tools
description: Lists the related skills and tools to review when a SKILL.md or tools/ CLI changes. Use when editing a skill or a tools/ CLI and unsure which downstream skills or tools to update.
meta:
  tag: []
  requires_repo_tools: tools/internal/justfile
  requires_env: none
  dependencies: none
  requires_install: none
  requires_hooks: none
  requires_skills: none
  status: experimental
  description: スキルまたは tools/ CLI 変更時の影響範囲列挙と設計正本への誘導
  version: 1.0.6
---

# スキルまたは tools/ CLI を変えるとき

スキルまたは `tools/` 配下のCLIを変えるとき、関連して見るスキル・ツールをスクリプトで絞り、設計正本の該当節に従って直す。チェックリスト本文はここに複製しない。方針の正本は[skill-tool-relations](../../../docs/repo-wide/skill-tool-relations.md)。

起動時に全グラフは注入しない。対象が決まってからスクリプトを叩く。

扱うのは**既存**のスキル・CLIを変えるときの影響範囲だけ。`tools/`配下にCLIを新規作成するときの置き場所・パッケージ化・`repo-tools.yaml`登録・`--version`規約は、`meta`スキルから[tool-conventions](../../../docs/repo-wide/tool-conventions.md)・[tools-directory-layout](../../../docs/repo-wide/tools-directory-layout.md)へ辿る。

## 初めて使うとき

対象の指定方法と出力の読み方は、リポジトリルートから次で確認できる。

```text
just --justfile tools/internal/justfile skill-tool-impact --help
```

## 手順

1. **変更対象を特定する** — スキルなら frontmatter の `name` または `SKILL.md` パス。ツールなら `repo-tools.yaml` のキーまたは登録済み `tools/...` パス。git の差分から対象を推定するモードは無い。同名がツールキーとスキル名で衝突するときはツールキーが優先される（例: `aim-summarize`）。スキル側を見るときは `SKILL.md` パスで指定する。
2. **影響範囲を列挙する** — リポジトリルートから:

   ```text
   just --justfile tools/internal/justfile skill-tool-impact <skill-name|tool-key|SKILL.md|tools/...>
   ```

   出力は下流ツール（`kind` と hop）と下流スキル（パスと hop）。`library` / `subprocess` は `must-see`、`family` は `check`。チェックリスト本文は出さない。

3. **設計正本の該当節に従って直す** — [skill-tool-relations](../../../docs/repo-wide/skill-tool-relations.md)の「変更時に見る場所」。スキル変更なら「スキルを変える」、ツール変更なら「ツールを変える」。
4. **辺そのものを変えたら検査に任せる** — `requires_tools` や workspace 依存の整合は lefthook の check 段（`tools/internal precommit check`）が見る。同じ検査コマンドを手で先に叩かない。

## やらないこと

- スキル本文へ「変更時に見る場所」のチェックリストをコピーする
- スキル同士の辺だけからツール同士の依存を推論する
- 対象が決まっていないのに全グラフを読む

## 関連

- [skill-tool-relations](../../../docs/repo-wide/skill-tool-relations.md) — 辺の意味・宣言場所・変更時に見る場所
- [repo-tools-config](../../../docs/repo-wide/repo-tools-config.md) — `repo-tools.yaml` の登録と検査
- [tools-directory-layout](../../../docs/repo-wide/tools-directory-layout.md) / [tool-conventions](../../../docs/repo-wide/tool-conventions.md) — CLIを新規作成するときの置き場所・版数・`--version`規約
- [skill-md-commits](../../../docs/repo-wide/skill-md-commits.md) — スキルを変えたあとの `meta.version` バンプ
- [committing](../committing/SKILL.md) — コミット時に lefthook がカバーしない下流確認

## このスキルの位置づけ

`meta-plugins/`はこのリポジトリ自身のメンテナンス用であり、ユーザー向けプラグインではない。`ai-tools.yaml`へ登録しないこと。
