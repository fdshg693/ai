import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import MiniSearch from "minisearch";
import { JSDOM } from "jsdom";
import {
  applyCardFilters,
  availablePluginValues,
  cardMatches,
} from "../src/lib/skill-filter.mjs";
import { SEARCH_INDEX_OPTIONS, tokenize } from "../api/src/lib/search-options.js";
import { buildSearchIndex } from "../scripts/build-search-index.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const skillFilterAstro = fs.readFileSync(
  path.join(here, "..", "src", "components", "SkillFilter.astro"),
  "utf8",
);
const skillFilterReact = fs.readFileSync(
  path.join(here, "..", "src", "components", "react", "SkillFilter.tsx"),
  "utf8",
);

const CARD_GRID = `
  <div class="skill-grid">
    <article data-skill-card data-path="a" data-tool="Claude Code" data-plugin="meta" data-status="stable" data-name="aim-cli"></article>
    <article data-skill-card data-path="b" data-tool="Codex" data-plugin="meta" data-status="draft" data-name="codex-guide"></article>
  </div>
  <p data-filter-empty hidden>条件に一致するスキルはありません。</p>`;

function renderCards() {
  return new JSDOM(`<!doctype html><html><body>${CARD_GRID}</body></html>`);
}

function cardsOf(dom) {
  return [...dom.window.document.querySelectorAll("[data-skill-card]")];
}

test("cardMatches uses AND semantics across query/tool/plugin/status", () => {
  const card = { name: "aim-cli", tool: "Claude Code", plugin: "meta", status: "stable" };
  assert.equal(cardMatches(card, { query: "aim", tool: "Claude Code", plugin: "", status: "" }), true);
  assert.equal(cardMatches(card, { query: "aim", tool: "Codex", plugin: "", status: "" }), false);
  assert.equal(cardMatches(card, { query: "", tool: "Claude Code", plugin: "", status: "draft" }), false);
});

test("applyCardFilters hides non-matching cards once the tool filter changes", () => {
  const dom = renderCards();
  const visible = applyCardFilters(cardsOf(dom), { query: "", tool: "Codex", plugin: "", status: "" });

  const cards = cardsOf(dom);
  const claudeCard = cards.find((card) => card.dataset.tool === "Claude Code");
  const codexCard = cards.find((card) => card.dataset.tool === "Codex");

  assert.equal(claudeCard.hidden, true, "non-matching card should be hidden");
  assert.equal(codexCard.hidden, false, "matching card should stay visible");
  assert.equal(visible, 1);
});

test("applyCardFilters hides non-matching cards once the status filter changes", () => {
  const dom = renderCards();
  const visible = applyCardFilters(cardsOf(dom), { query: "", tool: "", plugin: "", status: "draft" });

  const cards = cardsOf(dom);
  const stableCard = cards.find((card) => card.dataset.status === "stable");
  const draftCard = cards.find((card) => card.dataset.status === "draft");

  assert.equal(stableCard.hidden, true, "non-matching status card should be hidden");
  assert.equal(draftCard.hidden, false, "matching status card should stay visible");
  assert.equal(visible, 1);
});

test("tool, plugin, and status filters combine with AND semantics", () => {
  const dom = renderCards();
  const visible = applyCardFilters(cardsOf(dom), {
    query: "",
    tool: "Claude Code",
    plugin: "",
    status: "draft",
  });
  assert.ok(cardsOf(dom).every((card) => card.hidden === true));
  assert.equal(visible, 0);
});

test("search input filters cards by a partial, case-insensitive match on skill name", () => {
  const dom = renderCards();
  const visible = applyCardFilters(cardsOf(dom), { query: "AIM", tool: "", plugin: "", status: "" });

  const cards = cardsOf(dom);
  const aimCard = cards.find((card) => card.dataset.name === "aim-cli");
  const codexCard = cards.find((card) => card.dataset.name === "codex-guide");

  assert.equal(aimCard.hidden, false, "card whose name partially matches the query stays visible");
  assert.equal(codexCard.hidden, true, "card whose name does not match the query is hidden");
  assert.equal(visible, 1);
});

test("search combines with the tool filter using AND semantics", () => {
  const dom = renderCards();
  const visible = applyCardFilters(cardsOf(dom), { query: "aim", tool: "Codex", plugin: "", status: "" });
  assert.ok(cardsOf(dom).every((card) => card.hidden === true));
  assert.equal(visible, 0);
});

test("availablePluginValues hides plugins that don't belong to the selected tool", () => {
  const plugins = [
    { value: "meta", tools: ["Claude Code", "Codex"] },
    { value: "claude-only", tools: ["Claude Code"] },
  ];
  assert.deepEqual(availablePluginValues(plugins, "Codex"), ["meta"]);
  assert.deepEqual(availablePluginValues(plugins, ""), ["meta", "claude-only"]);
});

test("SkillFilter.astro mounts the React island with client:idle and search API", () => {
  assert.match(skillFilterAstro, /import SkillFilterReact from "\.\/react\/SkillFilter"/);
  assert.match(skillFilterAstro, /client:idle/);
  assert.match(skillFilterAstro, /searchApiHref="\/api\/search"/);
  assert.doesNotMatch(skillFilterAstro, /filter\.js/);
});

test("SkillFilter React island uses /api/search with client-side fallback", () => {
  assert.match(skillFilterReact, /\/api\/search|searchApiHref/);
  assert.match(skillFilterReact, /applyCardFilters/);
  assert.match(skillFilterReact, /availablePluginValues/);
  assert.match(skillFilterReact, /dataset\.path/);
});

test("tokenize emits CJK n-grams and latin tokens", () => {
  assert.deepEqual(tokenize("aim"), ["aim"]);
  const cjk = tokenize("検索");
  assert.ok(cjk.includes("検索"));
});

test("buildSearchIndex round-trips through MiniSearch.loadJSON", async () => {
  const outputPath = path.join(here, "..", "api", "data", "test-search-index.json");
  try {
    await buildSearchIndex({
      skills: [
        {
          path: "tool/plugin/skills/a/SKILL.md",
          name: "aim-cli",
          description: "CLI helper",
          tool: "Claude Code",
          plugin: "meta",
          status: { key: "stable" },
        },
      ],
      outputPath,
    });
    const raw = await fs.promises.readFile(outputPath, "utf8");
    const index = MiniSearch.loadJSON(raw, SEARCH_INDEX_OPTIONS);
    const hits = index.search("aim", { prefix: true });
    assert.equal(hits.length, 1);
    assert.equal(hits[0].id, "tool/plugin/skills/a/SKILL.md");
  } finally {
    await fs.promises.rm(outputPath, { force: true });
  }
});
