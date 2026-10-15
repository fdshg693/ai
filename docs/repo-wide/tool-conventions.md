---
type: Repo Convention
title: ツールの版数・`--version`・環境変数規約
description: "Explains this repository's shared rules for first-class CLI tools and scripts: process environment variables always win; installable CLIs with path or per-project settings use layered TOML config (nearest project file up to the git root, then a global user config) instead of .env, with relative paths resolved against the defining project file, otherwise the git root; other scripts keep a fixed-path .env; missing required keys must fail with diagnostics listing every place looked; each tool's package manifest is the version SSOT, repo-tools.yaml registered tools auto-bump patch versions on change, and every public CLI entrypoint must support --version with one-line output and no side effects."
tags: [tools, repo-wide]
generated: { by: reference_agent/cursor-grok-4.6, at: 2026-09-15T11:00:00Z }
status: stable
---

# ツールの版数・`--version`・設定読み込み規約

このリポジトリのCLI・スクリプト・スキル同梱スクリプトが従う共通ルール。対象は主に`tools/`配下の first-class CLI と、その周辺スクリプトである。設定（環境変数・設定ファイル・`.env`）の読み込み規約、版数のSSOT、`--version`の公開契約、`repo-tools.yaml`登録ツールの自動patchバンプをここにまとめる。個別ツールのREADMEや実装が食い違うときは、このドキュメントを優先する。

## 対象

- `repo-tools.yaml` に登録された first-class CLI
- それらが公開するコンソールエントリポイント（Pythonの`[project.scripts]`、Nodeの`package.json.bin`）
- `tools/`配下のその他のスクリプトや、スキル同梱スクリプトのうち、環境変数・設定ファイル・`.env`を読むもの

`repo-tools.yaml` 未登録の内部・実験スクリプトは、必ずしも自動バンプや`--version`契約の対象ではない。ただし first-class CLI として育てるなら、最初からこの規約に揃える。

## 規則

1. **プロセス環境変数が最優先。** すでに環境変数が存在する（空文字を含む）なら、設定ファイルや`.env`の同名設定で上書きしない。
2. **インストールして使うCLIで、パスやプロジェクトごとの設定を持つものは、`.env`ではなくレイヤー設定（TOML）を使う。** 環境変数 → 最寄りのプロジェクト設定（CWDからgitルートまで遡る）→ グローバル設定 → 既定値、の順に解決する。
3. **それ以外（秘密情報だけを読むスクリプト、スキル同梱スクリプト、インストールしないスクリプト）は、固定パスの`.env`を1箇所だけ見る。** CWD基準の`.env`探索や親ディレクトリ遡上はしない。
4. **相対パスの基準を固定する。** プロジェクト設定に書かれた相対パスはそのファイルのディレクトリ基準、それ以外（グローバル設定・環境変数・既定値）の相対パスはgitルート基準（git管理外ならCWD）。ツールのインストール先を基準にしない。
5. **必須キー欠落時は直し方が分かるエラーで止める。** 探した場所（環境変数・設定ファイルの絶対パス）と、それぞれが空だった理由を必ず出す。
6. **版数のSSOTは各ツールのマニフェスト。** Pythonは`pyproject.toml`の`[project].version`、Nodeは`package.json`の`version`を使い、`repo-tools.yaml`へ重複させない。
7. **公開CLIはすべて`--version`に対応する。** 標準出力1行で`<command> <manifest-version>`を返し、終了コード0で終え、環境変数・設定ファイル・`.env`・API・通常引数・永続副作用を要求しない。
8. **`repo-tools.yaml`登録ツールは、フォルダ変更時にpre-commitがpatchを自動バンプする。** ただし、すでに手動でversionを変更しているコミットでは追加バンプしない。

これらを満たせば、同じコマンドをどのCWDから叩いても設定の解決結果が予測でき、版数の正本がぶれず、CLI契約も統一される。

## 設定の置き場所の選び方

| ツールの種類                                                                                                           | 方式                                                                                                     | 理由                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| インストールして使うCLI（`uv tool install` / `pnpm add -g`）で、出力先などのパスやプロジェクトごとに変えたい設定を持つ | レイヤー設定（下記「レイヤー設定」節）                                                                   | ツール隣の`.env`は「インストール先＝ソースツリー」という前提でしか動かず、CWDごとの設定もできない |
| インストールして使うCLIで、APIキーなど秘密情報だけを読む                                                               | 新規はレイヤー設定のグローバル設定＋環境変数を推奨。既存の固定パス`.env`は、次に手を入れるときに移行する | 非editableインストールではインストール先に`.env`を置けない                                        |
| スキル同梱スクリプト、インストールしないスクリプト                                                                     | 固定パスの`.env`（下記「固定パスの`.env`」節）                                                           | スクリプトの位置が常に分かり、設定は秘密情報だけで足りる                                          |

