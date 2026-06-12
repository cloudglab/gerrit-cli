# gerrit-cli CLI Command Reference

Complete reference documentation for all gerrit-cli CLI commands.

## Output Format Flags

All commands that produce output support:
- `--json` — Structured JSON for programmatic consumption
- `--xml` — XML with CDATA-wrapped content (preferred for LLM consumption)
- (default) — Colored terminal output

`--json` and `--xml` are mutually exclusive.

---

## Change Viewing Commands

### show

Display comprehensive information about a Gerrit change.

**Syntax:**
```bash
gerrit-cli show [change-id] [options]
```

**Options:**
- `--json` — JSON output
- `--xml` — XML output
- `--no-comments` — Exclude comments
- `--no-diff` — Exclude diff

**Examples:**
```bash
gerrit-cli show
gerrit-cli show 12345
gerrit-cli show 12345 --xml
gerrit-cli show --no-comments
```

**Output includes:** metadata, commit message, file diffs, all comments, Jenkins build status

---

### diff

Get the diff for a Gerrit change.

**Syntax:**
```bash
gerrit-cli diff [change-id] [options]
```

**Options:**
- `--file <path>` — Show diff for specific file only
- `--base <revision>` — Compare against specific base revision
- `--files-only` — List changed filenames only (no diff content)
- `--json` — JSON output
- `--xml` — XML output

**Examples:**
```bash
gerrit-cli diff 12345
gerrit-cli diff 12345 --file src/api/client.ts
gerrit-cli diff 12345 --xml
```

---

### comments

View all comments on a change.

**Syntax:**
```bash
gerrit-cli comments [change-id] [options]
```

**Options:**
- `--unresolved-only` — Show only unresolved comments
- `--file <path>` — Show comments for specific file only
- `--json` — JSON output
- `--xml` — XML output

---

### files

List changed files in a change.

**Syntax:**
```bash
gerrit-cli files [change-id] [options]
```

**Options:**
- `--json` — JSON output
- `--xml` — XML output

---

### reviewers

List reviewers on a change.

**Syntax:**
```bash
gerrit-cli reviewers [change-id] [options]
```

**Options:**
- `--json` — JSON output
- `--xml` — XML output

---

## Change Listing Commands

### list

List your changes or changes needing your review.

**Syntax:**
```bash
gerrit-cli list [options]
```

**Options:**
- `--status <status>` — Filter by status: `open`, `merged`, `abandoned` (default: open)
- `-n, --limit <n>` — Maximum number of changes (default: 25)
- `--detailed` — Show detailed information
- `--reviewer` — Show changes where you are a reviewer or CC'd
- `--json` — JSON output
- `--xml` — XML output

---

### mine

List all changes owned by you. Alias for `gerrit-cli list`.

**Syntax:**
```bash
gerrit-cli mine [options]
```

**Options:**
- `--json` — JSON output
- `--xml` — XML output

---

### incoming / team

List changes where you are a reviewer or CC'd.
Both commands are aliases for `gerrit-cli list --reviewer`.
Query: `(reviewer:self OR cc:self) status:open`

**Syntax:**
```bash
gerrit-cli incoming [options]
gerrit-cli team [options]
```

**Options:**
- `--status <status>` — Filter by status (default: open)
- `-n, --limit <n>` — Maximum number of changes (default: 25)
- `--detailed` — Show detailed information
- `--all-verified` — Include all verification states (default: excludes unverified)
- `-f, --filter <query>` — Append custom Gerrit query syntax (e.g. `project:canvas-lms`)
- `--json` — JSON output
- `--xml` — XML output

**Examples:**
```bash
gerrit-cli team
gerrit-cli incoming --filter "project:canvas-lms"
gerrit-cli team --all-verified --json
```

---

### search

Search for changes using Gerrit query syntax.

**Syntax:**
```bash
gerrit-cli search [query] [options]
```

**Options:**
- `-n, --limit <n>` — Maximum results (default: 25)
- `--xml` — XML output

**Common Query Operators:**
- `owner:USER` / `owner:self`
- `status:open|merged|abandoned`
- `project:NAME`
- `branch:NAME`
- `reviewer:USER` / `cc:USER`
- `is:wip` / `is:submittable`
- `after:YYYY-MM-DD` / `before:YYYY-MM-DD`
- `age:1d|2w|1mon`
- `label:Code-Review+2`

**Examples:**
```bash
gerrit-cli search "owner:self status:open"
gerrit-cli search "is:wip"
gerrit-cli search "project:canvas-lms after:2025-01-01" -n 10 --xml
```

---

## Comment and Vote Commands

### comment

Post a comment on a Gerrit change.

