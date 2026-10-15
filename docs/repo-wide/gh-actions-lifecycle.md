---
type: Design Decision
title: GitHub Actions駆動のリリース・デプロイ・自動化ライフサイクル
description: Explains how this repository's release/deploy and issue/PR automation entirely run on GitHub Actions under .github/workflows/ — the skills-site build-verify-deploy-tag pipeline to Azure Static Web Apps, the gh-aw agentic workflows (Markdown source compiled to *.lock.yml, plus the auto-generated maintenance workflow), and the Claude/Codex/PR-Agent issue and PR bots. Use when a GitHub Actions run fails, when asked how a deploy/release actually happens in this repo, when adding or editing anything under .github/workflows/, or when deciding which secret a given workflow needs.
tags: [repo-wide]
generated: { by: reference_agent/cline-glm-5.2, at: 2026-08-09T14:39:30Z }
status: stable
---

# GitHub Actions駆動のリリース・デプロイ・自動化ライフサイクル

このリポジトリには専用のリリースツールやデプロイCLIは無く、`.github/workflows/`配下のGitHub Actionsだけでリリース・デプロイと、issue/PRの自動応答が完結する。ブランチ運用はmain 1本＋PRマージ（`git log`で確認できる`Merge pull request`コミットが実態）で、専用のリリースブランチやタグ運用も自動化側（後述のdeployタグ）に任せている。

このリポジトリは[MIT License](../../LICENSE)で、誰でも自由にFork・改変・再配布してよい。一方でここで説明するGitHub Actions駆動の自動化（issue/PR bot、skills-siteのデプロイ）は第三者には開放していない設定になっている（後述の`author_association`ガードとFork PRでのシークレット非公開）。コントリビュート方法とこの制限の位置づけは[CONTRIBUTING.md](../../CONTRIBUTING.md)を参照。

大きく2系統に分かれる。

1. **skills-siteのビルド→検証→デプロイ→タグ付け**（このリポジトリで唯一の「リリース・デプロイ」パイプライン）
2. **gh-aw / Claude / Codex / PR-Agentによるissue・PR自動化**（リリースではないが、GitHub上のライフサイクルを回す仕組みという点で同じ層）

## 1. skills-siteのリリース・デプロイパイプライン（`skill-site.yml`）

トリガーは`skills-site/**`、このワークフロー自身、各プラグインの`skills/**`等への push（main）/ pull_request / `workflow_dispatch`。

- **`check-secrets`**: `push`かつ`main`、または`workflow_dispatch`のときだけ、`AZURE_STATIC_WEB_APPS_API_TOKEN`の存在を確認して無ければ即失敗させる（デプロイ専用シークレットなのでPRでは走らない）。
- **`verify`**: push/PR/workflow_dispatchすべてで実行。`OPENROUTER_API_KEY`（catalog buildのskill embeddings計算に必須）を明示チェックしてから`build`→`validate`→`test`を実行し、`dist`と`api`をartifactとしてアップロードする。forkからのPRはリポジトリのシークレットを読めないため、この`OPENROUTER_API_KEY`チェックで**意図的に**落ちる（バグではなく、埋め込み抜きの不完全なビルドをそのまま通過させない安全装置）。
- **`deploy`**: `push`かつ`main`、または`workflow_dispatch`のときだけ、`verify`のartifactをAzure Static Web Appsへアップロードし、成功後に`deploy-<UTC日時>-<short SHA>`形式のgit tagを作成してpushする。

ロールバック専用の操作は無い。過去の`deploy-*`タグから戻したいcommitを特定し、そのcommitへの再push、または該当commitをmainへcherry-pick/revertして通常のpushフローに乗せる。

このパイプラインの詳細（各シークレットの正確な用途、`OPENROUTER_API_KEY`がビルド時のGitHub SecretsとランタイムのAzure SWA Application settingで**別々に**必要な理由、障害時の切り分け手順）は[skills-site/AGENTS.md](../../skills-site/AGENTS.md)が正。ここでは全体像だけを扱い、重複させない。

## 2. issue/PR自動化（Claude / Codex / PR-Agent / gh-aw）

