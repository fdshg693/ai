/**
 * Generates tools-site/docs/tools/<name>.md (install command from
 * repo-tools.yaml + README.md body verbatim) and docs/tools/index.md for
 * every release: true entry from repo-tools-data.mjs. docs/tools/ is fully
 * regenerated on every run (deleted then rewritten) so removed tools don't
 * leave stale pages behind.
 *
 * README bodies are embedded verbatim except for one rewrite: relative
 * markdown links (e.g. `[SKILL.md](../../claude-plugins/.../SKILL.md)`) only
 * resolve inside the source repo, not inside this VitePress docs tree, so
 * they're rewritten to absolute GitHub blob/tree URLs.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RELEASED_TOOLS } from "./repo-tools-data.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = path.resolve(SCRIPT_DIRECTORY, "..");
const REPO_ROOT = path.resolve(SITE_ROOT, "..");
const TOOLS_DOCS_DIRECTORY = path.join(SITE_ROOT, "docs", "tools");

// Mirrors GITHUB_BASE_URL in skills-site/scripts/repo-tools-registry.mjs.
const GITHUB_BASE_URL = "https://github.com/fdshg693/AI";

function rewriteRelativeLinks(markdown, readmeDir) {
  return markdown.replace(/\]\(([^)]+)\)/g, (match, target) => {
    if (/^([a-z][a-z0-9+.-]*:|#)/i.test(target)) return match; // absolute URL scheme or in-page anchor
    const [rawPath, hash] = target.split("#");
    const absolutePath = path.resolve(readmeDir, rawPath);
    const repoRelativePath = path.relative(REPO_ROOT, absolutePath).split(path.sep).join("/");
    const isDirectory = fs.existsSync(absolutePath) && fs.statSync(absolutePath).isDirectory();
    const githubType = isDirectory ? "tree" : "blob";
    const anchor = hash ? `#${hash}` : "";
    return `](${GITHUB_BASE_URL}/${githubType}/main/${repoRelativePath}${anchor})`;
  });
}

function renderToolPage(tool) {
  const readmeDir = path.dirname(tool.readmePath);
  const readme = rewriteRelativeLinks(fs.readFileSync(tool.readmePath, "utf8"), readmeDir);
  return `---
title: ${tool.name}
---

## インストール

\`\`\`bash
${tool.install}
\`\`\`

${readme}`;
}

function renderIndexPage(tools) {
  const links = tools.map((tool) => `- [${tool.name}](./${tool.name}.md)`).join("\n");
  return `---
title: ツール一覧
---

# ツール一覧

${links}
`;
}

fs.rmSync(TOOLS_DOCS_DIRECTORY, { recursive: true, force: true });
fs.mkdirSync(TOOLS_DOCS_DIRECTORY, { recursive: true });

for (const tool of RELEASED_TOOLS) {
  fs.writeFileSync(path.join(TOOLS_DOCS_DIRECTORY, `${tool.name}.md`), renderToolPage(tool));
}
fs.writeFileSync(path.join(TOOLS_DOCS_DIRECTORY, "index.md"), renderIndexPage(RELEASED_TOOLS));

console.log(`Generated ${RELEASED_TOOLS.length} tool page(s) + index.md in ${TOOLS_DOCS_DIRECTORY}`);
