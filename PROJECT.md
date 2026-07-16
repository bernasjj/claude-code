# PROJECT.md — Claude Code (public repository)

## What this repository actually is

**The Claude Code CLI's source code is NOT in this repository.** The CLI is
closed-source and distributed via native installers, Homebrew, WinGet, and the
(deprecated) npm package `@anthropic-ai/claude-code`. This repo is the CLI's
*public companion*: the place where Anthropic publishes everything around the
product that must be public.

Concretely, this repo serves four audiences:

1. **Claude Code users** — README, CHANGELOG (release notes for every CLI
   version), issue templates, and the GitHub issue tracker itself.
2. **Plugin users/authors** — an official plugin marketplace
   (`.claude-plugin/marketplace.json`) and 13 bundled plugins under `plugins/`.
3. **Enterprise administrators** — deployment and lockdown examples under
   `examples/` (MDM templates, managed settings, hooks) and a reference
   sandboxed devcontainer under `.devcontainer/`.
4. **The repo's own maintainers** — a substantial, Claude-powered issue-triage
   automation system (`.github/workflows/` + `scripts/` + `.claude/commands/`)
   that keeps a very high-volume issue tracker manageable with almost no
   human labor.

If you are asked to "fix a bug in Claude Code" and it's a CLI behavior bug,
the answer is usually *"that code is not here"* — the right move is filing or
triaging an issue, not editing this repo.

## Tech stack and why

| Piece | Where | Why it was chosen (inferred) |
|---|---|---|
| Markdown + YAML frontmatter | `plugins/*/commands`, `agents`, `skills`, `.claude/commands` | Claude Code's native extension format. Commands/agents/skills are prompts, not code. |
| Python 3 (stdlib only) | `plugins/hookify`, `plugins/security-guidance`, `examples/hooks` | Hooks must run on any machine where Claude Code runs; no `pip install` step is acceptable. Every Python file uses only the standard library. |
| Bash + `jq` | `plugins/ralph-wiggum`, `scripts/*.sh`, hook handlers | Same portability argument; hooks and CI helpers need zero setup. |
| TypeScript run by **Bun** | `scripts/*.ts` | Zero-build TS execution in GitHub Actions (`oven-sh/setup-bun` + `bun run file.ts`). There is deliberately **no `package.json`**, no lockfile, no node_modules — scripts use only `fetch` and Bun built-ins. |
| GitHub Actions | `.github/workflows/` | The automation runs where the issues live. Several workflows invoke `anthropics/claude-code-action@v1` — the repo dogfoods its own product for triage and dedupe. |
| Docker + iptables/ipset | `.devcontainer/` | Reference implementation of "run Claude Code with `--dangerously-skip-permissions` safely": default-deny egress firewall with an allowlist. |

## Architecture

```
                       ┌────────────────────────────────────────┐
                       │  GitHub issue events (opened/comment/  │
                       │  labeled/schedule crons)               │
                       └───────────────┬────────────────────────┘
                                       │
        ┌──────────────────────────────┼───────────────────────────────┐
        │ Claude-powered workflows     │ Deterministic workflows        │
        │                              │                                │
        │ claude-issue-triage.yml ──►  │ sweep.yml ────► scripts/sweep.ts
        │   runs /triage-issue         │ auto-close-duplicates.yml ──►  │
        │ claude-dedupe-issues.yml ──► │   scripts/auto-close-duplicates.ts
        │   runs /dedupe               │ issue-lifecycle-comment.yml ─► │
        │ claude.yml (@claude mention) │   scripts/lifecycle-comment.ts │
        │                              │ lock-closed-issues.yml         │
        │      │                       │ remove-autoclose-label.yml     │
        │      ▼                       │ log-issue-events.yml (Statsig) │
        │ .claude/commands/*.md        └────────────┬───────────────────┘
        │  (prompts)                                │
        │      │                                    │
        │      ▼                                    ▼
        │ scripts/gh.sh              scripts/issue-lifecycle.ts
        │ scripts/edit-issue-labels.sh   (single source of truth for
        │ scripts/comment-on-duplicates.sh   labels/timeouts/messages)
        │  (constrained side-effect scripts)
        └──────────────────────────────────────────────────────────────┘

        plugins/  ◄── indexed by ──  .claude-plugin/marketplace.json
        (13 plugins: prompts, hooks.json, python/bash hook handlers)

        examples/, .devcontainer/, Script/   (standalone reference material)
```

### The issue-automation pipeline (the most "load-bearing" system here)

1. **Issue opened** → `claude-issue-triage.yml` runs Claude with the
   `.claude/commands/triage-issue.md` prompt. Claude may only call two
   scripts: `scripts/gh.sh` (a read-only, allowlisted `gh` wrapper) and
   `scripts/edit-issue-labels.sh` (label add/remove only, issue number taken
   from the event payload, capped at 2 invocations via
   `CLAUDE_CODE_SCRIPT_CAPS`). In parallel, `claude-dedupe-issues.yml` runs
   `/dedupe`, which fans out search agents and may post one comment via
   `scripts/comment-on-duplicates.sh` (max 3 duplicate links, capped at 1
   invocation).
