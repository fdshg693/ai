import { useEffect, useMemo, useState } from "react";
import { applyCardFilters, availablePluginValues } from "../../lib/skill-filter.mjs";

type StatusOption = {
  key: string;
  label: string;
};

type SkillFilterProps = {
  tools: string[];
  plugins: string[];
  pluginToolMap: Record<string, string[]>;
  statuses: StatusOption[];
  count: number;
  searchApiHref?: string;
};

const SEARCH_DEBOUNCE_MS = 250;
const SEARCH_TIMEOUT_MS = 15_000;

export default function SkillFilter({
  tools,
  plugins,
  pluginToolMap,
  statuses,
  count,
  searchApiHref = "/api/search",
}: SkillFilterProps) {
  const [query, setQuery] = useState("");
  const [tool, setTool] = useState("");
  const [plugin, setPlugin] = useState("");
  const [status, setStatus] = useState("");
  const [visibleCount, setVisibleCount] = useState(count);

  const pluginEntries = useMemo(
    () => plugins.map((value) => ({ value, tools: pluginToolMap?.[value] ?? [] })),
    [plugins, pluginToolMap],
  );

  const enabledPlugins = useMemo(() => availablePluginValues(pluginEntries, tool), [pluginEntries, tool]);

  useEffect(() => {
    if (plugin && !enabledPlugins.includes(plugin)) {
      setPlugin("");
    }
  }, [plugin, enabledPlugins]);

  useEffect(() => {
    const cards = [...document.querySelectorAll<HTMLElement>("[data-skill-card]")];
    const empty = document.querySelector<HTMLElement>("[data-filter-empty]");
    const trimmedQuery = query.trim();

    const applyPaths = (paths: Set<string> | null) => {
      let visible = 0;
      for (const card of cards) {
        const matchesFilter =
          (!tool || card.dataset.tool === tool) &&
          (!plugin || card.dataset.plugin === plugin) &&
          (!status || card.dataset.status === status);
        const matchesQuery = !paths || (card.dataset.path ? paths.has(card.dataset.path) : false);
        const isVisible = matchesFilter && matchesQuery;
        card.hidden = !isVisible;
        if (isVisible) visible += 1;
      }
      setVisibleCount(visible);
      if (empty) empty.hidden = visible !== 0;
    };

    if (!trimmedQuery) {
      const visible = applyCardFilters(cards, { query: "", tool, plugin, status });
      setVisibleCount(visible);
      if (empty) empty.hidden = visible !== 0;
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: trimmedQuery });
        if (tool) params.set("tool", tool);
        if (plugin) params.set("plugin", plugin);
        if (status) params.set("status", status);
        const response = await fetch(`${searchApiHref}?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error("search failed");
        const data = await response.json();
        const paths = new Set<string>(
          Array.isArray(data.results) ? data.results.map((entry: { path?: string }) => entry.path).filter(Boolean) : [],
        );
        applyPaths(paths);
      } catch {
        // Local `astro dev` has no Functions; fall back to client-side name match.
        const visible = applyCardFilters(cards, { query: trimmedQuery, tool, plugin, status });
        setVisibleCount(visible);
        if (empty) empty.hidden = visible !== 0;
      } finally {
        clearTimeout(timeout);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query, tool, plugin, status, searchApiHref]);

  const handleReset = () => {
    setQuery("");
    setTool("");
    setPlugin("");
    setStatus("");
  };

  return (
    <form
      className="filter-panel"
      data-skill-filter
      onSubmit={(event) => event.preventDefault()}
      onReset={(event) => {
        event.preventDefault();
        handleReset();
      }}
    >
      <div className="filter-heading">
        <div>
          <p className="eyebrow">絞り込み</p>
          <h2>ツール・プラグイン・ステータスから探す</h2>
        </div>
        <button type="reset" className="button button-secondary">
          条件をリセット
        </button>
      </div>
      <div className="filter-fields">
        <label>
          <span>スキル名で検索</span>
          <input
            type="search"
            name="q"
            data-filter-search
            placeholder="スキル名の一部を入力"
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label>
          <span>AIツール</span>
          <select
            name="tool"
            data-filter-tool
            value={tool}
            onChange={(event) => setTool(event.target.value)}
          >
            <option value="">すべてのツール</option>
            {tools.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>プラグイン</span>
          <select
            name="plugin"
            data-filter-plugin
            value={plugin}
            onChange={(event) => setPlugin(event.target.value)}
          >
            <option value="">すべてのプラグイン</option>
            {pluginEntries.map((entry) => {
              const isAvailable = enabledPlugins.includes(entry.value);
              return (
                <option
                  key={entry.value}
                  value={entry.value}
                  hidden={!isAvailable}
                  disabled={!isAvailable}
                  data-tools={JSON.stringify(entry.tools)}
                >
                  {entry.value}
                </option>
              );
            })}
          </select>
        </label>
        <label>
          <span>ステータス</span>
          <select
            name="status"
            data-filter-status
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">すべてのステータス</option>
            {statuses.map((entry) => (
              <option key={entry.key} value={entry.key}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="filter-result" data-filter-summary aria-live="polite">
        {visibleCount}件のスキルを表示中
      </p>
    </form>
  );
}
