---
type: Design Decision
title: tools/aimファミリーによる軽量AI自動化
description: Explains this repository's preference for automating repetitive, judgment-light text tasks (summarizing files, batch-answering the same question across many files, filling in SKILL.md metadata) with the lightweight tools/aim family (aim, aim-summarize) instead of a full AI coding tool session, and when fanning a prompt out across many paths in parallel is the right lever. Use when a task is "run the same simple prompt over N files/dirs" or "pick a model tier for a one-shot text task" and a full agentic session would be overkill.
tags: [tools, repo-wide]
generated: { by: reference_agent/cline-glm-5.2, at: 2026-08-09T14:39:30Z }
status: stable
---

# tools/aimファミリーによる軽量AI自動化

このリポジトリは、判断の軽い反復的なテキストタスク（ファイルの要約、複数ファイルへの同一質問、`SKILL.md`メタデータの補完）を、AIコーディングツールのセッションを1つ立ち上げるのではなく、`tools/aim`ファミリー（`aim` / `aim-summarize`）で処理する方針を取る。エージェント的なオーバーヘッド（ツール呼び出し、複数ターンの文脈保持）が要らないタスクにはこちらの方が軽く速い。

## 役割分担

- **`aim`**（[claude-plugins/my-tools/skills/aim-cli](../../claude-plugins/my-tools/skills/aim-cli/SKILL.md)） — systemプロンプトもマルチターンも扱わない単発CLI。`--prompt`内の`@path`でファイル/ディレクトリ内容を取り込む。`--parallel`で複数`--prompt`を並列に投げ、プロンプトごとの応答を返す（ステートレス、1回きり。例: ms-digestが`mslearn`の大量検索結果を並列にAI抽出する）。略記のSSOTは`tools/aim/models.json`（`aim --list-models`で確認）。モデル選択は`mini-m3`を基本線に、簡単すぎるタスクは`gpt-120b`、`mini-m3`で不十分なら`glm-5.2`/`gpt-luna`へエスカレーションする（判断基準は当該スキル参照）
- **`aim-summarize`**（[claude-plugins/my-tools/skills/aim-summarize](../../claude-plugins/my-tools/skills/aim-summarize/SKILL.md)） — `aim --parallel`と同様の並列ファン・アウトだが、結果を`.aim-use/summaries.db`（SQLite）へ永続化し、変更されたファイルだけ再要約する。使い捨てでなく蓄積したい要約タスク向け

## このリポジトリ自身も実際に使っている

`skill_meta_field_fill.py`（[skill-meta-fields](/repo-wide/skill-meta-fields.md)）は、各`SKILL.md`をエージェントに1件ずつ読ませて判断させる代わりに、`aim`でスキルディレクトリを`@path`として投げて`meta:`の値を埋める。

## 使い分けの目安

- **aimファミリーへ**: タスクがステートレス（前のターンを覚える必要がない）、プロンプトが対象間でほぼ同一、必要な判断が1回のモデル呼び出しに収まる
- **エージェント/サブエージェントへ**: ツール呼び出しが要る、中間結果に依存する多段推論が要る、ファイルの書き込み・編集そのものを行わせたい

## モデル階層の選び方

固定のデフォルトではなくコスト/精度のトレードオフとして選ぶ。`mini-m3`から始め、本当に簡単で精度を求められないタスクだけ`gpt-120b`に下げ、`mini-m3`の応答が明らかに不十分な場合にのみ`glm-5.2`/`gpt-luna`へ上げる。使える略記は`aim --list-models`、判断基準は[aim-cli](../../claude-plugins/my-tools/skills/aim-cli/SKILL.md)を参照。

## 関連

- [claude-plugins/my-tools/skills/aim-cli](../../claude-plugins/my-tools/skills/aim-cli/SKILL.md) — `aim`自体の使い方・`@path`/`--parallel`・モデル選択方針
- [claude-plugins/my-tools/skills/aim-summarize](../../claude-plugins/my-tools/skills/aim-summarize/SKILL.md) — DB永続化つき要約の使い方
- [skill-meta-fields](/repo-wide/skill-meta-fields.md) — このリポジトリ自身がaimを使っている例

## このドキュメントの位置づけ

`meta-plugins/`はこのリポジトリ自身のメンテナンス用であり、ユーザー向けプラグインではない。既存方針に従い、この内容を`ai-tools.yaml`へ登録しないこと。詳細は[ai-tools-config](/repo-wide/ai-tools-config.md)参照。
