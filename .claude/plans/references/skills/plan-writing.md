# プラン作成時

詳細プランの書き方（5点フォーマット・OKF frontmatter・ステップ分割の目安）は [references/skills-general/plan-writing.md](../skills-general/plan-writing.md) を参照（この2ファイルの内容はほぼ共通）。このファイルではこのリポジトリ固有の補足のみ記す。

複数プランの依存を作る場合も、同ファイルの「プランフォルダ間の依存関係」に従い、関係する`00-overview.md`の`order`/`depends_on`/`blocks`を対で更新する。

初版の凍結スナップショット（`snapshot/`）の取り方も [references/skills-general/plan-writing.md](../skills-general/plan-writing.md) の「初版の凍結スナップショット」に従う。このリポジトリでは `uv run .claude/plans/snapshot_plan.py .claude/plans/<plan-name>` で取得する（[README.md](../../README.md) の「初版プランのスナップショット」節参照）。

## ルールの格納先（このリポジトリ固有）

このリポジトリでは Claude Rule の source を `.claude/rules/` に置き、ネストした `AGENTS.md` は `nested_agents_md` scenario の入力として維持する。「ルール更新ポイント」に書く対象は、Claude Ruleなら `.claude/rules/*.md`、AGENTS運用なら各領域の `AGENTS.md`（レポジトリ直下・サブフォルダ直下いずれもありうる）。`.github/instructions`・`.clinerules` などのAIツールのルールファイルは `lefthook.yml` による自動同期が走るので、手で二重に直す必要はない。

## 書き方の参考

新しくプランを書く前に、まず [references/](../) 配下の4ファイルを読むこと。架空のサンプル機能を題材に、フォーマットの粒度感を示している。

- [00-overview-example.md](../00-overview-example.md) — 複数ステップに分割する場合の概要ファイル
- [01-research-step-example.md](../01-research-step-example.md) — 事前調査ステップ
- [02-implementation-step-example.md](../02-implementation-step-example.md) — 実装ステップ
- [03-single-file-example.md](../03-single-file-example.md) — 小さい機能を1ファイルで完結させる場合

各ファイル末尾の「書き方のポイント」節に、なぜその粒度・構成にしているかの解説がある。実際にプランを書くときはこの4ファイルをテンプレートとして流用してよい。

## 実行主体・スキル選定（サブエージェント活用）

各ステップには「そのステップをどう進めるかの推奨（実行主体・使えるスキル・TODO化の粒度）」を1〜3行で書いておく。詳細な判断軸・メニュー表は [README.md](../../README.md) の「ステップの推奨の進め方」節を参照。

**スキル選定は必ず [discovering-skills](../../../../meta-plugins/skills/discovering-skills/SKILL.md) スキルの手順に従う。** 先に同梱の [BEST_PRACTICES.md](../../../../meta-plugins/skills/discovering-skills/BEST_PRACTICES.md) でこのリポジトリの典型パターンを確認し、該当が無ければ `skill-search` サブエージェントで探す。以下に挙げる `proposing-flow`・`claude-cli-use` は代表例に過ぎず、90件超あるこのリポジトリの全スキルを網羅していない。

立案時にステップ分割・実行主体の提案がほしいときは [proposing-flow](../../../../claude-plugins/coding/skills/proposing-flow/SKILL.md) スキルで `flow-proposer` サブエージェントに提案させてよい（採否はプランを書く側が判断する）。

外部知識の事前調査ステップを重いCLIワンショットへ委譲したい場合は [claude-cli-use](../../../../claude-plugins/meta/skills/claude-cli-use/SKILL.md) スキルを使う。

実行時の進め方（進捗記録・後片付け）は [plan-execution.md](plan-execution.md) を参照。

## プランレビュー（サブエージェントに1回依頼する。必須）

プランは分量が多く、誤りが実装フェーズまで気づかれないと手戻りが大きい。詳細プランを書き終えたら（概要＋ステップ分割・単一ファイル完結いずれも）、実装に着手する前に**必ず1回**、Agentツールでサブエージェントにレビューを依頼する。

- 依頼先: `subagent_type: "Plan"`（設計・アーキテクチャ観点のレビューに向く）。ファイル存在確認など読み取り中心のレビューでよければ `Explore` でも代用できる。
- レビュー→修正のサイクルは**1周のみ**。指摘を踏まえて修正したら、その修正に対する再レビューは不要（レビューをループさせない）。
- 依頼文テンプレート（Agentツールの`prompt`にそのまま流用する）:

```
以下のプランをレビューしてください。実装はまだ着手していません。プラン自体の書き直しは不要で、指摘のみ返してください。

# 元の依頼
{ユーザーからの依頼の全文をここに貼る}

# プラン全文
{00-overview.md〜各ステップファイル、または単一ファイル完結プランの全文をここに貼る}

# 確認してほしい観点
- 「やること」と元の依頼の間にズレ・抜け漏れがないか
- 「触るファイル」に不足・誤りがないか（実在するパスか、他に触るべきファイルが漏れていないか）
- ステップ間およびプラン間の依存関係・実行順序に矛盾がないか（プラン間では`order`、`depends_on`、`blocks`の相互対応と着手条件を確認）
- 「決定事項・注意点」に書かれていない隠れたリスク（競合状態、既存コードとの衝突、破壊的変更など）がないか
- ルール更新ポイントの記載漏れ（新規/変更が必要なルールファイルとその格納先）

指摘は「致命的（実装前に必ず直すべき）」「軽微（直さなくても進められる）」に分けて簡潔に列挙してください。
```
