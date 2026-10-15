/**
 * Reads meta_field.yaml (repository root), the SSOT for the definitions of
 * the `meta:` subfields in SKILL.md frontmatter, and exposes them for use by
 * the publication pipeline and (eventually) the site UI.
 *
 * Do not hardcode field labels/descriptions elsewhere — always go through
 * this module so meta_field.yaml stays the single source of truth.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIRECTORY, "..", "..");
const META_FIELD_YAML_PATH = path.join(REPO_ROOT, "meta_field.yaml");

/** Convert a meta_field.yaml snake_case field name to the camelCase key used on JS `meta` objects. */
export function toCamelCase(fieldName) {
  return fieldName.replace(/_([a-z0-9])/g, (_, char) => char.toUpperCase());
}

export function loadMetaFieldRegistry(filePath = META_FIELD_YAML_PATH) {
  const data = yaml.load(fs.readFileSync(filePath, "utf8"));
  if (!data || typeof data !== "object" || !data.fields || typeof data.fields !== "object") {
    throw new Error(`${filePath}: expected a top-level 'fields' mapping`);
  }
  return Object.entries(data.fields).map(([field, definition]) => ({
    field,
    camelField: toCamelCase(field),
    description: definition?.description ?? "",
    format: definition?.format ?? "",
    default: definition?.default ?? "",
    example: definition?.example ?? "",
  }));
}

/** Ordered list of the 9 meta_field.yaml entries: { field, camelField, description, format, default, example }. */
export const META_FIELD_REGISTRY = loadMetaFieldRegistry();

/** Same entries keyed by their snake_case field name for quick lookup. */
export const META_FIELD_REGISTRY_BY_FIELD = new Map(
  META_FIELD_REGISTRY.map((entry) => [entry.field, entry]),
);
