import catalog from "../../generated/catalog.json";

export const skills = catalog.skills;

// meta_field.yaml (repo root) is the SSOT for these entries; build-catalog.mjs
// loads it once via meta-field-registry.mjs and embeds it here so UI code
// never reads meta_field.yaml itself (Astro/Vite relocates bundled modules
// during prerendering, which breaks meta-field-registry.mjs's file-relative
// path resolution if imported directly from a component).
export const metaFieldRegistry = catalog.metaFieldRegistry;

// repo-tools.yaml (repo root) is the SSOT for these entries; same relocation
// caveat as metaFieldRegistry above (see build-catalog.mjs).
export const repoTools = catalog.repoTools;

export function metaFieldDefault(field) {
  return metaFieldRegistry.find((entry) => entry.field === field)?.default;
}

export function sortedUnique(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, "ja"));
}

// Azure Static Web Apps silently drops files/folders whose name starts with
// "." during deployment upload, so repo paths like ".claude/..." can't be
// used as literal route segments or ZIP filenames. Escape the leading dot.
// Mirrored in src/lib/ai-suggest.mjs#skillHref and scripts/publication-core.mjs#zipFileName.
function encodeSkillPathSegment(segment) {
  const encoded = encodeURIComponent(segment);
  return encoded.startsWith(".") ? `dot-${encoded.slice(1)}` : encoded;
}

export function skillRoutePath(path) {
  return path.split("/").map(encodeSkillPathSegment).join("/");
}

export function skillHref(path) {
  return sitePath(`skills/${skillRoutePath(path)}`);
}

export function downloadHref(download) {
  return sitePath(download.split("/").map((segment) => encodeURIComponent(segment)).join("/"));
}

export function sitePath(path = "") {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const suffix = path ? `/${path.replace(/^\//, "")}` : "";
  return `${base}${suffix || "/"}`;
}
