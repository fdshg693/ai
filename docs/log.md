# Directory Update Log

## 2026-10-14

- **Update**: `docs/repo-meta/` を `docs/repo-wide/` に改名した。概念ドキュメント間の OKF リンクと、`meta` スキルが読む一覧の対象ディレクトリを追従させた。
- **Update**: `docs/integrations/cli-tools.md` — 旧 `tools/install` の justfile とインストール説明（タグ+Release のピン留めを含む）をこの1ドキュメントへ統合した。`tools/install/AGENTS.md` と `CLAUDE.md` は残さない。`skill-tools` 本体は `tools/skill-tools/` のまま、導入だけをここで案内する。
- **Update**: リポジトリ直下のメンテ用プラグイン `repo-meta/` を `meta-plugins/` に改名した。

## 2026-10-13

- **Update**: `docs/repo-wide/tool-companion-skills.md` — 使い方FBを各ツールの `--fb` から `skill-tools --fb` に一本化した。保存先は設定の `fb.path`（環境変数 `SKILL_TOOLS_FB_DIR` が優先）で、`<fbルート>/skills|tools|workflows/<name>/<id>-fb.md`。各ツールは `--fb` を実装せず、個別スキルも言及しない。`index.md`・`tool-conventions.md`・`tools-directory-layout.md`・`skill-tool-relations.md` の参照を同期した。

## 2026-10-01

- **Update**: `docs/repo-wide/tool-conventions.md` — インストールして使うCLIで、パスやプロジェクトごとの設定を持つものは、`.env`ではなくレイヤー設定（TOML）を使う規約を追加した。解決順は、環境変数 → CWDからgitルートまで遡るプロジェクト設定`.<tool>.toml` → グローバル設定`~/.config/<tool>/config.toml` → 既定値。相対パスは「それを書いた設定ファイル基準、環境変数・既定値はgitルート基準」とし、秘密情報はプロジェクト設定から読まない。固定パス`.env`は、スキル同梱スクリプトなどインストールしないスクリプト向けに残した。参照実装は`tools/tav-cli`（`tools/tav-cli/.env`は廃止）。`index.md` と関連docの参照文言を同期した。

## 2026-09-27

- **Creation**: `docs/repo-wide/skill-tools-contract.md` — `tools/skill-tools` がリポジトリ全体をスキル・ツールのカタログとして検索・配置できるようにするCLIであることと、そのためにリポジトリ側が守る入力契約（`ai-tools.yaml` のプラグインルート、`SKILL.md` frontmatter、`skills-site/site-overrides.yaml`、`repo-tools.yaml`、`repo-workflows.yaml`、バンドルコピーポリシー）をまとめた。`docs/repo-wide/index.md` と `meta-plugins/skills/meta` の振り分けに追加した。

## 2026-09-15

- **Creation**: `tools/textgraph` を first-class CLI として `repo-tools.yaml` / uv workspace に登録し、companion スキル `claude-plugins/my-tools/skills/textgraph` と exploring-this-repo からの導線を追加した。
- **Update**: `docs/integrations/cli-tools.md` — `skill-tools list` / `install` の識別子を、local なら絶対パス・GitHub なら blob URL として案内するよう同期した。
- **Creation**: `docs/repo-wide/tool-conventions.md` — 既存の`.env`読み込み規約を一般化し、`repo-tools.yaml`登録CLIの版数SSOT、`--version`契約、pre-commitでの自動patchバンプまで含むツール共通規約として再編した。
- **Update**: `docs/repo-wide/repo-tools-config.md` — `repo-tools.yaml`の消費側として、登録ツール全体のmanifest auto-bumpと`release: true`の役割分離を反映した。Nodeの`package.json`もrepo-tools整合チェックのトリガーに含めた。
- **Update**: `docs/repo-wide/lefthook-automation.md` / `docs/repo-wide/tools-directory-layout.md` / `docs/repo-wide/tool-companion-skills.md` / `docs/repo-wide/skill-tool-relations.md` / `docs/repo-wide/index.md` — 新しい`tool-conventions`文書への参照へ統一し、ツールの`--version`・manifest version規約を各説明へ同期した。

## 2026-09-08

- **Update**: `docs/repo-wide/skill-tool-relations.md` — スキル↔ツール関係グラフを実装済み正本に更新。`repo-tools.yaml` の `requires_tools`、検査、`skill-tool-impact`、`changing-skills-and-tools` スキルへの参照を「実装済みの最小セット」に書いた。
- **Creation**: `docs/repo-wide/skill-tool-relations.md` — スキル↔ツールの関係グラフと変更時の修正箇所の理想案（未実装）。スキル側は `meta_field.yaml` の `requires_skills` / `requires_repo_tools`、ツール→スキルは逆引き、ツール→ツールは `repo-tools.yaml` の `requires_tools` としてルール化する。

## 2026-09-06

- **Update**: `docs/repo-wide/tool-companion-skills.md` — コンパニオンスキル付きCLIの `--fb` を実装済みとして規約化。併設スキル・ツールREADMEに使い方を追記。
- **Update**: `docs/repo-wide/tool-companion-skills.md` — コンパニオンスキル付きCLIの使い方FB（`--fb`、引数またはstdin、インストールパス直下`fb/`へ1件1ファイル、gitignore）。実装は未着手で、この節が実装時の規約。
- **Update**: `docs/repo-wide/tool-env-loading.md` — `skill-search`の`skills-site/.env`固定参照を例外として明記。検査レシピ（`just --justfile tools/internal/justfile tool-env-loading-check`）を追記。参照実装の「規則3未揃い」注記を外し、公開HTTPは診断をサーバーログに留める旨を追加。
- **Creation**: `docs/repo-wide/tool-env-loading.md` — ツール・スクリプトの環境変数と`.env`読み込みの共通規約（プロセス環境変数最優先、`.env`はエントリポイント同階層またはパッケージ化ツール直下の固定パスのみ、必須キー欠落時は想定パスとファイル有無／キー欠落を返す）。

## 2026-08-09

- **Creation**: `docs/` OKFバンドルを新設し、`meta-plugins/skills/` 配下の13個のメタスキル（aim-automation, ai-tools-config, claude-code-first-skills, gh-actions-lifecycle, justfile-conventions, lefthook-automation, repo-ssot-pattern, skill-improving-meta-skills, skill-md-commits, skill-meta-fields, tool-companion-skills, tools-directory-layout, uv-workspace）を `docs/repo-wide/` 配下のOKF概念ドキュメントへ一括移行した。`meta-plugins/skills/meta/` はスキルとして残し、`docs/repo-wide/` 配下のdocを取得・提示する役割に書き換えた。
- **Creation**: リポジトリ直下の `integrations/` フォルダ（`CLAUDE_CODE.md`, `CLI_TOOLS.md`, `CLINE.md`, `CODEX.md`）を `docs/integrations/` 配下のOKF概念ドキュメント（claude-code, cli-tools, cline, codex）へ移行した。同梱の `integrations/scripts`（`skill-deploy` CLI）はドキュメントではないため `tools/integration/scripts/` へ移動した。
