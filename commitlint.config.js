module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // config-conventionalのデフォルトはsentence-caseも禁止するが、それだと
    // "Cursor rules..." のように固有名詞（先頭1文字だけ大文字）で始まる件名まで
    // 誤検知してしまう。Start Case・PascalCase・全角/半角の全大文字のような
    // 明らかにおかしい書式だけを禁止する。
    "subject-case": [2, "never", ["start-case", "pascal-case", "upper-case"]],
  },
};
