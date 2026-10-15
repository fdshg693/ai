---
type: Design Decision
title: ツールへの使い方スキル併設
description: Explains the repository's pattern of pairing a tools/ convenience script with a SKILL.md that documents just its non-obvious usage decisions (e.g. claude-plugins/my-tools/skills/aim-cli for the `aim` CLI), so a human or agent isn't left guessing which flag/model/enum value to pick, and how usage feedback is stored with `skill-tools --fb` (one file per note under a configured fb root, gitignored) instead of a per-tool `--fb` flag. Use when adding a new tool under tools/ and deciding whether it needs a companion skill, when writing one, or when recording usage feedback about a skill, tool, or workflow.
tags: [tools, repo-wide]
generated: { by: reference_agent/cursor-grok-4.7, at: 2026-10-13T04:10:00Z }
status: stable
---

# ツールへの使い方スキル併設

`tools/`配下のCLI・スクリプトは、必要に応じて対応する使い方スキル（例: `tools/aim`に対する`claude-plugins/my-tools/skills/aim-cli`）を持つ。人間・エージェントが実行方法に迷わないための補助であり、すべてのツールに機械的に用意するものではない。

## 併設するかどうかの判断

`--help`だけで完結するツールには不要。次のように**判断が絡む**部分がある場合にだけ検討する。

- どのenum値・フラグを選ぶべきかの判断基準（`aim-cli`スキルのモデル選択表とエスカレーション方針: `minimax-m3`を基本線に、簡単すぎるタスクは`gpt-oss-120b`、力不足なら`glm-5.2`/`gpt-5.6-luna`へ）
- 出力フォーマットや終了コードの意味論で、扱いを誤ると後続処理に影響するもの
- ログファイルの意味論（例: `tools/aim/logs/<trace.tool>/<日付>.jsonl`は応答本文を含まず`cost`/`*_tokens`のみ記録、という制約を知らないと誤った前提で後続処理を組んでしまう）

## 置き場所

使い方スキルは`meta-plugins/skills/`ではなく、Claude Codeプラグイン配下（例: `claude-plugins/my-tools/skills/<tool-name>/`）に置き、`ai-tools.yaml`へ通常のスキルとして登録する（[ai-tools-config](/repo-wide/ai-tools-config.md)参照）。対象ツール自体がこのリポジトリ外でも使えるものである以上、スキルもマーケットプレイス・skills-siteの配布対象にする。`meta-plugins/`直下には置かない。

## 責務の境界: セットアップは扱わない

使い方スキルは**使い方のみ**を扱い、インストール・初期セットアップには踏み込まない。

- 前提条件（PATH上に`aim`が必要、`OPENROUTER_API_KEY`が必要、等）はfrontmatterの`#`コメントと本文冒頭の「前提条件」節に明記する
- 前提条件が満たされていない場合、スキル自身がインストールを試みるのではなく、ツールのREADME.mdのセットアップ手順をユーザーに案内するよう指示する

## frontmatterのmeta

対象ツールへの依存を`meta:`に反映する。

```yaml
meta:
  requires_repo_tools: aim
  requires_install: uv tool install --editable tools/aim
  requires_env: OPENROUTER_API_KEY
```

詳細は[skill-meta-fields](/repo-wide/skill-meta-fields.md)参照。

## 使い方フィードバック（`skill-tools --fb`）

使い方・スキル本文・挙動についてのフィードバック（FB）は、各ツールの`--fb`では残さない。`skill-tools`のトップレベル`--fb`に一本化する。各ツールは`--fb`を実装しない。`skill-tools-cli`以外のスキルも`--fb`に言及しない。FBを残す判断は`skill-tools-cli`だけが持つ。

### 取得

`--fb`はサブコマンドと併用しない、書き込み専用の入口。指定したらAPI呼び出しや本処理は走らせない。

```bash
skill-tools --fb <name> [--fb-kind skill|tool|workflow] [--fb-text "<本文>"]
echo "<本文>" | skill-tools --fb <name>
```

