# レポジトリメンテ　プラグイン

このレポジトリのメンテ用・このレポジトリの全スキル・ツールが使える前提のハイブリッドスキル用プラグインを登録。
このプラグインはこのレポジトリ特有なので、マーケットプレイスやサイトには含めない。
そのため、`ai-tools.yaml`には記載しない

スキルは `meta-plugins/skills/` 配下。メンテ資料の選択は `meta`、このリポジトリの地図は `exploring-this-repo`。詳細は各 `SKILL.md` を参照。

## ローカルでの直接インストール

マーケットプレイスには登録していないため、`--plugin-dir`でパスを直接指定してロードする。

```shell
# リポジトリルートから起動する場合
claude --plugin-dir ./meta-plugins
```

- スキル(`SKILL.md`)の変更はセッション中も即座に反映される。`agents/`や`hooks/`等を追加・変更した場合は`/reload-plugins`で反映するか再起動する。
- 動作確認後、マニフェストや構成の妥当性は`claude plugin validate ./meta-plugins --strict`でチェックできる。