**Syntax:**
```bash
gerrit-cli comment [change-id] [options]
```

**Options:**
- `-m, --message <text>` — Comment message (reads from stdin if omitted)
- `--file <path>` — File for inline comment
- `--line <n>` — Line number for inline comment
- `--unresolved` — Mark comment as unresolved

**Examples:**
```bash
gerrit-cli comment 12345 -m "Looks good!"
gerrit-cli comment 12345 --file src/api/client.ts --line 42 -m "Consider error handling"
echo "Review feedback" | gerrit-cli comment 12345
```

---

### vote

Vote on a Gerrit change.

**Syntax:**
```bash
gerrit-cli vote <change-id> [options]
```

**Options:**
- `--code-review <n>` — Code-Review vote (-2 to +2)
- `--verified <n>` — Verified vote (-1 to +1)
- `--label <name> <value>` — Custom label (repeatable)
- `--message <text>` — Optional comment with the vote
- `--json` — JSON output
- `--xml` — XML output

**Examples:**
```bash
gerrit-cli vote 12345 --code-review 2
gerrit-cli vote 12345 --code-review -1
gerrit-cli vote 12345 --verified 1 --message "Looks good"
gerrit-cli vote 12345 --label My-Label 1
```

---

## Change Management Commands

### abandon

Mark a change as abandoned.

**Syntax:**
```bash
gerrit-cli abandon [change-id] [options]
```

**Options:**
- `-m, --message <text>` — Abandonment message
- `--json` — JSON output
- `--xml` — XML output

---

### restore

Restore an abandoned change.

**Syntax:**
```bash
gerrit-cli restore [change-id] [options]
```

**Options:**
- `-m, --message <text>` — Restoration message
- `--json` — JSON output
- `--xml` — XML output

---

### submit

Submit a change (merge it).

**Syntax:**
```bash
gerrit-cli submit [change-id] [options]
```

**Options:**
- `--json` — JSON output
- `--xml` — XML output

---

### set-wip

Mark a change as work-in-progress.

**Syntax:**
```bash
gerrit-cli set-wip [change-id] [options]
```

**Options:**
- `-m, --message <text>` — Optional message
- `--json` — JSON output
- `--xml` — XML output

---

### set-ready

Mark a change as ready for review.

**Syntax:**
```bash
gerrit-cli set-ready [change-id] [options]
```

**Options:**
- `-m, --message <text>` — Optional message
- `--json` — JSON output
- `--xml` — XML output

---

### topic

Get or set the topic on a change.

**Syntax:**
```bash
gerrit-cli topic [change-id] [topic] [options]
```

**Options:**
- `--delete` — Remove the topic
- `--json` — JSON output
- `--xml` — XML output

**Examples:**
```bash
gerrit-cli topic 12345              # get topic
gerrit-cli topic 12345 my-feature   # set topic
gerrit-cli topic 12345 --delete     # delete topic
```

---

## Push and Checkout Commands

### push

Push changes to Gerrit for review.

**Syntax:**
```bash
gerrit-cli push [options]
```

**Options:**
- `-b, --branch <branch>` — Target branch (auto-detected from tracking branch)
- `-t, --topic <topic>` — Topic name
- `-r, --reviewer <email>` — Add reviewer (repeatable)
- `--cc <email>` — Add CC (repeatable)
- `--wip` — Mark as work-in-progress
- `--ready` — Mark as ready for review
- `--hashtag <tag>` — Add hashtag (repeatable)
- `--private` — Mark as private
- `--dry-run` — Preview without pushing

---

### checkout

Checkout a specific change revision locally.

**Syntax:**
```bash
gerrit-cli checkout <change-id> [options]
```

**Options:**
- `--revision <n>` — Checkout specific patchset (default: latest)

---

### cherry

Cherry-pick a Gerrit change into the current branch.

**Syntax:**
```bash
gerrit-cli cherry <change-id>[/<patchset>] [options]
```

**Options:**
- `--no-commit` — Stage changes without committing (`git cherry-pick -n`)
- `--no-verify` — Skip pre-commit hooks during cherry-pick
- `--remote <name>` — Use specific git remote (default: auto-detected from Gerrit host)

**Input formats:**
- `12345` — Latest patchset
- `12345/3` — Specific patchset
- `If5a3ae8cb5a107e187447802358417f311d0c4b1` — Change-ID
- `https://gerrit.example.com/c/my-project/+/12345` — Full URL

**Examples:**
```bash
gerrit-cli cherry 12345
gerrit-cli cherry 12345/3
gerrit-cli cherry 12345 --no-commit
gerrit-cli cherry 12345 --no-verify
```

---

### rebase

Rebase a change on Gerrit (server-side rebase).

