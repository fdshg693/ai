/** Client helpers for the AISuggest React island (server `/api/suggest` path). */

export const REQUEST_TIMEOUT_MS = 45_000;

/** Mirrors src/lib/catalog.js#skillRoutePath's segment-encoding (leading-dot escape for Azure SWA). */
function encodeSkillPathSegment(segment) {
  const encoded = encodeURIComponent(segment);
  return encoded.startsWith(".") ? `dot-${encoded.slice(1)}` : encoded;
}

/** Mirrors src/lib/catalog.js#skillHref. */
export function skillHref(path, basePath = "") {
  return `${basePath}/skills/${path.split("/").map(encodeSkillPathSegment).join("/")}`;
}

export function apiErrorMessage(code, status) {
  if (code === "rate_limited" || status === 429) {
    return "レート制限に達しました。しばらくしてから再試行してください。";
  }
  if (code === "timeout" || status === 504) {
    return "リクエストがタイムアウトしました。";
  }
  if (code === "unavailable" || status === 503) {
    return "提案機能は現在利用できません。しばらくしてから再試行してください。";
  }
  if (code === "bad_request" || status === 400) {
    return "質問の内容を確認してください。";
  }
  return "提案の取得に失敗しました。しばらくしてから再試行してください。";
}