2. **Lifecycle labels** (`invalid` 3d, `needs-repro` 7d, `needs-info` 7d,
   `stale` 14d, `autoclose` 14d — defined once in
   `scripts/issue-lifecycle.ts`) → when applied,
   `issue-lifecycle-comment.yml` posts a "heads-up" nudge comment.
3. **Twice-daily cron** `sweep.yml` → `scripts/sweep.ts` marks inactive
   issues `stale` and closes issues whose lifecycle timeout expired —
   *unless* a human commented after labeling or the issue has ≥10 👍
   reactions (`STALE_UPVOTE_THRESHOLD`).
4. **Daily cron** `auto-close-duplicates.yml` → closes issues 3+ days after a
   bot dupe-comment if there was no activity and the author didn't 👎 the
   comment.
5. **Escape hatches for humans**: any comment removes `autoclose`
   (`remove-autoclose-label.yml`); closed issues are locked after 7 days
   (`lock-closed-issues.yml`); analytics go to Statsig
   (`log-issue-events.yml`); `non-write-users-check.yml` flags any PR that
   touches `allowed_non_write_users` in workflow files, as an AppSec
   guardrail.

### The plugin system

Every directory in `plugins/` follows the same shape:

```
plugin-name/
├── .claude-plugin/plugin.json   # metadata (name, version, author)
├── commands/*.md                # slash commands (prompt + frontmatter)
├── agents/*.md                  # subagent definitions (prompt + frontmatter)
├── skills/<name>/SKILL.md       # skills, with references/ and scripts/
├── hooks/hooks.json             # hook wiring → shell/python handlers
└── README.md
```

`.claude-plugin/marketplace.json` at the repo root indexes all 13 plugins so
users can install them via `/plugin`. **Adding a plugin means touching three
places**: the plugin directory, `marketplace.json`, and the table in
`plugins/README.md`.

Most plugins are pure prompt-ware (feature-dev, code-review,
pr-review-toolkit, plugin-dev, frontend-design, agent-sdk-dev,
commit-commands, claude-opus-4-5-migration). Only three contain real
executable logic:

