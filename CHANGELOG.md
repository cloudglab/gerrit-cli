# Changelog

## 0.0.15 - 2026-06-17

### Fixed

- `install` / `update` 默认全局安装 skill 时改为 `skills --agent universal`，避开 PromptScript 不支持全局安装的问题。
- `install` / `update` 支持通过 `--skill-global false` 显式切到项目级；若全局 CLI 包里缺少 `skills/gerrit-cli`，会自动回退到 npm 包解压安装。

## 0.0.14 - 2026-06-17

### Changed

- CLI 开发、构建与发布产物改为标准 Node.js 入口，`dist/bin/*.js` 不再使用 `bun build --compile` 独立二进制模式。
- 仓库开发流统一到 `pnpm` + `tsx` + `tsup` + `Vitest`；GitHub Actions、Husky、smoke 脚本和文档入口同步调整。
- 发布仍保持单一自动入口 `.github/workflows/publish.yml`，tag push 后通过 npm Trusted Publisher 完成校验与发布。

## 0.0.13 - 2026-06-17

### Fixed

- CI publish failure for `v0.0.10`/`v0.0.12`: `tests/update-probe.test.ts` now uses `mkdtempSync` per test and writes/reads cache files directly, eliminating filesystem race conditions under Bun's parallel runner on GitHub Actions Ubuntu runners.

## 0.0.12 - 2026-06-17

### Fixed

- CI publish failure for `v0.0.10`: install/uninstall commands now import `execFileSync` directly from `node:child_process` to avoid ESM namespace binding issues under Bun 1.3.14.
- `tests/update-probe.test.ts` parallel flakiness: each test now manages its own isolated temp cache file path, eliminating describe-scoped variable races under Bun's default parallel test runner.

## 0.0.11 - 2026-06-17

### Fixed

- CI publish failure for `v0.0.10`: install/uninstall commands now import `execFileSync` directly from `node:child_process` to avoid ESM namespace binding issues under Bun 1.3.14.
- `tests/update-probe.test.ts` parallel flakiness: each test now uses a unique temp cache file path instead of a shared `process.pid`-based directory.

## 0.0.10 - 2026-06-17

### Added

- `upgrade` and `remove` aliases for `update` and `uninstall` commands, matching `zentao-cli` common command surface.
- `install` / `update` now support `--skill-source local|git|npm` and `--skill-local-path`, and install the opencode skill at project scope by default to stay compatible with agents that do not support global skill installation.
- `uninstall` now supports `--cli-only`, `--skill-only`, `--keep-config`, and `--remove-config`, and removes the skill globally via `npx -y skills remove ... --yes --global`.
- `install`, `update`, `upgrade`, `uninstall`, and `remove` are now visible across all role entrypoints (`dev`, `reviewer`, `lead`, `ci`).
- `whoami` is explicitly surfaced as a common command for all roles.

### Changed

- `install` / `update` global CLI installation now uses `npm install -g @cloudglab/gerrit-cli@latest` consistently, with npm/npx residue cleanup and ENOTEMPTY retry.
- `uninstall` now uses `npm uninstall -g @cloudglab/gerrit-cli` instead of `bun remove -g`.

### Fixed

- `register-analytics-commands.ts` no longer double-registers `install` / `update` / `uninstall`, fixing `gerrit --help` startup failure.
- `tests/change-id-formats.test.ts` mock now handles `MESSAGES` detail option and uses `onUnhandledRequest: 'error'` for stricter request validation.

## 0.0.9 - 2026-06-15

### Fixed

- Release version and changelog alignment for `v0.0.9`.
- `tests/change-id-formats.test.ts` mock handler minor consistency updates.

## 0.0.8 - 2026-06-15

### Fixed

- Release-blocking CI flake in `tests/update-probe.test.ts`: update probe helpers now accept an explicit cache file path so tests no longer depend on the module-level `CHECK_FILE` override under Bun coverage/CI execution.
- `update-probe` tests now write/read the same explicit temp cache file, restoring stable coverage runs for `bun run check:all` and npm publish workflow validation.
- `tests/change-id-formats.test.ts` edge-case assertions now use explicit 10s test timeouts so slower coverage/pre-push runs no longer fail on Bun default 5s timeout.

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
