# Changelog

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
