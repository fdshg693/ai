/**
 * Returns whether a skill card matches the current filter criteria.
 * @param {{ name?: string, tool?: string, plugin?: string, status?: string }} card
 * @param {{ query: string, tool: string, plugin: string, status: string }} filters
 */
export function cardMatches(card, { query, tool, plugin, status }) {
  const normalizedQuery = query.trim().toLowerCase();
  return (
    (!normalizedQuery || (card.name || "").includes(normalizedQuery)) &&
    (!tool || card.tool === tool) &&
    (!plugin || card.plugin === plugin) &&
    (!status || card.status === status)
  );
}

/**
 * Apply filter state to statically rendered `[data-skill-card]` elements.
 * @returns {number} visible count
 */
export function applyCardFilters(cards, filters) {
  let visible = 0;
  for (const card of cards) {
    const isVisible = cardMatches(
      {
        name: card.dataset.name,
        tool: card.dataset.tool,
        plugin: card.dataset.plugin,
        status: card.dataset.status,
      },
      filters,
    );
    card.hidden = !isVisible;
    if (isVisible) visible += 1;
  }
  return visible;
}

/**
 * Given plugin entries `{ value, tools }` and a selected tool, return which
 * plugin values remain available (empty tool = all available).
 */
export function availablePluginValues(plugins, selectedTool) {
  return plugins
    .filter((plugin) => !selectedTool || plugin.tools.includes(selectedTool))
    .map((plugin) => plugin.value);
}
