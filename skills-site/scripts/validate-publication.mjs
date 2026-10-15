import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SOURCE_REGISTRY } from "./source-registry.mjs";
import { SITE_OVERRIDES } from "./site-overrides.mjs";
import { discoverSkills, skillBundleFolder, zipFileName } from "./publication-core.mjs";
import {
  AI_INDEX_SCHEMA_VERSION,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
} from "./build-skill-embeddings.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = path.resolve(SCRIPT_DIRECTORY, "..");
const REPO_ROOT = path.resolve(SITE_ROOT, "..");
const GENERATED_ROOT = path.join(SITE_ROOT, "generated");
const DOWNLOAD_ROOT = path.join(SITE_ROOT, "public", "downloads");
const AI_INDEX_PATH = path.join(SITE_ROOT, "api", "data", "ai-index.json");
const SEARCH_INDEX_PATH = path.join(SITE_ROOT, "api", "data", "search-index.json");
const AI_INDEX_FIELDS = ["description", "embedding", "embeddingHash", "name", "path", "plugin", "status", "tool"];

function exists(target) {
  try {
    fs.accessSync(target);
    return true;
  } catch {
    return false;
  }
}

function assertSafePath(value, label) {
  if (typeof value !== "string" || !value || value.includes("\\") || path.isAbsolute(value) || value.split("/").includes("..")) {
    throw new Error(`${label} is not a safe POSIX relative path: ${value}`);
  }
}

function fileMap(files, label) {
  if (!Array.isArray(files)) throw new Error(`${label} must be an array`);
  const result = new Map();
  for (const file of files) {
    assertSafePath(file.path, `${label} file path`);
    if (!Number.isSafeInteger(file.size) || file.size < 0) throw new Error(`${label} has an invalid file size`);
    if (result.has(file.path)) throw new Error(`${label} contains a duplicate file: ${file.path}`);
    result.set(file.path, file.size);
  }
  return result;
}

export function zipEntries(zipPath) {
  const data = fs.readFileSync(zipPath);
  const entries = [];
  let offset = 0;
  while (offset < data.length - 4) {
    const signature = data.readUInt32LE(offset);
    if (signature === 0x04034b50) {
      const nameLength = data.readUInt16LE(offset + 26);
      const extraLength = data.readUInt16LE(offset + 28);
      const compressedSize = data.readUInt32LE(offset + 18);
      entries.push(data.subarray(offset + 30, offset + 30 + nameLength).toString("utf8"));
      offset += 30 + nameLength + extraLength + compressedSize;
    } else if (signature === 0x02014b50 || signature === 0x06054b50) {
      break;
    } else {
      throw new Error(`Invalid ZIP structure: ${zipPath}`);
    }
  }
  return entries;
}