- `<name>`はスキル名（またはcanonical ID）、ツール名（`repo-tools.yaml`の登録キーまたはリポジトリ相対path）、workflowの`id`
- `--fb-kind`は省略できる。省略時はskill / tool / workflowの3種すべてから探す。複数種別・複数件で一致したら保存せず終了コード`2`で、候補を`kind: id`として出す。`--fb-kind`を付けて指定し直す
- 0件も終了コード`2`。本文が空なら終了コード`1`で保存しない
- 本文は`--fb-text`、または`--fb-text`を省略したときの標準入力
- 成功時は保存したファイルの絶対パスだけを標準出力に出す。本文は再表示しない

解決対象はsourceのカタログ。skillは`ai-tools.yaml`登録スキル、toolは`repo-tools.yaml`、workflowは`repo-workflows.yaml`の`id`（`title`では一致させない）。`ai-tools.yaml`未登録のスキル（`meta-plugins/skills/**`など）は対象外。

ツールを使って出た不満は、スキルではなくツール名宛てにする。スキルとツールのどちらを直すか迷ったら、直す対象のほうに残す。

### 保存先

保存先ルートは実行ログと同様、設定で決める。優先順は環境変数`SKILL_TOOLS_FB_DIR`、設定の`fb.path`、既定値。既定は、editable / checkoutインストール時は`<skill-toolsプロジェクト>/fb`、wheel等で`pyproject.toml`が同梱されない場合はOSキャッシュ領域の`skill-tools/fb`。確認は`skill-tools config show`の`fb.path`。

レイアウトは種別ごと・対象名ごとに1件1ファイル。

```text
<fbルート>/skills/<skill-name>/<id>-fb.md
<fbルート>/tools/<tool-name>/<id>-fb.md
<fbルート>/workflows/<workflow-id>/<id>-fb.md
```

`id`はUTCの`YYYYMMDD-HHMMSS`。同一秒の衝突は`-2`、`-3`…を`id`側に付ける（`…-2-fb.md`）。本文は受け取ったまま（frontmatterは足さない）。作成は排他的で、既存ファイルは開かない。

各ツールのインストールパス直下や`tools/<name>/fb/`には書かない。

### gitignore

`fb/`は実行時に増えるローカルメモであり、コミットしない。ルート`.gitignore`の`fb/`で無視する（既定保存先がリポジトリ内の`tools/skill-tools/fb/`になる場合を含む）。空ディレクトリ用の`.gitkeep`も置かない。

### エージェントへの指示

指示は`skill-tools-cli`にだけ書き、次に限る。

- ユーザーが使い方への不満・誤案内・抜け・紛らわしいエラーを指摘したら、チャットに残すだけで終わらせず`skill-tools --fb <name> --fb-text "..."`で保存する
- エージェント自身がスキルの判断基準と実際の挙動のずれに気づいたときも同様
- 保存したFBを材料に、その場でスキルやツールを自動改稿しない。残すことが先

セットアップ手順をスキルが引き受けないのと同じで、`--fb`の実装や`fb/`の掃除もスキルの仕事ではない。

## Claude Code以外のツールへは自動的に広げない

同じツールに対応するスキルを他のAIツール（Cline/Codex/Copilot等）向けにも用意するかは別問題。このパターンはデフォルトでClaude Code向けであり、他ツールに機械的にポートしない理由は[claude-code-first-skills](/repo-wide/claude-code-first-skills.md)を参照。

## 関連

- [tools-directory-layout](/repo-wide/tools-directory-layout.md) — ツール自体のディレクトリ・CLI化規約
- [tool-conventions](/repo-wide/tool-conventions.md) — 設定の優先順位。FB保存先は各ツールの`.env`隣ではなく`skill-tools`の`fb.path`
- [ai-tools-config](/repo-wide/ai-tools-config.md) — スキルを`ai-tools.yaml`へ登録する手順
- [skill-meta-fields](/repo-wide/skill-meta-fields.md) — `meta:`ブロックの各フィールドの意味
- [skill-tool-relations](/repo-wide/skill-tool-relations.md) — コンパニオンを含むスキル↔ツールの辿り方と、ツール→ツールの `requires_tools`
- [claude-code-first-skills](/repo-wide/claude-code-first-skills.md) — 他AIツールへポートしない/する判断

## このドキュメントの位置づけ

`meta-plugins/`はこのリポジトリ自身のメンテナンス用であり、ユーザー向けプラグインではない。既存方針に従い、この内容を`ai-tools.yaml`へ登録しないこと。詳細は[ai-tools-config](/repo-wide/ai-tools-config.md)参照。
