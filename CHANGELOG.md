# Changelog

## 0.0.7 - 2026-06-15

### Added

- **Role-based command filtering**: `gerrit-dev`, `gerrit-reviewer`, `gerrit-lead`, `gerrit-ci` entries now show only role-relevant commands; `--role` flag available on all entries.
- **Write protection**: all write commands (`comment`, `vote`, `submit`, `abandon`, `restore`, `add-reviewer`, `remove-reviewer`) require `--confirm` to execute; without it, a preview is shown. `GERRIT_DISABLE_WRITE=true` disables all writes globally.
- **`whoami` command**: shows current identity, config source (file/env/merged), and masked credentials.
- **`doctor` command**: diagnoses local environment — config validity, Gerrit connection, git repository, remote URL, commit-msg hook, HEAD Change-Id.
- **Config environment merge**: environment variables now override file config when both are present; `config show` displays config source and masked credentials.
- **Update probe background process**: daily version check now runs as a detached subprocess, no longer blocks CLI startup. Added `SKIP_COMMANDS` (help/version/install/update/uninstall/completion) to skip unnecessary checks.
- **Skill/AI integration**: added `skills/gerrit-cli/SKILL.md` with command index, role entries, scenario chains, and write protection docs.
- **Manifest generation**: `scripts/generate-manifest.ts` produces `dist/manifest.json` with command metadata, groups, and role mappings; integrated into binary build and smoke scripts.
- **Uninstall `--remove-config`**: `gerrit uninstall --confirm --remove-config` now deletes `~/.gerrit-cli` config directory including credentials.

### Changed

- Role entries (`gerrit-dev`, `gerrit-reviewer`, etc.) now filter CLI help and visible command surface based on role metadata.
- `install` and `update` commands now auto-detect npm/bun and prefer npm for broader compatibility; added ENOTEMPTY residue retry.
- `setup`, `install`, `update`, `uninstall` commands now available.
- `banner.ts` lint fix: removed useless regex escape.
- Release smoke script uses manifest for command surface and supports both binary and source CLI execution.
- README: added `npx -y` no-preinstall entry points for install/update/uninstall/run.

## 0.0.6 - 2026-06-13

### Added

- Standalone binary build via `bun build --compile` — users no longer need Bun installed.
- Banner component with ASCII art and quick start guide on init/setup/update.

### Changed

- `npm install -g @cloudglab/gerrit-cli` now installs standalone binaries; no Bun prerequisite.
- `bin` entries in package.json point to compiled `dist/` binaries.
- `getVersion()` prefers build-time injected `GERRIT_CLI_VERSION` for compiled binaries.

### Removed

- AI tool artifacts: `.claude-plugin/`, `.cursor/`, `skills/`, `CLAUDE.md`, `llms.txt`.
- Duplicate workflows: `ci-simple.yml`, `claude.yml`, `claude-code-review.yml`, `dependency-update.yml`, `security.yml`.
- Redundant docs: `docs/prd/`, `docs/adr/`, `DEVELOPMENT.md`, `EXAMPLES.md`.
- `.eslintrc.js` (project uses oxlint).

## 0.0.5 - 2026-06-12

Follow-up release after the `v0.0.4` publish workflow failed in CI.

### Fixed

- Replace partial `child_process` module mocks with scoped adapter spies so CI tests do not leak incomplete mocks across files.

## 0.0.4 - 2026-06-12

Follow-up release after the `v0.0.3` publish workflow failed in CI.

### Fixed

- Route `child_process` usage through an internal adapter so Bun/Linux CI and tests avoid direct Node builtin ESM mock interop failures.

## 0.0.3 - 2026-06-12

Follow-up release after the `v0.0.2` publish workflow failed in CI.

### Fixed

- Use namespace imports for `node:child_process` to avoid Bun/Linux ESM named export compatibility failures in CI.

## 0.0.2 - 2026-06-12

Follow-up release after the initial public publish.

### Fixed

- Pin GitHub Actions publish workflow to Bun `1.3.14` to avoid `latest` runtime drift during npm publishing.

## 0.0.1 - 2026-06-12

Initial public baseline for `@cloudglab/gerrit-cli`.

### Added

- Gerrit CLI entrypoints for change viewing, review, workspace, CI, group, and configuration workflows.
- Structured output modes for human CLI usage, JSON pipelines, XML/CDATA LLM consumption, and automation scripts.
- README hero artwork and GitHub Pages quick reference surface.
- `gerrit-workflow` skill package for AI Agent driven Gerrit review scenarios.
- Productization docs covering roles, scenarios, install/update chain, release planning, and ADRs.
- Daily update probe and enhanced `config show` source/masking output.

### Release Notes

- This release intentionally starts from `0.0.1` as the first public version baseline.
- GitHub Release tags should start at `v0.0.1`.
