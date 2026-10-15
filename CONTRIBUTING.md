# コントリビューションガイド

このリポジトリは元々、AIコーディングツールの設定・調査を行う個人リポジトリとして運用している。
そのうえで [MIT License](LICENSE) を採用しており、**誰でも自由にFork・改変・再配布してよい**。プラグインや設定を自分の環境に取り込みたいだけであれば、PRを送る必要はなくFork（または該当フォルダのコピー）だけで完結する。

## GitHub Actionsによる自動化は第三者には開放していない

`.github/workflows/` 配下のissue/PR自動化（Claude / Codex / PR-Agent / gh-aw）は、リポジトリの `OWNER` または `COLLABORATOR` だけが起動できるよう `author_association` で制限している。第三者が作成したissueやPRコメントに対して、これらのAI自動化ボットは反応しない。書き込み権限を持つエージェントとAPI利用料をリポジトリオーナー以外に開放しないための意図的な制限であり、issueで「ボットが反応しない」と報告する必要はない。

同様に、skills-siteのビルド・デプロイパイプライン（`skill-site.yml`）はFork PRでは `OPENROUTER_API_KEY` 等のリポジトリシークレットを読めないため、`verify` ジョブが意図的に失敗する。これも安全装置であり、Fork PRのCIが赤くなること自体はバグではない。

これらの自動化・CIパイプラインの詳細は [docs/repo-wide/gh-actions-lifecycle.md](docs/repo-wide/gh-actions-lifecycle.md) を参照。

## PRを送る場合

1. Forkして作業ブランチを作成する。
2. 変更したフォルダのREADME/AGENTS.mdに検証コマンドが書かれていればそれに従う（例: `skills-site`配下の変更は`skills-site/AGENTS.md`のjustfileレシピを参照）。
3. PRを作成する。上記の通りFork PRでは一部のCIジョブ（シークレットが必要なもの）が失敗するが、それ自体は問題ない。

## Issue

バグ報告や提案はissueで歓迎する。ただし前述の通り、issueコメントによるボット自動応答（`@codex`など）はリポジトリのOWNER/COLLABORATORのみに制限されている。