export async function validatePublication({
  repoRoot = REPO_ROOT,
  registry = SOURCE_REGISTRY,
  overrides = SITE_OVERRIDES,
  generatedRoot = GENERATED_ROOT,
  downloadRoot = DOWNLOAD_ROOT,
  aiIndexPath = AI_INDEX_PATH,
  searchIndexPath = SEARCH_INDEX_PATH,
} = {}) {
  const discovered = await discoverSkills({ repoRoot, registry, overrides });
  let catalog;
  try {
    catalog = JSON.parse(await fs.promises.readFile(path.join(generatedRoot, "catalog.json"), "utf8"));
  } catch (error) {
    throw new Error(`Generated catalog is missing or invalid: ${error.message}`);
  }
  if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.skills)) {
    throw new Error("Generated catalog has an unsupported shape");
  }

  const expected = new Map(discovered.skills.map((skill) => [skill.id, skill]));
  const actual = new Map(catalog.skills.map((skill) => [skill.id, skill]));
  if (actual.size !== catalog.skills.length || expected.size !== actual.size || [...expected.keys()].some((id) => !actual.has(id))) {
    throw new Error("Generated catalog does not contain exactly the discovered skills");
  }
  for (const [id, source] of expected) {
    const published = actual.get(id);
    assertSafePath(id, `Skill '${id}' id`);
    if (published.path !== id || published.name !== source.name || published.description !== source.description || published.body !== source.body) {
      throw new Error(`Generated metadata does not match source: ${id}`);
    }
    const expectedFiles = fileMap(source.files, `Source '${id}'`);
    const actualFiles = fileMap(published.files, `Generated '${id}'`);
    if ([...actualFiles.keys()].some((file) => file.toLowerCase() === ".env")) throw new Error(`Generated file list contains a forbidden .env entry: ${id}`);
    if (expectedFiles.size !== actualFiles.size || [...expectedFiles].some(([file, size]) => actualFiles.get(file) !== size)) {
      throw new Error(`Generated file list does not match source: ${id}`);
    }
    const expectedDownload = `downloads/${zipFileName(id)}`;
    if (published.download !== expectedDownload) throw new Error(`Unexpected download path for ${id}`);
    const downloadPath = path.join(downloadRoot, zipFileName(id));
    if (!exists(downloadPath)) throw new Error(`Missing ZIP for ${id}: ${downloadPath}`);
    const names = zipEntries(downloadPath);
    if (names.some((name) => path.basename(name).toLowerCase() === ".env")) {
      throw new Error(`ZIP contains forbidden .env file: ${id}`);
    }
    const bundleFolder = skillBundleFolder(source.name, id);
    const expectedZipEntries = new Set([...expectedFiles.keys()].map((file) => `${bundleFolder}/${file}`));
    if (names.length !== expectedZipEntries.size || names.some((name) => !expectedZipEntries.has(name))) {
      throw new Error(`ZIP contains an unsafe path: ${id}`);
    }
  }

  let aiIndex;
  try {
    aiIndex = JSON.parse(await fs.promises.readFile(aiIndexPath, "utf8"));
  } catch (error) {
    throw new Error(`Generated AI index is missing or invalid: ${error.message}`);
  }
  if (
    aiIndex.schemaVersion !== AI_INDEX_SCHEMA_VERSION ||
    aiIndex.embeddingModel !== EMBEDDING_MODEL ||
    aiIndex.embeddingDimensions !== EMBEDDING_DIMENSIONS ||
    !Array.isArray(aiIndex.skills)
  ) {
    throw new Error("Generated AI index has an unsupported shape");
  }
  const aiIndexByPath = new Map(aiIndex.skills.map((skill) => [skill.path, skill]));
  if (aiIndexByPath.size !== aiIndex.skills.length || expected.size !== aiIndexByPath.size || [...expected.keys()].some((id) => !aiIndexByPath.has(id))) {
    throw new Error("Generated AI index does not contain exactly the discovered skills");
  }
  for (const [id, source] of expected) {
    const indexed = aiIndexByPath.get(id);
    const keys = Object.keys(indexed).sort();
    if (keys.length !== AI_INDEX_FIELDS.length || AI_INDEX_FIELDS.some((field, i) => keys[i] !== field)) {
      throw new Error(`Generated AI index entry has unexpected fields: ${id}`);
    }
    const publishedCatalog = actual.get(id);
    if (
      indexed.name !== publishedCatalog.name ||
      indexed.description !== publishedCatalog.description ||
      indexed.tool !== publishedCatalog.tool ||
      indexed.plugin !== publishedCatalog.plugin ||
      indexed.status?.key !== publishedCatalog.status?.key
    ) {
      throw new Error(`Generated AI index entry does not match catalog: ${id}`);
    }
    if (
      typeof indexed.embeddingHash !== "string" ||
      !/^[0-9a-f]{64}$/.test(indexed.embeddingHash)
    ) {
      throw new Error(`Generated AI index entry has an invalid embeddingHash: ${id}`);
    }
    if (
      !Array.isArray(indexed.embedding) ||
      indexed.embedding.length !== EMBEDDING_DIMENSIONS ||
      indexed.embedding.some((value) => typeof value !== "number" || !Number.isFinite(value))
    ) {
      throw new Error(`Generated AI index entry has an invalid embedding: ${id}`);
    }
  }

  if (!exists(searchIndexPath)) {
    throw new Error(`Generated search index is missing: ${searchIndexPath}`);
  }
  let searchIndexRaw;
  try {
    searchIndexRaw = JSON.parse(await fs.promises.readFile(searchIndexPath, "utf8"));
  } catch (error) {
    throw new Error(`Generated search index is invalid: ${error.message}`);
  }
  if (!searchIndexRaw || typeof searchIndexRaw !== "object") {
    throw new Error("Generated search index has an unsupported shape");
  }

  return { count: expected.size, warnings: discovered.warnings };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const result = await validatePublication();
    for (const warning of result.warnings) console.warn(`warning: ${warning}`);
    console.log(`Validated ${result.count} published skills (including AI + search indexes)`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
