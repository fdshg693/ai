---
type: Plan Step
status: implementing-done
---

# Step 1: 外部API仕様の事前調査（サンプル）

> [00-overview-example.md](00-overview-example.md) の続き。外部知識が必要な機能で、調査を独立したステップとして切り出す書き方のサンプルです。実装対象ではありません。
>
> このファイルは**実行済みの状態**も示している — frontmatterの`status: implementing-done`と「調査結果」節の progress リンクは、プラン実行中に更新・追記する導線のサンプル。新規プランを書くときは`status: planning-research`または`planning-breakdown`から始め、progressリンクは実行後に追記する。
>
> 詳細な調査結果 → [progress/01-research-results-example.md](progress/01-research-results-example.md)。後続Step2で実行すべき内容は、引継ぎとしてprogressへ置かず、Step2のプラン本文を直接更新する。

## やること

郵便番号→住所変換に使う外部API（zipcloud）の仕様を調査する。このステップではコードは書かない。調査で確定した実装前提は、後続の実装ステップ（[02-implementation-step-example.md](02-implementation-step-example.md)）のプラン本文へ直接反映する。

## 調査観点・キーワード

- `zipcloud API 仕様` — エンドポイント、リクエスト/レスポンス形式
- `zipcloud API 該当なし` — 該当住所が無い場合のレスポンス形式・ステータスコード
- `zipcloud API レート制限` — 呼び出し過多時の挙動

## 実行した調査

- WebSearchで上記キーワードを検索し、公式ドキュメントのURLを特定した。
- 特定したURLをWebFetchで取得し、リクエスト/レスポンス仕様を読解した。
- 既存コードに外部API呼び出しの類似実装が無いかは、Haikuモデルのサブエージェント（Agent tool を `model: haiku` で起動）に委任して調査した。理由: `grep`で候補ファイルを洗い出して有無を確認するだけの軽量な調査であり、ファイル本文をメインの実装コンテキストに持ち込む必要が無いため。

## 調査結果（後続ステップから参照する）

- エンドポイント: `GET https://zipcloud.ibsnet.co.jp/api/search?zipcode={7桁}` — 参照: https://zipcloud.ibsnet.co.jp/doc/api
- 該当住所が無い場合、HTTPステータスは200のまま `results` が `null` になる（エラーではない）。ステータスコードだけで成否判定すると誤判定になる。
- レート制限は数値での明記なし。「短時間での大量アクセスは禁止」という注記のみ。自前のレート制御は今回は見送り、[00-overview-example.md](00-overview-example.md) の決定事項として採用。
- Haikuサブエージェントへの委任結果: `ArticleShare/Services/ExternalApi/` 配下に既存の外部API呼び出し実装は無し。新規にディレクトリごと作成する。

> 上記は要約。生のAPIレスポンス例・検討した選択肢・更新理由は [progress/01-research-results-example.md](progress/01-research-results-example.md) に整理した。Step2のプラン本文は調査結果で更新済みであり、後続の実装者はprogressを引継ぎとして読み直す必要はない。

## 推奨の進め方

- **実行主体**: 設計判断を伴わない軽量なコードベース内調査（既存パターンの有無をgrepで洗い出すだけ、等）は読み取り専用サブエージェント（`Explore`、必要なら `model: haiku` でコスト低下）へ委任する。Web調査そのもの（WebSearch/WebFetch）はメインエージェントが行う — 取得したページの要約を後続ステップの前提にするため、メイン会話の文脈に残す。重いドキュメントの一括読み込みをメインコンテキストに持ち込みたくない場合は [claude-cli-use](../../skills/claude-cli-use/SKILL.md) でCLIワンショットへ委譲してもよい（タスク難度でモデル選択）。委譲先には判断させず、採否はプランを書く側が行う。
- **TODO化**: このステップは1つのTODO項目（「外部API仕様の調査」）。戻りを受けて要約を本プランへ残し、後続Step2のプランを更新してから完了マークにする。progressへの記録は詳細を残すために行い、Step2への作業指示には使わない。
- **関連スキル**: 立案時にステップ分割を提案してほしければ [proposing-flow](../../skills/proposing-flow/SKILL.md)。実行主体・スキル選定の判断軸は [README.md](../README.md) の「ステップの推奨の進め方」節のメニューを参照。

---

## 書き方のポイント

- 調査ステップの目的は「実装ステップを読むエージェントが、Web検索やページ全文を読み直さずに済むこと」。だから調査で読んだページの全文はここに書かず、**要約 + 参照URL** だけを残す。
- 調査観点（キーワード）は検索前に箇条書きで洗い出しておく。行き当たりばったりにWebFetchを連打すると無駄なページ取得が増え、コンテキストを圧迫する。
- 軽量なコードベース内調査（既存パターンの有無をgrepで洗い出すだけ、設計判断を伴わない調査）はHaikuサブエージェントに投げてよい。決定事項（採用するかどうかの判断）自体はプランを書く側が行い、委任先には判断させない。
- このステップ自体はルールを更新しない。知識がまだコードに反映されていないため、ルール更新は実装ステップ（Step2）側で行う。なお「ルール」の格納先はレポジトリによって異なる（`.claude/rules/`・`AGENTS.md`・`CLAUDE.md`・`.clinerules` 等）。各プランでは対象レポジトリの既存格納先に合わせること。
- **frontmatterの`status`は調査ステップでも同じ6値を使う。** `implementing-*`とあるが、調査ステップでは「コード実装」ではなく「そのステップの作業（Web調査等）の実行」を指す。着手前は`planning-research`（このステップの調査観点自体がまだ固まっていない場合）または`ready`、調査を進めている間は`implementing-started`/`implementing-in-progress`、要約を書き終えたら`implementing-done`にする。