**Syntax:**
```bash
gerrit-cli rebase [change-id] [options]
```

**Options:**
- `--base <sha-or-id>` — Rebase onto specific base commit or change
- `--allow-conflicts` — Allow rebase even when conflicts exist
- `--json` — JSON output
- `--xml` — XML output

**Examples:**
```bash
gerrit-cli rebase
gerrit-cli rebase 12345
gerrit-cli rebase 12345 --allow-conflicts
gerrit-cli rebase 12345 --base abc123def --xml
```

---

## Build and CI Commands

### build-status

Check the Jenkins build status for a change.

**Syntax:**
```bash
gerrit-cli build-status [change-id] [options]
```

**Options:**
- `--watch` — Poll until build completes
- `--interval <seconds>` — Polling interval (default: 30)
- `--timeout <seconds>` — Maximum wait time
- `--exit-status` — Return non-zero exit code on build failure (for scripting)
- `--json` — JSON output
- `--xml` — XML output

**Examples:**
```bash
gerrit-cli build-status 12345
gerrit-cli build-status --watch --interval 20 --timeout 1800
gerrit-cli build-status --exit-status
```

---

### extract-url

Extract URLs from change messages (e.g., Jenkins build links).

**Syntax:**
```bash
gerrit-cli extract-url <pattern> [change-id]
```

**Examples:**
```bash
gerrit-cli extract-url "build-summary-report"
gerrit-cli extract-url "build-summary-report" | tail -1
gerrit-cli extract-url "jenkins" 12345
```

---

### retrigger

Post a CI retrigger comment on a change.

**Syntax:**
```bash
gerrit-cli retrigger [change-id] [options]
```

**Options:**
- `--json` — JSON output
- `--xml` — XML output

The retrigger comment is configured via `gerrit-cli setup` or prompted on first use and saved to config.

**Examples:**
```bash
gerrit-cli retrigger
gerrit-cli retrigger 12345
gerrit-cli retrigger 12345 --json
```

---

## Analytics Commands

### analyze

View merged change analytics.

**Syntax:**
```bash
gerrit-cli analyze [options]
```

**Options:**
- `--start-date <YYYY-MM-DD>` — Start date (default: January 1 of current year)
- `--end-date <YYYY-MM-DD>` — End date (default: today)
- `--repo <name>` — Filter by repository
- `--json` — JSON output
- `--xml` — XML output
- `--markdown` — Markdown output
- `--csv` — CSV output
- `--output <file>` — Write output to file

**Examples:**
```bash
gerrit-cli analyze
gerrit-cli analyze --start-date 2025-01-01 --end-date 2025-06-30
gerrit-cli analyze --repo canvas-lms --markdown
gerrit-cli analyze --csv --output report.csv
```

---

### update

Update gerrit-cli to the latest version (self-update).

**Syntax:**
```bash
gerrit-cli update [options]
```

**Options:**
- `--skip-pull` — Skip version check, just reinstall

---

### failures

View recent build failures summary.

**Syntax:**
```bash
gerrit-cli failures [options]
```

**Options:**
- `--json` — JSON output
- `--xml` — XML output

---

## Worktree (tree) Commands

### tree setup

Create a git worktree for a Gerrit change, checked out at `<repo-root>/.gerrit-cli/<change-number>/`.

**Syntax:**
```bash
gerrit-cli tree setup <change-id>[:<patchset>] [options]
```

**Options:**
- `--json` — JSON output
- `--xml` — XML output

**Examples:**
```bash
gerrit-cli tree setup 12345
gerrit-cli tree setup 12345:3      # specific patchset
gerrit-cli tree setup 12345 --xml
```

---

### trees

List all gerrit-cli-managed worktrees.

**Syntax:**
```bash
gerrit-cli trees [options]
```

**Options:**
- `--json` — JSON output
- `--xml` — XML output

---

### tree rebase

Rebase the current worktree onto the latest base branch. Must be run from inside a gerrit-cli worktree.

**Syntax:**
```bash
gerrit-cli tree rebase [options]
```

**Options:**
- `--onto <branch>` — Rebase onto specific branch (default: auto-detected from tracking branch)
- `-i, --interactive` — Interactive rebase (`git rebase -i`)
- `--json` — JSON output
- `--xml` — XML output

**Examples:**
```bash
cd .gerrit-cli/12345
gerrit-cli tree rebase
gerrit-cli tree rebase --onto origin/main
gerrit-cli tree rebase --interactive
```

---

### tree cleanup

Remove a gerrit-cli-managed worktree.

**Syntax:**
```bash
gerrit-cli tree cleanup <change-id> [options]
```

---

## Groups and Reviewer Commands

