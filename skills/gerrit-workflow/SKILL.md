---
name: gerrit-workflow
description: Work with Gerrit code reviews using the gerrit-cli CLI tool. Use when reviewing changes, posting comments, managing patches, or interacting with Gerrit. Covers common workflows like fetching changes, viewing diffs, adding comments, voting, managing change status, cherry-picking, and tree worktrees.
allowed-tools: Bash, Read, Write, Edit, Grep, Glob
---

# Gerrit Workflow with gerrit-cli CLI

This skill helps you work effectively with Gerrit code reviews using the `gerrit-cli` CLI tool.

## Role-Based Usage

Route requests to the right commands based on the user's role:

### Developer (writing code, pushing changes)
- "我的变更" / "my changes" → `gerrit-cli mine`
- "推送" / "push this" → `gerrit-cli push`
- "rebase / 重基" → `gerrit-cli rebase`
- "abandon / 丢弃" → `gerrit-cli abandon`
- "检出 / checkout" → `gerrit-cli checkout`

### Reviewer (reviewing code, voting)
- "待审查" / "incoming" → `gerrit-cli incoming`
- "看 diff" / "show diff" → `gerrit-cli diff`
- "评论" / "comment" → `gerrit-cli comment` (or stdin pipe)
- "打分 / vote" → `gerrit-cli vote --code-review <n>`
- "查看评论" → `gerrit-cli comments`

### Team Lead (assigning reviewers, managing groups)
- "加审查人" / "add reviewer" → `gerrit-cli add-reviewer`
- "组 / groups" → `gerrit-cli groups`, `groups-members`
- "团队变更" / "team changes" → `gerrit-cli team`

### CI / Automation (builds, scripting)
- "构建状态" / "build status" → `gerrit-cli build-status --watch --exit-status`
- "提取链接" / "extract URL" → `gerrit-cli extract-url`
- Use `--json` or `--xml` for machine-readable output
- Pipe commands together for workflows

## Natural Language Routing

Map common requests to command chains:

| User says | Command chain |
|-----------|--------------|
| "帮我 review 12345" | `show 12345` → `diff 12345` → `comments 12345` → summarize |
| "12345 构建成功了吗" | `build-status 12345` |
| "等构建完再部署" | `build-status --watch --exit-status && deploy.sh` |
| "给 12345 评论 LGTM" | `comment 12345 -m "LGTM"` |
| "批量评论这三个文件" | stdin JSON → `comment 12345 --batch` |
| "12345 有哪些审查人" | `reviewers 12345` |
| "恢复 12345" | `restore 12345` |
| "合入 12345 并提交" | `submit 12345` |

When missing a required parameter:
1. Auto-detect from HEAD commit Change-Id (most commands support this)
2. Infer from previous command output
3. Ask the user only if neither works

## Error Handling

- **401 Unauthorized**: Prompt user to run `gerrit-cli setup` or check env vars
- **Network errors**: Retry once, then report
- **404 Not Found**: Verify change ID; suggest `gerrit-cli search`
- **Config missing**: Guide to `gerrit-cli setup` or `export GERRIT_HOST=...`

## Prerequisites

The `gerrit-cli` CLI tool must be installed and accessible in your PATH. It's available globally if installed from `~/github/gerrit-cli`.

## Output Formats

Most commands support `--json` and `--xml` flags:
- `--json` — Structured JSON for programmatic consumption
- `--xml` — XML with CDATA-wrapped content, optimized for LLM/AI consumption
- (default) — Plain text / colored terminal output for humans

These are mutually exclusive; using both is an error.

## Core Commands

### Viewing Changes

**Show comprehensive change information:**
```bash
gerrit-cli show [change-id]
```
Displays metadata, diff, and all comments. Auto-detects from HEAD commit if omitted.

**View specific diff:**
```bash
gerrit-cli diff [change-id]
gerrit-cli diff [change-id] --file src/api/client.ts   # specific file
```

**View all comments:**
```bash
gerrit-cli comments [change-id]
gerrit-cli comments [change-id] --unresolved-only
```

**List changed files:**
```bash
gerrit-cli files [change-id]
gerrit-cli files [change-id] --json
```

