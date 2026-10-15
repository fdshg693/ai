import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SOURCE_REGISTRY } from "./source-registry.mjs";
import { SITE_OVERRIDES } from "./site-overrides.mjs";
import { discoverSkills, removeInternalFields, skillBundleFolder, zipFileName } from "./publication-core.mjs";
import { META_FIELD_REGISTRY } from "./meta-field-registry.mjs";
import { REPO_TOOLS_REGISTRY } from "./repo-tools-registry.mjs";
import { buildSearchIndex } from "./build-search-index.mjs";
import {
  AI_INDEX_SCHEMA_VERSION,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  attachSkillEmbeddings,
  loadLocalEnv,
  loadPreviousAiIndex,
} from "./build-skill-embeddings.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = path.resolve(SCRIPT_DIRECTORY, "..");
const REPO_ROOT = path.resolve(SITE_ROOT, "..");
const GENERATED_ROOT = path.join(SITE_ROOT, "generated");
const DOWNLOAD_ROOT = path.join(SITE_ROOT, "public", "downloads");
const API_DATA_ROOT = path.join(SITE_ROOT, "api", "data");
const AI_INDEX_PATH = path.join(API_DATA_ROOT, "ai-index.json");
const SEARCH_INDEX_PATH = path.join(API_DATA_ROOT, "search-index.json");

const GITHUB_BASE_URL = "https://github.com/fdshg693/AI";

function isUnset(value) {
  return !value || value.trim() === "" || value.trim().toLowerCase() === "none";
}

/**
 * `meta.requiresSkills` (comma-separated skill names) resolved against the
 * full catalog's `frontmatter.name`s. Only a unique name match becomes an
 * in-site link (`path` set); 0 or multiple matches stay plain text (`path:
 * null`) since a bare name cannot safely be resolved further (skill names
 * are not guaranteed unique across the catalog).
 */
function resolveRequiresSkills(value, allSkills) {
  if (isUnset(value)) return [];
  return value
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => {
      const matches = allSkills.filter((skill) => skill.frontmatter.name === name);
      return matches.length === 1 ? { name, path: matches[0].path } : { name, path: null };
    });
}

/**
 * `meta.requiresHooks` is free text (not a structured list), so the whole
 * value is wrapped in a single link to where hook sources live (the
 * agent-tooling hook scenarios, one directory per hook id). Returns null when
 * the field is unset.
 */
function resolveRequiresHooks(value) {
  if (isUnset(value)) return null;
  return { text: value, href: `${GITHUB_BASE_URL}/tree/main/agent-tooling/agent_tooling/hooks/scenarios` };
}

/**
 * `meta.requiresRepoTools` (comma-separated repo-relative paths) resolved to
 * a GitHub tree/blob link when the path exists in the working tree
 * (fs.existsSync only — README/AGENTS.md presence is not verified, GitHub's
 * own directory rendering handles that). Missing paths stay plain text
 * (`href: null`).
 */
function resolveRequiresRepoTools(value, repoRoot) {
  if (isUnset(value)) return [];
  return value
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => {
      const exists = fs.existsSync(path.join(repoRoot, token));
      return { text: token, href: exists ? `${GITHUB_BASE_URL}/tree/main/${token}` : null };
    });
}

/** Resolve the link-bearing meta subfields once the full skill list (all names) is known. */
function resolveMetaLinks(meta, allSkills, repoRoot) {
  return {
    ...meta,
    requiresSkills: resolveRequiresSkills(meta.requiresSkills, allSkills),
    requiresHooks: resolveRequiresHooks(meta.requiresHooks),
    requiresRepoTools: resolveRequiresRepoTools(meta.requiresRepoTools, repoRoot),
  };
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  return {
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
  };
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function uint16(value) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value & 0xffff);
  return buffer;
}

function uint32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0);
  return buffer;
}

/** Create a UTF-8, uncompressed ZIP archive using only Node.js built-ins. */
export function createZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const { date, time } = dosDateTime();

  for (const entry of entries) {
    const name = Buffer.from(entry.name.replaceAll("\\", "/"), "utf8");
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data);
    const checksum = crc32(data);
    const localHeader = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      uint16(20), uint16(0x800), uint16(0), uint16(time), uint16(date),
      uint32(checksum), uint32(data.length), uint32(data.length), uint16(name.length), uint16(0), name,
    ]);
    localParts.push(localHeader, data);

    centralParts.push(Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x01, 0x02]),
      uint16(20), uint16(20), uint16(0x800), uint16(0), uint16(time), uint16(date),
      uint32(checksum), uint32(data.length), uint32(data.length), uint16(name.length), uint16(0),
      uint16(0), uint16(0), uint16(0), uint32(0), uint32(offset), name,
    ]));
    offset += localHeader.length + data.length;
  }

  const localDirectory = Buffer.concat(localParts);
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x05, 0x06]),
    uint16(0), uint16(0), uint16(entries.length), uint16(entries.length),
    uint32(centralDirectory.length), uint32(localDirectory.length), uint16(0),
  ]);
  return Buffer.concat([localDirectory, centralDirectory, end]);
}

