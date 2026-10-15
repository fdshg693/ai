---
type: Repo Convention
title: justfileの書き方規約
description: "Explains how justfiles are structured across this repo (root + per-tool, each with `set windows-shell`, a `default` recipe that runs `@just --list`, and a leading cwd comment) and the convention of routing recipes through mise-managed tool versions so they resolve identically regardless of which shell/GUI process launched them. Use when adding or editing a justfile recipe, deciding whether a new justfile is warranted, or a recipe behaves differently across shells/terminals."
tags: [repo-wide]
generated: { by: reference_agent/cline-glm-5.2, at: 2026-08-09T14:39:30Z }
status: stable
---

# justfileの書き方規約

このリポジトリには複数の`justfile`が共存する。ルート[`justfile`](../../justfile)（`py-format`/`py-lint`/`skills-site-*`/Azureインフラ、フックの自己インストール`hooks-install`/`hooks-update`等リポジトリ横断のもの）、[`tools/internal/justfile`](../../tools/internal/justfile)（このリポジトリ自身のメタ生成、[ai-tools-config](/repo-wide/ai-tools-config.md)参照）、そして`docs/integrations/justfile`・`tools/my-agents/justfile`・`agent-tooling/justfile`・`skills-site/justfile`のような、そのディレクトリの関心事に閉じた小さなものに分かれる。

## 共通の型

新しい`justfile`・レシピを追加する際は、既存のものと同じ型に揃える。

- 先頭に`set windows-shell := ["powershell.exe", "-NoLogo", "-NoProfile", "-Command"]`（このリポジトリはWindows前提）
- `default:` レシピで`@just --list`を呼び、引数なし`just`実行時に一覧が出るようにする
- レシピが前提とするcwdがそのjustfile自身の置き場所と異なる場合、レシピごとに繰り返さず、ファイル冒頭に一言でまとめる（例: `# Recipes run with this directory (docs/integrations) as cwd, so paths below are relative to it.`）
- 別ディレクトリのレシピを呼ぶ場合は`cd`ではなく`just --justfile <path>/justfile <recipe>`を使う（`lefthook.yml`がルートから`tools/internal/justfile`のレシピを呼ぶ例を参照）
- justfile自身の置き場所を起点にした絶対パスが欲しい場合は`justfile_directory()`を使う（`tools/my-agents/justfile`の`tools-yaml`レシピが、呼び出し時のcwdに依らず常に`tools/my-agents/tools/tools.yaml`へ出力する例）

## mise経由での実行

このリポジトリのツールバージョン（node/pnpm/terraform/uv）は[`mise.toml`](../../mise.toml)でpinされている。環境変数・ツール解決がシェルの起動経路に依存して届かない事例は実際に起きている（PowerShellの`$PROFILE`にだけ追記した環境変数が、GUIから直接起動したVSCode配下のプロセスには一切渡らなかった、というOTel計装のインシデント）。justfileのレシピも同様に、Claude CodeのBashツール（Git Bash経由）・PowerShellツール・素のターミナル・CI等、起動経路によって呼び出し元シェルの初期化状態が異なりうる。

mise管理下のツールバージョン・環境を確実に解決させたいレシピは、呼び出し元シェルがmiseのshimを読み込み済みであることに頼らず、`mise exec --`を挟んで実行する（例: `mise exec -- uv run ...`）方針を今後の追加・変更で優先する。**現時点でこのリポジトリの既存justfileはこれを一貫して適用できていない**ため、あるレシピに`mise exec`が付いていないことをもって「不要」と判断しないこと。新規・改修のレシピから順に適用していく。

## 関連

- [ai-tools-config](/repo-wide/ai-tools-config.md) — `tools/internal/justfile`の各レシピが何を再生成するか
- [lefthook-automation](/repo-wide/lefthook-automation.md) — justfileレシピをコミット時に自動実行させる仕組み
- [skill-tool-relations](/repo-wide/skill-tool-relations.md) — 変更時の影響範囲列挙は`just --justfile tools/internal/justfile skill-tool-impact`（lefthookには繋がない）
- [tools-directory-layout](/repo-wide/tools-directory-layout.md) — ツールのインストールコマンドをjustfileレシピとして揃える規約

## このドキュメントの位置づけ

`meta-plugins/`はこのリポジトリ自身のメンテナンス用であり、ユーザー向けプラグインではない。既存方針に従い、この内容を`ai-tools.yaml`へ登録しないこと。詳細は[ai-tools-config](/repo-wide/ai-tools-config.md)参照。
