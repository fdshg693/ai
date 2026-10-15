@./README.md

## Behaviour

- `AGENTS.md`の内容に、 `@./...` のような記載があれば、そのパスが差し示すファイルも読みに行くこと。
- `./.../SKILL.md`のような形式であっても、あなたがスキルとして呼び出せるとは限りません。その場合は、ファイルとして直接Readしてください。
- Claude Rule の source は `.claude/rules/`、ネストした `AGENTS.md` の注入は `agent-tooling/agent_tooling/hooks/scenarios/nested_agents_md/` が担当する。両者は独立した入力契約として扱うこと。
- エージェントフックの正本は `agent-tooling/agent_tooling/hooks/`。`.claude/hooks/` はインストール先なので直接編集しない。フックの追加・変更は `docs/repo-wide/hook-distribution.md` から辿る。
- あなた以外のエージェント・ユーザーがこのレポジトリで同時作業することは頻繁に起こります。
  - 自分が行った覚えのない変更を勝手に戻さないように心がけてください。明らかに戻すべき変更である場合のみ、ユーザーの同意の上で、削除を行ってください。

### テクニック

- 複雑なタスクには、積極的にユーザー質問・サブエージェント活用を行って
  - 便利なスキル・関連スキルがたくさんこのレポジトリにあります。複雑なタスクには `meta-plugins\skills\discovering-skills\SKILL.md` を積極的に参照してください。
- ツール・スキル変更時は `meta-plugins\skills\changing-skills-and-tools\SKILL.md` を参照。
- このレポジトリ全体に関わるようなタスクには `meta-plugins\skills\meta\SKILL.md` を参照。
- このリポジトリの全体像・「どこに何があるか」は `meta-plugins/skills/exploring-this-repo/SKILL.md`。コードの流れ・定義・呼び出し関係・影響範囲は、grep/Read の前に `codegraph_explore`（MCP）または `codegraph explore`（CLI）。地図は `codegraph status` と `codegraph files` が先。索引が無い／古いときは `codegraph init` または `codegraph sync`。`.codegraph/` はローカル索引で git 管理しない。詳細は `claude-plugins/topics/skills/codegraph-docs/SKILL.md`。

## AIツール/プラグイン設定のSSOT

- AIツール・プラグイン・マーケットプレイス・スキルカタログの所在は `ai-tools.yaml` がSSOT。
- 新しいプラグインを追加・削除したら、先に `ai-tools.yaml` を更新する。
- `./README.md` の `<!-- BEGIN: ai-tools-section -->`〜`<!-- END: ai-tools-section -->` は `tools/internal/plugin_meta/generate/generate_readme_tools_section.py` が `ai-tools.yaml` の `readme` ブロックから生成する。手編集しない。

## SKILL.md meta フィールドのSSOT

- `SKILL.md`フロントマターの`meta:`サブフィールド（`version`/`description`/`status`/`requires_skills`等）の定義は`meta_field.yaml`がSSOT。
  - 新フィールドを追加・意味を変更する場合は先に`meta_field.yaml`を更新する。
- 新フィールドは全てスカラー文字列（複数値はカンマ区切り、該当なしは`none`）。YAMLリスト値にしない（`tools/internal/skill/util/skill_meta_field.py`の制約）。
- `meta.version`以外のフィールドを変更した場合も、既存の`skill/check/check_skill_version_bump.py`が「frontmatter全体の変更」として検知するため、`meta.version`を1つ上げること。
  - 手動で編集してもよいが、`tools/internal/skill/set/bump_skill_versions.py`（`just --justfile tools/internal/justfile skill-version-bump`）で自動バンプできる（末尾の数値セグメントを+1し、`1.2.3-beta`等の接尾辞は落として`1.2.4`にする）。
- 新7フィールドの初回一括判定・再判定は`tools/internal/skill/set/skill_meta_field_fill.py`（`just --justfile tools/internal/justfile skill-meta-fields-fill`）で行う。
  - 判断結果は必ず`git diff`でレビューしてからコミットする（lefthookには紐づいていない）。
  - 新7フィールドの意味・メンテ手順の詳細は`docs/repo-wide/skill-meta-fields.md`を参照。
- コミット時は `meta-plugins\skills\committing\SKILL.md` を参照。

## コマンド

- このレポジトリは`mise・uv・pnpm・just`で管理されている。
- `npm, python`は直接使わず、`pnpm`/`just`/`uv`を使うこと。
