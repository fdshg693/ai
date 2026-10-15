import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import MiniSearch from "minisearch";
import { SEARCH_INDEX_OPTIONS } from "../api/src/lib/search-options.js";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = path.resolve(SCRIPT_DIRECTORY, "..");
const DEFAULT_CATALOG_PATH = path.join(SITE_ROOT, "generated", "catalog.json");
const DEFAULT_OUTPUT_PATH = path.join(SITE_ROOT, "api", "data", "search-index.json");

/**
 * Build a MiniSearch JSON index from catalog skills (minimal fields only).
 * @param {{ catalogPath?: string, outputPath?: string, skills?: Array }} [options]
 */
export async function buildSearchIndex({
  catalogPath = DEFAULT_CATALOG_PATH,
  outputPath = DEFAULT_OUTPUT_PATH,
  skills,
} = {}) {
  let documents = skills;
  if (!documents) {
    const catalog = JSON.parse(await fs.promises.readFile(catalogPath, "utf8"));
    if (!catalog || !Array.isArray(catalog.skills)) {
      throw new Error("catalog.json has unexpected shape");
    }
    documents = catalog.skills;
  }

  const miniSearch = new MiniSearch(SEARCH_INDEX_OPTIONS);
  miniSearch.addAll(
    documents.map((skill) => ({
      path: skill.path,
      name: skill.name,
      description: skill.description || "",
      tool: skill.tool || "",
      plugin: skill.plugin || "",
      status: skill.status?.key || skill.status || "",
    })),
  );

  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.promises.writeFile(outputPath, JSON.stringify(miniSearch), "utf8");
  return { count: documents.length, outputPath };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const result = await buildSearchIndex();
    console.log(`Wrote MiniSearch index for ${result.count} skills to ${result.outputPath}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
