import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { apiErrorMessage, skillHref } from "../src/lib/ai-suggest.mjs";
import { cosineSimilarity, topKByEmbedding } from "../api/src/lib/embedding-similarity.js";
import {
  DEFAULT_MODEL,
  SUGGEST_TOP_K,
  buildMessages,
  extractText,
  matchSuggestions,
  parseSuggestions,
} from "../api/src/lib/suggest-core.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const aiSuggestAstro = fs.readFileSync(path.join(here, "..", "src", "components", "AISuggest.astro"), "utf8");
const aiSuggestReact = fs.readFileSync(
  path.join(here, "..", "src", "components", "react", "AISuggest.tsx"),
  "utf8",
);

const AI_INDEX = {
  schemaVersion: 2,
  skills: [
    {
      path: "tool/plugin/skills/a/SKILL.md",
      name: "skill-a",
      description: "desc a",
      tool: "Claude Code",
      plugin: "meta",
      embedding: [1, 0, 0],
    },
  ],
};

test("skillHref mirrors catalog segment-encoding", () => {
  assert.equal(skillHref("tool/plugin/skills/a/SKILL.md"), "/skills/tool/plugin/skills/a/SKILL.md");
  assert.equal(
    skillHref("tool/my plugin/skills/a/SKILL.md", "/base"),
    "/base/skills/tool/my%20plugin/skills/a/SKILL.md",
  );
});

test("skillHref escapes a leading dot so the route isn't dropped by Azure SWA's dotfile filtering", () => {
  assert.equal(skillHref(".claude/skills/a/SKILL.md"), "/skills/dot-claude/skills/a/SKILL.md");
});

test("parseSuggestions accepts bare JSON and fenced JSON", () => {
  const payload = [{ path: "a", reason: "r" }];
  assert.deepEqual(parseSuggestions(JSON.stringify(payload)), payload);
  assert.deepEqual(parseSuggestions("```json\n" + JSON.stringify(payload) + "\n```"), payload);
});

test("matchSuggestions keeps only paths present in the index and strips embeddings", () => {
  const matched = matchSuggestions(
    [
      { path: "tool/plugin/skills/a/SKILL.md", reason: "関連するため" },
      { path: "tool/plugin/skills/does-not-exist/SKILL.md", reason: "捏造されたパス" },
    ],
    AI_INDEX.skills,
  );
  assert.equal(matched.length, 1);
  assert.equal(matched[0].skill.name, "skill-a");
  assert.equal(matched[0].reason, "関連するため");
  assert.equal(matched[0].skill.embedding, undefined);
});

test("buildMessages embeds the catalog without vectors and asks for JSON-only output", () => {
  const messages = buildMessages("テストについて", AI_INDEX.skills);
  assert.equal(messages.length, 2);
  assert.match(messages[0].content, /JSON配列のみ/);
  assert.match(messages[1].content, /スキル一覧:/);
  assert.match(messages[1].content, /質問: テストについて/);
  assert.doesNotMatch(messages[1].content, /"embedding"/);
});

test("extractText flattens string and multipart content", () => {
  assert.equal(extractText("hello"), "hello");
  assert.equal(extractText([{ text: "a" }, "b", { text: "c" }]), "abc");
});

test("apiErrorMessage maps server error codes", () => {
  assert.match(apiErrorMessage("rate_limited", 429), /レート制限/);
  assert.match(apiErrorMessage("timeout", 504), /タイムアウト/);
  assert.match(apiErrorMessage("unavailable", 503), /利用できません/);
});

test("chat model is fixed server-side", () => {
  assert.equal(DEFAULT_MODEL, "minimax/minimax-m3");
  assert.equal(SUGGEST_TOP_K, 10);
});

test("cosineSimilarity ranks identical and orthogonal vectors", () => {
  assert.equal(cosineSimilarity([1, 0], [1, 0]), 1);
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
  assert.ok(Number.isNaN(cosineSimilarity([1], [1, 0])));
});

test("topKByEmbedding returns the highest-scoring skills", () => {
  const skills = [
    { path: "a", embedding: [1, 0, 0] },
    { path: "b", embedding: [0.9, 0.1, 0] },
    { path: "c", embedding: [0, 1, 0] },
    { path: "d", embedding: [0.5, 0.5, 0] },
  ];
  const top = topKByEmbedding([1, 0, 0], skills, 2);
  assert.deepEqual(
    top.map((skill) => skill.path),
    ["a", "b"],
  );
});

test("AISuggest.astro mounts the React island with client:load and no BYOK props", () => {
  assert.match(aiSuggestAstro, /import AISuggestReact from "\.\/react\/AISuggest"/);
  assert.match(aiSuggestAstro, /client:load/);
  assert.match(aiSuggestAstro, /apiHref="\/api\/suggest"/);
  assert.doesNotMatch(aiSuggestAstro, /ai-index\.json/);
  assert.doesNotMatch(aiSuggestAstro, /ai-suggest\.js/);
});

test("AISuggest React component calls /api/suggest without model selection UI", () => {
  assert.match(aiSuggestReact, /data-ai-submit/);
  assert.match(aiSuggestReact, /\/api\/suggest|apiHref/);
  assert.doesNotMatch(aiSuggestReact, /data-ai-key-save/);
  assert.doesNotMatch(aiSuggestReact, /data-ai-key-verify/);
  assert.doesNotMatch(aiSuggestReact, /KEY_STORAGE/);
  assert.doesNotMatch(aiSuggestReact, /MODEL_STORAGE/);
  assert.doesNotMatch(aiSuggestReact, /data-ai-model-input/);
  assert.doesNotMatch(aiSuggestReact, /詳細設定/);
  assert.doesNotMatch(aiSuggestReact, /localStorage/);
  assert.doesNotMatch(aiSuggestReact, /model:/);
  assert.doesNotMatch(aiSuggestReact, /OPENROUTER_URL/);
});

test("public ai-suggest.js is removed after server migration", () => {
  assert.equal(fs.existsSync(path.join(here, "..", "public", "ai-suggest.js")), false);
});
