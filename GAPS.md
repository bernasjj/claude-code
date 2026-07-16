# GAPS.md — Honest audit of weaknesses

Ordered by severity, most important first. Each entry: what it is, where it
lives, why it matters, and a suggested fix small enough to execute as a
single task.

---

## 1. Hookify: `stop`/`prompt` rules leak into PreToolUse/PostToolUse for unmatched tools

**What:** `hooks/pretooluse.py` and `hooks/posttooluse.py` map only
`Bash → 'bash'` and `Edit/Write/MultiEdit → 'file'`. For every other tool
(Read, Glob, Task, WebFetch, …) `event` stays `None`, and
`load_rules(event=None)` applies **no filter at all** — so `stop` and
`prompt` rules are loaded and evaluated against PreToolUse input. Because
PreToolUse input includes `transcript_path`, a stop rule like the shipped
example `require-tests-stop.local.md` (`field: transcript`,
`operator: not_contains`, `action: block`) will match and emit
`permissionDecision: deny`, blocking unrelated tools mid-session.

**Where:** `plugins/hookify/hooks/pretooluse.py:41-52`,
`plugins/hookify/hooks/posttooluse.py:36-45`,
`plugins/hookify/core/config_loader.py:219-226`.

**Why it matters:** A user who enables the documented stop-rule example can
have every Read/Grep call denied — a confusing, hard-to-diagnose session
breakage caused by an official plugin.

**Fix (small):** In both entrypoints, when the tool is not Bash/Edit/Write/
MultiEdit, pass a sentinel such as `event='tool'` instead of `None` so only
`event: all` rules load. One-line change per file; add a comment explaining
why `None` must not be passed.

---

## 2. Hookify: `action: block` on PostToolUse emits the wrong response shape

**What:** `RuleEngine.evaluate_rules` returns
`{"hookSpecificOutput": {"hookEventName": …, "permissionDecision": "deny"}}`
for both PreToolUse **and** PostToolUse. `permissionDecision` is a
PreToolUse-only field; PostToolUse blocking uses `{"decision": "block",
"reason": …}`. Blocking rules on PostToolUse therefore silently do nothing
beyond showing a message.

**Where:** `plugins/hookify/core/rule_engine.py:72-79`.

**Why it matters:** Users writing block rules for post-execution feedback
(e.g. "block and force Claude to react when a command printed a secret")
believe they are enforcing something that never fires.

**Fix (small):** In the `elif hook_event in ['PreToolUse', 'PostToolUse']`
branch, split the two cases: keep `permissionDecision: "deny"` for
PreToolUse, and return `{"decision": "block", "reason": combined_message,
"systemMessage": combined_message}` for PostToolUse.

---

## 3. No automated tests anywhere

**What:** Zero test files in the repo. The only "tests" are
`if __name__ == '__main__':` smoke blocks in
`plugins/hookify/core/rule_engine.py` and `config_loader.py`. Nothing covers
the issue-automation scripts that mutate live GitHub issues.

**Where:** Whole repo; most critical untested paths:
- `scripts/auto-close-duplicates.ts` — `extractDuplicateIssueNumber`, the
  skip conditions (recent comment, human activity, 👎 reaction).
