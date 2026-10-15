/**
 * Shared MiniSearch options for build-time index + runtime loadJSON.
 * Japanese: 2–3 character n-grams. Latin: whitespace tokens (prefix search at query time).
 */
const CJK = /[\u3040-\u30ff\u3400-\u9fff]/;
const SPLIT = /[\s\u3000、。，．・／/\\|_.,;:!?()[\]{}「」『』【】<>「」]+/;

export function tokenize(text) {
  const normalized = String(text || "")
    .toLowerCase()
    .trim();
  if (!normalized) return [];

  const tokens = [];
  for (const part of normalized.split(SPLIT).filter(Boolean)) {
    if (CJK.test(part)) {
      if (part.length === 1) {
        tokens.push(part);
        continue;
      }
      for (const n of [2, 3]) {
        if (part.length < n) continue;
        for (let i = 0; i <= part.length - n; i += 1) {
          tokens.push(part.slice(i, i + n));
        }
      }
    } else {
      tokens.push(part);
    }
  }
  return tokens;
}

export const SEARCH_INDEX_OPTIONS = {
  idField: "path",
  fields: ["name", "description", "tool", "plugin"],
  storeFields: ["path", "name", "description", "tool", "plugin", "status"],
  tokenize,
};

export const SEARCH_QUERY_OPTIONS = {
  prefix: true,
  combineWith: "AND",
  boost: { name: 3, description: 1.5, tool: 1, plugin: 1 },
};
