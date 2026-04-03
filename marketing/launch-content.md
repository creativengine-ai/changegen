# changegen Launch Content

---

## 1. Show HN Post

**Title:** Show HN: changegen – a CLI that generates changelogs from git history (conventional commits)

**Body:**

Hey HN,

I got tired of writing changelogs by hand. Every release meant digging through git log, categorizing commits, formatting markdown, and inevitably missing something. So I built changegen.

It reads your git commit history, recognizes Conventional Commits format, and produces a categorized, readable changelog — in the terminal, as a markdown file, or both. One command.

```
npx @bbs-company/changegen
```

Example output:

```
Changelog — 1.3.0  2024-06-15
──────────────────────────────────────────────────

⚠️  Breaking Changes
  • redesign authentication API  bb7ef54  [BREAKING]

Features
  • add dark mode toggle  a1b2c3d
  • add export to PDF  e4f5g6h

Bug Fixes
  • fix crash on empty repository  m0n1o2p

  7 commits · 2 features · 2 fixes · 1 breaking
```

It handles repos that don't use conventional commits too — they just all land under "Other Changes." No errors, no drama.

You can use it as a one-off `npx` command (zero install), install it globally, or use the hosted API tier ($9/mo) if you want changelog generation as a service in your CI pipeline.

GitHub: https://github.com/bbs-company/changegen
npm: `npx @bbs-company/changegen`

Happy to answer questions or hear what features are missing for your workflow.

---

## 2. dev.to Article

**Title:** How I Built a Changelog Generator That Actually Works

**Body:**

Let me describe a ritual I used to dread every release cycle.

Open a new tab. Run `git log --oneline v1.2.0..HEAD`. Squint at fifty commits. Try to remember which ones were user-facing. Copy the interesting ones into a markdown file. Realize I forgot the format from last time. Check the old CHANGELOG. Repeat.

Forty minutes later: a changelog that looked like it was written under duress. Because it was.

I'm a developer, not a copywriter. I don't want to narrate what I already described in commit messages. So I built **changegen** — a CLI that does it for me.

### The Problem with Existing Tools

There are other changelog tools out there. Most of them either:

- Require a specific CI/CD setup to be useful
- Are tightly coupled to GitHub Releases or a specific platform
- Produce output so verbose it's useless at a glance
- Break on anything that isn't perfectly formatted

I wanted something that ran locally, produced clean output, and didn't make me feel like I needed a PhD to configure it.

### How changegen Works

