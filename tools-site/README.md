# tools-site

[repo-tools.yaml](../repo-tools.yaml) に登録済みのツールのうち **`release: true`** のものだけを対象に、インストール方法・使い方を VitePress で公開するサイト。

- インストールコマンドは `repo-tools.yaml` の `install:` から、使い方本文は各ツールフォルダの `README.md` からそのまま自動生成する。`docs/tools/**` は生成物であり手編集しない（`.gitignore` 対象）。
- [skills-site/](../skills-site/)（Astro製、スキル公開サイト）とはホスティング先・ビルドツールが異なる、独立したサイト。

## ローカル開発

```powershell
pnpm --filter ai-tools-doc-site run dev
```

## ビルド

```powershell
pnpm --filter ai-tools-doc-site run build
```
