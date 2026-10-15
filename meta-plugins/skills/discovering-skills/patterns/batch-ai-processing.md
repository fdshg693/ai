# パターン: リポジトリ内バッチAI処理

## 該当するタスクの例

- 「このディレクトリ配下の全ファイルに同じ質問を投げて」
- 「変更されたファイルだけ要約をDBに反映して」
- 「タスクの難易度に応じてモデルを選んで1回だけ呼びたい」

## 使い分け

| やりたいこと                                                                        | 使うスキル                                                                 |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 単発で1モデルに1プロンプトを投げる（永続化不要）                                    | `aim-cli`（CLI）/ `aim-lib`（Pythonから呼ぶ場合）                          |
| 複数ファイル/ディレクトリへプロンプトを並列に投げ、都度結果だけ欲しい（永続化不要） | `aim-cli`（`--parallel` で `--prompt` を複数。`@path` でファイル取り込み） |
| ファイル単位の要約をSQLiteに永続化し、変更分だけ再要約したい                        | `aim-summarize`                                                            |
| 定義済みのLangchainエージェント（YAML）を呼びたい/新規に作りたい                    | `my-agents`                                                                |

## 手順

1. 「結果をDBに残す必要があるか」で`aim-summarize`か`aim-cli --parallel`かを分岐する。
2. 対象がPythonコードからの呼び出しか、CLIからの呼び出しかで`aim-lib`か`aim-cli`かを分岐する。
3. 既存のエージェント定義を再利用したいだけなら`my-agents`を優先し、`aim-*`系を組み合わせて自作しない。

## スキルの場所

| スキル          | パス                                                    |
| --------------- | ------------------------------------------------------- |
| `aim-cli`       | `claude-plugins/my-tools/skills/aim-cli/SKILL.md`       |
| `aim-lib`       | `claude-plugins/my-tools/skills/aim-lib/SKILL.md`       |
| `aim-summarize` | `claude-plugins/my-tools/skills/aim-summarize/SKILL.md` |
| `my-agents`     | `claude-plugins/my-tools/skills/my-agents/SKILL.md`     |

## この流れで足りないとき

- モデル選定基準（どのタスクにどのモデルを使うか）が分からない → `aim-cli`のSKILL.md本文に選定基準がある。それでも不明なら`skill-search`。