async function writeSkillZip(skill, destination) {
  const folder = skillBundleFolder(skill.name, skill.path);
  const entries = [];
  for (const file of skill.files) {
    entries.push({
      name: `${folder}/${file.path}`,
      data: await fs.promises.readFile(path.join(skill.skillDirectory, file.path)),
    });
  }
  await fs.promises.writeFile(destination, createZip(entries));
}

/**
 * Slim per-skill projection for the server-side AI suggestion Function
 * (`api/suggest`). Deliberately excludes body/meta/files/frontmatter/download
 * to keep the LLM prompt payload small; schemaVersion is independent from
 * catalog.json's so the two can evolve separately. Must derive from the same
 * resolved-meta skill list used to build catalog.json so the two artifacts
 * never diverge. Written under `api/data/` (not public/) so it is not
 * exposed as a static asset. Each skill includes a build-time embedding
 * (`openai/text-embedding-3-small`) for suggest top-K filtering.
 *
 * @param {Array} skillsWithResolvedMeta
 * @param {{ attachEmbeddings?: typeof attachSkillEmbeddings, previousIndex?: object | null }} [options]
 */
async function buildAiIndex(skillsWithResolvedMeta, { attachEmbeddings = attachSkillEmbeddings, previousIndex = null } = {}) {
  const slimSkills = skillsWithResolvedMeta.map((skill) => ({
    path: skill.path,
    name: skill.name,
    description: skill.description,
    tool: skill.tool,
    plugin: skill.plugin,
    status: { key: skill.status.key },
  }));
  const skillsWithEmbeddings = await attachEmbeddings(slimSkills, { previousIndex });
  return {
    schemaVersion: AI_INDEX_SCHEMA_VERSION,
    embeddingModel: EMBEDDING_MODEL,
    embeddingDimensions: EMBEDDING_DIMENSIONS,
    skills: skillsWithEmbeddings,
  };
}

export async function buildPublication({
  repoRoot = REPO_ROOT,
  registry = SOURCE_REGISTRY,
  overrides = SITE_OVERRIDES,
  generatedRoot = GENERATED_ROOT,
  downloadRoot = DOWNLOAD_ROOT,
  aiIndexPath = AI_INDEX_PATH,
  searchIndexPath = SEARCH_INDEX_PATH,
  attachEmbeddings = attachSkillEmbeddings,
} = {}) {
  loadLocalEnv();
  const { skills, warnings } = await discoverSkills({ repoRoot, registry, overrides });
  await fs.promises.rm(generatedRoot, { recursive: true, force: true });
  await fs.promises.rm(downloadRoot, { recursive: true, force: true });
  await fs.promises.mkdir(generatedRoot, { recursive: true });
  await fs.promises.mkdir(downloadRoot, { recursive: true });

  // Resolve requiresSkills/requiresHooks/requiresRepoTools only once every
  // skill's catalog entry is known (requiresSkills needs the full name list).
  const skillsWithResolvedMeta = skills.map((skill) => ({
    ...skill,
    meta: resolveMetaLinks(skill.meta, skills, repoRoot),
  }));

  const publicSkills = [];
  for (const skill of skillsWithResolvedMeta) {
    const zip = zipFileName(skill.path);
    await writeSkillZip(skill, path.join(downloadRoot, zip));
    publicSkills.push({ ...removeInternalFields(skill), download: `downloads/${zip}` });
  }
  // metaFieldRegistry travels through catalog.json (rather than the Astro
  // components importing meta-field-registry.mjs directly) because that
  // module resolves meta_field.yaml's path relative to its own file location
  // at read time; Astro/Vite relocates bundled modules during prerendering,
  // which breaks that resolution. Routing the already-loaded data through
  // the generated JSON keeps meta_field.yaml as the single read site.
  const catalog = {
    schemaVersion: 1,
    skills: publicSkills,
    metaFieldRegistry: META_FIELD_REGISTRY,
    repoTools: REPO_TOOLS_REGISTRY,
  };
  await fs.promises.writeFile(path.join(generatedRoot, "catalog.json"), `${JSON.stringify(catalog, null, 2)}\n`, "utf8");

  // Read previous index before overwrite so unchanged skills can reuse vectors.
  const previousIndex = await loadPreviousAiIndex(aiIndexPath);
  const aiIndex = await buildAiIndex(skillsWithResolvedMeta, { attachEmbeddings, previousIndex });
  await fs.promises.mkdir(path.dirname(aiIndexPath), { recursive: true });
  await fs.promises.writeFile(aiIndexPath, `${JSON.stringify(aiIndex, null, 2)}\n`, "utf8");

  const searchIndex = await buildSearchIndex({
    skills: skillsWithResolvedMeta,
    outputPath: searchIndexPath,
  });

  return { catalog, aiIndex, searchIndex, warnings };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const result = await buildPublication();
    for (const warning of result.warnings) console.warn(`warning: ${warning}`);
    console.log(
      `Published ${result.catalog.skills.length} skills to ${GENERATED_ROOT}` +
        ` (AI index: ${result.aiIndex.skills.length}, search index: ${result.searchIndex.count})`,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
