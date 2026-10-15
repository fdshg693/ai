# スキル公開サイト

`skills-site` は、 `generated/catalog.json`(`tools\internal\plugin_meta\generate\generate_skill_catalog.py`によって生成) と `public/downloads/` を入力に、Astroで一覧・詳細ページを静的生成するサイトです。公開するのは登録済みスキルの `SKILL.md` 本文、frontmatter由来のメタデータ、スキルフォルダ単位のZIPだけです。

## ローカル開発

```powershell
pnpm --prefix skills-site install
pnpm --prefix skills-site run dev
```

ブラウザで表示されたローカルURLを開くと、一覧からスキル名で検索、またAIツール／プラグイン／ステータスで絞り込めます。詳細ページでは本文、メタデータ、ZIPに含まれるファイル一覧を確認できます。

## ビルドと検証

```powershell
pnpm --prefix skills-site run build
pnpm --prefix skills-site run validate
pnpm --prefix skills-site test
pnpm --prefix skills-site run preview
```

`build` はカタログとZIPを再生成したあと、`dist/` にAstroの静的出力を作ります。生成物は手編集せず、スキルの追加やfrontmatterの変更後に再生成してください。

`SITE_URL` を設定するとcanonical URLに、`SITE_BASE_PATH` を設定するとサブパス配信に対応します。

## ページ構成

- `/` — 全スキル一覧。スキル名の部分一致検索、AIツール、プラグイン、ステータスで絞り込めます。検索・絞り込みは React island（`src/components/react/SkillFilter.tsx`）で行い、外部解析SDKは含めません。「AIにスキルを提案してもらう」パネル（`src/components/AISuggest.astro` / `src/components/react/AISuggest.tsx`）から、自然文の質問に対してAIが関連スキルを提案する機能も利用できます。
- `/skills/<リポジトリ相対パス>` — `SKILL.md` のname・description・status、本文、リポジトリ相対パス、含有ファイル、ZIPダウンロードを表示します。

表示用のUIは `src/`、公開対象とfrontmatter・ZIPの正本は `scripts/` と `generated/catalog.json` に分離しています。将来検索やアクセス解析を追加する場合も、カタログ生成処理には公開データの責務だけを残します。

## スキル公開成果物の規約

- 公開対象のルートは `skills-site/scripts/source-registry.mjs` が `ai-tools.yaml`（リポジトリ直下）から自動的に導出する。新しいAIツールやプラグインのスキルを追加したら、`ai-tools.yaml` 側にプラグインを登録する（`source-registry.mjs` を直接編集しない）。
- スキャン対象は `ai-tools.yaml` に登録されたルート配下のみ。登録ルート外にある `SKILL.md`（例: `meta-plugins/` のように意図的に`ai-tools.yaml`へ登録しないプラグイン）は存在してもエラーにならず、単に公開対象から漏れる。
- `ai-tools.yaml` に登録済み（＝マーケットプレイスには載る）だが、このサイトでは非公開にしたいプラグイン／スキルがある場合は `skills-site/site-overrides.yaml`（`skills-site/scripts/site-overrides.mjs` が読み込む）の `exclude.sources` / `exclude.skills` に追記する。逆に、`ai-tools.yaml` に無いものをこのファイルだけで公開対象に追加することはできない。
- スキルの安定したID・URLは `SKILL.md` の `name` ではなく、リポジトリ相対パスを使う。同名スキルがあっても別スキルとして扱う。
- `skills-site/generated/` と `skills-site/public/downloads/` の生成物は、ローカルビルドまたはCIで毎回再生成し、手編集しない。
- ZIPはスキルフォルダ配下のファイルを含めるが、ファイル名が `.env` のファイルは大文字小文字を区別せず除外する。シンボリックリンクとスキルルート外へ解決されるパスは含めない。
- 公開前にカタログとZIPの検証を実行し、未登録の `SKILL.md`、必須frontmatter不足、危険なパス、`.env` の同梱を見逃さない。
- カタログには`SKILL.md`の`meta:`ブロックの構造化情報（`requiresSkills`/`requiresHooks`/`requiresRepoTools`の解決結果を含む）も含まれる。リンク解決ロジックの決定事項は`.claude/plans/skills-site-meta-display/01-data-layer.md`を参照。
- 公開workflowは `skills-site/dist` と `skills-site/api`（SWA managed Functions）をデプロイする。リポジトリルートやサイトのソースをAzure Static Web Appsへ直接公開しない。
- Azureのdeployment tokenはGitHub Actions Secretからのみ読み込み、`.env`・Bicepの出力・リポジトリファイルへ保存しない。
- OpenRouter 等のサーバー秘密値（`OPENROUTER_API_KEY`）は SWA の Application settings にのみ置き、クライアントやリポジトリへ漏らさない。
- カタログ生成、テスト、公開成果物検証、Astroビルドのいずれかが失敗した場合はデプロイしない。

