---
type: AI Tool
title: Cline SDK を使った、カスタマイズした Cline 利用 CLI ツール
description: Explains how to install this repository's cline-plugins/meta AgentPlugin globally into Cline (just cline-personal-info), and documents three Windows-specific known issues encountered along the way — PATH vs Path case-sensitivity breaking npm spawn from PowerShell/cmd, hub-daemon EADDRINUSE port conflicts, and @cline/cli-windows-x64's missing @cline/shared and jiti dependencies causing "load failed" plugins — with their workarounds. Use when `cline plugin install` fails on Windows, or when deciding whether a Cline plugin issue is this repo's code vs an upstream Cline packaging bug.
tags: [cline]
generated: { by: reference_agent/claude-sonnet-5, at: 2026-08-09T15:58:38Z }
status: stable
---

# Cline SDK を使った、カスタマイズした Cline 利用 CLI ツール

## 関連ファイル

- `cline-plugins\meta\` — skill-writer / plugin-writer / rule-writer / docs 等の authoring meta skills をまとめた Cline Plugin（`AgentPlugin`）。

## インストール

リポジトリルートから:

```bash
just -f docs/integrations/justfile cline-personal-info
```

中身は実質 `cline plugin install cline-plugins/meta --force` で、global（`~/.cline/plugins/`）にインストールする。

### なぜ PowerShell 直打ちだと失敗するか

PowerShell や cmd から直接

```powershell
cline plugin install cline-plugins\meta
```

を実行すると次のエラーになる:

```
error: ENOENT: no such file or directory, uv_spawn 'npm'
```

原因は `cline` CLI（内部で Bun ランタイムを embed）が依存インストールのために `npm` を spawn する際、環境変数名 `PATH` を大文字決め打ちで参照していること。Windows のネイティブシェル（PowerShell/cmd）が生成するプロセス環境では変数名は `Path`（先頭大文字）であり、`PATH`（全大文字）は存在しないため npm の解決に失敗する。Git Bash（MSYS）経由だと `PATH` が全大文字でエクスポートされるため問題が起きない。

`node -e "console.log(Object.keys(process.env).filter(k=>/path/i.test(k)))"` で実際に `Path` vs `PATH` の差分を確認できる。

そのため `cline plugin install` は PowerShell/cmd から直接ではなく、上記の `just cline-personal-info`（内部で Git Bash 経由 `& "C:/Program Files/Git/bin/bash.exe" -c "..."` を叩く）を使う。同じ問題は他の cline plugin install にも起こりうるので、`cline plugin install` は基本的に Git Bash 経由で実行するのが安全。

### hub-daemon のポート競合で EADDRINUSE になる場合

PATH 問題を Git Bash 経由で回避しても、今度は次のエラーで失敗することがあります。

```
[hub-daemon] fatal: Error: Failed to start hub server on 127.0.0.1:25463/hub: EADDRINUSE
```

これは別の `cline` hub-daemon プロセスがすでにポート `25463` を Listen しているため、`cline plugin install` が新規にハブを立てられないのが原因です。よくある発生元:

- VS Code 等のエディタ上で Cline 拡張が動いていてハブを常駐させている
- 以前の失敗した `cline plugin install` 試行がハブデーモンをデタッチ状態で残している

この場合、親 `cline.exe` プロセスが子ハブを自動再起動する構造になっていると、`Stop-Process` で kill してもすぐに別 PID で再起動して port を占有し続けます。この状態では install が完了しないので、まず Cline を動かしているエディタ/IDE をすべて閉じて `cline` プロセスが 0 件になったことを確認します。

```
Get-Process cline -ErrorAction SilentlyContinue        # 0 件であることを確認
(Get-NetTCPConnection -LocalPort 25463 -State Listen -ErrorAction SilentlyContinue | Measure-Object).Count
                                                       # 0 であることを確認
