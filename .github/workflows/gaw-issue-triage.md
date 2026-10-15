---
description: Reply to /gaw mentions in issues with a helpful response comment.
engine:
  id: codex
  # OpenAI モデル。codex エンジンで実行するため、リポジトリ Secrets に
  # `OPENAI_API_KEY` を設定すること（未設定だと codex エンジン起動失敗）。
  model: gpt-5.6-luna
strict: true
on:
  # Issue 本体または Issue コメントで `/gaw` と入力されたときに反応する
  # https://github.github.com/gh-aw/reference/triggers/#command-triggers-mentions
  slash_command:
    name: gaw
    events: [issues, issue_comment]
permissions:
  contents: read
  issues: read
tools:
  github:
    # https://github.github.com/gh-aw/reference/github-tools/#github-toolsets
    mode: gh-proxy
    toolsets: [issues]
# https://github.github.com/gh-aw/reference/safe-outputs/
safe-outputs:
  # Issue への返信コメント投稿を許可（issues: write は safe-outputs 側で付与される）
  add-comment:
  noop:
network:
  allowed:
    - defaults
# Github Agentic Workflow を利用
# https://github.github.com/gh-aw/
# 生成物は`./changelogs.lock.yml`に保存される（`gh aw compile changelogs --strict` で再生成）
---

# gaw issue replier

このワークフローは、Issue 本体または Issue コメントで `/gaw` とメンションされたときに起動し、**返答コメントを該当 Issue に投稿**します。

## やること

1. 起動のきっかけになった Issue は `#${{ github.event.issue.number }}` です。`/gaw` を含むコメント本文はコンテキストから取得できます。
2. `/gaw` 以降のコメント本文（質問・依頼内容）と、Issue のタイトル・本文・既存コメントを確認し、ユーザーが何を求めているか把握してください。
3. 質問や依頼に対し、日本語で簡潔かつ具体的に回答してください。コードや設定に関する質問は、リポジトリ内の該当ファイルを確認した上で事実に基づいた回答にしてください。
4. 回答は Issue のコメントとして投稿してください。冗長な前置き・後置きは避け、読み手がすぐ理解できる形にしてください。

## コメント投稿ルール

- コメントは **`add-comment` の safe output** を使って、起動元の Issue に投稿してください。
- `gh` コマンド等で直接コメントを投稿してはいけません。
- 1 回の実行で投稿するコメントは 1 件までにしてください。

## 完了時の動作

- 適切な返答コメントを `add-comment` で投稿してください。
- `/gaw` が単なる言及で明確な質問・依頼がない場合や、返答内容を確定できない場合は、理由を添えて `noop` を呼んでください。
