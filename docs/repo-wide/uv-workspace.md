---
type: Repo Convention
title: uvワークスペースによるPythonライブラリ管理
description: Explains how this repository manages its scattered Python packages (under tools/, tools/aim-use/, tools/skill-tools, claude-plugins/*/skills/) as one uv virtual workspace defined by the root pyproject.toml, including global CLI installs vs the shared dev venv. Use when adding a new Python package to the repo, wondering why `uv sync`/`uv run pytest` don't see a package, or deciding whether a directory needs its own pyproject.toml at all.
tags: [tools, repo-wide]
generated: { by: reference_agent/cline-glm-5.2, at: 2026-08-09T14:39:30Z }
status: stable
---

# uvワークスペースによるPythonライブラリ管理

このリポジトリ直下の[`pyproject.toml`](../../pyproject.toml)は`[project]`テーブルを持たない**仮想ワークスペースルート**であり、`tools/`配下や`claude-plugins/*/skills/`配下に散らばった複数のPythonパッケージを`[tool.uv.workspace]`の`members`一覧でまとめて管理する。このリポジトリ自体を1個のパッケージとして配布する意図はない。

## 2つの利用モード

同じパッケージが、独立した2つの方法で使われる。

1. **グローバルCLIとしてのインストール**（`pip install -e`の代替）

   ```bash
   uv tool install --editable tools/<name>
   ```

   パッケージ専用の隔離環境を作り、`[project.scripts]`のコンソールスクリプトをPATH上に公開する。`members`への登録は不要でもこの方法単体では動く。

2. **共有devvenvでの横断実行**

   ```bash
   uv sync && uv run pytest
   ```

   ワークスペース内の全メンバーを1つの共有`.venv`にまとめてインストールする。`just py-check`（ルートjustfile）やリポジトリ横断のテスト実行はこちらに依存する。

新しいパッケージは(1)だけ動作確認して満足せず、**必ず(2)のために`members`一覧へ明示的に追記する**。`ai-tools.yaml`と同様、`rglob`等の自動検出ではなく人が編集するリストに明示列挙する方針（[repo-ssot-pattern](/repo-wide/repo-ssot-pattern.md)参照）のため、追記漏れは検出されない。

## メンバーの対象は`tools/`だけではない

現在のメンバーは`tools/aim`、`tools/aim-use/aim-summarize`、`tools/tav-cli`、`tools/skill-tools`（`skill-tools`パッケージ）等の`tools/`配下に加え、`claude-plugins/meta/skills/writing-skill-web`（同梱スクリプトが本格的な依存を持つスキル）も含む。「独自の`pyproject.toml`を持ち、単発スクリプト以上の実体を持つディレクトリ」であれば`tools/`外でもメンバー候補になる。

## pytestの`--import-mode=importlib`

ルート`pyproject.toml`の`[tool.pytest.ini_options]`で`--import-mode=importlib`を指定している。各メンバーが`__init__.py`なしの独自`tests/`を持つため、同名のテストファイル（例: `tests/test_config.py`）が複数メンバーに存在すると、デフォルトのprependモードでは`sys.modules`上で衝突する。新しいメンバーを追加する際もこの制約を崩さないよう、`tests/`に`__init__.py`を足さない。

## フォーマット・リント

ruff（format中心、限定的なlint）の設定はルート`pyproject.toml`の`[tool.ruff]`一箇所のみ（`target-version = "py313"`, `line-length = 100`, `quote-style = "double"`）。全メンバーに一括適用され、`just py-format` / `just py-check`（ルートjustfile、詳細は[justfile-conventions](/repo-wide/justfile-conventions.md)）で手動実行できるほか、コミット時は`lefthook.yml`の「format Python with ruff」ジョブがステージ済みファイルを自動整形する（[lefthook-automation](/repo-wide/lefthook-automation.md)参照）。

## 落とし穴

- 新規`tools/<name>/pyproject.toml`を作っただけで`pyproject.toml`の`members`に追記し忘れると、`uv sync`/`uv run pytest`はそのパッケージを無視する。`uv tool install --editable`によるグローバルインストールは独立して動いてしまうため、追記漏れに気づきにくい。
- 複数メンバーが同名のトップレベルモジュール/パッケージを公開すると、共有devvenvでは1つの環境に相乗りするため衝突する。

## 関連

- [tools-directory-layout](/repo-wide/tools-directory-layout.md) — `tools/`配下のディレクトリ構成規約（このドキュメントはパッケージ管理側、あちらは配置・CLI化側）
- [tool-companion-skills](/repo-wide/tool-companion-skills.md) — CLI化したツールに使い方スキルを併設する方針

## このドキュメントの位置づけ

`meta-plugins/`はこのリポジトリ自身のメンテナンス用であり、ユーザー向けプラグインではない。既存方針に従い、この内容を`ai-tools.yaml`へ登録しないこと。詳細は[ai-tools-config](/repo-wide/ai-tools-config.md)参照。
