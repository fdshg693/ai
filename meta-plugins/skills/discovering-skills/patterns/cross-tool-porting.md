# パターン: 他AIツールへの横展開

## 該当するタスクの例

- 「claude-plugins向けに作ったこのスキルをcursor/codex/copilotにも用意して」
- 「AIツール全体でこのルールを統一したい」

## 前提

このリポジトリは`ai-tools.yaml`をSSOTとして、Claude Code/Cursor/Codex/Copilot/Cline/AntigravityそれぞれにプラグインルートとSKILL.md群を持つ。ツールごとにフォーマット・置き場所・執筆規約が異なるため、対象ツールごとに専用の"書き方"スキルへ切り替える必要がある。

## 使うスキル（対象ツールに応じて選ぶ）

| 対象ツール     | 執筆規約スキル                                     | 配置先                             |
| -------------- | -------------------------------------------------- | ---------------------------------- |
| Claude Code    | `writing-skill`（複雑なら`writing-skill-complex`） | `claude-plugins/*/skills/`         |
| Cursor         | `cursor-skill-use` / `cursor-plugin-use`           | `cursor-plugins/*/skills/`         |
| Codex          | `codex-skill-authoring`                            | `codex-plugins/*/skills/`          |
| GitHub Copilot | `writing-skills`（`copilot-plugins/meta/`配下）    | `copilot-plugins/*/`               |
| Cline          | `cline-skill-writer` / `cline-plugin-writer`       | `cline-plugins/`, `.cline/skills/` |
| Antigravity    | `antigravity-skills`                               | `_agents/plugins/*/skills/`        |

## スキルの場所

| スキル                      | パス                                                                  |
| --------------------------- | --------------------------------------------------------------------- |
| `writing-skill`             | `claude-plugins/meta/skills/writing-skill/SKILL.md`                   |
| `writing-skill-complex`     | `claude-plugins/meta/skills/writing-skill-complex/SKILL.md`           |
| `cursor-skill-use`          | `cursor-plugins/meta/skills/cursor-skill-use/SKILL.md`                |
| `cursor-plugin-use`         | `cursor-plugins/meta/skills/cursor-plugin-use/SKILL.md`               |
| `codex-skill-authoring`     | `codex-plugins/meta/skills/codex-skill-authoring/SKILL.md`            |
| `writing-skills`（Copilot） | `copilot-plugins/meta/writing-skills/SKILL.md`                        |
| `cline-skill-writer`        | `.cline/skills/cline-skill-writer/SKILL.md`                           |
| `cline-plugin-writer`       | `.cline/skills/cline-plugin-writer/SKILL.md`                          |
| `antigravity-skills`        | `_agents/plugins/antigravity-meta/skills/antigravity-skills/SKILL.md` |

## 手順

1. 展開先ツールを確定する（依頼で名指しされたツールだけに絞る。「全部」と言われない限り全ツールに展開しない）。
2. 各ツールごとに上表の執筆規約スキルを、そのツール分の編集ステップの直前だけロードする（一度に全部読み込まない — SKILL.md本体の手順4と同じ考え方）。
3. 新規プラグイン・スキルを追加/削除したら、まず`ai-tools.yaml`を更新する（AGENTS.mdのSSOT規約）。README.mdの`ai-tools-section`は`generate_readme_tools_section.py`が生成するため手編集しない。

## この流れで足りないとき

- 表にないツール、または表のスキル名が実際には存在しない（リネーム済み等） → `skill-search`エージェントでそのツール名をキーワードに再検索する。
