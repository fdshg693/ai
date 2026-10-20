---
type: Setup Guide
title: このリポジトリのCLIツールのインストール方法
description: Explains how to install this repository's own CLI tools (aim, tav-cli, skill-tools, textgraph, ona-run, agents-rules) via docs/integrations/justfile's *-local (editable, for a cloned checkout) and *-git (uv tool install from a git URL, no clone needed) recipe pairs, plus how release:true packages are pinned with a git tag. Use when a skill or script fails because a prerequisite CLI isn't installed, or when deciding whether to install editable-local vs git-remote vs a pinned tag.
tags: [tools]
generated: { by: reference_agent/claude-sonnet-5, at: 2026-08-09T15:58:38Z }
status: stable
---

# CLI ツールインストール

幾つかのスキルやスクリプトで前提となっている、CLIツールのインストール方法を記載する。インストールコマンドの正本は同階層の `justfile` で、リポジトリルートからは `just -f docs/integrations/justfile <recipe>` で実行する。

`skill-tools` の本体は [tools/skill-tools/](../../tools/skill-tools/) にある。ここには導入レシピだけを書き、コマンドの詳細はそちらの README に任せる。

インストールコマンドは `docs\integrations\justfile` を参照。各ツールとも次の2通りのインストール方法を用意している。

- **local**（`*-local` レシピ）: リポジトリを clone 済みの開発者向け。エディタブルインストール（`uv tool install --editable`、`pip install -e` の代替）なので、ソースを編集すれば即座に反映される。
- **git**（`*-git` レシピ）: リポジトリを clone せずに手軽に入れたい場合向け。`uv tool install "git+<repo_url>#subdirectory=..."` でGitHub上のソースを直接インストールする。エディタブルではないため、更新を取り込むには同じコマンドを再実行する。`docs\integrations\justfile` 内の `repo_url` を実際のリポジトリURLに置き換えてから使うこと。

## 1. aim CLI

- `tools\aim\README.md` を参照。
- インストール: リポジトリルートから `just -f docs/integrations/justfile aim-local`（clone済み）または `just -f docs/integrations/justfile aim-git`（clone不要）

## 2. tav-cli

- `tools\tav-cli\README.md` を参照。Tavily SDK を利用する検索・抽出・サイトマップ・クロール・Research 用の `tav` CLI ラッパーです。
- インストール: リポジトリルートから `just -f docs/integrations/justfile tavily-local`（clone済み）または `just -f docs/integrations/justfile tavily-git`（clone不要）
- 実行前に `tools\tav-cli\.env` へ `TAVILY_API_KEY` を設定するか、環境変数に設定してください。

インストール後は、例えば次のように実行します。

```bash
tav search "Microsoft Fabric overview" --topic msfabric_overview
```

## 3. skill-tools

`skill-tools` は、`ai-tools.yaml` に登録された plugin / workspace root の `SKILL.md` bundle の一覧・配置・検索をまとめて扱う CLI です。`meta-plugins/` のような未登録領域は対象外です。

- 詳細なコマンド・設定形式・安全性は [tools/skill-tools/README.md](../../tools/skill-tools/README.md) を参照。
- インストール: リポジトリルートから `just -f docs/integrations/justfile skill-tools-local`（clone済み）または `just -f docs/integrations/justfile skill-tools-git`（clone不要）。
- インストールレシピは `skill-tools config init` も実行し、グローバル設定ファイルを作成する。対象プロジェクトの `skill-tools.yaml` はグローバル設定への差分として source / index / destination を上書きできる。
- `skill-tools list-skills` で source path（local なら絶対パス、GitHub なら blob URL）を確認して、`skill-tools install-skills <source path または一意な名前>` で導入する。`skill-tools install-skills self` は skill-tools 自身のコンパニオンスキル（`self_skill` 設定、既定は `skill-tools-cli`）を入れる。
- 既定では `.claude/skills/<skill-name>/` に展開する。`skill-tools.yaml` にリポジトリ相対 canonical ID ごとの `destination` を指定すれば `.agents/skills/` や `Docs/` などへ変更できる。
- ローカル source の `install-skills` はスキル同梱の生成物（`.venv`、`__pycache__`、`node_modules` 等）を同梱しない。除外/包含は source の `tools/skill-tools/.gitignore` と `tools/skill-tools/.skill-tools` の `include:` で決まり、`.env` は既定除外（コピーさせたい場合だけ利用者が追記する）。優先順位は [tools/skill-tools/README.md](../../tools/skill-tools/README.md) の「バンドルコピーの除外/包含ポリシー」を参照。
- `skill-tools build-index` は CLI 専用のグローバルキャッシュを作成し、`skill-tools search --query "<検索語>"` は CWD に依存せずその snapshot を検索する。GitHub source は build 時に解決済み commit SHA へ固定する。
- インデックスは既定で7日間キャッシュされ、その間の `build-index` は再生成せずスキップする。強制的に作り直すなら `skill-tools build-index --force`（日数を変えるなら `--max-age-days N`、`0` は常に再生成）。再生成時も `name` / `description` が変わっていないスキルは前回のベクトルを再利用し、`embedded: N, reused: M` として件数が出る。
- `search` は fingerprint 不一致やインデックスの古さでは失敗せず、stderr の警告にとどめる。別 source のインデックス・未作成・APIキー未設定は従来どおり非ゼロ終了。
- APIキーはプロセス環境変数を優先し、ソース checkout から実行する場合は `tools/skill-tools/.env` に `OPENROUTER_API_KEY` を置けます。`skills-site/.env` は参照しません。
- 新規に追加した skill が AI ツールに表示されない場合は、セッションまたは IDE を再起動する。

