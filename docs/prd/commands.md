# Commands

Complete specification of all CLI commands.

## Change Viewing

### show

Display comprehensive change information.

```bash
gerrit-cli show [change-id]
gerrit-cli show 12345
gerrit-cli show If5a3ae8...  # Change-ID format
gerrit-cli show              # Auto-detect from HEAD
```

| Option | Description |
|--------|-------------|
| `--xml` | Output as XML for LLM consumption |
| `--no-diff` | Skip diff output |
| `--no-comments` | Skip comments |

**Output includes:**
- Change metadata (number, project, branch, status)
- Owner, reviewers, and CC information
- Submit requirements
- Full diff
- All comments with context

### files

List files changed in a change.

```bash
gerrit-cli files [change-id]
gerrit-cli files 12345
gerrit-cli files              # Auto-detect from HEAD
gerrit-cli files 12345 --json
gerrit-cli files 12345 --xml
```

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |
| `--xml` | Output as XML for LLM consumption |

**Output:** One file per line with status prefix (`M` modified, `A` added, `D` deleted, `R` renamed). Magic files (`/COMMIT_MSG`, `/MERGE_LIST`, `/PATCHSET_LEVEL`) are filtered out.

**JSON output:**
```json
{
  "status": "success",
  "change_id": "12345",
  "files": [
    { "path": "src/foo.ts", "status": "M", "lines_inserted": 10, "lines_deleted": 2 }
  ]
}
```

### reviewers

List reviewers on a change.

```bash
gerrit-cli reviewers [change-id]
gerrit-cli reviewers 12345
gerrit-cli reviewers          # Auto-detect from HEAD
gerrit-cli reviewers 12345 --json
gerrit-cli reviewers 12345 --xml
```

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |
| `--xml` | Output as XML for LLM consumption |

**Output:** One reviewer per line in `Name <email>` format (or email alone for email-only accounts).

**JSON output:**
```json
{
  "status": "success",
  "change_id": "12345",
  "reviewers": [
    { "account_id": 1001, "name": "Alice Smith", "email": "alice@example.com", "username": "alice" }
  ]
}
```

### diff

Get change diff in various formats.

```bash
gerrit-cli diff <change-id>
gerrit-cli diff 12345 --files-only
gerrit-cli diff 12345 --base 1  # Diff against patchset 1
```

| Option | Description |
|--------|-------------|
| `--xml` | Output as XML |
| `--files-only` | List only changed files |
| `--base <ps>` | Diff against specific patchset |

### comments

View all comments on a change with diff context.

```bash
gerrit-cli comments <change-id>
gerrit-cli comments 12345 --xml
```

| Option | Description |
|--------|-------------|
| `--xml` | Output as XML |
| `--context <n>` | Lines of context (default: 3) |

### search

Query changes with Gerrit syntax.

```bash
gerrit-cli search "owner:self status:open"
gerrit-cli search "project:canvas-lms branch:main"
```

| Option | Description |
|--------|-------------|
| `--xml` | Output as XML |
| `--limit <n>` | Max results (default: 25) |

## Change Management

### mine

List user's open changes.

```bash
gerrit-cli mine
gerrit-cli mine --xml
```

**Output:** Changes grouped by project with status indicators.

### incoming

View changes needing your review.

```bash
gerrit-cli incoming
gerrit-cli incoming --xml
```

**Output:** Changes where you're a reviewer, grouped by project.

### abandon

Abandon a change.

```bash
gerrit-cli abandon <change-id>
gerrit-cli abandon <change-id> -m "No longer needed"
gerrit-cli abandon  # Interactive selection
```

| Option | Description |
|--------|-------------|
| `-m <message>` | Abandon reason |

### restore

Restore an abandoned change.

```bash
gerrit-cli restore <change-id>
gerrit-cli restore <change-id> -m "Needed after all"
```

### set-ready

Mark a WIP change as ready for review via the Gerrit REST API. Does not require a git push.

```bash
gerrit-cli set-ready <change-id>
gerrit-cli set-ready <change-id> -m "Ready for another look"
```

| Option | Description |
|--------|-------------|
| `-m <message>` | Optional message to include with the status change |

### set-wip

