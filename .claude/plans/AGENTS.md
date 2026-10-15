## `.claude/plans` 運用ルール

機能実装前のプランを置く場所。新規プランを**書く前**にも、既存プランを**読み込んで実装を進める前**にも、以下から場面に応じたスキルを参照すること。

| 場面             | 参照先                                                                     |
| ---------------- | -------------------------------------------------------------------------- |
| ラフプラン作成時 | [references/skills/rough-plan.md](references/skills/rough-plan.md)         |
| プラン作成時     | [references/skills/plan-writing.md](references/skills/plan-writing.md)     |
| プラン実行時     | [references/skills/plan-execution.md](references/skills/plan-execution.md) |

網羅的な詳細（フォーマットの全項目・判断軸メニュー）は [README.md](README.md) にまとまっている。上記3ファイルはREADME.mdの該当節への導線を兼ねる。

- 複数プランにまたがる作業は、作成・実行前に関係する`00-overview.md`の`order`/`depends_on`/`blocks`を確認する。着手条件を満たすまで後続プランを開始せず、関係を変えるときは両端のfrontmatterを対で更新する。

- フォルダ方式の詳細プランは、初版のレビュー後・実行着手前に `uv run .claude/plans/snapshot_plan.py .claude/plans/<plan-name>` を実行して初版を `snapshot/` に凍結する。以降 `snapshot/` は編集せず、更新は親フォルダ側のプランだけに行う（[README.md](README.md) の「初版プランのスナップショット」節参照）。

- このレポジトリでは、Claude Rule の source として `.claude/rules/` を使い、ネストした `AGENTS.md` は `nested_agents_md` hook scenario の入力として維持する。用途の異なる入力を一括移行しない。
  - `.github/instructions`・`.clinerules` などのAIツールのルールファイルは、`lefthook.yml`による自動同期が走るので気にしなくていい。
- **スキル選定は必ず [discovering-skills](../../meta-plugins/skills/discovering-skills/SKILL.md) スキルの手順に従う。** 先に同梱の [BEST_PRACTICES.md](../../meta-plugins/skills/discovering-skills/BEST_PRACTICES.md) を確認し、該当パターンが無ければ `skill-search` サブエージェントで検索する。上記3ファイル（`references/skills/*.md`）で名前を挙げているスキルは代表例に過ぎず、90件超あるこのリポジトリの全スキルを網羅していない。

汎用的に他プロジェクトへ持ち出せる版（このリポジトリ固有のスキル連携を含まない）は [AGENTS_GENERAL.md](AGENTS_GENERAL.md) と [references/skills-general/](references/skills-general/) を参照。他プロジェクトへコピーして使う手順は [COPYING.md](COPYING.md) を参照。
