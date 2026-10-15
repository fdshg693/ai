# skill-maintenance

## 位置付け

`skill-maintenance` は、通常の専門スキルとは異なる保守専用のメタスキルである。回答や成果物を作るためのスキルではなく、同じ `claude-plugins/meta/skills` 配下にある他のスキルが、現在の Claude CLI と Claude Code の仕様に追随できているかを点検し、必要なスキルだけを更新する。

いわば「スキルをメンテナンスするスキル」であり、保守対象には自分自身を含めない。自分自身の設計変更は、通常の開発作業として人間がレビューする。

## 特別扱いする理由

このスキルは次の理由から、通常のスキルと異なり自動起動させない。

- 外部ドキュメントへのアクセスと `claude` CLI の実行を伴う
- 生成済みスナップショットを書き換える
- 差分の解釈結果に基づいて、複数のスキルの説明や手順を書き換える可能性がある
- 誤った一括更新が、以後のClaude Code作業全体に影響する

そのため `SKILL.md` の `disable-model-invocation: true` を維持し、ユーザーが明示的に呼び出した場合だけ実行する。起動時には取得処理を動的コンテキストとして必ず実行し、エージェントの判断だけで更新確認を省略しない。

## 保守対象と情報源

| 対象                                  | 情報源                                               | 生成物                                                           |
| ------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------- |
| Claude CLI のオプション・サブコマンド | `claude-cli-docs/generate_claude_help_yaml.py`       | `claude-cli-docs/output/help_result.yaml`                        |
| Claude Code 公式ドキュメント          | `claude-code-docs/download_claude_code_reference.py` | `claude-code-docs/output/llms.txt` / `llms-full.txt`             |
| 影響を受けるスキル                    | 上記生成物の意味のある差分                           | `claude-plugins/meta/skills` 配下の関連 `SKILL.md`・参照ファイル |

生成物の `fetched_at` は取得時刻であり、更新要否の根拠にしない。内容差分の取得は [scripts/refresh_and_diff.py](scripts/refresh_and_diff.py) が Python の unified diff として行い、対象ごとに `temp/skill-maintenance/diff/` 配下の個別ファイルへ書き出す。

## 保守時の原則

- 取得スクリプトを正規の情報源として実行し、生成物を手編集しない。
- 差分ファイルはエージェント自身が全文を読むのではなく、サブエージェントに要約させてから使う。差分は取得直後の生スナップショット比較で巨大になりやすく、直接コンテキストに載せると以降の作業を圧迫するため。
- サブエージェントの要約に現れたフラグ、サブコマンド、機能名、URL/slugから影響範囲を絞り、無関係なスキルを変更しない。
- 公式情報にない仕様を推測して補わない。
- 取得に失敗した情報源を最新とみなさない。片方だけ成功した場合は、成功した側の差分だけを処理する。
- `CATALOG.md` は生成物なので直接編集せず、frontmatterを変更した場合だけ `tools/internal/plugin_meta/generate/generate_skills_catalog_md.py` で再生成する。
- `temp/skill-maintenance/` は差分レポート用の作業領域であり、コミットしない。

## 手動での確認

スキルを明示的に呼び出すと、取得・差分生成から始まる。差分ファイルは対象ごとに次のフォルダへ出力される。

```text
temp/skill-maintenance/diff/
├── claude-cli-help.diff
├── claude-code-reference.diff
└── claude-code-full-reference.diff
```

差分がない対象のファイルは書き出されない。各ファイルはサブエージェントに読ませて要約させ、要約結果に基づいて影響を受けるスキルを特定する。

`claude` CLI が未導入、ネットワークに接続できない、または依存パッケージが不足している場合は、エラーを記録して更新を止める。両方の情報源に失敗した場合、関連スキルを変更しない。

## ファイル構成

```text
skill-maintenance/
├── SKILL.md                         # Claude Codeが実行時に読む手順
├── README.md                        # 人間向けの設計意図・保守規約
└── scripts/
    └── refresh_and_diff.py          # 2本の取得スクリプト実行と差分生成
```
