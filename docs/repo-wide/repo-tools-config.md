---
type: Design Decision
title: repo-tools.yamlによるSKILL.md自作ツール依存の管理
description: Explains how repo-tools.yaml registers which tools/-rooted CLI tools a SKILL.md may declare as an install-time prerequisite (meta.requires_repo_tools / meta.requires_install), which other registered tools each entry depends on (requires_tools), how commit-time checks and auto version bumps consume that registry, and how .github/workflows/tool-release.yml still uses only its `release` field to determine tag+GitHub Release targets. Use when adding a new tools/ CLI that a skill or another tool depends on, when a lefthook "repo-tools consistency" or tool-version bump step fails, when deciding whether a tool needs registering here at all, or when deciding whether a tool should be a tag+Release target.
tags: [tools, repo-wide]
generated: { by: reference_agent/claude-sonnet-5, at: 2026-08-11T00:00:00Z }
status: stable
---

# repo-tools.yamlによるSKILL.md自作ツール依存の管理

## SSOT: `repo-tools.yaml`

リポジトリ直下の[`repo-tools.yaml`](../../repo-tools.yaml)が、「`SKILL.md`の`meta.requires_repo_tools`/`meta.requires_install`が参照してよい、`tools/`配下の自作CLIツール」と、ツール同士の依存（`requires_tools`）の単一の情報源（SSOT）。各エントリは`path`（`tools/`配下のディレクトリ）、`install`（インストールコマンド）、`description`（ツール概要の取得元を示す`<repo相対path>[#<dotted key>]` locator。例`tools/aim/pyproject.toml#project.description`）を持つ。概要本文はここに書かず、locatorが指す先（各ツールのマニフェスト、無ければREADME）をSSOTとする（[tool-conventions](/repo-wide/tool-conventions.md)）。他の登録ツールに依存するときは`requires_tools`（キーは同ファイルのツール名、値は`library` / `subprocess` / `family`）を書く。辺の意味は[skill-tool-relations](/repo-wide/skill-tool-relations.md)。

版数はここには置かない。Pythonは各ツールの`pyproject.toml`、Nodeは`package.json`がSSOTであり、公開CLIの`--version`もその値を返す。詳細は[tool-conventions](/repo-wide/tool-conventions.md)。

`ai-tools.yaml`・`meta_field.yaml`と同じ[SSOT+生成パターン](/repo-wide/repo-ssot-pattern.md)を踏襲するが、**このSSOTからは派生ファイルが生成されない**点が異なる。役割は「チェック」「公開表示への読み込み」「タグ+Release対象の判定」の3つ。skills-site / tools-site への下流表示はまだしない。

## 消費側1: コミット時チェック

`tools/internal/skill/check/check_skill_repo_tools.py`が、全`SKILL.md`の`requires_repo_tools`/`requires_install`に含まれる`tools/...`パスを`repo-tools.yaml`の`path`一覧と突き合わせ、未登録のパスがあれば失敗する。同じlefthookジョブで`check_repo_tool_relations.py`が`requires_tools`の参照先・`kind`・自己参照と、`library`辺と`pyproject.toml`のworkspace依存の一致を見る。読み込みは共有ローダ`tools/internal/skill/util/repo_tools_registry.py`の`load_repo_tools()`経由で行い、スクリプト側にパスをハードコードしない。

以下は対象外（`check_skill_repo_tools.py`冒頭のコメント参照）:

- `meta-plugins/**` — このディレクトリの`SKILL.md`は`requires_repo_tools`を「CLI依存」ではなく「このメタスキルが説明するファイル」の意味で流用しているため（[tool-companion-skills](/repo-wide/tool-companion-skills.md)参照）
- `tools/internal/**` — リポジトリ保守用の内部スクリプトで、スキル利用者がインストールする対象ではないため

`repo-tools.yaml`冒頭のコメントにある通り、**スキルからも他ツールからも参照されていないツールは登録不要**（例: 執筆時点の`tools/schedule`）。スキル未参照でも、他ツールから依存される／他ツールに依存する first-class ツールは載せる。

## 消費側2: skills-siteの公開表示