- `scripts/sweep.ts` — stale-marking cutoffs and lifecycle-close logic.
- `plugins/hookify/core/config_loader.py` — the hand-rolled frontmatter
  parser (see #6).
- `plugins/ralph-wiggum/hooks/stop-hook.sh` — promise extraction/iteration.

**Why it matters:** These scripts close, label, and lock other people's
issues on a schedule. A regression mass-closes real bug reports; there is no
safety net beyond `--dry-run` being run by hand.

**Fix (small, per-task):** (a) Add `scripts/*.test.ts` using `bun test` for
the pure functions — extract `extractDuplicateIssueNumber` and the sweep
cutoff predicates into exported functions first if needed; add a CI workflow
step `bun test scripts/`. (b) Add `plugins/hookify/tests/test_config_loader.py`
with stdlib `unittest` covering frontmatter parsing, and run it in CI with
`python3 -m unittest discover plugins/hookify`.

---

## 4. Backfill workflow input is silently ignored, and the script hardcodes the repo

**What:** `.github/workflows/backfill-duplicate-comments.yml` passes
`DAYS_BACK: ${{ inputs.days_back }}`, but
`scripts/backfill-duplicate-comments.ts` never reads `DAYS_BACK` — it reads
`MAX_ISSUE_NUMBER`/`MIN_ISSUE_NUMBER` (defaults 4050/1). It also hardcodes
`owner = "anthropics"; repo = "claude-code"` while sibling scripts use
`GITHUB_REPOSITORY_OWNER`/`GITHUB_REPOSITORY_NAME`.

**Where:** `.github/workflows/backfill-duplicate-comments.yml:43`,
`scripts/backfill-duplicate-comments.ts:89-93`.

**Why it matters:** An operator running the workflow with `days_back: 30`
gets the issue-number-range behavior instead, with no error. On forks the
script targets the upstream repo, not the fork.

**Fix (small):** Either implement `DAYS_BACK` in the script (filter by
`created_at`) or remove the input from the workflow and expose
`min/max_issue_number` inputs instead; switch owner/repo to the env vars the
other scripts use.

---

## 5. Devcontainer firewall has real egress holes (severity: medium — it's a sandbox people trust)

**What:** `init-firewall.sh`:
- allows **all outbound TCP 22** (`iptables -A OUTPUT -p tcp --dport 22 -j
  ACCEPT`) before the default-deny — SSH to *any* host is an open
  exfiltration channel that defeats the domain allowlist;
- allows **all outbound UDP 53**, enabling DNS tunneling;
- resolves allowlisted domains **once at container start** — CDN-backed
  hosts (npm registry, Statsig) rotate IPs, so rules both go stale (breakage)
  and keep stale IPs allowed (over-permission);
- derives the "host network" as a `/24` from the default route
  (`init-firewall.sh:94-105`) and allows it wholesale.

**Where:** `.devcontainer/init-firewall.sh:29-38, 67-91, 94-105`.

**Why it matters:** This container is the documented pattern for running
Claude Code with `--dangerously-skip-permissions`. Users assume the
firewall's allowlist is the egress boundary; port-22-to-anywhere means it
is not.

**Fix (small):** Restrict port 22 to GitHub's `git` IP ranges (already
fetched from `api.github.com/meta` — add `.git` ranges to a dedicated ipset
used by the port-22 rule), and restrict UDP/TCP 53 to the resolvers in
`/etc/resolv.conf`. Document the IP-staleness limitation in a comment.

---

## 6. Hookify's hand-rolled YAML parser corrupts common regex patterns

**What:** `extract_frontmatter` parses YAML with string splitting. Inline
list-dict items are split on commas
(`config_loader.py:164-171`), so a condition written inline like
`- field: command, operator: regex_match, pattern: \d{1,3}` truncates the
pattern at `\d{1` (regex quantifiers contain commas). Values containing
`: ` in patterns, nested structures beyond one level, and multi-line strings
are also unsupported. Errors are silent — the rule just matches wrongly or
never.

**Where:** `plugins/hookify/core/config_loader.py:87-195`.

**Why it matters:** Regexes with `{m,n}` quantifiers or alternations with
commas are exactly what users will write; the failure mode is a security/
guard rule that silently doesn't fire.

