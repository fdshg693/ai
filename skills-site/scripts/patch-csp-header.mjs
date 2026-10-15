#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(scriptDir, "..", "dist");
const configPath = path.join(distDir, "staticwebapp.config.json");

function listHtmlFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const entryPath = path.join(dir, entry);
    const stats = statSync(entryPath);
    if (stats.isDirectory()) files.push(...listHtmlFiles(entryPath));
    else if (entry.endsWith(".html")) files.push(entryPath);
  }
  return files;
}

function collectInlineScriptHashes() {
  const hashes = new Set();
  for (const file of listHtmlFiles(distDir)) {
    const html = readFileSync(file, "utf-8");
    for (const match of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
      const body = match[1];
      if (!body.trim()) continue;
      const digest = createHash("sha256").update(body, "utf-8").digest("base64");
      hashes.add(`'sha256-${digest}'`);
    }
  }
  return hashes;
}

function patchScriptSrc(cspValue, hashes) {
  const directives = cspValue.split(";").map((part) => part.trim()).filter(Boolean);
  const patched = directives.map((directive) => {
    if (!directive.startsWith("script-src")) return directive;
    const [name, ...sources] = directive.split(/\s+/);
    const merged = new Set([...sources, ...hashes]);
    return [name, ...merged].join(" ");
  });
  return patched.join("; ");
}

const hashes = collectInlineScriptHashes();
if (hashes.size === 0) {
  console.log("No inline scripts found; leaving CSP header unchanged.");
  process.exit(0);
}

const config = JSON.parse(readFileSync(configPath, "utf-8"));
const currentCsp = config.globalHeaders?.["Content-Security-Policy"];
if (!currentCsp) {
  throw new Error(`No Content-Security-Policy header found in ${configPath}`);
}

config.globalHeaders["Content-Security-Policy"] = patchScriptSrc(currentCsp, hashes);
writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

console.log(`Patched script-src in ${configPath} with ${hashes.size} inline script hash(es):`);
for (const hash of hashes) console.log(`  ${hash}`);