`skills-site/scripts/repo-tools-registry.mjs`も同じ`repo-tools.yaml`を読む。ただしこちらは検証ではなく、公開サイト上で「インストール可能なツール」をツール名とGitHubフォルダへのリンクとして表示するために使う（インストール手順そのものは載せない）。`skills-site/scripts/build-catalog.mjs`の`resolveRequiresRepoTools`が、SKILL.mdの`requires_repo_tools`値をこの一覧と突き合わせてリンク化するかプレーンテキスト表示に留めるかを決める。

## 消費側3: タグ+Releaseの対象判定

`.github/workflows/tool-release.yml`の`discover`ジョブも同じ`repo-tools.yaml`を読む。各エントリの`release: true`フィールドを見て、値が`true`のエントリの`path`一覧をタグ+GitHub Releaseの対象（`release`ジョブの`strategy.matrix.dir`）として動的に決定する。読み込みは`util/`の共有ローダを使わず、workflow内で完結する独立したPythonスニペット（`uv run --with pyyaml python -c "..."`）で行う——`tools/internal/skill/AGENTS.md`が`util/`モジュールの新規消費者を`set/`・`check/`・`query/`に限っているため。

執筆時点の対象は`aim`/`grepapp`/`mslearn`/`tav`/`ctx7`の5エントリ（`tools/aim`・`tools/grepapp`・`tools/mslearn`・`tools/tav-cli`・`tools/ctx7`）。`aim-summarize`/`my-agents`はworkspace内兄弟パッケージへの依存でdependency confusionを起こすため`release`未設定（対象外）——詳細は[docs/integrations/cli-tools.md](../../docs/integrations/cli-tools.md)参照。

この`release`フラグは消費側1（チェック対象可否）・消費側2（skills-site公開可否）とは無関係な独立した軸。あるツールがチェック対象・公開対象であっても、タグ+Releaseの対象とは限らない。

## 消費側4: lefthookによるバージョン自動アップ

`lefthook.yml`のpre-commitジョブ「bump registered tool manifest version」（`tools/internal/release/bump_tool_versions.py`）も同じ`repo-tools.yaml`を読み、**登録済みツール全体**の各`path`について、ステージ済みファイルがそのフォルダ配下に1つでもあれば版数付きマニフェストを調べる。Pythonなら`pyproject.toml`に対して`uv version --bump patch --frozen`、Nodeなら`package.json`に対して`pnpm version patch --no-git-tag-version --no-git-checks`を使い、patchバージョンを1つ上げる。判定はフォルダ単位（そのフォルダ配下の変更ファイル数やdiffの中身は見ない）で、ドキュメントのみの変更でもバージョンが上がる。

ただし、現在のマニフェストversionがすでに`HEAD`と異なる場合は、自動バンプしない。手動minor/majorや、同コミットで明示したversion変更を尊重するためである。新規マニフェストや、初めてversionを導入したマニフェストも同様に、初期versionだけで止まる。

再ステージは`lefthook.yml`の`stage_fixed`に任せず、スクリプト自身が更新したマニフェストを`git add`で明示的にステージする。`stage_fixed`はジョブ自身の`glob`にマッチし、かつ元々ステージ済みだったファイルしか再ステージしない（例: `tools/aim/README.md`だけをステージしたコミットでは、`tools/aim/pyproject.toml`はそのどちらにも該当せず、`stage_fixed`では拾われない——実機検証済み）。消費側3と同じくworkflow内蔵スニペット方式を踏襲し、`skill/util/repo_tools_registry.py`は使わない（`tools/internal/skill/AGENTS.md`参照）。

これにより、登録済み first-class CLI はコミットのたびに（そのフォルダに変更があれば）patchバージョンが維持される。一方で、mainへのpush時に新しいタグ+Releaseを発行するのは、引き続き消費側3の`release: true`集合だけである。

## 消費側5: skill-toolsの列挙・インストール

`tools/skill-tools`の`list-tools`/`install-tools`も、設定中のsource（local cloneまたはGitHub）の`repo-tools.yaml`を`skill_tools/repo_tools/load.py`経由で読む。`list-tools`は全エントリを`name`/`path`/`install`/`description`で列挙し、`description`は`description` locatorを解決した1行概要（locator未指定なら空文字、解決失敗はエラー）。`--json`は同じ4フィールドの配列を返す。`install-tools`は選択したツール（無指定なら全件）の`install`文字列をsourceルートで実行する。**`release`は参照せず**、全エントリが対象。実行はリポジトリ相対パスに依存するためlocal sourceが必須で、GitHub sourceではエラーになる。このCLIは`repo-tools.yaml`を書き換えず、登録・検証は従来どおり消費側1のチェックが担う。

