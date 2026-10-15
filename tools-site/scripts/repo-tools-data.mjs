/**
 * Reads repo-tools.yaml (repository root) and returns only the entries with
 * release: true — the tools this site publishes install/usage pages for.
 * Same import.meta.url-based repo-root resolution and js-yaml read pattern as
 * skills-site/scripts/repo-tools-registry.mjs, plus the release filter and
 * install/readmePath fields this site needs.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIRECTORY, "..", "..");
const REPO_TOOLS_YAML_PATH = path.join(REPO_ROOT, "repo-tools.yaml");

export function loadReleasedTools(filePath = REPO_TOOLS_YAML_PATH) {
  const data = yaml.load(fs.readFileSync(filePath, "utf8"));
  if (!data || typeof data !== "object" || !data.tools || typeof data.tools !== "object") {
    throw new Error(`${filePath}: expected a top-level 'tools' mapping`);
  }
  return Object.entries(data.tools)
    .filter(([, definition]) => definition?.release === true)
    .map(([name, definition]) => ({
      name,
      path: definition.path,
      install: definition.install,
      readmePath: path.join(REPO_ROOT, definition.path, "README.md"),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
}

/** Ordered list of release: true repo-tools.yaml entries: { name, path, install, readmePath }. */
export const RELEASED_TOOLS = loadReleasedTools();