Mark a change as work-in-progress via the Gerrit REST API. Does not require a git push.

```bash
gerrit-cli set-wip <change-id>
gerrit-cli set-wip <change-id> -m "Still in progress"
```

| Option | Description |
|--------|-------------|
| `-m <message>` | Optional message to include with the status change |

### workspace

View local git branch tracking information.

```bash
gerrit-cli workspace
```

**Output:** Current branch and associated Gerrit change.

### topic

Get, set, or remove topic for a change.

```bash
gerrit-cli topic [change-id]              # View current topic (auto-detect from HEAD)
gerrit-cli topic [change-id] <topic>      # Set topic
gerrit-cli topic [change-id] --delete     # Remove topic
gerrit-cli topic [change-id] --xml        # XML output
```

| Option | Description |
|--------|-------------|
| `--delete` | Remove the topic from the change |
| `--xml` | Output as XML for LLM consumption |

**Output formats:**

Text (get):
```
my-feature
```

Text (set):
```
✓ Set topic on change 12345: my-feature
```

Text (delete):
```
✓ Removed topic from change 12345
```

XML:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<topic_result>
  <status>success</status>
  <action>get|set|deleted</action>
  <change_id><![CDATA[12345]]></change_id>
  <topic><![CDATA[my-feature]]></topic>
</topic_result>
```

**Use cases:**
- Group related changes under a common topic
- Filter changes by topic in Gerrit UI
- Organize work for releases or features

## Code Review

### comment

Post comments (overall or inline).

```bash
# Overall comment
gerrit-cli comment <change-id> -m "LGTM"

# Inline comments via JSON
echo '[{"file":"src/index.ts","line":42,"message":"Consider null check"}]' | gerrit-cli comment 12345

