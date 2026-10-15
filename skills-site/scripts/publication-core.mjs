import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { META_FIELD_REGISTRY } from "./meta-field-registry.mjs";

export const KNOWN_STATUSES = new Map([
  ["draft", { label: "Draft", recommendation: "draft" }],
  ["experimental", { label: "Experimental", recommendation: "experimental" }],
  ["stable", { label: "Stable", recommendation: "recommended" }],
  ["deprecated", { label: "Deprecated", recommendation: "deprecated" }],
]);

const SKILL_FILE = "SKILL.md";

export function toPosix(value) {
  return value.split(path.sep).join("/");
}

export function repoRelative(repoRoot, absolutePath) {
  const relative = toPosix(path.relative(repoRoot, absolutePath));
  if (!relative || relative === ".." || relative.startsWith("../") || path.isAbsolute(relative)) {
    throw new Error(`Path is outside the repository: ${absolutePath}`);
  }
  return relative;
}

export function parseSkillDocument(text, displayPath) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    throw new Error(`${displayPath}: YAML frontmatter is missing or has no closing delimiter`);
  }

  let data;
  try {
    data = yaml.load(match[1]);
  } catch (error) {
    throw new Error(`${displayPath}: invalid YAML frontmatter (${error.message})`);
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error(`${displayPath}: frontmatter must be a YAML mapping`);
  }
  for (const field of ["name", "description"]) {
    if (typeof data[field] !== "string" || data[field].trim() === "") {
      throw new Error(`${displayPath}: frontmatter field '${field}' must be a non-empty string`);
    }
  }

  const rawStatus = data.meta?.status;
  return {
    frontmatter: {
      name: data.name,
      description: data.description,
    },
    body: text.slice(match[0].length),
    status: normalizeStatus(rawStatus),
    meta: normalizeMetaBlock(data.meta),
  };
}

export function normalizeStatus(rawStatus) {
  if (rawStatus === undefined || rawStatus === null || String(rawStatus).trim() === "") {
    return { key: "unset", label: "Normal", recommendation: "normal" };
  }
  const raw = String(rawStatus).trim();
  const known = KNOWN_STATUSES.get(raw.toLowerCase());
  if (known) return { key: raw.toLowerCase(), ...known };
  return { key: "unknown", raw, label: "Undefined status", recommendation: "normal" };
}

/**
 * Normalize a SKILL.md `meta:` block against meta_field.yaml (the SSOT for
 * the 9 subfields). The result always has all 9 keys (camelCase, e.g.
 * `requiresSkills`) so callers can branch on the value (e.g. "none") instead
 * of on key presence — this keeps old SKILL.md files without a `meta:` block
 * at all indistinguishable from ones where every field is left at default.
 * Values are treated as opaque scalar strings; no further validation is done
 * here (meta_field.yaml is a display reference, not a validator).
 */
export function normalizeMetaBlock(rawMeta) {
  const source = rawMeta && typeof rawMeta === "object" && !Array.isArray(rawMeta) ? rawMeta : {};
  const normalized = {};
  for (const entry of META_FIELD_REGISTRY) {
    const value = source[entry.field];
    const isEmpty = value === undefined || value === null || String(value).trim() === "";
    normalized[entry.camelField] = isEmpty ? entry.default : String(value).trim();
  }
  return normalized;
}

async function exists(target) {
  try {
    await fs.promises.access(target);
    return true;
  } catch {
    return false;
  }
}

async function walkFiles(directory, files = []) {
  const entries = await fs.promises.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) await walkFiles(absolute, files);
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
}

async function findSkillFiles(directory, files = []) {
  if (!(await exists(directory))) return files;
  const entries = await fs.promises.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) await findSkillFiles(absolute, files);
    else if (entry.isFile() && entry.name === SKILL_FILE) files.push(absolute);
  }
  return files;
}

function validateRegistry(registry) {
  const ids = new Set();
  const roots = new Set();
  for (const entry of registry) {
    if (!entry.id || !entry.tool || !entry.plugin || !entry.root) {
      throw new Error("Every source registry entry needs id, tool, plugin, and root");
    }
    if (!ids.add(entry.id)) throw new Error(`Duplicate source registry id: ${entry.id}`);
    const normalizedRoot = entry.root.replaceAll("\\", "/").replace(/\/$/, "");
    if (!roots.add(normalizedRoot)) throw new Error(`Duplicate source registry root: ${entry.root}`);
  }
}

