---
# 前提: skill-tools が導入済み（`uv tool install --editable tools/skill-tools`）であること。
# 詳細は tools/skill-tools/README.md 参照。同梱のmeta-plugins/agents/skill-search.mdサブエージェントを併用する。
name: discovering-skills
description: Searches this repository's full skill catalog via the skill-search agent and its skill-tools search CLI before starting non-trivial work here, and folds genuinely relevant hits into the task's TODO as explicit skill-loading steps. Use when starting a multi-step task inside this repo (features under claude-plugins/, cursor-plugins/, codex-plugins/, copilot-plugins/, cline-plugins/, antigravity-plugins/, tools/, docs/, meta-plugins/ etc.), when unsure whether an existing skill already covers the task, or when the current session's auto-suggested Skill-tool listing seems incomplete — that listing only reflects whichever marketplace/plugin dirs happen to be loaded this session, while the index covers every SKILL.md in the repo regardless.
meta:
  tag: []
  requires_repo_tools: tools/skill-tools, meta-plugins/agents/skill-search.md
  requires_env: OPENROUTER_API_KEY
  dependencies: none
  requires_install: uv tool install --editable tools/skill-tools
  requires_hooks: none
  requires_skills: none
  status: experimental
  description: no description
  version: 1.0.5
---

# リポジトリ内スキルの発見・TODOへの組み込み

このリポジトリには`claude-plugins/`だけでなく`cursor-plugins/`・`codex-plugins/`・`copilot-plugins/`・`cline-plugins/`・`antigravity-plugins/`・`meta-plugins/`などに90件超のスキルが分散している。今のセッションでAIに自動提案されるSkillツール一覧は、そのセッションで実際にロードされているマーケットプレイス/プラグインディレクトリ次第で変わり、関連スキルが存在するのに一覧に出てこないことがある。このスキルは、その隙間を`skill-tools search`（ローカル本文語彙と意味検索のハイブリッド検索）で埋め、見つけたスキルをTODOの中の適切な位置に明示的に組み込む。

## 手順

1. **軽微なタスクなら使わない** — typo修正・1行変更・単純な質問への回答など、探索コストに見合わない依頼はスキップしてよい。複数ファイルにまたがる調査・実装・非自明な判断を要するタスクで使う。
2. **先に同梱の`BEST_PRACTICES.md`を確認する** — このリポジトリでよく発生するタスク形状と、その際に組み合わせるスキル群をまとめた早見表。該当するパターンがあれば対応する`patterns/*.md`を読み、そこに書かれたスキルをそのまま手順5のTODO組み込みに使ってよい（`skill-tools search`の呼び出しを省略できる）。合致するパターンがない、またはパターンに載っているスキルだけでは足りないと感じた場合のみ次のステップに進む。
3. **`skill-search`エージェントに依頼内容を渡す** — Agentツールで`meta-plugins/agents/skill-search.md`の`skill-search`サブエージェントを呼ぶ。サブエージェントは真っ新なコンテキストで始まるため、プロンプトには**ユーザー依頼の全文**（要約でなく）と、既に判明している理解・調査結果があればそれも書く。
4. **返ってきた候補を吟味する** — スコアや説明文を鵜呑みにせず、実際にこのタスクで役立つものだけを採用する。1件も無関係なら採用しない。
5. **採用したスキルを、それが実際に必要になる直前のステップとしてTODOに入れる** — TodoWriteでタスクを分解する際、「Skillツールで`<skill-name>`を読み込む」を独立した項目として入れる。位置は一律「先頭」ではなく、そのスキルが使われる直前にする。既存の実装・調査ステップに埋め込まず独立ステップにすることで、読み込み忘れを防ぐ。
   - 例: 調査観点のスキル（例: `writing-subagents`）→ 調査ステップの直前
   - 例: 実装方針・作法のスキル（例: `writing-skill`）→ 該当ファイルを書き始める実装ステップの直前
   - 例: テストの書き方・実行手順のスキル（例: `code-review`）→ 実装完了後、テスト・レビューのステップの直前（TODOの先頭にまとめて置かない）
6. **通常の調査・実装・テストの流れに進む** — 手順5で挿入したスキル読み込みステップは、それぞれ対応する本来の作業の直前で消化する。
7. **作業が一区切りついたら`logs/SKILL_USAGE.md`に1行追記する** — 実際に組み合わせたスキルを記録する。手順2でパターンに合致していた場合は使ったスキルを列挙せず「パターン合致: `patterns/xxx.md`」とだけ書けばよい。合致しなかった場合は実際に使ったスキル名を列挙する。フォーマットは`logs/README.md`を参照。ログの整理・重複の検知・パターンへの昇格はユーザーが都度見直して判断するため、エージェント側でこのログを整理・要約・削除する必要はない（追記のみでよい）。

## 注意

- `skill-tools`のCLI専用インデックスは`skills-site`と別実装・別ライフサイクルであり、`ai-tools.yaml`に登録されていない`meta-plugins/`配下のスキル（`meta`やこの`discovering-skills`自身を含む）は検索対象外。これは既存方針どおりで、修正不要。
- 同じタスク内で何度も呼び直さない。方針が大きく変わった場合のみ再検索する。
- `skill-search`エージェントが「関連するスキルは見つからなかった」と返した場合、無理に既存スキルへこじつけず、通常通り自力で進める。
- このスキル自身と`meta`スキルは、対象読者が異なる（`meta`は`docs/repo-wide/`のメンテ知識ドキュメント選択、こちらはリポジトリ全体のSKILL.md発見）ため別スキルのまま維持する。
- `logs/`はリポジトリ全体の`.gitignore`の`logs/`ルールの対象だが、このディレクトリだけは`.gitignore`側で明示的に例外化してgit管理下に置いている（ユーザーが履歴として見直せるようにするため）。フォーマット・運用ルールは`logs/README.md`、実際のログは`logs/SKILL_USAGE.md`に分かれている。
