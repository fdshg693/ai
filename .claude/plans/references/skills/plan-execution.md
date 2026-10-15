# プラン実行時

進捗記録・完了後の後片付けの基本ルールは [references/skills-general/plan-execution.md](../skills-general/plan-execution.md) を参照。このリポジトリでは、次の手順を**プラン実行の完了条件**として必ず行う。

## 必須の更新手順

1. ステップを開始・中断・完了するたびに、そのステップのfrontmatter `status` を更新する。
2. `00-overview.md` がある場合は、frontmatter直下の「実装ステータス」の`- [ ]` / `- [x]`とoverviewのfrontmatter `status` を同時に更新する。
3. `depends_on`がある場合は、各参照先とコメントに書かれた完了条件を確認してから着手する。依存関係を変えるときは、相手プランの`depends_on`/`blocks`と`order`も同時に更新する。
4. 予定外の事実が判明した場合は、影響を受ける後続ステップまたは後続タスクのプラン本文を直接更新する。`progress/` への引継ぎメモだけで済ませてはならない。
5. 初版は `snapshot/` に凍結済みなので、親フォルダ側のプランは古い記述の削除・全面改稿を含めて自由に書き換えてよい（`snapshot/` は編集しない）。変更したプランには「実行中に判明した変更」または「計画との差分」節を残し、判明した事実、更新箇所、理由の要約を記録すると追いやすい。詳細な根拠だけをprogressへ置く。
6. プラン終了前に必ずprogressファイルを作り、完了範囲・検証結果・差分の有無を記録する。差分がなければ「差分なし」と明記する。
7. 最終progressを書いた後、全ステップを `implementing-done`、overviewのstatusと全チェックボックスを完了へ更新してから、`depends_on`/`blocks`でつながる未完了プランがなければプラン削除と参照除去の後片付けを行う。

## 進捗記録のサンプル

- [references/progress/README.md](../progress/README.md) — 進捗記録の棲み分け方（何をプランファイル本体に残し、何を progress に置くか）
- [references/progress/01-research-results-example.md](../progress/01-research-results-example.md) — 調査ステップの詳細結果とプラン本文への反映記録
- [references/progress/02-implementation-notes-example.md](../progress/02-implementation-notes-example.md) — 実装ステップの計画との差分・実装メモ

## 実行時に使えるスキル

**スキル選定は必ず [discovering-skills](../../../../meta-plugins/skills/discovering-skills/SKILL.md) スキルの手順に従う。** 先に同梱の [BEST_PRACTICES.md](../../../../meta-plugins/skills/discovering-skills/BEST_PRACTICES.md) でこのリポジトリの典型パターンを確認し、該当が無ければ `skill-search` サブエージェントで探す。以下は代表例に過ぎず、90件超あるこのリポジトリの全スキルを網羅していない。

- ルール更新（`AGENTS.md` への追記のフォーマット）: [writing-rules](../../../../claude-plugins/meta/skills/writing-rules/writing.md)
- 再利用するサブエージェントを作る場合: [writing-subagents](../../../../claude-plugins/meta/skills/writing-subagents/SKILL.md)
- 複数ステップをサブエージェントで並行させる場合（Dynamic Workflow）: [writing-workflows](../../../../claude-plugins/meta/skills/writing-workflows/SKILL.md)

実行主体・スキル選定の判断軸は [README.md](../../README.md) の「ステップの推奨の進め方」節のメニューを参照。
