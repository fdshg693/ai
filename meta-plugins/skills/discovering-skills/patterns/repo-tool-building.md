# パターン: `tools/`配下CLIの新規作成・機能追加

## 該当するタスクの例

- 「`tools/`に〇〇するCLIを新しく作って」
- 「`textgraph`に`check`/`fix`サブコマンドを足して」
- 「`aim2`にローカル会話継続（`thread_id`）を実装して」
- 「既存の2つのCLIを1つに統合して、グローバルインデックスに移行して」
- 「この自作CLIの出力表示を変えて」

単に既存CLIを**呼び出して使う**だけのタスクは該当しない（それは各ツールの併設スキル、例えば`aim-cli`・`textgraph`の担当）。ここで扱うのは`tools/`配下の**実装・構成を変える**タスク。

## 使うスキル・ドキュメント（順序どおり）

1. **`meta`スキル** — 最初に読む。`docs/repo-wide/*.md`の一覧から、そのタスクが触る規約ドキュメントへ振り分ける。下の表が主な行き先。
2. **既存CLIへの追加・変更なら`changing-skills-and-tools`** — `skill-tool-impact`で下流スキル・ツールを列挙してから着手する。新規作成だけなら不要。
3. **`test-driven-development`** — CLIの振る舞い（サブコマンド・出力契約・終了コード）を足すときの既定。ログ上、実装タスクの大半でこれが選ばれていなかったので明示する。
4. 実装する。
5. **登録・後片付け** — `repo-tools.yaml`（登録要否は下表）、`pyproject.toml`のworkspace members（Pythonパッケージの場合）、`--version`実装、tools-site掲載（`release: true`のとき）。
6. **併設スキルを作るか判断する** — `tool-companion-skills`。作ると決めたら[skill-authoring](skill-authoring.md)パターンへ接続する。

## 触る対象ごとの行き先

| 触る対象・判断                                                      | 参照先                                                               |
| ------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 新しいCLIをどこに置くか、自前サブフォルダ/パッケージの要否          | `docs/repo-wide/tools-directory-layout.md`                           |
| Pythonパッケージ化・`uv sync`がパッケージを見つけない               | `docs/repo-wide/uv-workspace.md`                                     |
| 環境変数・設定ファイル・`.env`の優先順位、版数SSOT、`--version`規約 | `docs/repo-wide/tool-conventions.md`                                 |
| `repo-tools.yaml`への登録、ツール間依存、自動patchバンプ            | `docs/repo-wide/repo-tools-config.md`                                |
| justfileレシピの追加、lefthookへの接続                              | `docs/repo-wide/justfile-conventions.md` / `lefthook-automation.md`  |
| 使い方スキルを併設するか、`skill-tools --fb` によるFB蓄積           | `docs/repo-wide/tool-companion-skills.md`                            |
| 変更が下流のどのスキル・ツールに波及するか                          | `changing-skills-and-tools`スキル（正本は`skill-tool-relations.md`） |

## スキルの場所

| スキル                      | パス                                                               |
| --------------------------- | ------------------------------------------------------------------ |
| `meta`                      | `meta-plugins/skills/meta/SKILL.md`                                   |
| `changing-skills-and-tools` | `meta-plugins/skills/changing-skills-and-tools/SKILL.md`              |
| `test-driven-development`   | `claude-plugins/subagents/skills/test-driven-development/SKILL.md` |

## この流れで足りないとき

- CLIが外部API・外部ライブラリを叩く場合、その仕様調査は[external-doc-research](external-doc-research.md)を併用する。
- 併設スキルまで作るなら[skill-authoring](skill-authoring.md)を併用する。
- 同じ機能を他AIツール向けにも展開するなら[cross-tool-porting](cross-tool-porting.md)を併用する。