- **hookify** (`plugins/hookify/`) — the largest codebase in the repo. Users
  write rules as `.claude/hookify.<name>.local.md` files (YAML frontmatter +
  markdown message). Four thin hook entrypoints
  (`hooks/pretooluse.py`, `posttooluse.py`, `stop.py`, `userpromptsubmit.py`)
  read hook JSON from stdin, load rules via
  `core/config_loader.py` (which includes a *hand-rolled* YAML-frontmatter
  parser — see GAPS.md), evaluate them in `core/rule_engine.py`, and print a
  JSON verdict (warn via `systemMessage`, or block). Design invariants:
  always `exit 0` (a broken hook must never break the user's session), no
  dependencies, rules re-read from disk on every event (hence "no restart
  needed").
- **security-guidance** (`plugins/security-guidance/`) — a PreToolUse hook
  that substring-matches file edits against 9 risky patterns
  (`eval(`, `dangerouslySetInnerHTML`, GitHub-workflow paths, `pickle`, …),
  blocks the first occurrence per (file, rule, session) with `exit 2`, and
  remembers shown warnings in `~/.claude/security_warnings_state_<session>.json`.
- **ralph-wiggum** (`plugins/ralph-wiggum/`) — a Stop-hook loop
  (`hooks/stop-hook.sh`): while `.claude/ralph-loop.local.md` exists, exiting
  the session re-feeds the same prompt (state = iteration counter in the
  file's frontmatter; termination = max iterations or an exact
  `<promise>…</promise>` string in the last assistant message).

### Everything else

- `examples/settings/` — three managed-settings archetypes (lax / strict /
  bash-sandbox) for org-wide lockdown.
- `examples/mdm/` — Jamf/Kandji (macOS `.mobileconfig`/`.plist`) and
  Intune/Group Policy (Windows `.admx`/`.adml` + PowerShell) templates to
  distribute `managed-settings.json`.
- `examples/hooks/bash_command_validator_example.py` — the canonical minimal
  PreToolUse hook example (exit 2 = block and show stderr to Claude).
- `.devcontainer/` — Node 20 image with Claude Code preinstalled and
  `init-firewall.sh`, which default-denies all egress and allowlists GitHub
  IP ranges (fetched live from `api.github.com/meta`), npm registry,
  Anthropic API, Sentry, Statsig, and VS Code marketplace, then verifies the
  firewall by asserting `example.com` is unreachable.
- `Script/run_devcontainer_claude_code.ps1` — Windows/PowerShell helper to
  launch that devcontainer.
- `CHANGELOG.md` — release notes for the CLI itself. Updated by an Anthropic
  release bot (`chore: Update CHANGELOG.md` commits). Treat as generated.

## Key design decisions (inferred, with reasoning)

1. **Least-privilege AI automation.** The Claude-powered workflows never get
   raw `gh` or API access. They get wrapper scripts that (a) allowlist
   subcommands and flags (`scripts/gh.sh`), (b) bind the target issue number
   to the triggering event payload so prompt injection in an issue body
   can't redirect actions to another issue (`edit-issue-labels.sh`,
   `comment-on-duplicates.sh` read `GITHUB_EVENT_PATH`), and (c) are capped
   in invocation count via `CLAUDE_CODE_SCRIPT_CAPS`. When you touch these
   scripts, you are editing a security boundary, not a convenience wrapper.
2. **Humans can always veto the robots.** Every destructive automation has
   an override: 👎 reaction blocks dupe-close, any comment removes
   `autoclose`/`stale`, ≥10 👍 exempts an issue from staleness, `--dry-run`
   flags exist on the sweep scripts.
3. **One source of truth for lifecycle policy.** Labels, timeouts, and
   nudge/close messages all live in `scripts/issue-lifecycle.ts`; both
   `sweep.ts` and `lifecycle-comment.ts` import it. Change policy there, not
   in the workflows.
4. **Zero-dependency executable code.** No `package.json`, no
   `requirements.txt` anywhere. Bun scripts use `fetch`; Python uses stdlib;
   Bash uses `jq`/`gh` that CI images already have. This is a deliberate
   constraint — do not add a dependency to "clean things up".
5. **Workflow-injection hygiene.** Workflows pass untrusted event fields
   (titles, bodies) through `env:` blocks instead of interpolating
   `${{ … }}` into `run:` scripts. The security-guidance plugin even ships a
   reminder about exactly this pattern. Follow it in any workflow edit.
6. **Prompts as product.** The commands/agents in `.claude/commands` and
   `plugins/` are carefully engineered prompts (e.g. `/dedupe`'s
   multi-agent fan-out, triage's "body text is authoritative" rules). Treat
   prompt files with the same review rigor as code — they drive real actions
   on a public repo.

## Critical paths vs. safe-to-touch

**Load-bearing (changes have production effects on a very active public repo):**
- `scripts/*.sh` and `scripts/*.ts` — run by scheduled workflows against
  live issues. A bug here mass-closes or mass-spams real users' issues.
- `.github/workflows/*.yml` — same blast radius; also security-sensitive
  (`allowed_non_write_users: "*"` means *any* GitHub user's issue text
  reaches Claude).
- `.claude/commands/triage-issue.md` and `dedupe.md` — behavior of the
  triage/dedupe bots.
- `.claude-plugin/marketplace.json` — a syntax error breaks plugin install
  for everyone who added this marketplace.

**Medium risk:**
- `plugins/hookify/**` and `plugins/security-guidance/**` — executable code
  running inside users' sessions on every tool call.
- `.devcontainer/init-firewall.sh` — a mistake silently weakens the sandbox
  people rely on for `--dangerously-skip-permissions`.

**Safe to change casually:**
- READMEs, `examples/settings/*.json`, `examples/mdm/*`, issue templates,
  and the prompt-only plugins (worst case: a slash command gives worse
  guidance).

**Do not touch:**
- `CHANGELOG.md` content (bot-maintained), `demo.gif`, `LICENSE.md`.

## Surprises and traps for someone new

- **There is no build, no test suite, and no linter configured.** `bun run
  scripts/<file>.ts` and piping JSON into the Python hooks is the entire
  verification story today. See GAPS.md for what should exist.
- **`scripts/backfill-duplicate-comments.ts` ignores the workflow's
  `days_back` input** — the workflow passes `DAYS_BACK` but the script reads
  `MAX_ISSUE_NUMBER`/`MIN_ISSUE_NUMBER`. Known drift; see GAPS.md.
- **Hookify's import trick:** the hook entrypoints add the *parent* of
  `CLAUDE_PLUGIN_ROOT` to `sys.path` and import `hookify.core.*` — the
  package name is literally the plugin directory name. Renaming the
  `hookify/` directory (or vendoring it elsewhere) breaks all imports.
- **Hookify rules live in the *user's project*, not the plugin:**
  `.claude/hookify.*.local.md` relative to the session CWD, and `.local.md`
  files are gitignored by design.
- **Two copies of `/commit-push-pr` exist** (`.claude/commands/` for this
  repo, `plugins/commit-commands/commands/` for the marketplace). They can
  and do drift.
- **`marketplace.json` duplicates each plugin's `version`/`author`** from
  its `plugin.json`; nothing enforces they agree.
- **Exit-code semantics for hooks are non-obvious:** for PreToolUse hooks,
  `exit 2` + stderr = "block and tell Claude"; `exit 0` + JSON on stdout is
  the structured API; hookify deliberately *always* exits 0 and speaks JSON,
  while security-guidance uses exit 2. Both are valid patterns — don't
  "normalize" one to the other without understanding this.
- **The dedupe → auto-close contract is a string match.** `auto-close-duplicates.ts`
  finds bot comments containing `"Found"` + `"possible duplicate"`, and the
  comment format is produced by `comment-on-duplicates.sh`. Changing the
  comment wording breaks auto-close silently.
