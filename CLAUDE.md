# CLAUDE.md

Read `PROJECT.md` for architecture and how the pieces fit together. Read
`GAPS.md` for the known-issues audit (ordered by severity) before "fixing"
anything — your bug may already be documented there with a scoped fix.

## What this repo is (and is not)

This is the **public companion repo** for the Claude Code CLI: plugins +
marketplace, issue-tracker automation, CHANGELOG, and enterprise/sandbox
examples. **The CLI's source code is not here** — never try to fix CLI
behavior bugs in this repo.

## Commands that matter

There is no build, no lint, and no test suite (see GAPS.md #3).

```bash
# Run issue-automation scripts locally (Bun, no npm install — there is no package.json)
GITHUB_TOKEN=... GITHUB_REPOSITORY_OWNER=anthropics GITHUB_REPOSITORY_NAME=claude-code \
  bun run scripts/sweep.ts --dry-run          # ALWAYS --dry-run locally; these mutate live issues

# Smoke-test hookify (built-in __main__ blocks)
python3 plugins/hookify/core/rule_engine.py
python3 plugins/hookify/core/config_loader.py

# Exercise a hook end-to-end by piping hook JSON on stdin
echo '{"tool_name":"Bash","tool_input":{"command":"rm -rf /tmp/x"},"hook_event_name":"PreToolUse"}' \
  | CLAUDE_PLUGIN_ROOT=$PWD/plugins/hookify python3 plugins/hookify/hooks/pretooluse.py

# Validate JSON manifests before pushing (no CI does this — GAPS.md #18)
find plugins .claude-plugin -name '*.json' -exec jq empty {} +
```

## Conventions this codebase actually follows

- **Zero dependencies, everywhere.** Bun scripts use only `fetch`/built-ins
  (no `package.json`). Python is stdlib-only. Bash relies only on `jq`/`gh`.
  Do not introduce a dependency, lockfile, or `requirements.txt`.
- **Plugins** follow the standard layout:
  `.claude-plugin/plugin.json` + optional `commands/`, `agents/`, `skills/`,
  `hooks/hooks.json`. Commands/agents/skills are markdown with YAML
  frontmatter — they are prompts, treat them with code-review rigor.
- **Adding a plugin = three edits:** the plugin directory,
  `.claude-plugin/marketplace.json`, and the table in `plugins/README.md`.
  Keep `version`/`author` consistent between `marketplace.json` and the
  plugin's `plugin.json` (nothing enforces it).
- **Hooks:** reference scripts as
  `${CLAUDE_PLUGIN_ROOT}/hooks/<script>` in `hooks.json`. Two valid response
  styles: JSON-on-stdout with `exit 0` (hookify — hook errors must NEVER
  break the session), or `exit 2` + stderr to block (security-guidance,
  examples/hooks). Don't mix them within one script.
- **Issue lifecycle policy** (labels, timeouts, messages) lives ONLY in
  `scripts/issue-lifecycle.ts`; `sweep.ts` and `lifecycle-comment.ts` import
  it. Change policy there, never inline in a workflow.
- **Workflow security pattern:** untrusted event fields (issue titles,
  bodies, comments) go through `env:` blocks — never interpolate
  `${{ github.event.* }}` directly into `run:` scripts. Build JSON with
  `jq -n --arg`, not string splicing.
- **User-local files** use the `.local.md` / `.local.json` suffix and are
  gitignored (see `plugins/hookify/.gitignore`). Committed examples of such
  files live in `plugins/hookify/examples/`.
- Line endings are enforced LF via `.gitattributes` (`*.sh text eol=lf`).

## Gotchas

- **`scripts/gh.sh` is a security boundary, not a convenience wrapper.** It
  allowlists exactly `issue view|issue list|search issues|label list` and
  four flags, and pins the repo. The triage/dedupe prompts are only allowed
  these scripts, with invocation caps set via `CLAUDE_CODE_SCRIPT_CAPS` in
  the workflows. Never "fix" a failing automation by widening the wrapper or
  calling raw `gh` — that is the attack surface for prompt injection from
  public issue text.
- **Issue numbers come from the event payload** (`GITHUB_EVENT_PATH`) in
  `edit-issue-labels.sh`/`comment-on-duplicates.sh`, deliberately NOT from
  arguments — so injected issue text can't redirect actions to another
  issue. Preserve this when editing.
- **The dedupe comment text is a contract.** `auto-close-duplicates.ts`
  finds bot comments by matching the strings `"Found"` +
  `"possible duplicate"` produced by `comment-on-duplicates.sh`. Rewording
  either side breaks auto-close silently.
- **Hookify's imports depend on the directory name.** Entrypoints add the
  parent of `CLAUDE_PLUGIN_ROOT` to `sys.path` and `import hookify.core.*` —
  renaming `plugins/hookify/` breaks every import. Hookify rules are read
  from the *user project's* `.claude/hookify.*.local.md` at session CWD, not
  from the plugin.
- **Hookify's frontmatter parser is hand-rolled** — no PyYAML. Inline
  comma-separated condition dicts corrupt regexes containing commas (e.g.
  `{1,3}`); prefer the multi-line condition form in docs and examples
  (GAPS.md #6).
- **`backfill-duplicate-comments.ts` ignores the workflow's `days_back`
  input** and hardcodes `anthropics/claude-code` (GAPS.md #4).
- **Two copies of `/commit-push-pr`** exist (`.claude/commands/` and
  `plugins/commit-commands/commands/`); if you edit one, check the other
  (GAPS.md #11–12).
- **PostToolUse blocking uses `{"decision": "block"}`, not
  `permissionDecision`** — `permissionDecision` is PreToolUse-only. Hookify
  currently gets this wrong (GAPS.md #2).

## Rules — do not break these

- **Never hand-edit `CHANGELOG.md` content** — it is maintained by a release
  bot (`chore: Update CHANGELOG.md` commits) and regenerated per release.
- **Treat `scripts/*` and `.github/workflows/*` as production.** They run on
  a schedule against a very active public issue tracker; a bad merge
  mass-closes real users' issues. Test with `--dry-run` first; both sweep
  scripts support it.
- **Never add or loosen `allowed_non_write_users`** in a workflow without
  security review — `non-write-users-check.yml` exists to flag exactly this.
- **Keep executable code dependency-free** (see Conventions). Portability is
  a product requirement for hooks and CI scripts, not a style choice.
- **`.devcontainer/init-firewall.sh` is a safety mechanism** users rely on
  for `--dangerously-skip-permissions`; changes must keep default-deny
  egress and the self-verification checks at the end of the script.
- `demo.gif`, `LICENSE.md` — never modify.
