# ラフプラン作成時

要件や実装方針がまだ固まっていない複雑なタスクで、詳細プランを書く前に方針を書き殴るためのフェーズ。汎用的な考え方は [references/skills-general/rough-plan.md](../skills-general/rough-plan.md) を参照（この2ファイルの内容はほぼ共通）。このファイルではこのリポジトリ固有の補足のみ記す。

- 置き場所・frontmatter（`type: Rough Plan`、`drafting`/`ready-for-plan`/`promoted`の3値）は [README.md](../../README.md) の「ラフプランの置き場所」節を参照。
- 書き殴り方のサンプル: [references/rough/example.md](../rough/example.md)（同じ架空機能を題材に、詳細プランを書く前段階の書き殴り方を示している）。
- 複数案の比較検討で方向性の壁打ちがしたいだけなら、この段階でサブエージェントを立てる必要は薄い。ステップ分割・実行主体の提案が欲しくなったら、詳細プラン作成時に [proposing-flow](../../../../claude-plugins/coding/skills/proposing-flow/SKILL.md) スキルを使う（[plan-writing.md](plan-writing.md) 参照）。
- 方針が固まったら [plan-writing.md](plan-writing.md) のフォーマットに従って詳細プランへ整理する。
