---
# 前提: 対象は常にこのリポジトリのルート。codegraph が PATH にあり `.codegraph/` があること。
# 同梱: scripts/snapshot_indexed_layout.py — 索引の status / files --max-depth 2 と、ディスクにあって索引に無いトップレベル名を注入する。
# 地図の取り方そのものは codegraph-docs（一般）。このスキルは「このリポジトリでは何をグラフに頼らないか」だけを足す。
# ai-tools.yaml には登録しない。
name: exploring-this-repo
description: Maps this repository's indexed code layout versus docs, skills, and SSOTs, then routes the next lookup. Use when starting a session here, when asked what the repo is or where something lives, or before grepping the whole tree for an unfamiliar area.
meta:
  tag: []
  requires_repo_tools: none
  requires_env: none
  dependencies: none
  requires_install: npm i -g @colbymchenry/codegraph
  requires_hooks: none
  requires_skills: codegraph-docs, discovering-skills, meta
  status: experimental
  description: このリポジトリの地図（索引に載るコード vs 載らない docs/スキル/SSOT）と次の参照先
  version: 1.0.2
---

!`python ${CLAUDE_SKILL_DIR}/scripts/snapshot_indexed_layout.py`

# このリポジトリを探す

ここは単一アプリではなく、AI コーディングツールの設定・プラグインと `tools/` の寄せ集め。上のスナップショットは **CodeGraph が索引したソースだけ**。上に注入が無いときは先に同梱スクリプトを実行する。

フォルダの用途は索引から推測しない。[README.md](../../../README.md) を `Read` する。

## 次にどれを見るか

1. **索引に載っているディレクトリ**（`tools/`、各 `*-plugins/` のスクリプト、`agent-tooling/` のフック実装など）— パスを特定してから [codegraph-docs](../../../claude-plugins/topics/skills/codegraph-docs/SKILL.md)。広い explore（「このリポジトリはどう動く」）はしない。コードの流れ・定義・呼び出し関係はこちら。
2. **テキストのローカル参照**（Markdown / SKILL.md / `.txt` のファイルリンク、リンク切れ、あるテキストを直したときの inbound）— [textgraph](../../../claude-plugins/my-tools/skills/textgraph/SKILL.md)。広い grep の前に `textgraph impact`。
3. **索引に無いトップレベル** — 中身の種類で振り分ける。
   - `SKILL.md` を探す / どのスキルを読むか → [discovering-skills](../discovering-skills/SKILL.md)
   - このリポジトリ自身のメンテ規約 → [meta](../meta/SKILL.md)（`docs/repo-wide/`）
   - YAML の意味（`ai-tools.yaml` / `repo-tools.yaml` / `meta_field.yaml`） → そのファイルを `Read` し、対応する `docs/repo-wide/` へ
4. どれにも当てはまらなければ、README が指すそのフォルダの README / `docs/index.md` を `Read` する。リポジトリ全体を grep しない。

## やらないこと

- 概要を `codegraph explore` の広い問いで取ろうとする
- スナップショットの木だけを見てフォルダの役割を言い切る
- `docs/` や `SKILL.md` 本文の参照関係を codegraph に期待する（テキストのローカルリンクは textgraph）

## このスキルの位置づけ

`meta-plugins/` はこのリポジトリ自身のメンテナンス用であり、ユーザー向けプラグインではない。`ai-tools.yaml` へ登録しないこと。
