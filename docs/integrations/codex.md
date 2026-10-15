---
type: AI Tool
title: Codex プラグインのインストール
description: Explains how to install this repository's codex-plugins/meta plugin via the .agents/plugins/marketplace.json local marketplace (seiwan-codex-marketplace) — from the ChatGPT desktop app, or from Codex CLI with or without cloning (including sparse checkout), plus update/removal commands and troubleshooting when the plugin doesn't appear. Use when installing or updating this repo's Codex plugin into an external environment.
tags: [codex]
generated: { by: reference_agent/claude-sonnet-5, at: 2026-08-09T15:58:38Z }
status: stable
---

# Codex プラグインのインストール

このレポジトリでは、`.agents/plugins/marketplace.json` を Codex のローカルマーケットプレイスとして利用している。

## 前提

- ChatGPT デスクトップアプリ、または Codex CLI を利用できること
- Codex CLI からインストールする場合は、`codex` コマンドが使えること

Codex CLI では、マーケットプレイスの Git URL を直接登録できるため、利用者側でこのレポジトリを clone する必要はない。ChatGPT デスクトップアプリで repo-scoped marketplace を利用する場合は、後述のとおりレポジトリを clone する。

マーケットプレイスの定義は次のファイルにある。

```text
.agents/plugins/marketplace.json
```

この定義では、マーケットプレイス名を `seiwan-codex-marketplace`、表示名を `Seiwan Codex Marketplace` とし、次のプラグインを登録している。

```text
meta
└── codex-plugins/meta
```

`source.path` は `.agents/plugins/` からの相対パスではなく、レポジトリルートからの相対パスで解決される。

## ChatGPT デスクトップアプリからインストールする

1. このレポジトリを clone する。

   ```bash
   git clone <このレポジトリのURL>
   cd <レポジトリのディレクトリ>
   ```

2. ChatGPT デスクトップアプリを再起動する。

3. ChatGPT デスクトップアプリで **Work モード**、または **Codex** を開き、**Plugins** を選択する。

4. マーケットプレイスの一覧から **Seiwan Codex Marketplace** を選び、`meta` を開いてインストールする。

5. インストール後、新しいチャットまたは Codex セッションを開始する。

repo-scoped marketplace は、レポジトリ内の `.agents/plugins/marketplace.json` から読み込まれる。レポジトリを更新してプラグインの内容を変更した場合も、アプリを再起動してから新しいチャットまたはセッションを開始する。

## Codex CLI から、clone せずにインストールする

公開されている GitHub レポジトリの URL、または `owner/repository` 形式を指定してマーケットプレイスを登録する。

```bash
codex plugin marketplace add https://github.com/<OWNER>/<REPOSITORY>.git
```

GitHub shorthand を使う場合は次のようにする。

```bash
codex plugin marketplace add <OWNER>/<REPOSITORY>
```

登録できたことを確認する。

```bash
codex plugin marketplace list
```

続いて Codex CLI を起動し、プラグインブラウザーを開く。

```text
codex
/plugins
```

マーケットプレイスの一覧から **Seiwan Codex Marketplace** を選び、`meta` をインストールする。インストール後は Codex CLI の新しいセッションを開始すると、同梱スキルを利用できる。

### sparse checkout を使う場合

このレポジトリではマーケットプレイス定義とプラグイン本体が別のディレクトリにあるため、sparse checkout を使う場合は両方を取得対象にする。

```bash
codex plugin marketplace add https://github.com/<OWNER>/<REPOSITORY>.git --sparse .agents/plugins --sparse codex-plugins/meta
```

`<OWNER>/<REPOSITORY>` は、このレポジトリを公開している GitHub の所有者名とレポジトリ名に置き換える。

## Codex CLI から、clone 済みのレポジトリを使ってインストールする

レポジトリルートでマーケットプレイスを登録する。

```bash
codex plugin marketplace add .
```

登録できたことを確認するには、次を実行する。

```bash
codex plugin marketplace list
```

続いて Codex CLI を起動し、プラグインブラウザーを開く。

```text
codex
/plugins
```

マーケットプレイスの一覧から **Seiwan Codex Marketplace** を選び、`meta` をインストールする。インストール後は Codex CLI の新しいセッションを開始すると、同梱スキルを利用できる。

## 更新・削除

レポジトリを更新した後、Codex CLI の登録内容を更新する。

```bash
git pull
codex plugin marketplace upgrade seiwan-codex-marketplace
```

登録済みマーケットプレイスを削除する場合は次を実行する。

```bash
codex plugin marketplace remove seiwan-codex-marketplace
```

ChatGPT デスクトップアプリでインストールした場合は、Plugins の一覧から `meta` を開き、**Uninstall plugin** を選択する。

## インストール後に利用できるもの

`meta` には、次のスキルが含まれる。

- `codex-docs` — OpenAI 公式 Codex ドキュメントを参照して回答する
- `codex-cli-docs` — 実行環境の `codex --help` を根拠に Codex CLI を説明する
- `codex-cli-use` — Codex CLI へ単発タスクを委譲する

プラグインが見つからない場合は、次を確認する。

- `.agents/plugins/marketplace.json` がレポジトリルートの配下に存在する
- `marketplace.json` の `source.path` が `./codex-plugins/meta` になっている
- ChatGPT デスクトップアプリを再起動したか、Codex CLI で `marketplace list` を実行したか
- インストール後に新しいチャットまたは Codex セッションを開始したか

なお、Codex プラグインは ChatGPT の Chat モードや IDE 拡張では利用できない。公式の詳細は [Plugins](https://developers.openai.com/codex/plugins) と [Build plugins](https://developers.openai.com/codex/build-plugins) を参照すること。
