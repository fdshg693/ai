import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  OPENROUTER_EMBEDDINGS_URL,
  buildEmbeddingText,
  fetchEmbeddings,
  missingRequiredKeyMessage,
} from "../api/src/lib/embeddings.js";

export {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  OPENROUTER_EMBEDDINGS_URL,
  buildEmbeddingText,
  fetchEmbeddings,
};

export const AI_INDEX_SCHEMA_VERSION = 2;
export const EMBEDDING_TIMEOUT_MS = 60_000;
export const EMBEDDING_BATCH_SIZE = 64;

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = path.resolve(SCRIPT_DIRECTORY, "..");
const DEFAULT_ENV_PATH = path.join(SITE_ROOT, ".env");

/** Load skills-site/.env into process.env when present (does not override existing keys). */
export function loadLocalEnv(envPath = DEFAULT_ENV_PATH) {
  try {
    process.loadEnvFile(envPath);
  } catch {
    // Missing .env is fine when OPENROUTER_API_KEY is already set (e.g. CI).
  }
}

export function hashEmbeddingText(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

async function fetchEmbeddingsBatched(texts, { apiKey, fetchImpl = fetch } = {}) {
  const all = [];
  for (let offset = 0; offset < texts.length; offset += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(offset, offset + EMBEDDING_BATCH_SIZE);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), EMBEDDING_TIMEOUT_MS);
    try {
      const embeddings = await fetchEmbeddings(batch, {
        apiKey,
        fetchImpl,
        signal: controller.signal,
      });
      all.push(...embeddings);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`OpenRouter embeddings timed out after ${EMBEDDING_TIMEOUT_MS}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  return all;
}

/**
 * Read a previous AI index for content-hash reuse, or null when unusable.
 * @param {string} aiIndexPath
 */
export async function loadPreviousAiIndex(aiIndexPath) {
  try {
    const parsed = JSON.parse(await fs.promises.readFile(aiIndexPath, "utf8"));
    if (
      parsed?.schemaVersion !== AI_INDEX_SCHEMA_VERSION ||
      parsed?.embeddingModel !== EMBEDDING_MODEL ||
      parsed?.embeddingDimensions !== EMBEDDING_DIMENSIONS ||
      !Array.isArray(parsed.skills)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Attach embeddings to slim AI-index skill rows.
 * Reuses previous vectors when embeddingHash matches (local incremental builds).
 *
 * @param {Array<{ path: string, name: string, description: string, tool: string, plugin: string, status: { key: string } }>} skills
 * @param {{
 *   apiKey?: string,
 *   previousIndex?: { skills?: Array } | null,
 *   fetchImpl?: typeof fetch,
 *   fetchEmbeddingsFn?: typeof fetchEmbeddingsBatched,
 * }} [options]
 */
export async function attachSkillEmbeddings(
  skills,
  {
    apiKey = process.env.OPENROUTER_API_KEY?.trim(),
    previousIndex = null,
    fetchImpl = fetch,
    fetchEmbeddingsFn = fetchEmbeddingsBatched,
  } = {},
) {
  const previousByPath = new Map(
    (previousIndex?.skills || [])
      .filter(
        (skill) =>
          skill &&
          typeof skill.path === "string" &&
          typeof skill.embeddingHash === "string" &&
          Array.isArray(skill.embedding) &&
          skill.embedding.length === EMBEDDING_DIMENSIONS,
      )
      .map((skill) => [skill.path, skill]),
  );

  const prepared = skills.map((skill) => {
    const text = buildEmbeddingText(skill);
    const embeddingHash = hashEmbeddingText(text);
    const previous = previousByPath.get(skill.path);
    const reusable = previous && previous.embeddingHash === embeddingHash ? previous.embedding : null;
    return { skill, text, embeddingHash, reusable };
  });

  const toFetch = prepared.filter((entry) => !entry.reusable);
  if (toFetch.length > 0 && !apiKey) {
    throw new Error(
      `${missingRequiredKeyMessage("OPENROUTER_API_KEY")}\n` +
        "CI では OPENROUTER_API_KEY シークレットが必要です。",
    );
  }

  const fetched =
    toFetch.length > 0
      ? await fetchEmbeddingsFn(
          toFetch.map((entry) => entry.text),
          { apiKey, fetchImpl },
        )
      : [];

  if (fetched.length !== toFetch.length) {
    throw new Error("Embedding count does not match skills needing computation");
  }

  let fetchIndex = 0;
  return prepared.map((entry) => {
    const embedding = entry.reusable || fetched[fetchIndex++];
    return {
      path: entry.skill.path,
      name: entry.skill.name,
      description: entry.skill.description,
      tool: entry.skill.tool,
      plugin: entry.skill.plugin,
      status: { key: entry.skill.status.key },
      embedding,
      embeddingHash: entry.embeddingHash,
    };
  });
}