```

ポートが解放された状態で改めて `just cline-personal-info`（Git Bash 経由）を実行してください。成功すると `~/.cline/plugins/_installed/local/` 配下に plugin が配置されます。

### Windows で plugin が load failed になる（`@cline/cli-windows-x64` の依存欠落）

`cline plugin install <path> --cwd .` 自体は成功表示（`Installed plugin from ...`）されても、直後に次のような警告/エラーが出て、実際には plugin がロードされない（`cline config` の plugins タブで `load failed` になる）ことがある。

```
error: Warning: failed to sync plugin MCP servers for <installed path>\package\index.ts: plugin-sandbox process exited (code=1, signal=null): node:internal/modules/package_json_reader:301
Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@cline/shared' imported from <pnpm-global>\@cline\cli-windows-x64\extensions\plugin-sandbox-bootstrap.js
```

このあと `@cline/shared` を解決できるようにしても、続けて次のエラーが出ることがある。

```
error: Warning: failed to sync plugin MCP servers for ...: Cannot find package 'jiti' imported from ...\extensions\plugin-sandbox-bootstrap.js
```

#### 原因

`plugin-sandbox-bootstrap.js` は全 plugin 共通のロード処理（tools/commands/rules 等すべてこの sandbox 経由）で、内部で `@cline/shared`（`normalizePluginManifest` 等）と `jiti`（plugin の `.ts` を動的にトランスパイルして import するため）を必要とする。

この bootstrap は `@cline/cli-windows-x64`（Windows 用 CLI バイナリの npm パッケージ、`3.0.46` 時点）に同梱されているが、**`@cline/cli-windows-x64` 自身の `package.json` にはこの2つが依存として宣言されていない**（`os`/`cpu`/`bin` のみで `dependencies` が空）。そのため pnpm がこれらを `@cline/cli-windows-x64` の `node_modules` にリンクせず、Node の ESM 解決がそもそも失敗する。`pnpm view @cline/cli-windows-x64 dependencies` でレジストリ上も空であることを確認済みで、ローカル環境固有の破損ではなく **npm に公開されているパッケージ自体のパッケージングバグ**（Windows 版特有、かつ調査時点で `cline update` しても最新の `3.0.46` が既に該当バージョン）。

一方 `@cline/sdk` 等 plugin の実際の依存関係は bootstrap 内の動的フォールバック解決ロジック（`u()`/`T()` 等）で別途探索されるため問題にならない。今回壊れているのは bootstrap スクリプト自身の**トップレベル static import**（`@cline/shared`）と、動的 `import("jiti")` の2箇所。

#### 対処（回避策）

グローバル pnpm store 内で、`@cline/cli-windows-x64` の `node_modules` から、store 内に既に存在する実体パッケージへ NTFS ジャンクションを張ることで解決できる（実体は `pnpm view cline dependencies` に出てくる `@cline/shared`、および `@cline/core` が要求するバージョン帯 `jiti@^2.7.0` を store 内で探して使う）。

```powershell
# 1. @cline/cli-windows-x64 のバージョン/ハッシュディレクトリを確認
#    C:\Users\<user>\AppData\Local\pnpm\store\v11\links\@cline\cli-windows-x64\<version>\<hash>\node_modules\@cline\cli-windows-x64\

# 2. @cline/shared の実体を確認（同 store 配下）
#    C:\Users\<user>\AppData\Local\pnpm\store\v11\links\@cline\shared\<version>\<hash>\node_modules\@cline\shared

# 3. jiti の実体を確認（unscoped package は links\@\<name>\ 配下に格納される点に注意）
#    C:\Users\<user>\AppData\Local\pnpm\store\v11\links\@\jiti\<version>\<hash>\node_modules\jiti

New-Item -ItemType Junction `
  -Path "<cli-windows-x64 hash dir>\node_modules\@cline\shared" `
  -Target "<@cline/shared hash dir>\node_modules\@cline\shared"

New-Item -ItemType Junction `
  -Path "<cli-windows-x64 hash dir>\node_modules\jiti" `
  -Target "<jiti hash dir>\node_modules\jiti"