## インタラクティブUI・サーバーAPI規約

- インタラクティブ UI は React island（`src/components/react/`）で実装し、バニラJS を `public/` に増やさない。
- コンテンツページは Astro 静的生成のまま（`output: "static"`）。サーバー処理は `skills-site/api/` の SWA managed Functions（`/api/*`）のみ。Astro `src/pages/api` や hybrid/SSR adapter は使わない。
- 外部 APIキー（OpenRouter 等）はサーバー環境変数（`OPENROUTER_API_KEY`）のみで保持し、クライアントへ公開・BYOK させない。
- 検索インデックスはビルド時生成（`catalog:build` と同タイミング、`scripts/build-search-index.mjs`）し、実行時生成しない。ライブラリは MiniSearch。成果物は `api/data/` に置き Functions が `loadJSON` する。
- AI 提案用のスリム索引（`api/data/ai-index.json`）も同様にビルド時生成し、クライアントへ配信しない。ビルド時に `openai/text-embedding-3-small`（OpenRouter Embeddings）のベクトルを各スキルへ同梱する。埋め込み計算にも `OPENROUTER_API_KEY` を使い、鍵が無いビルドは失敗させる。成果物は `api/data/` のみ。
- `/api/suggest` はビルド済みベクトルでクエリと類似度 top-K（10）に絞り、固定チャットモデル `minimax/minimax-m3` でレコメンドする。クライアントからモデルを選ばせない。埋め込み失敗時に全件を LLM へフォールバックしない。

## AIによるスキル提案（サーバー側 OpenRouter）

- AIスキル提案は SWA managed Functions（`/api/suggest`）がサーバー保持の `OPENROUTER_API_KEY` で OpenRouter を呼び出す。クライアントに APIキーを入力させない（BYOK 廃止）。チャットモデルは常に `minimax/minimax-m3`（リクエストの `model` は無視）。フロントにモデル選択UIは無い。
- 提案パイプライン: クエリを `openai/text-embedding-3-small` で埋め込み → 索引ベクトルとのコサイン類似度で top-10 → その10件だけを LLM に渡し最大5件＋日本語 reason を返す。埋め込み失敗時や索引にベクトルが無い場合は 502/503（全件 LLM フォールバックはしない）。
- 提案用のスリム索引は `api/data/ai-index.json`（`path`/`name`/`description`/`tool`/`plugin`/`status.key` に加え、ビルド時計算の `embedding` / `embeddingHash`）で、`catalog:build` が `generated/catalog.json` と同じ解決済みデータから同時に生成する。埋め込みモデルは `openai/text-embedding-3-small`（OpenRouter Embeddings）。静的配信せず Functions バンドルに同梱する。
- `catalog:build` にも `OPENROUTER_API_KEY` が必要（索引は gitignore のため毎回再計算する）。ローカルは `skills-site/.env`、CI は GitHub Actions シークレット `OPENROUTER_API_KEY` を workflow が注入する。鍵が無いビルドは失敗する（埋め込み欠落のままデプロイしない）。
- 全文検索はビルド時 MiniSearch インデックス（`api/data/search-index.json`）を `/api/search` が参照する。テキスト検索はサーバー、ツール／プラグイン／ステータス絞り込みはクライアントと併用。
- `public/staticwebapp.config.json` の CSP `connect-src` は `'self'` のみ（OpenRouter 直叩きはしない）。
- 本番のランタイムでは Azure Portal（または `az staticwebapp appsettings set`）で Static Web App に `OPENROUTER_API_KEY` を設定する。ローカルでは `skills-site/.env` に `OPENROUTER_API_KEY` を設定するだけでよい（`api/src/lib/load-local-env.js` が Functions 起動時に `process.env.OPENROUTER_API_KEY` 未設定なら `../.env` を読み込むフォールバックを行うため、`api/local.settings.json` への二重設定は不要。`catalog:build` も同様に `.env` を読む）。`local.settings.json` は `AzureWebJobsStorage` 等のホスト設定のみで、`api/local.settings.example.json` をコピーして使う。
  - `skills-site/.env` に `OPENROUTER_API_KEY` を設定した状態（mise activate済み・`skills-site` ディレクトリ配下）で `just azure-set-openrouter-key` を実行すると、その値をそのまま本番の Application setting として反映できる（値はログに出力しない）。設定済みかどうかだけを確認したい場合は `just azure-openrouter-key-status` を使う（true/false のみを返し、値そのものは出力しない）。GitHub Actions のデプロイフローはこの値を SWA Application setting としては注入しない（デプロイトークンではApplication settingsを設定できない）が、**ビルド時の埋め込み計算用には** 同名の Actions シークレットが必要。リソース再作成時などはランタイム側の手動設定を忘れないこと。

