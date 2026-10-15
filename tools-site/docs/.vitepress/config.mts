import { defineConfig } from "vitepress";
import { RELEASED_TOOLS } from "../../scripts/repo-tools-data.mjs";

export default defineConfig({
  title: "AI Tools",
  description: "このリポジトリの自作CLIツールのインストール/使い方まとめ",
  base: "/AI/",
  themeConfig: {
    nav: [
      { text: "トップ", link: "/" },
      { text: "ツール一覧", link: "/tools/" },
    ],
    sidebar: [
      {
        text: "ツール",
        items: RELEASED_TOOLS.map((tool) => ({
          text: tool.name,
          link: `/tools/${tool.name}`,
        })),
      },
    ],
  },
});
