import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import MiniSearch from "minisearch";
import { SEARCH_INDEX_OPTIONS, SEARCH_QUERY_OPTIONS } from "./search-options.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA_ROOT = path.resolve(HERE, "../../data");

let cachedIndex = null;

export function loadSearchIndex() {
  if (cachedIndex) return cachedIndex;
  const raw = fs.readFileSync(path.join(DATA_ROOT, "search-index.json"), "utf8");
  cachedIndex = MiniSearch.loadJSON(raw, SEARCH_INDEX_OPTIONS);
  return cachedIndex;
}

/**
 * @param {{ q: string, tool?: string, plugin?: string, status?: string, limit?: number }} query
 */
export function searchSkills({ q, tool = "", plugin = "", status = "", limit = 50 }) {
  const index = loadSearchIndex();
  const trimmed = String(q || "").trim();
  if (!trimmed) return [];

  const hits = index.search(trimmed, SEARCH_QUERY_OPTIONS);
  const results = [];
  for (const hit of hits) {
    const doc = {
      path: hit.path ?? hit.id,
      name: hit.name,
      description: hit.description,
      tool: hit.tool,
      plugin: hit.plugin,
      status: hit.status,
      score: hit.score,
    };
    if (tool && doc.tool !== tool) continue;
    if (plugin && doc.plugin !== plugin) continue;
    if (status && doc.status !== status) continue;
    results.push(doc);
    if (results.length >= limit) break;
  }
  return results;
}