## 4. textgraph

テキストファイルのローカルリンクを索引し、参照関係（inbound / outbound）とリンク切れを返す CLI。API キーは不要。

- 詳細は [tools/textgraph/README.md](../../tools/textgraph/README.md) を参照。
- インストール: リポジトリルートから `just -f docs/integrations/justfile textgraph-local`（clone済み）または `just -f docs/integrations/justfile textgraph-git`（clone不要）。

## 5. ona-run

- `tools\ona-run\README.md` を参照。前提として `ona` CLI へのログインが必要。
- インストール: リポジトリルートから `just -f docs/integrations/justfile ona-run-local`（clone済み。git レシピは無い）。

## 6. agents-rules

- [tools/agents-rules/README.md](../../tools/agents-rules/README.md) を参照。
- インストール: リポジトリルートから `just -f docs/integrations/justfile agents-rules-local`（clone済み）または `just -f docs/integrations/justfile agents-rules-git`（clone不要）。

## 7. Cline プラグイン

`cline-personal-info` は Cline 向けプラグインの導入で、CLI の `uv tool install` とは別手順。詳細と Windows での既知の不具合は [cline](cline.md) を参照。リポジトリルートから `just -f docs/integrations/justfile cline-personal-info`。

## タグ+Releaseによるバージョン管理

対象パッケージについて、`.github/workflows/tool-release.yml` が main ブランチへの push をトリガーに、パッケージごとの git タグと GitHub Release を自動発行する。スケジュール実行ではなく「`pyproject.toml` のバージョンが上がった」ときだけ発行される（対象タグが既に存在する場合はサイレントにスキップ）。

- タグ命名規則: `<pyprojectのnameフィールド>-v<version>`（例: `aim-cli-v0.1.0`）
- 対象パッケージの正本は `repo-tools.yaml` の `release: true` なエントリ（`tool-release.yml` の `discover` ジョブが動的に読む。詳細は [repo-tools-config](../repo-wide/repo-tools-config.md) 参照）。以下の表は現状把握用の参考情報（8つ。ワークスペース内の兄弟パッケージに依存しないもののみ）

  | パッケージ名   | ディレクトリ      |
  | -------------- | ----------------- |
  | `aim-cli`      | `tools/aim`       |
  | `grepapp-cli`  | `tools/grepapp`   |
  | `tav-cli`      | `tools/tav-cli`   |
  | `mslearn-cli`  | `tools/mslearn`   |
  | `awsdocs-cli`  | `tools/awsdocs`   |
  | `gdevdocs-cli` | `tools/gdevdocs`  |
  | `ctx7-cli`     | `tools/ctx7`      |
  | `textgraph`    | `tools/textgraph` |

- `aim-summarize` / `my-agents` は対象外。`[tool.uv.sources]` で workspace 内の兄弟パッケージ（`aim-cli`・`mslearn-cli`・`tav-cli`）を参照しているが、この解決は `uv build` が生成する wheel には反映されず、workspace 外で単体インストールすると壊れるため。`my-agents` は依存パッケージ名（`mslearn-cli`・`tav-cli`）が PyPI 上に存在せず素直にインストールエラーになるが、`aim-summarize` は依存名 `aim-cli` が PyPI 上の無関係な別パッケージ（[Aim](https://aimstack.io/) という MLOps 向け実験管理ツール）に静かに誤解決されてしまい、インストール自体はエラーなく完了した上で実行時に `ModuleNotFoundError` で壊れる（dependency confusion）。このため `justfile` にもこの2パッケージ向けの `-git` レシピは意図的に追加していない。

- ピン留めインストール（対象8パッケージのみ）:

  ```bash
  uv tool install "git+https://github.com/fdshg693/AI.git@<tag>#subdirectory=tools/<dir>"
  # 例
  uv tool install "git+https://github.com/fdshg693/AI.git@aim-cli-v0.1.0#subdirectory=tools/aim"
  ```

  `tools/<dir>` は上表の「ディレクトリ」列を使う。`justfile` の `*-git` レシピ（常に最新mainを追う）と異なり、`@<tag>` を固定することで特定バージョンにピン留めできる。

## 関連

- [claude-code](claude-code.md) — `my-tools` プラグインなど、ここでインストールしたCLIを前提にするAIツール側の導入手順
