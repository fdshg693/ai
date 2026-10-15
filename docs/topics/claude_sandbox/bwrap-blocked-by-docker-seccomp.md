---
type: Known Issue
title: コンテナ内のbubblewrapサンドボックスがDocker既定seccompでブロックされる
description: tools/sandbox（ISSUE駆動Dockerサンドボックスエージェント）のコンテナ内で、Claude Code組み込みのBashサンドボックス（bubblewrap）が「bwrap No permissions to create new namespace」で起動できない原因と修正を記録する。原因はDockerのデフォルトseccompプロファイルが非特権ユーザー名前空間作成(unshare(CLONE_NEWUSER))自体をブロックしていることで、Ubuntu 24.04+のAppArmor制限や`enableWeakerNestedSandbox`が対応する別の失敗モード（/procの再マウント失敗）とは異なる。Use when Dockerコンテナ内でbubblewrap/Claude Codeサンドボックスが同様のエラーで起動しない場合、またはコンテナ内Bashサンドボックスの防御レイヤーを検証・変更する場合。
tags: [tools]
generated: { by: reference_agent/claude-sonnet-5, at: 2026-08-10T13:30:00Z }
status: stable
---

# コンテナ内のbubblewrapサンドボックスがDocker既定seccompでブロックされる

## 症状

[tools/sandbox](../../tools/sandbox/)のISSUE専用使い捨てコンテナ内で、Claude Code組み込みのBashサンドボックス（bubblewrap）を有効にしたまま`query()`を実行すると、Bashツール実行のたびに以下のエラーで失敗し、エージェントがBash/Readのみのフォールバック動作に陥る（`git commit`等ができないまま終了する）。

```
bwrap: No permissions to create new namespace, likely because the kernel does not allow non-privileged user namespaces.
```

## 原因

Dockerのデフォルトseccompプロファイルは、非rootプロセスによる`unshare(CLONE_NEWUSER)`（ユーザー名前空間作成）自体をブロックする。bubblewrapはBashサンドボックスの実現にこの呼び出しを必須とするため、`docker run`に何も追加せずに起動すると常にこのエラーになる。

これはAnthropic公式ドキュメント（[Configure the sandboxed Bash tool](https://code.claude.com/docs/en/sandboxing.md)）が挙げる2つの既知パターンのどちらとも異なる:

- **Ubuntu 24.04+のAppArmor制限**（`kernel.apparmor_restrict_unprivileged_userns`）: `sandbox-agent:latest`イメージ内で`/proc/sys/kernel/apparmor_restrict_unprivileged_userns`を読むと`No such file or directory`となり、そもそもこのsysctlキー自体が存在しない（Docker Desktop / WSL2バックエンドのカーネルにはこの制限機構がない）。該当しない。
- **`enableWeakerNestedSandbox`が対応する失敗**: このオプションは「名前空間の作成自体は成功するが、コンテナ内で`/proc`を新規マウントできない」ケース向け。今回のエラーは名前空間作成そのものが拒否されており、`/proc`マウント以前の、より早い段階での失敗。[docker/claude-settings/managed-settings.json](../../tools/sandbox/docker/claude-settings/managed-settings.json)で既に`enableWeakerNestedSandbox: true`を設定済みだったが、このエラーには無関係だった。

## 検証方法

`sandbox-agent:latest`イメージに対し、`docker run`のセキュリティ関連フラグを変えて直接`bwrap`を実行し切り分けた。

```bash
# 素のdocker run（フラグなし）→ 再現する
docker run --rm sandbox-agent:latest bash -c \
  "bwrap --unshare-user --ro-bind / / echo ok"
# => bwrap: No permissions to create new namespace ...

# --security-opt apparmor=unconfined → 効果なし（AppArmorは原因ではない）
docker run --rm --security-opt apparmor=unconfined sandbox-agent:latest bash -c \
  "bwrap --unshare-user --ro-bind / / echo ok"
# => bwrap: No permissions to create new namespace ...

# --cap-add SYS_ADMIN → 別のエラーに変化（不十分）
docker run --rm --cap-add SYS_ADMIN sandbox-agent:latest bash -c \
  "bwrap --unshare-user --ro-bind / / echo ok"
# => bwrap: pivot_root: Operation not permitted

# --security-opt seccomp=unconfined → 成功
docker run --rm --security-opt seccomp=unconfined sandbox-agent:latest bash -c \
  "bwrap --unshare-user --ro-bind / / echo ok"
# => ok
```

Claude Codeサンドボックスが実際に使うフラグ一式（`--unshare-all --die-with-parent --ro-bind / / --proc /proc --dev /dev`相当）でも`--security-opt seccomp=unconfined`単体で成功することを確認済み。

## 修正

[tools/sandbox/orchestrator/run_agent.py](../../tools/sandbox/orchestrator/run_agent.py)の`run_container()`内、`docker run`コマンド組み立て部分に`--security-opt seccomp=unconfined`を追加する。

## トレードオフと妥当性

このオプションはDockerコンテナ自体のseccompフィルタ（デフォルトで約40系統のsyscallをブロックする防御）を丸ごと外すため、[AGENTS.md](../../tools/sandbox/AGENTS.md)が定義する「Dockerコンテナ＋GitHub App最小権限＋Claude Code組み込みネットワークサンドボックスの三重防御」のうち、**Dockerコンテナ自体の隔離強度は低下する**。

ただしAGENTS.mdの設計方針は、ネットワーク制御の主防御をDockerネットワーク自体ではなく「コンテナ内でネストして動くClaude Code組み込みサンドボックス（`sandbox.network.allowedDomains`）」に置くことを前提としている。つまりこのネスト動作が機能して初めて三重防御が成立する設計であり、`seccomp=unconfined`はその前提を壊す変更ではなく、**むしろ壊れていた前提を復旧する変更**にあたる。この経緯から、既存の設計判断を維持したまま適用してよいと判断した。

## 関連

- [tools/sandbox/AGENTS.md](../../tools/sandbox/AGENTS.md) — 「運用上の注意点」節、三重防御の設計方針
- [tools/sandbox/docker/claude-settings/managed-settings.json](../../tools/sandbox/docker/claude-settings/managed-settings.json) — `enableWeakerNestedSandbox`等のsandbox設定
- [Configure the sandboxed Bash tool](https://code.claude.com/docs/en/sandboxing.md) — Anthropic公式ドキュメント、Troubleshootingセクション
