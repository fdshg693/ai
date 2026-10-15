export const DEFAULT_MODEL = "minimax/minimax-m3";
export const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
export const OPENROUTER_TIMEOUT_MS = 30_000;
/** Max skills passed to the chat model after embedding similarity ranking. */
export const SUGGEST_TOP_K = 10;

export function extractText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((part) => (typeof part === "string" ? part : part?.text || "")).join("");
  }
  return "";
}

export function parseSuggestions(text) {
  const stripped = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(stripped);
  } catch {
    const match = stripped.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("failed to parse suggestions");
    return JSON.parse(match[0]);
  }
}

/**
 * Build chat messages for recommend. `index` must already be the embedding top-K
 * candidates (at most SUGGEST_TOP_K); embeddings are not sent to the LLM.
 */
export function buildMessages(query, index) {
  const catalogText = JSON.stringify(
    index.map(({ path, name, description, tool, plugin }) => ({ path, name, description, tool, plugin })),
  );
  return [
    {
      role: "system",
      content:
        "あなたはAIコーディングツール向けスキルのレコメンドアシスタントです。" +
        "与えられたスキル一覧(JSON配列、各要素はpath/name/description/tool/plugin)の中から、" +
        "ユーザーの質問に関連するスキルを最大5件選び、" +
        '厳密に次の形式のJSON配列のみを出力してください（説明文やコードフェンスは一切付けない）: ' +
        '[{"path": "元のpathをそのまま", "reason": "日本語で1文の理由"}]。' +
        "一覧に無いpathを作り出さないこと。関連するスキルが無ければ空配列 [] を返すこと。",
    },
    { role: "user", content: `スキル一覧: ${catalogText}\n\n質問: ${query}` },
  ];
}

export function matchSuggestions(parsed, index) {
  if (!Array.isArray(parsed)) throw new Error("unexpected suggestion shape");
  const indexByPath = new Map(index.map((skill) => [skill.path, skill]));
  return parsed
    .filter((entry) => entry && typeof entry.path === "string" && indexByPath.has(entry.path))
    .map((entry) => {
      const skill = indexByPath.get(entry.path);
      return {
        skill: {
          path: skill.path,
          name: skill.name,
          description: skill.description,
          tool: skill.tool,
          plugin: skill.plugin,
        },
        reason: typeof entry.reason === "string" ? entry.reason : "",
      };
    });
}