/**
 * Discover skills from the registered roots only (derived from ai-tools.yaml
 * via source-registry.mjs). Anything not reachable from a registered root is
 * intentionally invisible here — some plugins (e.g. meta-plugins/) are
 * deliberately kept out of ai-tools.yaml and must never surface on the site.
 *
 * `overrides` lets skills-site hide entries that ARE registered in
 * ai-tools.yaml (and therefore still ship in the marketplace/skill-catalog
 * outputs) but should not be published on this site. See site-overrides.mjs.
 */
export async function discoverSkills({ repoRoot, registry, overrides = {} }) {
  validateRegistry(registry);
  const excludedSourceIds = new Set(overrides.excludeSources ?? []);
  const excludedSkillPaths = new Set(overrides.excludeSkills ?? []);
  const activeRegistry = registry.filter((source) => !excludedSourceIds.has(source.id));
  const root = path.resolve(repoRoot);
  const skills = [];
  const registeredPaths = new Set();
  const warnings = [];

  for (const source of activeRegistry) {
    const sourceRoot = path.resolve(root, source.root);
    if (!(await exists(sourceRoot))) throw new Error(`Registered skill root does not exist: ${source.root}`);
    for (const skillFile of await findSkillFiles(sourceRoot)) {
      const repoPath = repoRelative(root, skillFile);
      if (excludedSkillPaths.has(repoPath)) continue;
      if (!registeredPaths.add(repoPath)) throw new Error(`Skill is registered more than once: ${repoPath}`);
      const parsed = parseSkillDocument(await fs.promises.readFile(skillFile, "utf8"), repoPath);
      if (parsed.status.key === "unknown") {
        warnings.push(`${repoPath}: unknown status '${parsed.status.raw}' (published as undefined)`);
      }
      const skillDirectory = path.dirname(skillFile);
      const files = [];
      for (const file of await walkFiles(skillDirectory)) {
        if (path.basename(file).toLowerCase() === ".env") continue;
        const relative = toPosix(path.relative(skillDirectory, file));
        if (!relative || relative.startsWith("../") || path.isAbsolute(relative)) {
          throw new Error(`${repoPath}: file path escapes skill directory: ${relative}`);
        }
        files.push({ path: relative, size: (await fs.promises.stat(file)).size });
      }
      files.sort((a, b) => a.path.localeCompare(b.path));
      skills.push({
        id: repoPath,
        sourceId: source.id,
        tool: source.tool,
        plugin: source.plugin,
        path: repoPath,
        name: parsed.frontmatter.name,
        description: parsed.frontmatter.description,
        frontmatter: parsed.frontmatter,
        status: parsed.status,
        meta: parsed.meta,
        body: parsed.body,
        files,
        skillDirectory,
      });
    }
  }

  skills.sort((a, b) => a.id.localeCompare(b.id));
  return { skills, warnings };
}

// Azure Static Web Apps silently drops files/folders whose name starts with
// "." during deployment upload, so a ZIP filename can't start with a literal
// dot. Mirrored in src/lib/catalog.js#skillRoutePath.
function encodeSkillPathSegment(segment) {
  const encoded = encodeURIComponent(segment);
  return encoded.startsWith(".") ? `dot-${encoded.slice(1)}` : encoded;
}

export function zipFileName(repoPath) {
  const slug = repoPath.split("/").map(encodeSkillPathSegment).join("--");
  const digest = crypto.createHash("sha256").update(repoPath).digest("hex").slice(0, 12);
  return `${slug}--${digest}.zip`;
}

/**
 * Top-level folder name used inside a skill's download ZIP. Uses the skill's
 * frontmatter `name` (the canonical skill name) so extracting the archive drops
 * a single `{skill-name}/` folder straight into the working directory with all
 * bundled files inside — instead of mirroring the deep repo-relative path of
 * SKILL.md (which previously produced a nested chain ending in a folder
 * literally named "SKILL.md"). Guarded so a name can never introduce a path
 * separator or be empty, which would either nest deeper or escape the folder.
 */
export function skillBundleFolder(name, displayPath) {
  const folder = String(name ?? "").trim();
  if (!folder || folder.includes("/") || folder.includes("\\") || folder.includes("\0")) {
    throw new Error(`${displayPath}: skill name '${name}' is not a valid bundle folder name`);
  }
  return folder;
}

export function removeInternalFields(skill) {
  const { skillDirectory, ...publicSkill } = skill;
  return publicSkill;
}
