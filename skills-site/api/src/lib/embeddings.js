import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

/** skills-site/.env — fixed path used by catalog:build, /api/suggest, and skill-search. */
export const SKILLS_SITE_ENV_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../.env",
);

export function missingRequiredKeyMessage(key, envPath = SKILLS_SITE_ENV_PATH) {
  const envState = key in process.env ? "空で設定されている" : "未設定";
  let fileState;
  try {
    fileState = fs.statSync(envPath).isFile()
      ? `${envPath} はありますが、${key} が無いか空です。`
      : `想定した .env は ${envPath} ですが、ファイルがありません。`;
  } catch {
    fileState = `想定した .env は ${envPath} ですが、ファイルがありません。`;
  }
  return `${key} が解決できません。\n環境変数 ${key} は${envState}です。\n${fileState}`;
}

/** Shared OpenRouter embedding constants and helpers (build-time + suggest runtime). */

export const EMBEDDING_MODEL = "openai/text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;
export const OPENROUTER_EMBEDDINGS_URL = "https://openrouter.ai/api/v1/embeddings";

/**
 * Fixed embedding input format for skill vectors.
 * Do not change without recomputing the AI index.
 */
export function buildEmbeddingText({ name, description }) {
  return `name: ${name}\ndescription: ${description ?? ""}`;
}

/**
 * Call OpenRouter Embeddings API for one or more input strings.
 * @param {string[]} texts
 * @param {{ apiKey: string, fetchImpl?: typeof fetch, signal?: AbortSignal }} options
 * @returns {Promise<number[][]>}
 */
export async function fetchEmbeddings(texts, { apiKey, fetchImpl = fetch, signal } = {}) {
  if (!apiKey) throw new Error(missingRequiredKeyMessage("OPENROUTER_API_KEY"));
  if (!Array.isArray(texts) || texts.length === 0) return [];

  const response = await fetchImpl(OPENROUTER_EMBEDDINGS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts,
      dimensions: EMBEDDING_DIMENSIONS,
    }),
    signal,
  });

  if (!response.ok) {
    let detail = "";
    try {
      detail = (await response.text()).slice(0, 200);
    } catch {
      // ignore body read failures
    }
    const error = new Error(
      `OpenRouter embeddings failed (${response.status})${detail ? `: ${detail}` : ""}`,
    );
    error.status = response.status;
    throw error;
  }

  const data = await response.json();
  const rows = Array.isArray(data?.data) ? data.data : null;
  if (!rows || rows.length !== texts.length) {
    throw new Error("OpenRouter embeddings response has unexpected shape");
  }

  const byIndex = new Map(rows.map((row) => [row.index, row.embedding]));
  const embeddings = [];
  for (let i = 0; i < texts.length; i += 1) {
    const embedding = byIndex.has(i) ? byIndex.get(i) : rows[i]?.embedding;
    if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(`Embedding at index ${i} has unexpected dimensions`);
    }
    if (embedding.some((value) => typeof value !== "number" || !Number.isFinite(value))) {
      throw new Error(`Embedding at index ${i} contains non-finite values`);
    }
    embeddings.push(embedding);
  }
  return embeddings;
}
