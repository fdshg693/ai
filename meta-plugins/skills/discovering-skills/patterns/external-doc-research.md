# パターン: 外部ドキュメント調査

## 該当するタスクの例

- 「Azure Functionsの最新の書き方を調べて実装に反映して」
- 「S3 のライフサイクルルールの設定方法を AWS 公式で確認して」
- 「このライブラリのv3での破壊的変更を教えて」
- 「Web上の記事を集めて要点をまとめて」
- 「このライブラリの wheel / 配布物の中身を一次ソースとして読んで」

## 情報源ごとの使い分け

| 調べたい対象                                                                             | 使うスキル                                                                                                                    |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Microsoft/Azure/.NET/M365 公式ドキュメント                                               | `ms-learn`（検索・取得）。結果件数が多い/大きいファイルが複数あるときは`ms-digest`で並列AI抽出                                |
| AWS 公式ドキュメント・Blog・What's New・re:Post・リージョン可用性                        | `aws-docs`（検索・取得・可用性確認）。大きいファイルが複数あるときは`aim-cli`（`--parallel`）で抽出                           |
| GCP / Google Workspace の開発者向け公式ドキュメント（概念、API、設定、クォータ、エラー） | `gdev-docs`（検索・取得・概念の回答）。大きいファイルが複数あるときは`aim-cli`（`--parallel`）で抽出                          |
| ライブラリ・フレームワークの最新API・移行ガイド（Microsoft以外）                         | `use-context`（Context7経由）                                                                                                 |
| ライブラリの配布物・実装・実際の公開モジュール                                           | `inspecting-python-libraries`（`pyinspect`）。使わない: `use-context`（ドキュメント索引）、`grep-app`（他リポジトリの使用例） |
| 一般Web検索・複数URL・サイトマップ/クロール                                              | `tav-cli`（本体）。既知の1URLだけなら`tav-lit`で十分。`--topic`収集後の絞り込みは`tav-digest`                                 |
| すでに手元にある複数ファイルへの一括質問（要約・バグ指摘等）                             | `aim-cli`（`--parallel`）                                                                                                     |

## 手順

1. 調べたい対象で分岐する。Microsoft公式 → `ms-learn`。AWS公式 → `aws-docs`。GCP と Google Workspace の開発者向け公式ドキュメント → `gdev-docs`。ライブラリのAPI・移行ドキュメント → `use-context`。配布物・実装・公開モジュール → `inspecting-python-libraries`。一般Web → `tav-cli`（既知1URLなら`tav-lit`）。
2. 検索結果・取得結果のファイル数が多い（目安5件以上）場合は、1件ずつReadせず`ms-digest`または`tav-digest`（`aws-docs` と `gdev-docs` の結果は`aim-cli`の`--parallel`）で並列AI抽出する。
3. 結果を実装・ドキュメントに反映する。

## スキルの場所

| スキル                        | パス                                                                  |
| ----------------------------- | --------------------------------------------------------------------- |
| `ms-learn`                    | `claude-plugins/my-tools/skills/ms-learn/SKILL.md`                    |
| `ms-digest`                   | `claude-plugins/my-tools/skills/ms-digest/SKILL.md`                   |
| `aws-docs`                    | `claude-plugins/my-tools/skills/aws-docs/SKILL.md`                    |
| `gdev-docs`                   | `claude-plugins/my-tools/skills/gdev-docs/SKILL.md`                   |
| `use-context`                 | `claude-plugins/my-tools/skills/use-context/SKILL.md`                 |
| `inspecting-python-libraries` | `claude-plugins/my-tools/skills/inspecting-python-libraries/SKILL.md` |
| `tav-cli`                     | `claude-plugins/my-tools/skills/tav-cli/SKILL.md`                     |
| `tav-lit`                     | `claude-plugins/my-tools/skills/tav-lit/SKILL.md`                     |
| `tav-digest`                  | `claude-plugins/my-tools/skills/tav-digest/SKILL.md`                  |
| `aim-cli`                     | `claude-plugins/my-tools/skills/aim-cli/SKILL.md`                     |

## この流れで足りないとき

- 上記スキルのいずれにも当てはまらない情報源（例: 社内Wiki、特定SaaSのAPI） → `skill-search`で個別に探す。
