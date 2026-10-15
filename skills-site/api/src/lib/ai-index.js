import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from "./embeddings.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA_ROOT = path.resolve(HERE, "../../data");

let cachedAiIndex = null;

function assertSkillEmbeddings(skills) {
  for (const skill of skills) {
    if (
      !skill ||
      typeof skill.path !== "string" ||
      !Array.isArray(skill.embedding) ||
      skill.embedding.length !== EMBEDDING_DIMENSIONS ||
      skill.embedding.some((value) => typeof value !== "number" || !Number.isFinite(value))
    ) {
      throw new Error("ai-index.json skill embedding is missing or invalid");
    }
  }
}

export function loadAiIndex() {
  if (cachedAiIndex) return cachedAiIndex;
  const raw = fs.readFileSync(path.join(DATA_ROOT, "ai-index.json"), "utf8");
  const parsed = JSON.parse(raw);
  if (
    !parsed ||
    parsed.schemaVersion !== 2 ||
    parsed.embeddingModel !== EMBEDDING_MODEL ||
    parsed.embeddingDimensions !== EMBEDDING_DIMENSIONS ||
    !Array.isArray(parsed.skills)
  ) {
    throw new Error("ai-index.json has unexpected shape");
  }
  assertSkillEmbeddings(parsed.skills);
  cachedAiIndex = parsed;
  return cachedAiIndex;
}
