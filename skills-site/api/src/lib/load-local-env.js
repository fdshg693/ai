/**
 * Local-dev convenience: fall back to skills-site/.env for secrets (e.g. OPENROUTER_API_KEY)
 * that aren't already present in process.env. In Azure, Application settings populate
 * process.env before this runs, so this never overrides real values.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.resolve(HERE, "../../../.env");

if (fs.existsSync(ENV_PATH)) {
  dotenv.config({ path: ENV_PATH, override: false, quiet: true });
}