**List reviewers:**
```bash
gerrit-cli reviewers [change-id]
gerrit-cli reviewers [change-id] --xml
```

### Listing Changes

**Your open changes:**
```bash
gerrit-cli mine
gerrit-cli list
```

**Changes needing your review (reviewer OR cc'd):**
```bash
gerrit-cli incoming
gerrit-cli team
```
Both query `reviewer:self OR cc:self status:open`. Options:
- `--all-verified` — Include all verification states (default: open only)
- `-f, --filter <query>` — Append custom Gerrit query syntax
- `--status <status>` — Filter by status: open, merged, abandoned
- `-n, --limit <n>` — Limit number of results (default: 25)
- `--detailed` — Show detailed info for each change
- `--json` / `--xml`

**General list with options:**
```bash
gerrit-cli list --status merged
gerrit-cli list --reviewer          # same as incoming
gerrit-cli list -n 10 --json
```

**Search with custom query:**
```bash
gerrit-cli search "owner:self is:wip"
gerrit-cli search "project:my-project status:open" -n 10 --xml
```

### Posting Comments and Votes

**Post a comment:**
```bash
gerrit-cli comment [change-id] -m "Your comment"
echo "Review feedback" | gerrit-cli comment [change-id]   # from stdin
gerrit-cli comment [change-id] --file src/api/client.ts --line 42 -m "Inline comment"
```

**Vote on a change:**
```bash
gerrit-cli vote <change-id> --code-review 2
gerrit-cli vote <change-id> --verified 1 --message "Looks good"
gerrit-cli vote <change-id> --label My-Label 1
```

### Managing Changes

**Abandon / restore:**
```bash
gerrit-cli abandon [change-id] -m "No longer needed"
gerrit-cli restore [change-id]
```

**Submit a change:**
```bash
gerrit-cli submit [change-id]
```

**Set WIP / Ready:**
```bash
gerrit-cli set-wip [change-id]
gerrit-cli set-wip [change-id] -m "Still working on tests"
gerrit-cli set-ready [change-id]
gerrit-cli set-ready [change-id] -m "Ready for review"
```

**Topic:**
```bash
gerrit-cli topic [change-id]            # get current topic
gerrit-cli topic [change-id] my-topic   # set topic
gerrit-cli topic [change-id] --delete   # delete topic
```

### Pushing Changes

**Push changes to Gerrit:**
```bash
gerrit-cli push
gerrit-cli push -b main -t my-feature -r alice@example.com --wip
```
Options: `-b`, `-t`, `-r`, `--cc`, `--wip`, `--ready`, `--hashtag`, `--private`, `--dry-run`

### Checkout and Cherry-Pick

**Checkout a change locally:**
```bash
gerrit-cli checkout 12345
gerrit-cli checkout 12345 --revision 3   # specific patchset
```

**Cherry-pick a change into current branch:**
```bash
gerrit-cli cherry 12345
gerrit-cli cherry 12345/3                # specific patchset
gerrit-cli cherry 12345 --no-commit      # stage without committing
gerrit-cli cherry 12345 --no-verify      # skip pre-commit hooks
gerrit-cli cherry https://gerrit.example.com/c/my-project/+/12345
```

### Rebase

**Rebase a change on Gerrit (server-side):**
```bash
gerrit-cli rebase [change-id]
gerrit-cli rebase [change-id] --base <sha-or-change>
gerrit-cli rebase [change-id] --allow-conflicts   # rebase even with conflicts
gerrit-cli rebase [change-id] --json
```
Auto-detects from HEAD commit if no change-id provided.

### Retrigger CI

**Post a CI retrigger comment:**
```bash
gerrit-cli retrigger [change-id]
```
Auto-detects from HEAD. Saves the retrigger comment to config on first use (or configure via `gerrit-cli setup`).

### Build Status

**Check Jenkins build status:**
```bash
gerrit-cli build-status [change-id]
gerrit-cli build-status --watch --interval 20 --timeout 1800
gerrit-cli build-status --exit-status   # non-zero exit on failure (for scripting)
```

**Extract build URLs:**
```bash
gerrit-cli extract-url "build-summary-report"
gerrit-cli extract-url "build-summary-report" | tail -1
```

**Canonical CI workflow:**
```bash
gerrit-cli build-status --watch --interval 20 --timeout 1800 && \
  gerrit-cli extract-url "build-summary-report" | tail -1 | jk failures --smart --xml
```

### Analytics

**View merged change analytics (year-to-date by default):**
```bash
gerrit-cli analyze
gerrit-cli analyze --start-date 2025-01-01 --end-date 2025-12-31
gerrit-cli analyze --repo canvas-lms
gerrit-cli analyze --json
gerrit-cli analyze --xml
gerrit-cli analyze --markdown
gerrit-cli analyze --csv
gerrit-cli analyze --output report.md   # write to file
```
Default start date: January 1 of current year.

**Update gerrit-cli to the latest version:**
```bash
gerrit-cli update
gerrit-cli update --skip-pull   # reinstall without version check
```

**View recent failures summary:**
```bash
gerrit-cli failures
gerrit-cli failures --xml
```

### Worktree (tree) Commands

Manage git worktrees for reviewing changes in isolation.

**Setup a worktree for a change:**
```bash
gerrit-cli tree setup 12345
gerrit-cli tree setup 12345:3     # specific patchset
gerrit-cli tree setup 12345 --xml
```
Creates worktree at `<repo-root>/.gerrit-cli/<change-number>/`.

**List gerrit-cli-managed worktrees:**
```bash
gerrit-cli trees
gerrit-cli trees --json
```

**Rebase a worktree (run from inside the worktree):**
```bash
cd .gerrit-cli/12345
gerrit-cli tree rebase
gerrit-cli tree rebase --onto origin/main
gerrit-cli tree rebase --interactive   # interactive rebase (-i)
```

**Remove a worktree:**
```bash
gerrit-cli tree cleanup 12345
```

### Groups and Reviewers

**Add reviewers:**
```bash
gerrit-cli add-reviewer user@example.com -c 12345
gerrit-cli add-reviewer --group project-reviewers -c 12345
gerrit-cli add-reviewer --cc user@example.com -c 12345
gerrit-cli add-reviewer --notify none user@example.com -c 12345
```

**Remove reviewers:**
```bash
gerrit-cli remove-reviewer user@example.com -c 12345
```

**List groups:**
```bash
gerrit-cli groups
gerrit-cli groups --pattern "^team-.*"
gerrit-cli groups --project canvas-lms
gerrit-cli groups --owned
```

**Show group details / members:**
```bash
gerrit-cli groups-show administrators
gerrit-cli groups-members project-reviewers
```

### Configuration and Setup

```bash
gerrit-cli setup          # interactive first-time setup
gerrit-cli config list    # list all config
gerrit-cli config get gerrit.url
gerrit-cli config set gerrit.url https://gerrit.example.com
```

## Auto-Detection

These commands auto-detect the change from the HEAD commit's `Change-Id` footer when no change-id is provided:
`show`, `build-status`, `topic`, `rebase`, `extract-url`, `diff`, `comments`, `vote`, `retrigger`, `files`, `reviewers`

## Common LLM Workflows

```bash
# Review a change
gerrit-cli show <id> --xml
gerrit-cli diff <id> --xml
gerrit-cli comments <id> --xml

# Post a review
gerrit-cli comment <id> -m "..."
gerrit-cli vote <id> Code-Review +1

# Manage changes
gerrit-cli push
gerrit-cli checkout <id>
gerrit-cli abandon <id>
gerrit-cli submit <id>

# WIP toggle
gerrit-cli set-wip <id>
gerrit-cli set-ready <id> -m "message"

# Check CI
gerrit-cli build-status <id> --exit-status
```

## Notes

- Commands run from within a Gerrit repository
- Most commands accept an optional change-id; if omitted, they use the current branch's HEAD `Change-Id`
- The tool uses local SQLite caching for offline-first functionality
- `--xml` is preferred over `--json` for LLM/AI consumption (easier to parse)
- Numeric change numbers (12345) and full Change-IDs (I1234abc...) are both accepted
