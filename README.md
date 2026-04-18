# changegen

[![npm](https://img.shields.io/npm/v/@creativengine-ai/changegen)](https://www.npmjs.com/package/@creativengine-ai/changegen)

Generate clean, categorized changelogs from git commit history using [Conventional Commits](https://www.conventionalcommits.org/).

## Quick Start

```bash
npx @creativengine-ai/changegen
```

Reads your git history since the latest tag, prints a colorized summary to the terminal, and writes `CHANGELOG.md`.

## Installation

```bash
npm install -g @creativengine-ai/changegen
# or use without installing:
npx @creativengine-ai/changegen
```

## Usage

```
changegen [options] [path]
```

| Option | Description | Default |
|--------|-------------|---------|
| `--since <ref>` | Start from a tag, commit hash, or date | latest tag |
| `--until <ref>` | End at a tag, commit hash, or date | HEAD |
| `--version <ver>` | Version label in the changelog header | `Unreleased` |
| `--output <mode>` | `markdown`, `terminal`, or `both` | `both` |
| `--out <file>` | Write markdown to this file | `CHANGELOG.md` |
| `--no-file` | Print only; do not write to a file | — |
| `--list-tags` | Show available tags and exit | — |
| `--help, -h` | Show help | — |

### Examples

```bash
# Generate since latest tag (default behavior)
npx @creativengine-ai/changegen

# Generate since a specific tag
npx @creativengine-ai/changegen --since v1.2.0

# Label this as v1.3.0
npx @creativengine-ai/changegen --since v1.2.0 --version 1.3.0

# Terminal output only (no file write)
npx @creativengine-ai/changegen --output terminal

# Write markdown to stdout (pipe-friendly)
npx @creativengine-ai/changegen --output markdown --no-file > CHANGELOG.md

# Generate for a specific date range
npx @creativengine-ai/changegen --since "2024-01-01" --until "2024-06-30"

# Run against a different repository
npx @creativengine-ai/changegen /path/to/another/repo

# List available tags
npx @creativengine-ai/changegen --list-tags
```

## Commit Format

`changegen` recognizes [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]
[optional footer(s)]
```

### Supported types

| Type | Section |
|------|---------|
| `feat` | Features |
| `fix` | Bug Fixes |
| `perf` | Performance Improvements |
| `refactor` | Refactoring |
| `docs` | Documentation |
| `test` | Tests |
| `build` | Build System |
| `ci` | CI/CD |
| `style` | Code Style |
| `chore` | Chores |
| `revert` | Reverts |
| anything else | Other Changes |

### Breaking changes

Mark breaking changes with `!` after the type/scope, or include `BREAKING CHANGE:` in the commit footer:

```
feat!: redesign authentication API
feat(api)!: remove deprecated v1 endpoints

feat: new login flow

BREAKING CHANGE: session tokens are no longer compatible with v1 clients
```

## Non-conventional repos

If your repo doesn't use conventional commits, `changegen` still works — all commits will appear under **Other Changes**. No errors, no drama.

## Example output

```
Changelog — 1.3.0  2024-06-15
──────────────────────────────────────────────────

⚠️  Breaking Changes
  • redesign authentication API  bb7ef54  [BREAKING]

Features
  • add dark mode toggle  a1b2c3d
  • add export to PDF  e4f5g6h

Bug Fixes
  • auth: resolve token refresh race condition  i7j8k9l
  • fix crash on empty repository  m0n1o2p

Documentation
  • update API reference  q3r4s5t

  7 commits · 2 features · 2 fixes · 1 breaking
```

## GitHub Actions

Use changegen directly in your CI pipeline with the official GitHub Action.

### Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `since` | Start from a tag, commit hash, or date | latest tag |
| `until` | End at a tag, commit hash, or date | HEAD |
| `version` | Version label in the changelog header | `Unreleased` |
| `output-file` | Write markdown to this path (empty = no file) | `CHANGELOG.md` |
| `working-directory` | Path to the git repository | `.` |

### Outputs

| Output | Description |
|--------|-------------|
| `changelog` | Generated changelog in Markdown format |

### Examples

**Keep `CHANGELOG.md` up to date on every push to `main`:**

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0

- uses: creativengine-ai/changegen@v1
  with:
    version: Unreleased
    output-file: CHANGELOG.md
```

**Post as a PR comment:**

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0

- name: Generate changelog
  id: changelog
  uses: creativengine-ai/changegen@v1
  with:
    since: ${{ github.event.pull_request.base.sha }}
    output-file: ''

- uses: actions/github-script@v7
  with:
    script: |
      github.rest.issues.createComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: context.issue.number,
        body: process.env.CHANGELOG,
      });
  env:
    CHANGELOG: ${{ steps.changelog.outputs.changelog }}
```

**Use as a GitHub Release body on tag push:**

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0

- name: Generate changelog
  id: changelog
  uses: creativengine-ai/changegen@v1
  with:
    version: ${{ github.ref_name }}
    output-file: ''

- uses: actions/github-script@v7
  with:
    script: |
      github.rest.repos.createRelease({
        owner: context.repo.owner,
        repo: context.repo.repo,
        tag_name: context.ref.replace('refs/tags/', ''),
        name: context.ref.replace('refs/tags/', ''),
        body: process.env.CHANGELOG,
      });
  env:
    CHANGELOG: ${{ steps.changelog.outputs.changelog }}
```

See [`.github/workflows/example.yml`](.github/workflows/example.yml) for a full working example covering all three patterns.

## Self-hosting the API server

`changegen` ships an HTTP server (`src/server.ts`) that exposes a REST API with Lemon Squeezy subscription gating.

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Port to listen on (default: `3000`) |
| `CHANGEGEN_API_KEY` | No | Static bearer token for self-hosted deployments (bypasses subscription checks) |
| `LEMONSQUEEZY_API_KEY` | Yes (for payments) | Lemon Squeezy API key from your dashboard |
| `LEMONSQUEEZY_STORE_ID` | Yes (for payments) | Lemon Squeezy store ID |
| `LEMONSQUEEZY_VARIANT_ID` | Yes (for payments) | Lemon Squeezy product variant ID to sell |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | Yes (for webhooks) | Signing secret from the Lemon Squeezy webhook settings |

### API endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | None | Health check |
| `POST` | `/api/subscribe` | None | Returns a Lemon Squeezy checkout URL |
| `POST` | `/api/webhook` | Signature | Handles Lemon Squeezy webhook events |
| `POST` | `/api/changelog` | Bearer token | Generates a changelog for a remote repo |

### Webhook events handled

- `subscription_created` — issues a new API key for the subscriber
- `subscription_cancelled` — deactivates the subscriber's API key
- `subscription_expired` — deactivates the subscriber's API key

## Requirements

- Node.js >= 18
- Git available in PATH

## License

MIT