```

ジャンクション作成後、`cline plugin install <path> --cwd . --force` を再実行するとエラーが消える。ただし **jiti 初回実行時はコンパイル/キャッシュ生成で遅く、`plugin-sandbox call timed out after 4000ms: initialize` というタイムアウトが1回だけ出ることがある**。その場合は同じコマンドをもう一度実行すれば通る（2回目以降は安定してエラーなし）。

#### 注意点・限界

- この修正は対象プロジェクト外の**グローバル pnpm store**への変更であり、`cline update` で `@cline/cli-windows-x64` が新しいビルド（＝新しい content hash ディレクトリ）に置き換わると、張ったジャンクションは無効になり同じエラーが再発する。その場合は上記手順をやり直す。
- pnpm store 内のパッケージバージョンは環境ごとに異なりうるため、パスの `<version>`/`<hash>` は都度 `find`（や `Get-ChildItem`）で実際の値を確認すること。
- 根本原因は upstream（[cline/cline](https://github.com/cline/cline)）側の `@cline/cli-windows-x64` パッケージングミスなので、恒久対応が必要なら issue 報告が筋。この回避策はあくまで一時しのぎ。
- 非対話ターミナル（Bash tool 等）からは `cline config` / `cline config --json` は `interactive mode requires a TTY` で使えないため、plugin が実際に load されたかどうかの最終確認は対話セッション（TUI か実セッション内でのツール呼び出し）で行う必要がある。

### plugin の tool 呼び出し結果が `JSON.stringify cannot serialize cyclic structures` エラーになる

上記の load failed を解消して plugin 自体は正常にロードされるようになった後、実際にセッション内で tool を呼び出すと、セッションの `<session-id>.messages.json` に次のような `tool_result` が記録されることがある。

```json
{
  "type": "tool_result",
  "tool_use_id": "get_personal_info_0",
  "name": "get_personal_info",
  "content": "{\"error\":\"JSON.stringify cannot serialize cyclic structures.\"}",
  "is_error": true
}
```

tool の `execute()` がプレーンなオブジェクト（例: `{name, email, timezone}` のみ、循環参照なし）を返しているだけでも発生する。

#### 切り分け方法・結論

`plugin-sandbox-bootstrap.js` を Node の `child_process.fork()` で直接起動し、cline-core が行うのと同じ IPC 手順（`{type:"call", method:"initialize", args:{pluginPaths:[...]}}` → `{type:"call", method:"executeTool", args:{pluginId, contributionId, input:{}, context:{}}}`）を自前で叩いて再現を試みた。

結果、**sandbox（Node 側）から返ってくる `TOOL RESULT` は完全にクリーンなプレーンオブジェクトで、循環参照は一切なかった**。つまり:

- plugin のコード（`execute()` の返り値）は正しい
- sandbox 経由のツール実行そのものも正しく完了している

にもかかわらずセッション上ではこのエラーになる、ということは、**循環参照エラーは sandbox の外側、Bun で動いている親プロセス（`cline.exe` 本体）が sandbox から受け取ったクリーンな結果を後段で処理する際**（LLM に渡す `tool_result` の文字列化、セッションの `messages.json` への書き込み等）に発生していると強く推測される。

補足として、このエラー文言 `"JSON.stringify cannot serialize cyclic structures."` は Node/V8 標準の文言（`Converting circular structure to JSON`）とは異なり、Bun ランタイム特有の文言。`@cline/core` / `@cline/agents` / `@cline/shared` / `@cline/llms` / `cli-windows-x64` の dist バンドル全体を grep してもこの文字列を自前で組み立てているコードは無く（見つかったのは zod の JSON Schema 変換ロジック内の別の "Cycle detected" メッセージのみで無関係）、実行時エンジン自身が投げた例外である可能性が高い。前述の通り `cline.exe` は Bun を embed しているため辻褄が合う。

#### 対応

- plugin 側・sandbox 側のコードは無罪と切り分けられているので、これ以上 plugin 側で調査しても解決しない。
- `cline.exe` 本体は Bun でコンパイルされたバイナリで中身のソースが読めないため、これ以上の原因特定は事実上困難。upstream（[cline/cline](https://github.com/cline/cline)）への issue 報告が現実的な対応。報告時は「plugin 自体・sandbox 経由の実行は上記の fork 直叩きで clean だと確認済み」という切り分け結果を添えると再現・修正がしやすいはず。
