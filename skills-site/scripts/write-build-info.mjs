#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(scriptDir, "..", "public", "build-info.json");

function gitRevParseHead() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

function gitCurrentBranch() {
  try {
    return execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

const commit = process.env.GITHUB_SHA || gitRevParseHead() || "unknown";
const ref = process.env.GITHUB_REF_NAME || gitCurrentBranch() || "local";
const runUrl =
  process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : null;

const buildInfo = {
  commit,
  shortCommit: commit === "unknown" ? "unknown" : commit.slice(0, 7),
  ref,
  builtAt: new Date().toISOString(),
  workflowRunUrl: runUrl,
};

mkdirSync(path.dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(buildInfo, null, 2)}\n`);

console.log(`Wrote build info to ${outPath}:`, buildInfo);
