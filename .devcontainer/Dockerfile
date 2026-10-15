FROM mcr.microsoft.com/devcontainers/base:2.0.4-noble

# Node.js + pnpm (versions match mise.toml at the repo root), installed system-wide
# so they're available without shell activation (needed for non-interactive exec,
# e.g. `ona environment exec` / `ona-run`).
RUN curl -fsSL https://deb.nodesource.com/setup_26.x | bash - \
	&& apt-get install -y --no-install-recommends nodejs \
	&& rm -rf /var/lib/apt/lists/* \
	&& npm install -g pnpm@11.15.0

# uv (Python tooling for tools/aim, tools/aim-use, etc.), installed system-wide.
RUN curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR=/usr/local/bin sh

# AI agent CLIs used by tools/ona-run's --agent claude/codex templates.
RUN npm install -g @anthropic-ai/claude-code @openai/codex
