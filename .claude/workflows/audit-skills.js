// audit-skills — SKILL.md をベストプラクティス(claude-plugins/meta/skills/writing-skill/bestpractices.md)に
// 照らして監査し、優先度別の日本語Markdownレポートを返すワークフロー。
//
// 【デフォルトの対象】
// 引数なしで `/audit-skills` を実行すると、`claude-plugins/meta/skills/claude-cli-docs/SKILL.md` の
// 1件だけを監査します。これは「間違えて引数なしで実行してもすぐ終わる・agentを1〜2体しか
// 起動しない」ようにするための安全な既定値であり、リポジトリ全体の監査がデフォルトでは
// ありません。全件監査したい場合は必ず対象を明示してください。
//
// 【対象の指定方法(args)】
// args にはリポジトリルートからの相対パス(フォワードスラッシュ区切り)を、文字列 or 配列で渡します。
// 各要素は「SKILL.mdファイルへの直接パス」でも「配下を再帰的に探すディレクトリ」でも構いません。
//
//   例1: 特定の1ファイルだけ監査
//     /audit-skills claude-plugins/meta/skills/writing-skill/SKILL.md
//
//   例2: ディレクトリ配下を再帰的に監査(directory内の全SKILL.mdが対象になる)
//     /audit-skills claude-plugins/coding/skills
//
//   例3: 複数対象をまとめて指定(ファイル・ディレクトリを混在可)
//     /audit-skills ["claude-plugins/coding/skills", "claude-plugins/meta/skills/writing-workflows/SKILL.md"]
//
//   例4: リポジトリ全体(claude-plugins 配下すべて)を監査
//     /audit-skills ["claude-plugins"]
//     → 40件超のSKILL.mdが対象になり得るため、agentが十数体〜数十体起動しトークン消費も
//       大きくなります。まず1ディレクトリなど小さい範囲で試してから範囲を広げてください。
//
// 【処理の流れ】
// 1. 対象探索: 指定ルート配下のSKILL.mdを1体のagentがGlobで動的に列挙(ハードコードしない)
// 2. バッチ監査: 4件ずつバッチ化し、バッチごとに独立agentが bestpractices.md の基準で
//    優先度(高/中/低)・問題点(重大/軽微)・改善提案を構造化出力
// 3. 件数集計・優先度分類はスクリプト側のJSで決定論的に処理(agent任せにしない)
// 4. レポート集約: 別agentが優先度順+頻出パターンをまとめた日本語Markdownレポートに統合
//
// 戻り値は { roots, audited, counts, report } のオブジェクト。report が最終的な監査レポート本文。

export const meta = {
  name: 'audit-skills',
  description:
    "Audit SKILL.md files in this repo against claude-plugins/meta/skills/writing-skill/bestpractices.md, fan out per batch, and return a priority-sorted Japanese report. Pass a root path (or array of paths, repo-relative; file or directory) via args to scope the audit; defaults to the single file 'claude-plugins/meta/skills/claude-cli-docs/SKILL.md' so an accidental no-args run finishes fast.",
  phases: ['対象探索', 'バッチ監査', 'レポート集約'],
}

const BESTPRACTICES = 'claude-plugins/meta/skills/writing-skill/bestpractices.md'
const WRITING = 'claude-plugins/meta/skills/writing-skill/writing.md'
const BATCH_SIZE = 4

const roots = args ? (Array.isArray(args) ? args : [args]) : ['claude-plugins/meta/skills/claude-cli-docs/SKILL.md']

const found = await agent(
  `次のパスから SKILL.md ファイルを列挙してください: ${roots.join(', ')}\n` +
    `各パスについて、パス自体が "SKILL.md" というファイル名で終わっていればそのパスをそのまま1件として扱ってください。` +
    `そうでなければディレクトリとみなし、配下を Glob ツールで "**/SKILL.md" パターンで再帰的に検索してください。\n` +
    `見つかった全パスをリポジトリルートからの相対パス(フォワードスラッシュ区切り)で返してください。存在しないパスは無視してください。`,
  {
    label: '対象探索',
    schema: {
      type: 'object',
      required: ['files'],
      properties: { files: { type: 'array', items: { type: 'string' } } },
    },
  },
)

const targets = [...new Set(found.files ?? [])].sort()

if (targets.length === 0) {
  return { roots, audited: 0, report: '対象となる SKILL.md が見つかりませんでした。' }
}

const batches = []
for (let i = 0; i < targets.length; i += BATCH_SIZE) {
  batches.push(targets.slice(i, i + BATCH_SIZE))
}

const batchSchema = {
  type: 'object',
  required: ['results'],
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        required: ['skill', 'path', 'priority', 'issues'],
        properties: {
          skill: { type: 'string' },
          path: { type: 'string' },
          priority: { type: 'string', enum: ['高', '中', '低'] },
          good_points: { type: 'array', items: { type: 'string' } },
          issues: {
            type: 'array',
            items: {
              type: 'object',
              required: ['severity', 'description'],
              properties: {
                severity: { type: 'string', enum: ['重大', '軽微'] },
                description: { type: 'string' },
              },
            },
          },
          suggestions: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
}

const batchResults = await pipeline(batches, batch =>
  agent(
    `あなたはClaude CodeのスキルSKILL.mdをレビューします。\n\n` +
      `## 必須の準備作業\n` +
      `まず必ず以下をReadツールで読んでください（評価基準そのものです）:\n` +
      `- ${BESTPRACTICES}\n` +
      `- ${WRITING}（書き方の指針、参考）\n\n` +
      `## 評価対象（${batch.length}件。それぞれ同ディレクトリの同梱ファイルも必要に応じて確認。全文精読は不要で、構成と分量感の把握で十分）\n` +
      batch.map((p, i) => `${i + 1}. ${p}`).join('\n') +
      `\n\n## 評価観点\n` +
      `1. bestpractices.md の各項目に沿っているか\n` +
      `2. 初見で読んで用途がすぐ理解できるか\n` +
      `3. 冗長でないか、逆に説明不足でないか\n` +
      `4. 記述と実装の乖離、リンク切れの可能性、古い情報がないか\n\n` +
      `各スキルについて問題点を「重大」「軽微」に分け、該当箇所を具体的に示してください。良い点があれば簡潔に。改善提案も簡潔に。`,
    { label: batch.join(', '), schema: batchSchema },
  ),
)

const results = batchResults.flatMap(r => r?.results ?? [])

const byPriority = { 高: [], 中: [], 低: [] }
for (const r of results) {
  if (r && byPriority[r.priority]) byPriority[r.priority].push(r)
}

const synthesis = await agent(
  `以下は SKILL.md 監査結果(JSON、優先度別)です。探索対象 ${targets.length} 件中 ${results.length} 件を評価しました。\n` +
    `優先度「高」→「中」→「低」の順に、スキルごとの問題点・改善提案を簡潔にまとめた日本語Markdownレポートを作成してください。\n` +
    `個々の生出力の丸写しではなく要点を絞ること。全体を通じて頻出する問題パターン（例:「参照ファイルに目次がない」が複数スキルで共通、など）があれば、個別指摘とは別に「頻出パターン」節としてまとめてください。\n\n` +
    JSON.stringify(byPriority, null, 2),
  { label: 'レポート集約' },
)

return {
  roots,
  audited: targets.length,
  counts: { 高: byPriority.高.length, 中: byPriority.中.length, 低: byPriority.低.length },
  report: synthesis,
}
