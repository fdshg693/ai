export const STATUS_ORDER = ["unset", "draft", "experimental", "stable", "deprecated", "unknown"];

const STATUS_TEXT = {
  unset: { label: "ステータス未設定", description: "通常のスキルとして掲載" },
  draft: { label: "Draft", description: "作成中の下書き" },
  experimental: { label: "Experimental", description: "試験的なスキル" },
  stable: { label: "Stable", description: "安定版として推奨" },
  deprecated: { label: "非推奨", description: "利用は推奨されません" },
};

export function statusText(status) {
  if (status.key === "unknown") {
    return { label: `未定義: ${status.raw}`, description: "未定義のステータス" };
  }
  return STATUS_TEXT[status.key] ?? STATUS_TEXT.unset;
}

// Generic (raw-independent) label for a status key, used where skills are
// grouped by key rather than shown individually (e.g. the filter dropdown).
export function statusFilterLabel(key) {
  if (key === "unknown") return "未定義";
  return STATUS_TEXT[key]?.label ?? STATUS_TEXT.unset.label;
}
