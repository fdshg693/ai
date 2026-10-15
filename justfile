set windows-shell := ["powershell.exe", "-NoLogo", "-NoProfile", "-Command"]

site_dir := "skills-site"
infra_dir := site_dir + "/infra"
azure_location := env_var_or_default("AZURE_LOCATION", "japaneast")
azure_resource_group := env_var_or_default("AZURE_RESOURCE_GROUP", "rg-ai-skill-catalog")
azure_static_site := env_var_or_default("AZURE_STATIC_SITE_NAME", "ai-skill-catalog")
github_repository := env_var_or_default("GITHUB_REPOSITORY", "fdshg693/AI")

default:
    @just --list

py-format:
    uv run ruff format .

py-format-check:
    uv run ruff format --check .

py-lint:
    uv run ruff check .

py-check: py-format-check py-lint

skills-site-check: skills-site-build skills-site-validate skills-site-test

skills-site-build:
    pnpm --filter ai-skill-catalog-site run build

skills-site-validate:
    pnpm --filter ai-skill-catalog-site run validate

skills-site-test:
    pnpm --filter ai-skill-catalog-site run test

infra-validate:
    az bicep build --file "{{infra_dir}}/main.bicep" --stdout > $null

azure-provision: infra-validate
    az deployment sub create --location "{{azure_location}}" --template-file "{{infra_dir}}/main.bicep" --parameters location="{{azure_location}}" resourceGroupName="{{azure_resource_group}}" staticSiteName="{{azure_static_site}}"

azure-token:
    az staticwebapp secrets list --resource-group "{{azure_resource_group}}" --name "{{azure_static_site}}" --query properties.apiKey --output tsv

azure-set-github-secret:
    az staticwebapp secrets list --resource-group "{{azure_resource_group}}" --name "{{azure_static_site}}" --query properties.apiKey --output tsv | gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN --repo "{{github_repository}}"

azure-url:
    az staticwebapp show --resource-group "{{azure_resource_group}}" --name "{{azure_static_site}}" --query defaultHostname --output tsv

# Self-install this repository's hooks with the bundled skill-tools.
# Sources live in agent-tooling; installed copies are gitignored. See .claude/hooks/AGENTS.md.
hooks_cli := "uv run --project tools/skill-tools skill-tools hooks"
hooks_config := ".claude/skill-tools.hooks.yaml"

hooks-install *flags:
    {{hooks_cli}} install --config {{hooks_config}} --agent claude agent_sessions long_run_collector long_run_statement_collector stop_alert task_tracker_session {{flags}}
    {{hooks_cli}} install --config {{hooks_config}} --agent codex nested_agents_md scoped_rules agent_sessions {{flags}}
    {{hooks_cli}} install --config {{hooks_config}} --agent kilo agent_sessions {{flags}}

hooks-update *flags:
    {{hooks_cli}} update --config {{hooks_config}} {{flags}}

hooks-installed:
    {{hooks_cli}} installed