## Azure Static Web Appsへの公開

Azureリソースは infra/main.bicep で作成します。`skills-site/.env.example` を `skills-site/.env`（gitignore済み）へコピーして値を設定すると、`skills-site/mise.toml` 経由で `AZURE_LOCATION` / `AZURE_RESOURCE_GROUP` / `AZURE_STATIC_SITE_NAME` / `GITHUB_REPOSITORY` が自動で読み込まれます（mise未activate、または `skills-site` 以外のカレントディレクトリでは読み込まれません）。同ファイルは `az` CLIの状態を `skills-site/.azure` に隔離する `AZURE_CONFIG_DIR` も設定するため、他プロジェクトやグローバルの `az login` 状態と混ざりません。詳細は infra/AGENTS.md を参照してください。

準備ができたら `skills-site` ディレクトリで次を実行してください。

```powershell
az login
az account set --subscription "<subscription-id>"
just azure-provision
just azure-set-github-secret
just azure-url
```

AZURE_LOCATION、AZURE_RESOURCE_GROUP、AZURE_STATIC_SITE_NAME の環境変数で既定値を変更できます。BicepはリソースグループとFree tierのStatic Web Appだけを作成し、ソースリポジトリとのAzure側連携は設定しません。

GitHub Actionsの .github/workflows/skill-site.yml は、Pull Requestではカタログ生成・ZIP検証・テスト・Astroビルド・API依存インストールまでを実行します。`catalog:build` のスキル埋め込み計算には Actions シークレット `OPENROUTER_API_KEY` が必要です（未設定や fork PR では verify が失敗します）。mainへのpushが成功した場合だけ、生成済みの `skills-site/dist` と `skills-site/api`（索引同梱）をAzure Static Web Appsへアップロードします。Azure側でフロントを再ビルドせず、APIは SWA が managed Functions としてビルドします。deployment tokenはGitHub Secret AZURE_STATIC_WEB_APPS_API_TOKEN からのみ読み込みます。

### 現在本番に出ているビルドの確認

- `build` スクリプト（`catalog:build` の後）は `scripts/write-build-info.mjs` を実行し、commit SHA・ブランチ・ビルド日時・（CI実行時のみ）workflow run URLを `public/build-info.json` として生成します。生成物はgitignore対象で手編集しません。
- このJSONはページフッターに short SHA とビルド日時として表示されるほか、`/build-info.json` として本番サイトから直接取得できます。今公開されているビルドがどのcommit・いつのものかは、サイトを見れば分かります。
- デプロイjobは成功後に `deploy-<UTC日時>-<short SHA>` 形式のgit tagを作成してpushします（例: `deploy-20260729T153000Z-abc1234`）。過去のデプロイ履歴はリポジトリのtag一覧から辿れ、ロールバックしたい場合は該当tagのcommitでworkflowを再実行（`workflow_dispatch`はカタログ検証のみのため、実際には該当commitへの再push、またはそのcommitをmainにcherry-pick/revertして通常のpushフローに乗せる）します。

### 障害時の確認

- verifyが失敗した場合は、公開対象の登録、frontmatter、ZIP、.env混入の検証エラーを修正してから再実行します。deployは実行されません。
- deployが失敗した場合は、GitHub repository Secretの名前と値、Static Web Appのdeployment token、just azure-urlの対象リソースを確認します。必要ならjust azure-set-github-secretでtokenを更新します。
- デプロイ自体は成功しているのに `/api/suggest` が503 `{"error":"unavailable"}` を返す場合は、まず `just azure-openrouter-key-status` で `OPENROUTER_API_KEY` がApplication settingとして設定済みかを確認する（GitHub Actionsのデプロイはこの値を注入しないため、リソース再作成直後などは未設定になりやすい）。未設定なら `just azure-set-openrouter-key` で反映する。
- 公開対象やサイトの変更は、生成物を手編集せず、ソースと生成スクリプトを変更してからjust skills-site-checkで確認します。

サイト生成処理とAstroの静的出力はホスティングサービスから独立しています。将来Firebaseへ移行する場合は、BicepとAzure用workflowをFirebase用のリソース定義・デプロイworkflowへ置き換え、カタログスキーマ・ZIP仕様・UIはそのまま利用できます。

### Openrouter

`Openrouter` について詳細に調べたい場合は、WEB検索でなくまず `claude-plugins\topics\skills\openrouter-docs\SKILL.md` を確認する