参照実装は`tools/tav-cli/tav_core/environment.py`（レイヤー設定）と`tools/aim/aim_cli.py`（固定パス`.env`）。

## レイヤー設定（インストールするCLI）

### 解決順

上ほど優先。値が見つかった層より下は見ない。キー単位で判定する。

| 優先 | ソース           | 場所                                                                                                       |
| ---- | ---------------- | ---------------------------------------------------------------------------------------------------------- |
| 1    | プロセス環境変数 | `<TOOL>_*`など、ツールが決めた名前。空文字でも「設定済み」                                                 |
| 2    | プロジェクト設定 | CWDからgitルートまで（両端を含む）遡って見つかる`.<tool>.toml`。近いものが勝つ。git管理外ではCWDだけを見る |
| 3    | グローバル設定   | `$<TOOL>_CONFIG_HOME/config.toml` → `$XDG_CONFIG_HOME/<tool>/config.toml` → `~/.config/<tool>/config.toml` |
| 4    | 既定値           | コード内の定数                                                                                             |

- gitルートは、CWDから親へ`.git`（ディレクトリ、またはworktreeの場合はファイル）を探して決める。`git`コマンドは呼ばない。
- グローバル設定はOSを問わず`~/.config/<tool>/`に揃える（Windowsでも`%USERPROFILE%\.config\<tool>\`）。テストやCIのために`<TOOL>_CONFIG_HOME`で差し替えられるようにする。
- 汎用の`.env`は読まない。他アプリ向けの`.env`を誤って取り込むことや、秘密情報が混ざることを防ぐため、ツール専用のファイル名にする。

### パスの解決

- **プロジェクト設定**に書かれた相対パスは、**そのファイルがあるディレクトリ**を基準に解決する（git configやmiseと同じ考え方）。
- それ以外（**グローバル設定**・環境変数・既定値）から来た相対パスは、**CWDのgitルート**を基準に解決する。グローバル設定はリポジトリをまたいで使う既定値なので、`~/.config/<tool>/`基準にはしない。git管理外ならCWD基準。これでリポジトリのどのサブディレクトリから叩いても、出力が`<repo>/...`に集まる。
- 絶対パスと`~`はそのまま使う。
- ツールのインストール先（`__file__`の位置）を、ユーザーデータや出力先の基準にしない。

### 秘密情報

- APIキーなどの秘密情報は、環境変数かグローバル設定だけから読む。
- プロジェクト設定はコミットされうるので、秘密情報のキーがあればエラーで止める（黙って無視しない）。

### 検証と可視化

- 未知のキーや型違いは、設定ファイルの絶対パス付きのエラーで止める。打ち間違いを黙って無視しない。
- `<tool> config`のようなサブコマンドで、CWD・gitルート・読み込んだファイル（優先順）・各設定値とその出どころを表示する。秘密情報の値は出さず、有無だけを出す。
- 監査ログを残すツールは、読み込んだ設定ファイルと各設定の出どころをログに記録する。

### 実装の目安

- Pythonは標準ライブラリの`tomllib`（3.11+）で読む。`python-dotenv`は不要。
- 読み込みは1モジュール（慣例名`environment.py`）に集め、各設定は`resolve_setting(key)`のような1関数で「値・出どころ・相対パスの基準ディレクトリ」を返す。
- 環境変数の真偽値は、`false`/`0`/`no`/`off`/空（大文字小文字無視）を偽、それ以外を真として読む。TOML側は真偽値型で書かせる。
- リポジトリには`config.example.toml`のような記入例をコミットし、READMEに解決順・キー一覧・パスの基準を書く。

## 固定パスの`.env`（それ以外のスクリプト）

### パスの決め方

`__file__`（Python）または`import.meta.url`（Node）からツール／スクリプトの位置を解決する。`os.getcwd()`や`find_dotenv(usecwd=True)`は使わない。

```python
from pathlib import Path
from dotenv import load_dotenv

# 単一モジュールCLI / スキル同梱スクリプト: エントリポイントと同階層
# 例: tools/aim/aim_cli.py -> tools/aim/.env
#     skills/.../extract_page.py -> そのスクリプト隣の.env
ENV_PATH = Path(__file__).resolve().parent / ".env"