# From file
cat comments.json | gerrit-cli comment 12345
```

| Option | Description |
|--------|-------------|
| `-m <message>` | Overall comment message |
| `--unresolved` | Mark inline comments as unresolved |

**JSON schema for inline comments:**
```json
[{
  "file": "path/to/file.ts",
  "line": 42,
  "message": "Comment text",
  "range": {
    "start_line": 40,
    "end_line": 45,
    "start_character": 0,
    "end_character": 80
  },
  "side": "REVISION",
  "unresolved": true
}]
```

### vote

Cast review votes.

```bash
gerrit-cli vote <change-id> --code-review +1
gerrit-cli vote <change-id> --code-review +2 --verified +1
gerrit-cli vote <change-id> --label "Custom-Label" +1
```

| Option | Description |
|--------|-------------|
| `--code-review <score>` | Code-Review vote (-2 to +2) |
| `--verified <score>` | Verified vote (-1 to +1) |
| `--label <name> <score>` | Custom label vote |
| `-m <message>` | Optional message with vote |

### add-reviewer

Add reviewers or groups to a change.

```bash
gerrit-cli add-reviewer <change-id> <user1> <user2>
gerrit-cli add-reviewer <change-id> --group frontend-team
gerrit-cli add-reviewer <change-id> user@example.com --cc
```

| Option | Description |
|--------|-------------|
| `--group <name>` | Add group as reviewer |
| `--cc` | Add as CC instead of reviewer |

### remove-reviewer

Remove reviewers from a change.

```bash
gerrit-cli remove-reviewer user@example.com -c 12345
gerrit-cli remove-reviewer user1@example.com user2@example.com -c 12345
gerrit-cli remove-reviewer johndoe -c 12345 --notify none
```

Supports email addresses, usernames, or account IDs as reviewer identifiers.

| Option | Description |
|--------|-------------|
| `-c, --change <id>` | Change ID (required) |
| `--notify <level>` | Notification level (none, owner, owner_reviewers, all) |
| `--xml` | Output as XML |

## Git Operations

### checkout

Checkout a change locally.

```bash
gerrit-cli checkout <change-id>
gerrit-cli checkout <change-id> --patchset 3
gerrit-cli checkout https://gerrit.example.com/c/project/+/12345
```

| Option | Description |
|--------|-------------|
| `--patchset <n>` | Specific patchset |
| `--branch <name>` | Custom branch name |

**Creates:** `review/12345` branch by default.

### push

Push changes for review.

```bash
gerrit-cli push
gerrit-cli push --reviewers alice bob
gerrit-cli push --topic "feature-x"
gerrit-cli push --wip
```

| Option | Description |
|--------|-------------|
| `--reviewers <users>` | Add reviewers |
| `--topic <name>` | Set topic |
| `--wip` | Push as work-in-progress |
| `--ready` | Mark ready for review |
| `--private` | Push as private |

**Auto-installs:** Gerrit commit-msg hook if missing.

### rebase

Rebase a change on target branch.

```bash
gerrit-cli rebase [change-id]
gerrit-cli rebase 12345
gerrit-cli rebase If5a3ae8...  # Change-ID format
gerrit-cli rebase              # Auto-detect from HEAD
gerrit-cli rebase --base <ref> # Rebase onto specific ref
```

| Option | Description |
|--------|-------------|
| `--base <ref>` | Base revision to rebase onto |
| `--xml` | Output as XML for LLM consumption |

### submit

Submit a change for merge.

```bash
gerrit-cli submit <change-id>
```

**Validates:** All submit requirements met.

## Group Management

### groups

List Gerrit groups.

```bash
gerrit-cli groups
gerrit-cli groups --pattern "team-*"
gerrit-cli groups --owned
gerrit-cli groups --project canvas-lms
gerrit-cli groups --user john.doe
```

| Option | Description |
|--------|-------------|
| `--pattern <glob>` | Filter by name |
| `--owned` | Only groups you own |
| `--project <name>` | Groups with project access |
| `--user <name>` | Groups containing user |
| `--xml` | Output as XML |

### groups-show

Display group details.

```bash
gerrit-cli groups-show <group-id>
gerrit-cli groups-show frontend-team
```

**Output:** Name, description, owner, members, options.

### groups-members

List group members.

```bash
gerrit-cli groups-members <group-id>
gerrit-cli groups-members frontend-team --xml
```

## Utilities

### status

Check connection and authentication.

```bash
gerrit-cli status
```

**Verifies:** API connectivity, credentials valid.

### setup / init

Configure credentials interactively.

```bash
gerrit-cli setup
gerrit-cli init  # Alias
```

**Creates:** `~/.gerrit-cli/config.json` with secure permissions.

### install-hook

Install the Gerrit commit-msg hook for automatic Change-Id generation.

```bash
gerrit-cli install-hook
gerrit-cli install-hook --force  # Overwrite existing hook
```

| Option | Description |
|--------|-------------|
| `--force` | Overwrite existing hook |
| `--xml` | Output as XML |

**Downloads:** Hook from configured Gerrit server.
**Installs to:** `.git/hooks/commit-msg` (executable).

**Use cases:**
- Set up a new clone before first push
- Repair corrupted hook
- Update hook after Gerrit upgrade

### open

Open change in browser.

```bash
gerrit-cli open <change-id>
gerrit-cli open  # Auto-detect from HEAD
```

### extract-url

Extract URLs from change messages.

```bash
gerrit-cli extract-url <change-id>
gerrit-cli extract-url <change-id> --pattern "jenkins"
gerrit-cli extract-url <change-id> --include-comments
```

| Option | Description |
|--------|-------------|
| `--pattern <regex>` | Filter URLs |
| `--include-comments` | Include comment URLs |
| `--json` | Output as JSON |

**Use case:** Get Jenkins build URL for `jk` integration.

### build-status

Check CI build status.

```bash
gerrit-cli build-status <change-id>
gerrit-cli build-status <change-id> --watch
gerrit-cli build-status <change-id> --watch --interval 30 --timeout 1800
```

| Option | Description |
|--------|-------------|
| `--watch` | Poll until terminal state |
| `--interval <sec>` | Poll interval (default: 30) |
| `--timeout <sec>` | Max wait time |
| `--exit-status` | Exit 1 on failure |

**States:** `pending`, `running`, `success`, `failure`, `not_found`

**Exit codes:**
- 0: Completed (any state)
- 1: Failure (with `--exit-status`)
- 2: Timeout
- 3: API error

## Global Options

Available on most commands:

| Option | Description |
|--------|-------------|
| `--xml` | Output as XML for LLM consumption |
| `--help` | Show command help |
| `--version` | Show version |