**Fix (small):** Cannot add PyYAML (stdlib-only constraint). Two scoped
options: (a) drop support for the inline comma-separated dict form (parse
only the multi-line form, which splits on `:` once per line) and update the
README/skill docs; or (b) keep the form but split only on `, ` followed by a
known key name (`field|operator|pattern`). Add unit tests either way
(pairs with gap #3).

---

## 7. security-guidance hook: false positives block edits, and it logs to a fixed world-writable path

**What:** Substring matching produces false positives: `"exec("` matches
JavaScript's `regex.exec(str)`; `"pickle"` matches the word in a comment or
docstring; the `child_process_exec` reminder text hardcodes advice about
`src/utils/execFileNoThrow.ts`, a file from the *Claude Code CLI's* internal
codebase that won't exist in users' projects. On first match the hook
**blocks** the edit (`sys.exit(2)`), then never warns again for that
file+rule+session. Debug logging writes to the fixed path
`/tmp/security-warnings-log.txt` — on multi-user systems that's a symlink
/pre-creation hazard and leaks activity across users.

**Where:** `plugins/security-guidance/hooks/security_reminder_hook.py:14,
71-89, 271-273`.

**Why it matters:** Severity low-to-medium. Blocking legitimate edits erodes
trust in security warnings (users learn to ignore them); the `/tmp` log is a
minor local-security smell in a plugin whose entire purpose is security
hygiene.

**Fix (small):** (a) Change `exec(`/`execSync(` matching to require word
boundaries and exclude `.exec(`; (b) generalize the execFileNoThrow reminder
to "use execFile/spawn with an args array" without referencing a
nonexistent file; (c) write the debug log under
`~/.claude/` (next to the state files) instead of `/tmp`, or gate it behind
an env var.

---

## 8. sweep.ts: 404s return `{}` and then get `.filter()`ed; no rate-limit handling

**What:** `githubRequest` returns `{} as T` on 404
(`sweep.ts:34-36`). Callers immediately treat results as arrays
(`events.filter`, `comments.some`) — a 404 (deleted issue, permission
change) throws `TypeError: events.filter is not a function` and kills the
whole sweep run mid-pagination. `closeExpired` also makes 2+ API calls per
labeled issue with no backoff; on a busy day it can hit secondary rate
limits and abort, leaving the sweep partially applied.

**Where:** `scripts/sweep.ts:34-36, 115-133`.

**Why it matters:** The sweep silently stops enforcing lifecycle policy for
issues later in the iteration order; nobody notices because the cron "ran".

**Fix (small):** Return `[] as unknown as T` only for the two list endpoints
(or make callers null-check), wrap the per-issue body in try/catch that logs
and continues, and add a simple `Retry-After`/403-abuse check with a sleep.

---

## 9. Dedupe → auto-close contract is an unversioned string match with a 20-page cap

**What:** `auto-close-duplicates.ts` identifies dupe comments by
`body.includes("Found") && body.includes("possible duplicate") &&
user.type === "Bot"` — any bot comment with those words qualifies, and any
rewording of `comment-on-duplicates.sh`'s output breaks auto-close silently.
`extractDuplicateIssueNumber` grabs the **first** `#\d+` anywhere in the
body before falling back to URL parsing. Pagination stops at
`page > 20` (2,000 open issues) — this repo has more open issues than that,
so older issues are simply never considered.

**Where:** `scripts/auto-close-duplicates.ts:49-63, 139-141, 164-169`;
`scripts/comment-on-duplicates.sh:73-90`.

**Why it matters:** Fragile coupling between a bash template and a TS
matcher, plus silent coverage gaps.

**Fix (small):** Embed an HTML marker comment (e.g.
`<!-- dedupe-bot:v1 -->`) in the bash template and match on that marker in
both `auto-close-duplicates.ts` and `backfill-duplicate-comments.ts`; keep
the old substring match as fallback for pre-existing comments. Raise or
remove the page cap (the 3-day filter already bounds work).

---

## 10. ralph-wiggum stop hook: `set -e` makes its own error handling unreachable

**What:** `stop-hook.sh` sets `set -euo pipefail`, then does
`LAST_OUTPUT=$(echo "$LAST_LINE" | jq -r '…' 2>&1)` followed by
`if [[ $? -ne 0 ]]`. Under `set -e`, a failing `jq` in the assignment
terminates the script before the check; the "Failed to parse assistant
message JSON" branch can never execute. Same pattern for the earlier `jq`
calls. A malformed transcript line kills the hook with a raw nonzero exit
instead of the intended graceful cleanup (`rm` of the state file), which can
leave a stuck infinite loop state file.

**Where:** `plugins/ralph-wiggum/hooks/stop-hook.sh:7, 90-105`.

**Why it matters:** The failure path of a plugin whose documented risk is
"cannot be stopped manually" must actually run.

**Fix (small):** Append `|| true` inside the command substitutions whose
exit codes are checked, or capture with
`if ! LAST_OUTPUT=$(…); then … fi`. Verify with a hand-crafted bad
transcript line.

---

## 11. `.claude/commands/commit-push-pr.md` allowlists a nonexistent git flag

**What:** Frontmatter grants `Bash(git checkout --branch:*)` — there is no
`--branch` flag on `git checkout`; branch creation is `git checkout -b`. The
permission entry can never match the command Claude actually runs, so step 1
("create a new branch") always requires a manual permission grant.

**Where:** `.claude/commands/commit-push-pr.md:2`. Note
`plugins/commit-commands/commands/commit-push-pr.md` is a near-duplicate —
check and fix both (see #12).

**Why it matters:** The command's whole point is a friction-free
single-message workflow.

**Fix (small):** Replace with `Bash(git checkout -b:*)` (and/or
`Bash(git switch -c:*)`).

---

## 12. Duplicated command definitions between `.claude/commands/` and `plugins/commit-commands/`

**What:** `/commit-push-pr` exists in both `.claude/commands/commit-push-pr.md`
(repo-local) and `plugins/commit-commands/commands/commit-push-pr.md`
(marketplace). They already drift (frontmatter and wording differ).

**Where:** `.claude/commands/commit-push-pr.md`,
`plugins/commit-commands/commands/commit-push-pr.md`.

**Why it matters:** Fixes applied to one copy (e.g. gap #11) silently miss
the other; contributors don't know which is canonical.

**Fix (small):** Make the plugin the single source of truth: delete the
repo-local copy (this repo can install its own marketplace plugin), or add a
comment header in the repo-local file stating it intentionally shadows the
plugin version and must be kept in sync.

---

## 13. Hookify dead scaffolding and stale comments

**What:** `plugins/hookify/matchers/__init__.py` and
`plugins/hookify/utils/__init__.py` are empty packages nothing imports —
abandoned structure. `Rule.action`'s comment says `"warn" or "block"
(future)` but block is fully implemented. `RuleEngine.__init__` is a
commented no-op. The README "Future Enhancements" list overlaps with what
already exists.

**Where:** `plugins/hookify/matchers/`, `plugins/hookify/utils/`,
`plugins/hookify/core/config_loader.py:40`,
`plugins/hookify/core/rule_engine.py:30-33`.

**Why it matters:** Dead structure invites future contributors to put code
in places nothing loads; stale comments misinform.

**Fix (small):** Delete the two empty packages, fix the `(future)` comment,
drop the empty `__init__` body from `RuleEngine` or the class-level comment.

---

## 14. Documentation inconsistencies (npm deprecation, stale links, CHANGELOG typo)

**What:**
- Root `README.md` marks npm install as **deprecated**, but
  `plugins/README.md:33-36` still instructs `npm install -g
  @anthropic-ai/claude-code` as step 1.
- `plugins/README.md` and several plugin READMEs link to
  `docs.claude.com/en/docs/claude-code/...` while the root README uses the
  newer `code.claude.com/docs/...` domain.
- `CHANGELOG.md:6` has a `- - Added` double-bullet typo (bot-generated file;
  fix upstream in the release tooling rather than hand-editing, or accept a
  one-line manual fix knowing the next bot commit may not preserve it).
- `plugins/hookify/README.md:295` references a `cc` CLI alias
  (`cc --plugin-dir …`) that isn't an official command name.

**Where:** as listed above.

**Why it matters:** This repo *is* documentation; drift here is a product
defect, not cosmetics.

**Fix (small):** One PR normalizing install instructions to the install
script + `/plugin` flow and the docs domain to `code.claude.com`.

---

## 15. log-issue-events.yml builds JSON by string concatenation

**What:** The Statsig payload is assembled by splicing env vars into a
single-quoted JSON heredoc, with only `"` sed-escaped for the title
(`log-issue-events.yml:25-40`). Backslashes or control characters in a title
produce invalid JSON and a silently failed (but green) step — the `curl`
exit code isn't checked either. The sibling dedupe workflow already does
this correctly with `jq -n --arg`.

**Where:** `.github/workflows/log-issue-events.yml:25-40`.

**Why it matters:** Analytics silently drop events; the pattern also looks
injection-prone to every security reviewer who reads it (the env-var usage
makes it not-exploitable, but the escaping is still wrong).

**Fix (small):** Rebuild the payload with `jq -n --arg …` exactly as
`claude-dedupe-issues.yml:52-69` does, and fail the step on non-2xx.

---

## 16. lock-closed-issues comments on every issue it locks, and mutates while paginating

**What:** The workflow posts a boilerplate comment to every closed issue
before locking (notification spam to all participants at up-to-daily
volume), and it paginates `sort: updated asc` while its own comments bump
`updated_at`, shifting items across pages mid-iteration (classic
skip/duplicate pagination hazard — mostly benign here because locked issues
are skipped on re-encounter, but items can be missed until the next run).

**Where:** `.github/workflows/lock-closed-issues.yml:26, 32-90`.

**Why it matters:** Noise for users; missed locks delay the intended
"file a new issue instead" behavior.

**Fix (small):** Drop the pre-lock comment (locking already shows a banner
on GitHub) or make it conditional; collect issue numbers first, then mutate
in a second pass.

---

## 17. Supply-chain pinning in the devcontainer image

**What:** `Dockerfile` uses `FROM node:20` (mutable tag, no digest), pipes
`zsh-in-docker.sh` from a GitHub release straight into `sh`, and installs
the git-delta `.deb` without a checksum.

**Where:** `.devcontainer/Dockerfile:1, 52-55, 72-79`.

**Why it matters:** This is the reference "safe sandbox" image; its build
inputs should be verifiable. Severity low (build-time, user-initiated).

**Fix (small):** Pin `node:20@sha256:…`, and verify sha256 sums for the
delta `.deb` and zsh-in-docker script before executing.

---

## 18. No CI validation for marketplace/plugin manifests or hook JSON

**What:** Nothing checks that `.claude-plugin/marketplace.json`, each
plugin's `plugin.json`, and each `hooks/hooks.json` are valid JSON, that
marketplace `source` paths exist, or that marketplace `version`/`author`
agree with the plugin's own manifest. `plugin-dev` ships validation scripts
(`plugins/plugin-dev/skills/hook-development/scripts/validate-hook-schema.sh`)
that this repo doesn't run on itself.

**Where:** absence of a workflow; relevant files listed above.

**Why it matters:** A malformed manifest merged to `main` breaks `/plugin`
installs for every user of this marketplace — the highest-traffic artifact
in the repo has no gate.

**Fix (small):** Add a `validate.yml` workflow on PRs that runs `jq empty`
over all `*.json` under `plugins/` + `.claude-plugin/`, checks each
marketplace `source` directory exists and contains
`.claude-plugin/plugin.json`, and diffs name/version consistency. Pure bash
+ jq, ~40 lines.

---

## 19. Accepted-risk items worth documenting (not bugs)

- `allowed_non_write_users: "*"` in `claude-issue-triage.yml` and
  `claude-dedupe-issues.yml` intentionally lets any GitHub user's issue text
  drive a Claude run. Mitigations exist (wrapper scripts, script caps,
  event-bound issue numbers, `non-write-users-check.yml`), but every change
  to those workflows must be reviewed as security-sensitive.
- Hookify re-reads and re-parses every rule file, and can read the entire
  session transcript, on **every** hook event with a 10s timeout — fine at
  small scale, degrades with many rules/huge transcripts. Optimization not
  currently needed; know it's there.
- `scripts/gh.sh` is deliberately restrictive (four subcommands, four
  flags). If a future prompt needs more, extend the allowlist consciously —
  do not bypass the wrapper.
