# claude_sandbox/ — tools/sandbox（ISSUE駆動Dockerサンドボックスエージェント）の概念

[tools/sandbox](../../tools/sandbox/)（GitHub ISSUEの`@sandbox`メンションをポーリングし、使い捨てDockerコンテナ内でClaude Agent SDKに作業させる仕組み）の運用中に得た、AGENTS.md/READMEには書ききれない調査結果・既知の不具合を記録する。

- [bwrap-blocked-by-docker-seccomp](bwrap-blocked-by-docker-seccomp.md) — コンテナ内のbubblewrapサンドボックスがDocker既定seccompでブロックされる原因と修正（`--security-opt seccomp=unconfined`）。Use when Dockerコンテナ内でbubblewrap/Claude Codeサンドボックスが「bwrap: No permissions to create new namespace」で起動しない場合。
