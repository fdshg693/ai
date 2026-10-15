# パターン: スキル新規作成・改修

## 該当するタスクの例

- 「〇〇用のスキルを新しく作って」
- 「このSKILL.mdのdescriptionが分かりにくいので直して」
- 「meta_field.yamlに新フィールドを足したので既存スキルに反映して」
- 「新しいスキルの実装計画を作って」（SKILL.mdの目的・構成・frontmatterをその計画内で決める場合）

コード実装の計画に将来のスキル追加が含まれるだけで、その計画中にSKILL.mdの契約を決めない場合はこのパターンを適用しない。プラン実行の進捗記録・後片付けは`plan-execution`の実行規約に従うが、これはスキル選定パターンではない。

## 使うスキル（順序どおり）

1. **`writing-skill`** — 執筆前に必ず読む。同梱の`bestpractices.md`がチェックリスト。frontmatter規約・freedom度の判断基準・スクリプト同梱基準など。
   - 判断フロー・分岐が多い複雑なスキルなら代わりに`writing-skill-complex`を使う。
   - Web公開UI寄りの文言調整（skills-site表示など）が絡むなら`writing-skill-web`も併読する。
2. 本文を実際に編集する。
3. **`meta.version`以外のfrontmatterフィールドを触った場合** — `docs/repo-wide/skill-meta-fields.md`を読み、`meta.version`を1つ上げる（`bump-skill-versions`ツール、または手動+1）。既存の`check_skill_version_bump.py`が変更検知に使うため必須。
4. **`audit-skills`** — 編集後、`bestpractices.md`チェックリストに沿っているか自己監査する（Skillツールで直接呼べる。対象パスを`args`で渡す）。
5. コミット前に`lefthook`のpre-commitで生成物再生成・バンプチェックが走る前提を踏まえ、`docs/repo-wide/skill-md-commits.md`の落とし穴（Windowsでの大文字小文字衝突など）を確認する。

## スキルの場所

| スキル                  | パス                                                                                                |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| `writing-skill`         | `claude-plugins/meta/skills/writing-skill/SKILL.md`                                                 |
| `writing-skill-complex` | `claude-plugins/meta/skills/writing-skill-complex/SKILL.md`                                         |
| `writing-skill-web`     | `claude-plugins/meta/skills/writing-skill-web/SKILL.md`                                             |
| `audit-skills`          | `.claude/workflows/audit-skills.js`（ワークフロー。Skillツール経由で`/audit-skills`としても呼べる） |

## この流れで足りないとき

- 新しいスキルが依存する外部ツール・CLI自体の使い方が分からない → 該当ツールの`-docs`/`-use`系スキルを個別に探す（`skill-search`推奨）。
- 複数AIツール向けに同時展開する場合 → [cross-tool-porting.md](cross-tool-porting.md)も参照。