| ワークフロー                                      | トリガー                                     | 実行主体                                                                   | 必要なシークレット  |
| ------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------- | ------------------- |
| `claude-issue-triage.yml`                         | `issues: opened`                             | `anthropics/claude-code-action`（`/github-action:issue-triage`プロンプト） | `ANTHROPIC_API_KEY` |
| `codex-issue-triage.yml`                          | issue本文またはissueコメントに`@codex`       | `openai/codex-action`                                                      | `OPENAI_API_KEY`    |
| `pr-agent.yml`                                    | PRへのコメント（`/describe`, `/review`等）   | `the-pr-agent/pr-agent`                                                    | `OPENAI_KEY`        |
| `gaw-issue-triage.md`→`gaw-issue-triage.lock.yml` | issue本文/コメントで`/gaw`スラッシュコマンド | gh-aw（codexエンジン）                                                     | `OPENAI_API_KEY`    |
| `agentics-maintenance.yml`                        | 日次cron + `workflow_dispatch`               | gh-aw自動生成の保守ワークフロー                                            | `GITHUB_TOKEN`のみ  |

### gh-awの`.md`→`.lock.yml`という生成関係

`.github/workflows/gaw-issue-triage.md`のfrontmatter（`on.slash_command`, `safe-outputs`等）が実体で、`gaw-issue-triage.lock.yml`は[gh-aw](https://github.github.com/gh-aw/)がコンパイルした**生成物**（[repo-ssot-pattern](/repo-wide/repo-ssot-pattern.md)と同じ「SSOT→生成」の形）。`.lock.yml`を直接編集しても次のコンパイルで上書きされるため、`.md`側を直してから再コンパイルする。

```bash
just --justfile .github/workflows/justfile compile-one gaw-issue-triage
just --justfile .github/workflows/justfile compile        # 全ワークフロー
```

`agentics-maintenance.yml`も同じくgh-awが自動生成したファイル（ヘッダに`DO NOT EDIT`と明記）で、期限切れのsafe outputs掃除や`activity_report`/`forecast`等の手動保守操作を提供する。設定を変えたい場合はこのファイルを直接編集せず、`.github/workflows/aw.json`側の設定を変更して`gh aw compile`で再生成する。

### 誰が起動できるか（author_associationによる制限）

このリポジトリはpublicなため、issueやPRコメントは書き込み権限の無い第三者でも作成できる。それだけで課金や書き込み権限込みのエージェントが起動しないよう、`claude-issue-triage.yml` / `codex-issue-triage.yml` / `pr-agent.yml`はいずれもジョブの`if`条件で`github.event.issue.author_association` / `github.event.comment.author_association`を`OWNER`または`COLLABORATOR`に制限している。`gaw-issue-triage.md`（gh-aw）は`pre_activation`ジョブの`is_team_member`チェックで同等の制限を自前実装済みのため、追加のガードは不要。

新しいissue/PR bot系ワークフローを追加するときは、同じ観点（誰が起動できるか、書き込み権限をどこまで渡すか）を必ず確認し、`author_association`によるガード無しでOWNER/COLLABORATOR以外に課金・書き込み権限を渡さない。

## 落とし穴

- **fork PRの`verify`失敗は意図した安全装置**。「CIが壊れている」と早合点して`OPENROUTER_API_KEY`チェックを削除・回避しない。
- **`*.lock.yml`を手編集しない**。gh-awの`.md`ソースを直して`gh aw compile --strict`（または上記justfileレシピ）で再生成する。
- **`OPENROUTER_API_KEY`は2箇所で別々に管理**される。GitHub Actions Secrets（`verify`のビルド時埋め込み計算用）と、Azure SWAのApplication setting（本番`/api/suggest`のランタイム用）は同じ名前でも別設定であり、片方を更新してももう片方には反映されない（詳細は[skills-site/AGENTS.md](../../skills-site/AGENTS.md)）。
- **`AZURE_STATIC_WEB_APPS_API_TOKEN`はデプロイトークン**であり、Application settingsの注入はできない。ランタイム用の環境変数を追加したい場合はAzure側で別途設定する。

## 関連

- [CONTRIBUTING.md](../../CONTRIBUTING.md) — MITライセンスでのFork可否と、GitHub Actions自動化を第三者に開放しない方針の説明
- [skills-site/AGENTS.md](../../skills-site/AGENTS.md) — skills-siteのビルド・検証・デプロイ・障害時対応の詳細（このドキュメントが要約する一次情報源）
- [repo-ssot-pattern](/repo-wide/repo-ssot-pattern.md) — 「1つのSSOT＋生成スクリプト」という設計思想（gh-awの`.md`→`.lock.yml`も同じ形）
- [ai-tools-config](/repo-wide/ai-tools-config.md) — このリポジトリの別のCI/自動化対象（マーケットプレイス・スキルカタログの生成とlefthook連携）
