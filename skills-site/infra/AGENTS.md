# Azure Static Web Apps infrastructure

main.bicep creates the resource group and a Free-tier Azure Static Web App. It does not configure a repository connection; GitHub Actions builds and deploys the generated site.

## Setup

Prerequisites are Azure CLI with Bicep, an Azure subscription with resource creation permission, GitHub CLI authenticated to the repository, and just.

Environment variables (`AZURE_LOCATION`, `AZURE_RESOURCE_GROUP`, `AZURE_STATIC_SITE_NAME`, `GITHUB_REPOSITORY`) come from `skills-site/.env` via `skills-site/mise.toml`, instead of being set by hand each session. Copy the template once:

```powershell
cp skills-site/.env.example skills-site/.env
```

`skills-site/.env` is untracked (matched by the repo-root `.gitignore`'s `*.env` rule). mise loads it automatically whenever the shell's working directory is inside `skills-site` and mise is activated in that shell; run `just` recipes from within `skills-site` (its own `justfile` duplicates the root recipes) so the directory-scoped env actually applies. All four variables are still optional — `just` falls back to the same defaults either way.

`skills-site/mise.toml` also sets `AZURE_CONFIG_DIR` to `skills-site/.azure`, so `az` state (active subscription, cached login tokens, extensions) for this project stays isolated from your global `~/.azure` and from any other project's Azure CLI session. That directory is gitignored; delete it to force a fresh `az login` for this project only.

From `skills-site`:

```powershell
az login
az account set --subscription "<subscription-id>"
just azure-provision
```

## Configure GitHub Actions

The recommended helper sends the deployment token directly from Azure CLI to GitHub CLI:

```powershell
just azure-set-github-secret
```

The helper creates or updates AZURE_STATIC_WEB_APPS_API_TOKEN. Use just azure-token only when you need to inspect the token; treat its output as a secret. The token is never a Bicep output or repository file.

Pull requests run generation, validation, tests, and Astro build. A successful push to main runs the same checks, then uploads only skills-site/dist. Azure does not rebuild from source.

If deployment fails, inspect the skill-site workflow first. A failed verify job blocks deploy. For an Azure or token error, check the Static Web App and rerun just azure-set-github-secret.

## Future Firebase boundary

The catalog generator, schema, ZIP format, and Astro output are hosting-neutral. A Firebase migration only needs a new resource definition and deployment workflow.
