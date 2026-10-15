---
type: AI Tool
title: Claude Code へのプラグイン導入方法
description: Explains how to add this repository's claude-plugins/ marketplace (seiwan-marketplace) to a user's own Claude Code environment — via /plugin marketplace add (GitHub or a local clone path), installing individual plugins, and auto-provisioning teammates via .claude/settings.json's extraKnownMarketplaces/enabledPlugins. Use when installing or updating this repo's Claude Code plugins into an external environment.
tags: [claude-code]
generated: { by: reference_agent/claude-sonnet-5, at: 2026-08-09T15:58:38Z }
status: stable
---

# Claude Code へのプラグイン導入方法

このレポジトリの [`claude-plugins/`](../../claude-plugins/) 以下にある自作プラグイン（skills, subagents など）を、自分の Claude Code 環境に取り込む方法を記載する。

配信は [`.claude-plugin/marketplace.json`](../../.claude-plugin/marketplace.json) で定義されたマーケットプレイス経由で行う。
マーケットプレイス名は `seiwan-marketplace`、リポジトリは https://github.com/fdshg693/AI 。

## 1. マーケットプレイスを追加する

Claude Code 内のスラッシュコマンドで実行する場合:

```
/plugin marketplace add fdshg693/AI
```

CLI から実行する場合:

```shell
claude plugin marketplace add fdshg693/AI
```

### ローカルにクローン済みの場合（直接パス指定）

このレポジトリを既にローカルに `git clone` 済みなら、GitHub 経由で取得し直さずローカルパスを直接指定してマーケットプレイスを追加できる。マーケットプレイス名（`seiwan-marketplace`）は `marketplace.json` の内容から決まるため、追加元がリモートでもローカルパスでも変わらない。

```
/plugin marketplace add /path/to/AI
```

CLI から実行する場合:

```shell
claude plugin marketplace add /path/to/AI
```

以降の手順（インストール・確認・管理）はリモート追加時と同じ。ただし clone 元のファイルを更新した場合の反映は GitHub からの再取得ではなく、後述の `/reload-plugins` で行う。

## 2. プラグインをインストールする

`marketplace.json` には次のプラグインが登録されている。必要なものだけを選んでインストールすればよい。

インストールは `/plugin install <プラグイン名>@seiwan-marketplace` の形式で行う。

```
/plugin install <plugin-name>@seiwan-marketplace
```

CLI から特定スコープ（例: プロジェクト単位）にインストールする場合:

```shell
claude plugin install <plugin-name>@seiwan-marketplace --scope project
```

## 3. 確認・管理

```
/plugin list
/plugin disable <plugin-name>@seiwan-marketplace
/plugin uninstall <plugin-name>@seiwan-marketplace
```

マーケットプレイス側（`marketplace.json`）が更新された場合は次で反映する。

```
/reload-plugins
```

## チーム・複数プロジェクトへの自動導入（任意）

プロジェクトの `.claude/settings.json` に `extraKnownMarketplaces` / `enabledPlugins` を書いておくと、リポジトリを clone したメンバーに自動でマーケットプレイス追加・インストールが促される。

```json
{
  "extraKnownMarketplaces": {
    "seiwan-marketplace": {
      "source": { "source": "github", "repo": "fdshg693/AI" }
    }
  },
  "enabledPlugins": {
    "<plugin-name>@seiwan-marketplace": true
  }
}
```

## 補足: `my-tool` プラグインの前提ツール

`my-tool` プラグイン内の skill は 自作 CLI のインストール済を前提にしていることが多い。
事前に [cli-tools](cli-tools.md) の手順でインストールしておくこと。

## 関連

- [cli-tools](cli-tools.md) — `my-tools` プラグインが前提とする `aim`/`tav` CLI 自体のインストール手順
- [codex](codex.md) / [cline](cline.md) — 他のAIツールへの同種の導入手順
