---
type: Plan
status: implementing-done
order: 2/3
depends_on:
  - ../account-foundation/00-overview.md # Step3（入力検証基盤）まで完了していること
blocks:
  - ../notification-preferences/00-overview.md # 本プラン完了後に着手可
---

## 実装ステータス

- [x] [01-research-step-example.md](01-research-step-example.md) — 外部API仕様の事前調査
- [x] [02-implementation-step-example.md](02-implementation-step-example.md) — APIクライアント実装 + フォーム組み込み

# 郵便番号からの住所自動入力機能 実装プラン - 概要（サンプル）

> これは `.claude/plans/references/` 配下のサンプルです。架空の機能を題材に、複数ステップに分割するプランの書き方を示しています。実装対象ではありません。
>
> このファイルは**実行済みの状態**も示している — frontmatterの`status: implementing-done`と、frontmatter直下の「実装ステータス」チェックボックスは、プラン実行中に必ず更新する進捗導線のサンプル。新規プランではチェックボックスを`- [ ]`で作り、開始・完了のたびにoverviewの`status`と一緒に更新する。完了前には必ずprogressへ最終記録を書く（[references/progress/README.md](progress/README.md) 参照）。
>
> `order`/`depends_on`/`blocks`は、別プランとの関係を同じfrontmatterに書く例です。`../account-foundation/`と`../notification-preferences/`は架空の兄弟プランであり、実際のプランでは相手側にも逆方向のキーを対で書く。依存がないプランにはこの3キーを付けない。
>
> 実際のプランなら`implementing-done`後、依存する未完了プランがなければ削除対象だが（[README.md](../README.md)の「完了後の後片付け」節参照）、このファイルはテンプレートのため削除せず残している。

## 要件

- 会員登録フォームの郵便番号欄に、外部API（zipcloud）を使った住所自動入力を追加する。
- 該当住所が無い場合はエラーにせず、住所欄を空のまま残す。

## 実装ステップ

1. [01-research-step-example.md](01-research-step-example.md) — 外部API仕様の事前調査（Web調査 + 既存コード調査をHaikuサブエージェントへ委任） → 詳細結果: [progress/01-research-results-example.md](progress/01-research-results-example.md)
2. [02-implementation-step-example.md](02-implementation-step-example.md) — APIクライアント実装 + フォーム組み込み → 実装メモ・差分: [progress/02-implementation-notes-example.md](progress/02-implementation-notes-example.md)

## 主要な決定事項

| 決定                                                                             | 理由                                                                                                    |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| DBスキーマは変更しない（住所は取得のたびにフォームへ表示するだけで永続化しない） | 保存が要件に含まれておらず、永続化は過剰設計                                                            |
| 外部APIクライアントは新規レイヤー `Services/ExternalApi/` として独立させる       | Article本体のドメインロジックとは無関係な横断的関心事であり、既存の `ArticleService` 等とは責務が異なる |

## 変更/新規ファイル一覧

（各ファイルの役割・読むべき既存ファイルは各ステップを参照）

### 新規

- `ArticleShare/Services/ExternalApi/IPostalCodeApiClient.cs` / `PostalCodeApiClient.cs`
- `ArticleShare/wwwroot/js/postal-code-autofill.js`
- `.claude/rules/external-api.md`

### 変更

- `ArticleShare/Controllers/AccountController.cs`
- `ArticleShare/Views/Account/Register.cshtml`

## ルール更新ポイント

> ルールの格納先はレポジトリによって異なる。`.claude/rules/`（Claude Code・複数ファイル＋`paths:`フロントマター）、`AGENTS.md`（レポジトリ直下・Codex等）、`CLAUDE.md`（Claude Codeのプロジェクトメモリ）、`.clinerules`（Cline）など。本サンプルでは `.claude/rules/` を前提で書くが、実際のプランでは対象レポジトリの既存ルール格納先に合わせて読み替えること。

- `external-api.md`（Step2, 新規作成・フロントマター付き）: 外部APIクライアントの配置規約とレスポンス成否判定の注意点

## 推奨の進め方（概要ファイル）

- **立案時**: ステップ分割や実行主体（メイン/サブエージェント）の割り当てに迷うなら [proposing-flow](../../skills/proposing-flow/SKILL.md) スキルで `flow-proposer` サブエージェントに「調査/実装/テストの各ステップと実行主体」を提案させ、それを概要のステップ一覧へ落とす。提案をそのまま正とせず、最終的な採否はプランを書く側が判断する。
- **TODO化**: ステップ一覧の各項目をそのままTODO項目にする。各ステップの進め方（実行主体・スキル・TODO粒度）の詳細は各ステップファイルの「推奨の進め方」節に書き、概要には持ち込まない（概要は目次・導線を保つ）。
- **関連スキル**: 複数ステップをサブエージェントで並行させるなら [writing-workflows](../../skills/writing-workflows/SKILL.md)。セッションをまたいで再開する前提なら [task-tracker](../../skills/task-tracker/SKILL.md)。実行主体・スキル選定の判断軸は [README.md](../README.md) の「ステップの推奨の進め方」節のメニューを参照。

---

## 書き方のポイント

- **要件は2〜4行の箇条書きで十分。** 背景の説明やユースケースの動機は書かない。
- **外部API・外部ライブラリなど、実装前にWeb上の仕様を確認しないと決定事項が固まらない機能は、調査を独立したステップ（Step1）として先に置く。** 実装ステップ（Step2）はその結果を前提に書けるので、調査時に読んだページの全文を実装ステップ側に持ち込まずに済む。詳細は[README.md](../README.md)の「外部知識が必要な場合」節を参照。
- **実装ステップの数は機能の複雑さなりに。** 小さい機能は調査ステップも不要で、1ファイルに収める（[03-single-file-example.md](03-single-file-example.md) 参照）。無理に `00-overview.md` + 複数ステップの型に当てはめない。
- **決定事項は「決定」と「理由」を1行ずつ。** 判断の根拠となる規約は `[[リンク]]` で指すだけにする。理由の全文はリンク先のルールファイル（`.claude/rules/`・`AGENTS.md`・`CLAUDE.md` 等、レポジトリの格納先）に書かれているべきもので、プラン側で重複させない。
- **ファイル一覧は「新規」「変更」の2分類のみ。** 「読むべきファイル・推奨Grep」のような、実装者向けの詳細な手引きは各ステップファイル側に書き、概要ファイルには持ち込まない。
- **frontmatter直下の「実装ステータス」は必須。** 新規プランでは各ステップを`- [ ]`で列挙し、開始・完了のたびに対応するチェックボックスを更新する。概要ファイルのfrontmatter `status` は機能全体の代表ステータスであり、チェックボックスと同時に更新する。個々のステップの詳細な状態は各ステップファイル側のfrontmatterを見る（自動集計はしない。手動で揃える）。値の意味は[README.md](../README.md)の「プランのfrontmatter（OKF準拠）」節を参照。
- **別プランの依存はoverviewのfrontmatterで表す。** `order`は読みやすい予定順、`depends_on`は着手条件、`blocks`はその逆方向の宣言。パスは兄弟プランのoverviewを指し、コメントで必要な完了ステップを補足する。2つのプランの片側だけを更新しない。