## 実行方法

```bash
just --justfile tools/internal/justfile skill-repo-tools-check
```

`lefthook.yml`のpre-commitに、`**/SKILL.md`・`repo-tools.yaml`・`tools/**/pyproject.toml`・`tools/**/package.json`の変更をトリガーとして登録済み（`stage_fixed`は使わない — このチェックはファイルを書き換えない）。workspace依存やNodeマニフェストだけ変えてYAMLを触らないドリフトを落とすため、両方のマニフェストをglobに含む。`tools/**`全体にはしない（自動version bumpと衝突する）。通常は手動実行不要で、コミット時に任せればよい。

変更時に下流スキル/ツールを列挙するクエリは別レシピ（`just --justfile tools/internal/justfile skill-tool-impact`）。lefthookには繋がない。

## 新しい`tools/`配下ツールを追加する手順

1. `tools/<name>/`にツール本体を作成する
2. いずれかの`SKILL.md`の`meta.requires_repo_tools`（および必要なら`meta.requires_install`）でそのツールを参照する（[skill-meta-fields](/repo-wide/skill-meta-fields.md)参照）。または他の登録ツールとの依存だけでも登録する
3. 版数付きマニフェストを1つ用意する（Pythonは`pyproject.toml`、Nodeは`package.json`）。公開CLIには`--version`を実装し、`<command> <manifest-version>`を返すようにする（[tool-conventions](/repo-wide/tool-conventions.md)）
4. `repo-tools.yaml`の`tools:`に`path`と`install`を追記する（アルファベット順を維持）。リポジトリ内ツールへ依存するなら同じエントリに`requires_tools`を書く
5. そのツールをタグ+GitHub Releaseの対象にもしたい場合は、同じエントリに`release: true`を追記する（workspace内の兄弟パッケージに依存しないツールのみ——理由は[docs/integrations/cli-tools.md](../../docs/integrations/cli-tools.md)参照）

手順4を忘れると、次のコミットでlefthookの「check SKILL.md repo-tools consistency」が失敗する。手順5は任意（省略時は`.github/workflows/tool-release.yml`のタグ+Release対象にならないだけで、他の消費側には影響しない）。

## 落とし穴

- ツールをリネーム・移動したのに`repo-tools.yaml`の`path`を更新し忘れると、参照側の`SKILL.md`が「未登録」としてチェックに失敗する（typoと区別がつかないので、エラーメッセージに従い両方を疑う）
- `meta-plugins/**`配下の`SKILL.md`で`requires_repo_tools`に`justfile`や`lefthook.yml`のようなツール以外のパスを書いても、このチェックの対象外なので失敗しない（[tool-companion-skills](/repo-wide/tool-companion-skills.md)の用法の違いを参照）

## 関連

- [repo-ssot-pattern](/repo-wide/repo-ssot-pattern.md) — `repo-tools.yaml`が従うSSOT+生成パターン全体（このSSOTは「生成なし」の例外形）
- [skill-meta-fields](/repo-wide/skill-meta-fields.md) — `requires_repo_tools`/`requires_install`フィールド自体の意味
- [tool-companion-skills](/repo-wide/tool-companion-skills.md) — `meta-plugins/**`が`requires_repo_tools`を別の意味で流用している理由
- [skill-tool-relations](/repo-wide/skill-tool-relations.md) — ツール同士の `requires_tools` の意味と変更時に見る場所。skills-site / tools-site への下流表示はまだしない
- [lefthook-automation](/repo-wide/lefthook-automation.md) — コミット時チェックを自動実行する仕組み全体
- [docs/integrations/cli-tools.md](../../docs/integrations/cli-tools.md) — タグ+Releaseの対象パッケージ表とピン留めインストール手順、workspace内兄弟パッケージ依存による除外理由
- [tool-conventions](/repo-wide/tool-conventions.md) — ツールの版数SSOT、`--version`、設定読み込み（レイヤー設定 / `.env`）の共通規約

## このドキュメントの位置づけ

`meta-plugins/`はこのリポジトリ自身のメンテナンス用であり、ユーザー向けプラグインではない。既存方針に従い、この内容を`ai-tools.yaml`へ登録しないこと。詳細は[ai-tools-config](/repo-wide/ai-tools-config.md)参照。