changegen reads your git history between two refs (defaults to your latest tag and HEAD), parses commits using the [Conventional Commits](https://www.conventionalcommits.org/) spec, and categorizes them:

- `feat` → Features
- `fix` → Bug Fixes
- `perf` → Performance Improvements
- `docs` → Documentation
- `feat!` or `BREAKING CHANGE:` → Breaking Changes
- Everything else → Other Changes

Then it spits out a colorized terminal summary and/or writes a `CHANGELOG.md`. By default, both.

```bash
npx @bbs-company/changegen
```

That's it. No config files. No setup. Just run it in your repo.

### Real-World Usage

Here are the commands I actually use:

```bash
# Standard release prep
npx @bbs-company/changegen --since v1.2.0 --version 1.3.0

# Quick scan of what's changed since last tag
npx @bbs-company/changegen --output terminal

# Pipe markdown into a file manually
npx @bbs-company/changegen --output markdown --no-file > CHANGELOG.md

# Check what tags exist
npx @bbs-company/changegen --list-tags
```

The `--since` flag accepts a tag, a commit hash, or a date (`"2024-01-01"`). The `--until` flag works the same way if you want to generate a historical changelog.

### It Handles Messy Repos Too

Not every repo is perfectly conventional-commit-compliant. If yours isn't, changegen still works — commits just land under "Other Changes." No config, no errors, no drama. This was a deliberate design choice. The tool should be useful on day one, even if you're retroactively cleaning up your commit style.

### The Hosted API Tier

The CLI is completely free. But if you want to integrate changelog generation into a CI pipeline without installing Node.js on your build server, there's a hosted API tier at $9/month. Send it a repo URL (or a git bundle), get back structured JSON or markdown.

### What I Learned Building It

A few things surprised me during development:

**Parsing conventional commits is trickier than it looks.** The spec allows for scopes, breaking change footers, multi-line bodies, and revert commits. I had to handle all the edge cases without making the parser fragile on non-standard input.

**Terminal output UX matters.** The colorized terminal view was an afterthought that became a core feature. Seeing your changes at a glance — grouped, counted, highlighted — is genuinely more useful than scanning raw git log.

**Zero-config is a feature, not a limitation.** Every option I considered adding as a config file ended up being better as a CLI flag. When something is that simple to run, people actually run it.

### Try It

```bash
npx @bbs-company/changegen
```

GitHub: https://github.com/bbs-company/changegen
npm: `@bbs-company/changegen`

If you have a feature request or find a bug, open an issue. I'd love to hear how you're using it.

---

## 3. Reddit Posts

### r/programming

**Title:** I got tired of writing changelogs by hand, so I built a CLI for it

Writing changelogs manually every release is one of those small annoyances that adds up. I built `changegen` — it reads your git history, parses conventional commits, and outputs a categorized changelog (terminal + markdown) in one command.

```
npx @bbs-company/changegen
```

Works on any git repo. No config files. If your repo doesn't use conventional commits, everything just lands under "Other Changes" rather than breaking.

Free CLI, $9/mo hosted API if you want it in CI without Node.js.

GitHub: https://github.com/bbs-company/changegen

Happy to hear feedback or answer questions.

---

### r/devops

**Title:** changegen — generate changelogs from git history in CI or locally (free CLI + hosted API)

If you're doing releases and need changelog generation in your pipeline, I built `changegen` for this.

It parses conventional commits and produces categorized markdown changelogs. Use it locally:

```
npx @bbs-company/changegen --since v1.2.0 --version 1.3.0
```

Or in CI without Node.js via the hosted API tier ($9/mo).

Supports: custom `--since`/`--until` refs, version labels, markdown-only output mode for piping, `--no-file` flag for stdout-only, date-based ranges.

Zero config. Handles non-conventional-commit repos gracefully.

GitHub: https://github.com/bbs-company/changegen
npm: `npx @bbs-company/changegen`

---

## 4. Twitter/X Thread

**Tweet 1:**
Writing changelogs by hand is one of the most boring parts of shipping software.

Dig through git log. Categorize manually. Format markdown. Miss half the commits. Repeat next release.

I built a CLI to fix this. 🧵

**Tweet 2:**
`changegen` reads your git history, parses conventional commits, and produces a categorized changelog — in your terminal AND as a markdown file.

```
npx @bbs-company/changegen
```

One command. No config files. No setup. Works in any git repo.

**Tweet 3:**
The output actually looks good:

```
⚠️  Breaking Changes
  • redesign auth API  [BREAKING]

Features
  • add dark mode toggle
  • add export to PDF

Bug Fixes
  • fix crash on empty repo

7 commits · 2 features · 2 fixes · 1 breaking
```

Colorized in the terminal. Clean markdown file on disk.

**Tweet 4:**
Useful flags:

`--since v1.2.0` — start from a tag
`--version 1.3.0` — label the release
`--output terminal` — no file write
`--no-file` — stdout only (pipe-friendly)
`--list-tags` — see available tags

Also accepts commit hashes and dates for `--since`/`--until`.

**Tweet 5:**
Free CLI via npx (no install needed):
`npx @bbs-company/changegen`

$9/mo hosted API if you want it in CI without Node.js.

GitHub: https://github.com/bbs-company/changegen
npm: `@bbs-company/changegen`

Would love feedback — what's missing for your workflow?
