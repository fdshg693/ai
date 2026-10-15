import "../lib/load-local-env.js";
import { app } from "@azure/functions";
import { loadAiIndex } from "../lib/ai-index.js";
import { topKByEmbedding } from "../lib/embedding-similarity.js";
import { fetchEmbeddings, missingRequiredKeyMessage } from "../lib/embeddings.js";
import { checkRateLimit, clientKey } from "../lib/rate-limit.js";
import {
  DEFAULT_MODEL,
  OPENROUTER_TIMEOUT_MS,
  OPENROUTER_URL,
  SUGGEST_TOP_K,
  buildMessages,
  extractText,
  matchSuggestions,
  parseSuggestions,
} from "../lib/suggest-core.js";

const SUGGEST_RATE = { max: 10, windowMs: 60_000 };
const CACHE_TTL_MS = 5 * 60_000;
const MAX_QUERY_LENGTH = 2000;

/** @type {Map<string, { expires: number, body: unknown }>} */
const responseCache = new Map();

function json(status, body, headers = {}) {
  return {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    },
    jsonBody: body,
  };
}

function errorResponse(status, code, headers = {}) {
  return json(status, { error: code }, headers);
}

async function callOpenRouter({ apiKey, messages, signal }) {
  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: DEFAULT_MODEL, messages, temperature: 0.2 }),
    signal,
  });
  return response;
}

function publicSuggestions(matched) {
  return matched.map(({ skill, reason }) => ({
    skill: {
      path: skill.path,
      name: skill.name,
      description: skill.description,
      tool: skill.tool,
      plugin: skill.plugin,
    },
    reason,
  }));
}

app.http("suggest", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (request) => {
    const rate = checkRateLimit(`suggest:${clientKey(request)}`, SUGGEST_RATE);
    if (!rate.allowed) {
      return errorResponse(429, "rate_limited", { "Retry-After": String(rate.retryAfterSec) });
    }

    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (!apiKey) {
      console.error(missingRequiredKeyMessage("OPENROUTER_API_KEY"));
      return errorResponse(503, "unavailable");
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return errorResponse(400, "bad_request");
    }

    const query = typeof payload?.query === "string" ? payload.query.trim() : "";
    if (!query || query.length > MAX_QUERY_LENGTH) {
      return errorResponse(400, "bad_request");
    }
    // Client-supplied model is ignored; chat model is fixed server-side.

    const cacheKey = query;
    const cached = responseCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return json(200, cached.body);
    }

    let skills;
    try {
      skills = loadAiIndex().skills;
    } catch {
      return errorResponse(503, "unavailable");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT_MS);

    try {
      let queryEmbedding;
      try {
        const [embedding] = await fetchEmbeddings([query], {
          apiKey,
          signal: controller.signal,
        });
        queryEmbedding = embedding;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") throw error;
        if (error?.status === 429) return errorResponse(429, "rate_limited");
        return errorResponse(502, "upstream_error");
      }

      const candidates = topKByEmbedding(queryEmbedding, skills, SUGGEST_TOP_K);
      if (candidates.length === 0) {
        return errorResponse(503, "unavailable");
      }

      const response = await callOpenRouter({
        apiKey,
        messages: buildMessages(query, candidates),
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 429) return errorResponse(429, "rate_limited");
        return errorResponse(502, "upstream_error");
      }

      const data = await response.json();
      const content = extractText(data?.choices?.[0]?.message?.content);
      let matched;
      try {
        matched = matchSuggestions(parseSuggestions(content), candidates);
      } catch {
        return errorResponse(502, "upstream_error");
      }

      const body = { suggestions: publicSuggestions(matched) };
      responseCache.set(cacheKey, { expires: Date.now() + CACHE_TTL_MS, body });
      return json(200, body);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return errorResponse(504, "timeout");
      }
      return errorResponse(502, "upstream_error");
    } finally {
      clearTimeout(timeout);
    }
  },
});