### add-reviewer

Add reviewers, groups, or CCs to a change.

**Syntax:**
```bash
gerrit-cli add-reviewer <reviewers...> -c <change-id> [options]
```

**Options:**
- `-c, --change <id>` — Change ID (required)
- `--group` — Add as group
- `--cc` — Add as CC
- `--notify <level>` — `none`, `owner`, `owner_reviewers`, `all`
- `--xml` — XML output

---

### remove-reviewer

Remove a reviewer from a change.

**Syntax:**
```bash
gerrit-cli remove-reviewer <account> -c <change-id> [options]
```

**Options:**
- `-c, --change <id>` — Change ID (required)
- `--notify <level>` — `none`, `owner`, `owner_reviewers`, `all`
- `--xml` — XML output

---

### groups

List and search Gerrit groups.

**Syntax:**
```bash
gerrit-cli groups [options]
```

**Options:**
- `--pattern <regex>` — Filter by name pattern
- `--owned` — Show only groups you own
- `--project <name>` — Show groups for a project
- `--user <account>` — Show groups a user belongs to
- `--limit <n>` — Limit results (default: 25)
- `--xml` — XML output

---

### groups-show

Show detailed information about a specific group.

**Syntax:**
```bash
gerrit-cli groups-show <group-id> [options]
```

**Options:**
- `--xml` — XML output

---

### groups-members

List all members of a group.

**Syntax:**
```bash
gerrit-cli groups-members <group-id> [options]
```

**Options:**
- `--xml` — XML output

---

## Configuration Commands

### setup

Interactive first-time setup.

```bash
gerrit-cli setup
```

Configures Gerrit URL, credentials, and retrigger comment.

### config

Manage gerrit-cli CLI configuration.

**Syntax:**
```bash
gerrit-cli config <action> [key] [value]
```

**Actions:** `get`, `set`, `list`, `reset`

**Examples:**
```bash
gerrit-cli config list
gerrit-cli config get gerrit.url
gerrit-cli config set gerrit.url https://gerrit.example.com
```

---

## Auto-Detection

These commands auto-detect the change from the HEAD commit's `Change-Id` footer when no change-id is provided:

`show`, `build-status`, `topic`, `rebase`, `extract-url`, `diff`, `comments`, `vote`, `retrigger`, `files`, `reviewers`

---

## Exit Codes

- `0` — Success
- `1` — General error (network, API, validation)
- `build-status --exit-status` returns non-zero on build failure

---

## Utility Commands

### status

Check connection status to Gerrit server.

```bash
gerrit-cli status
gerrit-cli status --json
```

### whoami

Show current Gerrit login identity (account info, email, server).

```bash
gerrit-cli whoami
gerrit-cli who am i          # natural language alias
gerrit-cli whoami --json
```

### doctor

Diagnose local environment: Bun version, git, hook, config, network connectivity.

```bash
gerrit-cli doctor
gerrit-cli doctor --skip-network
gerrit-cli doctor --json
```

### version

Display gerrit-cli version.

```bash
gerrit-cli version
gerrit-cli version --json
gerrit-cli --version
```

### completion

Generate shell completion scripts for bash, zsh, or fish.

```bash
gerrit-cli completion bash
gerrit-cli completion zsh
gerrit-cli completion fish
```

### clean

Clean up merged topic branches.

```bash
gerrit-cli clean --dry-run    # preview
gerrit-cli clean              # actually delete
gerrit-cli clean --json
```

### open

Open a change in the browser.

```bash
gerrit-cli open 12345
```

### install-hook

Install the Gerrit commit-msg hook for the current repository.

```bash
gerrit-cli install-hook
gerrit-cli install-hook --force
```

### projects

List and filter Gerrit projects.

```bash
gerrit-cli projects
gerrit-cli projects --pattern "^canvas-.*"
gerrit-cli projects --xml
```

### init

Initialize gerrit-cli in the current repository (interactive setup alternative).

```bash
gerrit-cli init
```

### workspace

Create and manage git worktrees for isolated change review.

```bash
gerrit-cli workspace create 12345
gerrit-cli workspace list
gerrit-cli workspace cleanup
```

### install

One-command setup: check Bun, configure, test connection, install hook.

```bash
gerrit-cli install
gerrit-cli install --skip-config-check
gerrit-cli install --skip-hook
```

### update

Check for and install the latest version.

```bash
gerrit-cli update
gerrit-cli update --skip-config-check
npx -y @cloudglab/gerrit-cli@latest update
```

### config show / test

Display or verify configuration.

```bash
gerrit-cli config show             # display config (with source info)
gerrit-cli config test             # test connection
gerrit-cli config show --json
```