# パッケージ化したツール: ツールディレクトリ直下
# 例: tools/issue-agent/issue_agent/environment.py -> tools/issue-agent/.env
# ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
```

Nodeも同じ。エントリが`src/cli.mjs`ならツール直下は`path.resolve(scriptDir, "..", ".env")`。

複数ファイルが同じ設定を読むなら、読み込みを1関数（慣例名`load_environment()`）に集め、各`main()`の先頭で一度だけ呼ぶ。

### 読み込み方

- 既存キーを消さない。`python-dotenv`なら`load_dotenv(ENV_PATH, override=False)`。自前パーサでも同じ。
- `.env`が無くても、必要なキーがプロセス環境にあれば成功とする。
- 空のプロセス環境変数を`.env`で埋めてはならない。その場合は「環境変数`KEY`は空で設定されている」と書いて止める。
- 探索のフォールバック（cwd → 親 → ライブラリ既定のような多段）を足さない。多段にしたくなったら、それはレイヤー設定へ移行する合図である。

Python以外（`process.loadEnvFile`、自前のKEY=VALUEパーサ等）でも、上書きしないこと・固定パス・失敗時の診断は同じ。

### `.env.example`と文書

- コミットするのは`.env.example`だけ。実体の`.env`はコミットしない。
- `.env.example`は、実際に読む`.env`と同じ階層に置く。
- READMEには「必須キー/任意キー」と「`.env`の置き場所」を書く。cwdやリポジトリルートを案内しない。

## 必須キーが無いときのエラー

必須キーを読んだ結果が空なら、終了コード非0（または例外）で止める。メッセージには次を**すべて**含める。

| 含める情報                           | 例                                                               |
| ------------------------------------ | ---------------------------------------------------------------- |
| 足りないキー名                       | `OPENROUTER_API_KEY`                                             |
| プロセス環境の状態                   | 未設定 / 空で設定されている                                      |
| 探した設定ファイル・`.env`の絶対パス | `C:\Users\me\.config\tav\config.toml` / `C:\C\ai\tools\aim\.env` |
| そのファイルの状態                   | ファイルが無い / あるがキーが無い / あるがキーが空               |
| （レイヤー設定）読まない場所の注記   | プロジェクト設定からは`api_key`を読まない                        |

固定パス`.env`の例:

```text
OPENROUTER_API_KEY が解決できません。
環境変数 OPENROUTER_API_KEY は未設定です。
想定した .env は C:\C\ai\tools\aim\.env ですが、ファイルがありません。
```

レイヤー設定の例:

```text
TAVILY_API_KEY が解決できません。
環境変数 TAVILY_API_KEY は未設定です。
グローバル設定 C:\Users\me\.config\tav\config.toml がありません。
(プロジェクト設定 .tav.toml からは api_key を読みません)
```

公開HTTPエンドポイントだけは例外で、診断はサーバーログに留め、クライアント応答へパスを載せない。

## やってはいけないこと

- `find_dotenv(filename=".env", usecwd=True)`や、cwdから親へ`.env`を辿る処理（遡上が要るならレイヤー設定のTOMLで行う）
- `load_dotenv(..., override=True)`、または既存キーを上書きする自前実装
- リポジトリルートの`.env`を全ツール共通の探索先にすること
- グローバルインストール先の隣を「ツール直下」とみなして、そこにユーザーの秘密や設定を期待すること
- インストールするCLIで、出力先などの相対パスをCWDやインストール先を基準に黙って解決すること
- プロジェクト設定（コミットされうるファイル）から秘密情報を読むこと

## この規則の外にあるもの

- CLIフラグ（例: `--token`）は、そのツールが明示したときだけ環境変数より上でよい
- GitHub Actionsシークレット、Azure Application settings、Docker `environment:` のようなホスト注入値は、すでにプロセス環境にある値として最優先になる
- `mise` の`[env]`や`_.file`は、シェル起動時にプロセス環境へ載せる仕組みであり、ツール内部の設定探索を置き換えるものではない
- `skills-site/.env`のようなホスト常駐プロセス都合の例外は、その専用README/コード側で明示する

## 版数のSSOT

### どこに置くか

- **Pythonツール**: `tools/<name>/pyproject.toml` の `project.version`
- **Nodeツール**: `tools/<name>/package.json` の `version`

`repo-tools.yaml`はツール登録・依存関係・Release対象のSSOTであり、版数は持たない。版数を別のYAMLやREADMEへ複写しない。

同じく、ツール概要のSSOTは各ツールのマニフェスト`description`（Pythonは`pyproject.toml`の`[project].description`、Nodeは`package.json`の`description`）とし、それが無い場合はそのツールのREADME先頭見出しを使う。`repo-tools.yaml`には概要の取得元locator（`description`）だけを書き、概要本文を複写しない。

各`repo-tools.yaml`登録ツールは、ちょうど1つの版数付きマニフェストを持つこと。`pyproject.toml`と`package.json`の両方で同じCLIの版数を持たない。新しいfirst-class CLIを追加するときは、初期版数（通常は`0.1.0`または`1.0.0`）を最初から入れる。

### `release: true`との違い

`repo-tools.yaml`の`release: true`は、「mainへのpush時に`.github/workflows/tool-release.yml`がタグ+GitHub Releaseを作る対象」を表す。版数の存在や、自動patchバンプの対象かどうかとは別軸である。`release: false`でも first-class CLI なら版数を持ち、変更時に自動patchバンプされる。

## `--version` 契約

### 対象

- Pythonの`[project.scripts]`で公開しているすべてのコマンド
- Nodeの`package.json.bin`で公開しているすべてのコマンド

1ツールが複数コマンドを公開している場合は、各コマンドがそれぞれ同じマニフェスト版数を返す。

### 挙動

`--version`単独で実行したとき、次を満たす。

- 標準出力に **ちょうど1行**、`<command> <manifest-version>` を出す
- 終了コード0
- 標準エラーへ補足を出さない
- 設定ファイル・`.env` の読み込み、APIクライアント生成、ネットワークアクセス、通常コマンドの必須引数チェック、ログ書き込み、ファイル生成をしない

`-v`のような短縮形は、既存互換のために残してよいが、この契約の必須対象ではない。

### 実装の目安

- `argparse`系: `parser.add_argument("--version", action="version", version="...")`
- Typerや独自パーサ: `main()` 冒頭で `sys.argv[1:] == ["--version"]` を早期分岐
- Node: `.env`や設定のロード前に `process.argv.slice(2)` を見て早期分岐

マニフェスト値をハードコードしない。常に、そのツール自身の`pyproject.toml`または`package.json`から読む。

## `repo-tools.yaml`登録ツールの自動patchバンプ

`lefthook.yml`のpre-commitジョブ`bump registered tool manifest version`が、`repo-tools.yaml`登録ツールのフォルダ変更を検知してpatch版数を自動で1つ上げる。実体は次のレシピ/スクリプト。

```text
just --justfile tools/internal/justfile tool-version-bump
tools/internal/release/bump_tool_versions.py
```

### ルール

- 判定はフォルダ単位。`tools/<name>/README.md`だけの変更でも、そのツールのpatchは上がる
- ただし **すでにHEADと異なるversionが入っている** 場合は、自動バンプしない。手動minor/majorや、同コミットで明示したversion変更を尊重する
- 新しいマニフェストを追加したコミットや、初めて`version`を入れたコミットでも、初期versionだけで止める
- 再ステージは`stage_fixed`任せではなく、スクリプトが更新したマニフェストを`git add`する

### PythonとNodeの違い

- Python: `uv version --bump patch --frozen`
- Node: `pnpm version patch --no-git-tag-version --no-git-checks`

どちらもマニフェストのversionだけを上げ、Git tagや追加コミットは作らない。

### 新しいツールを追加するとき

1. ツールディレクトリを作る
2. 版数付きマニフェストを1つ置く
3. 公開コマンドに`--version`を実装する
4. `repo-tools.yaml`へ登録する
5. 必要なら`release: true`を付ける

手順4を忘れると、自動patchバンプの対象にも、スキル依存の参照対象にもならない。

## 検査

`.env`探索の禁止パターン（`find_dotenv`・`usecwd=True`・パス無し`load_dotenv()`）は次で検査する。

```text
just --justfile tools/internal/justfile tool-env-loading-check
```

登録CLIの`--version`契約と、登録ツールの自動patchバンプはテストで確認する。

```text
uv run pytest tools/internal/tests/test_bump_tool_versions.py
uv run pytest tools/internal/tests/test_registered_cli_versions.py
```

## 関連

- [repo-tools-config](/repo-wide/repo-tools-config.md) — `repo-tools.yaml` 登録と自動patchバンプ
- [tools-directory-layout](/repo-wide/tools-directory-layout.md) — `tools/`配下の置き方とCLI化
- [tool-companion-skills](/repo-wide/tool-companion-skills.md) — コンパニオンスキルと `skill-tools --fb`
- [uv-workspace](/repo-wide/uv-workspace.md) — Pythonツールのworkspace管理
- [lefthook-automation](/repo-wide/lefthook-automation.md) — pre-commitへ寄せる方針

## このドキュメントの位置づけ

`meta-plugins/`はこのリポジトリ自身のメンテナンス用であり、ユーザー向けプラグインではない。既存方針に従い、この内容を`ai-tools.yaml`へ登録しないこと。詳細は[ai-tools-config](/repo-wide/ai-tools-config.md)参照。
