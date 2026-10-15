import { app } from "@azure/functions";
import { checkRateLimit, clientKey } from "../lib/rate-limit.js";
import { searchSkills } from "../lib/search-index.js";

const SEARCH_RATE = { max: 60, windowMs: 60_000 };
const MAX_QUERY_LENGTH = 200;

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

app.http("search", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async (request) => {
    const rate = checkRateLimit(`search:${clientKey(request)}`, SEARCH_RATE);
    if (!rate.allowed) {
      return errorResponse(429, "rate_limited", { "Retry-After": String(rate.retryAfterSec) });
    }

    const q = (request.query.get("q") || "").trim();
    if (!q || q.length > MAX_QUERY_LENGTH) {
      return errorResponse(400, "bad_request");
    }

    const tool = (request.query.get("tool") || "").trim();
    const plugin = (request.query.get("plugin") || "").trim();
    const status = (request.query.get("status") || "").trim();

    try {
      const results = searchSkills({ q, tool, plugin, status });
      return json(200, {
        results: results.map(({ path, name, tool: t, plugin: p, status: s, score }) => ({
          path,
          name,
          tool: t,
          plugin: p,
          status: s,
          score,
        })),
      });
    } catch {
      return errorResponse(503, "unavailable");
    }
  },
});
