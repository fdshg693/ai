import { defineConfig } from "astro/config";
import react from "@astrojs/react";

export default defineConfig({
  output: "static",
  site: process.env.SITE_URL || undefined,
  base: process.env.SITE_BASE_PATH || "/",
  trailingSlash: "never",
  integrations: [react()],
});
