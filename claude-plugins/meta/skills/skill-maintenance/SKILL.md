---
# Claude CLI と Claude Code の取得スクリプト、および同ディレクトリ配下の他スキルに依存する。
# 取得とファイル変更を伴うため、ユーザーが明示的に呼び出した場合だけ使う。
name: skill-maintenance
description: Maintains the Claude-related skills under `claude-plugins/meta/skills` by refreshing the Claude CLI help snapshot and Claude Code documentation snapshot, inspecting semantic changes, and updating affected skills. Use when explicitly checking whether those skills are stale after a Claude CLI or Claude Code documentation update.
disable-model-invocation: true
allowed-tools: Bash(python ${CLAUDE_SKILL_DIR}/scripts/*.py *)
meta:
  tag: []
  requires_repo_tools: tools/internal/plugin_meta/generate/generate_skills_catalog_md.py
  requires_env: none
  dependencies: none
  requires_install: none
  requires_hooks: none
  requires_skills: claude-cli-docs, claude-code-docs
  status: experimental
  description: no description
  version: 1.0.4
---

!`python ${CLAUDE_SKILL_DIR}/scripts/refresh_and_diff.py`

# スキルメンテナンス

`claude-plugins/meta/skills` 配下の Claude 関連スキルを、現在の Claude CLI と Claude Code 公式ドキュメントに追随させる。対象のスナップショットを更新し、意味のある差分に関係するスキルだけを修正する。

## 手順

1. **取得と差分生成の結果を確認する**

   スキル起動時に次の動的コンテキストが実行される。

   ```text
   python ${CLAUDE_SKILL_DIR}/scripts/refresh_and_diff.py
   ```

   このスクリプトは、次の2本を `--force` 付きで実行し、実行後の内容を Python で比較する。

   - `${CLAUDE_SKILL_DIR}/../claude-cli-docs/generate_claude_help_yaml.py`
   - `${CLAUDE_SKILL_DIR}/../claude-code-docs/download_claude_code_reference.py`

   比較対象の「変更前」は実行直前の `output/` の内容ではなく、`claude-plugins/meta/skills/skill-maintenance/state/` に保存されている「前回このスクリプトを実行した時点」のスナップショットである。`output/` が別経路（生成スクリプトの直接実行、手動編集、git checkout 等）で更新されていても、このスナップショットは本スクリプトの実行時にしか書き換わらないため影響を受けない。そのぶん、別経路での更新が既に反映済みの変更を再度差分として拾う可能性があるが、これは許容する。スナップショットは毎回の実行後に最新内容へ更新される（`state/` 配下は git 管理対象外）。

   取得時刻だけの差分は除外し、ソースごとの完全な unified diff を `temp/skill-maintenance/diff/` フォルダ配下に対象ごとの個別ファイルとして書き出す（例: `claude-cli-help.diff`, `claude-code-reference.diff`, `claude-code-full-reference.diff`）。動的コンテキストの出力には、書き出されたファイル一覧と差分の有無だけが表示される。**この差分ファイルは自分で直接読まない。** 差分は巨大になりやすく、そのままコンテキストに載せると以降の作業を圧迫する。

2. **取得失敗を切り分ける**

   どちらかの生成スクリプトが失敗した場合、そのソースを最新とみなさない。失敗理由（`claude` CLI の未導入、ネットワーク、依存パッケージなど）を報告し、成功したソースの差分だけを処理する。両方とも失敗した場合はスキル更新を行わず、原因と再実行条件を報告する。

3. **差分をサブエージェントに要約させる**

   `temp/skill-maintenance/diff/` に書き出された差分ファイルごとに、Agent ツール（`general-purpose` 等、通常の新規サブエージェント）を1つ起動し、そのファイルを読ませて要約させる。要約対象は、意味のある変更点（追加・変更・削除されたフラグ、サブコマンド、設定名、機能名、ドキュメント URL/slug）に限定し、差分そのものの引用や整形上のノイズは含めないよう指示する。複数ファイルがある場合は並列に起動してよい。

   サブエージェントへの指示に最低限含めるもの:
   - 読ませる差分ファイルの絶対パス（`temp/skill-maintenance/diff/*.diff`）
   - 「差分全体を引用せず、影響範囲の特定に使える変更点だけを箇条書きで返す」という要件
   - どのソース（Claude CLI / Claude Code ドキュメント）由来の差分かという文脈

4. **影響を受けるスキルの特定をサブエージェントに委譲する**

   Agent ツール（`general-purpose` 等、通常の新規サブエージェント）を1つ新たに起動し、手順3で得た全ソース分の要約（テキストとして渡す。要約ではなく差分ファイルそのものは渡さない）を渡して、次の2段階の絞り込みを行わせる。1段階目だけで確定させず、必ず2段階目まで行うよう明示的に指示する。このサブエージェントには編集は行わせず、調査と報告のみを行わせる。

   1. **`CATALOG.md` で候補を絞り込む**

      `claude-plugins/meta/skills/CATALOG.md` を読み、要約中のキーワード（フラグ名、サブコマンド名、設定名、機能名、ドキュメント URL/slug）を各スキルエントリの `name`・`description`・コメント行と照合する。一致または関連が疑われるスキルをすべて候補としてリストアップする。判断に迷う場合は候補から外さず含める（この段階では過剰に拾ってよい）。

      - CLI 由来の差分は `claude-cli-docs` と `claude-cli-use`、および `claude` コマンドの仕様に言及するスキルを優先的に候補に入れる。
      - Claude Code ドキュメント由来の差分は、該当 URL/slug や機能名に言及するスキルを優先的に候補に入れる。
      - `CATALOG.md` に説明が現れないという理由だけで候補から除外しない。`CATALOG.md` は `name`/`description`/コメントのみを収録しており、本文中でしか言及されない固有名詞もあるため、この段階はあくまで一次スクリーニングとする。

   2. **候補スキルの `SKILL.md` と `README.md` を読んで確定する**

      1で挙げた候補それぞれについて、`claude-plugins/meta/skills/<候補名>/SKILL.md`（存在すれば同ディレクトリの `README.md` も）を実際に読み、差分の内容が本文中の説明・手順・コマンド例・参照先と矛盾するか、古くなっているかを個別に確認する。

      - 実際に影響がある（記述が古い・矛盾する）と確認できたスキルだけを更新対象として確定する。
      - 候補ではあったが読んだ結果影響がないと判断したスキルは、その理由を挙げる。
      - 関係のないスキルは対象にしない。スナップショットの変更だけで説明・手順が変わらない場合も対象にしない。
      - 候補スキルを読んでも差分の意味が判断できない場合に限り、該当箇所を絞った上で差分ファイルの該当部分だけを読む（ファイル全体は読まない）。

   サブエージェントへの指示に最低限含めるもの:
   - 手順3の要約全文（ソースごとの文脈付き）
   - `CATALOG.md` の絶対パス
   - 上記1・2の2段階を必ず順に踏むこと、および1の結果だけで確定してはならないという要件
   - 出力形式: 更新対象と確定したスキルごとに「スキル名・具体的にどこが古いか・何を根拠にそう判断したか」を、対象外と判断した候補ごとに「スキル名・対象外と判断した理由」を、それぞれ構造化して返すこと

   このサブエージェントからの報告を受け取ったら、更新対象スキルの一覧と根拠が差分の要約と整合しているかを確認する。整合しない、または根拠が薄いと判断した場合は対象から外すか、自分で候補の `SKILL.md` を読み直して判断する。

5. **関連スキルの更新をサブエージェントに委譲する**

   手順4で更新対象と確定したスキルごとに、Agent ツールで新たなサブエージェントを1つ起動し、実際の編集を行わせる。対象スキルが複数ある場合は並列に起動してよい（スキルごとに編集範囲が独立しているため競合しない）。

   サブエージェントへの指示に最低限含めるもの:
   - 編集対象の `SKILL.md`（および `README.md`）の絶対パス
   - 手順4で得た、そのスキルに関する具体的な根拠（どこが古いか・何が変わったか）
   - 「古い仕様・例・コマンド・参照先・制約だけを、渡された根拠に基づいて修正すること。公式ドキュメントにない仕様を推測して追加しないこと。既存のユーザー変更は保持し、通常のファイル編集手段（Edit 等）を使うこと」という要件
   - 変更後、自分が何を・なぜ変更したかを簡潔に要約して返すこと

   全サブエージェントの完了後、`CATALOG.md` は生成物なので直接編集しない。スキルの追加・削除・frontmatter変更が発生した場合だけ、リポジトリルートから次を実行して再生成する。

   ```text
   uv run --directory tools/internal python -m plugin_meta.generate.generate_skills_catalog_md
   ```

6. **検証して報告する**

   手順5の各サブエージェントが変更した `SKILL.md` の frontmatter と参照パスを自分で確認し、手順4の根拠・手順3の要約に対応していることを再確認する。最後に、取得結果、要約内容の要点、手順4で対象外と判断したスキルとその理由、変更したスキルとその内容、残った失敗や確認事項を簡潔に報告する。

## 制約

- 取得時刻だけの差分を更新理由にしない。
- `output/help_result.yaml`、`output/llms.txt`、`output/llms-full.txt` は生成スクリプトの出力であり、手編集しない。
- 既存スキルを一括で書き換えず、差分から影響範囲を説明できるものだけ更新する。
- 影響を受けるスキルは `CATALOG.md` での絞り込みだけで確定させない。候補となったスキルの `SKILL.md`（存在すれば `README.md` も）を実際に読んでから更新対象を確定する。この特定作業自体を自分（起動元）が直接行わず、サブエージェントに委譲する。
- スキルの実際の更新（ファイル編集）も自分が直接行わず、対象スキルごとにサブエージェントへ委譲する。
- `temp/skill-maintenance/diff/` の各ファイルは自分で全文を読まず、必ずサブエージェントの要約を経由する。要約で判断できない場合だけ、該当箇所に絞って読む。
- `temp/skill-maintenance/` は作業用の差分置き場であり、コミット対象にしない。
- `claude-plugins/meta/skills/skill-maintenance/state/` は前回実行時点のスナップショットを保持するための内部状態であり、手編集・コミット対象にしない（`.gitignore` 済み）。
