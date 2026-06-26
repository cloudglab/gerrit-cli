# Changelog

## 0.0.19 - 2026-06-26

### Added

- 新增内置 `changelog` 命令：`gerrit changelog` 输出内置 CHANGELOG，支持默认文本、`--json`、`--xml` 与 `--version <version>`（如 `0.0.18`）查看指定版本段；脚本与 Agent 可直接消费，无需读 npm tarball。
- `design.md`：补齐架构、Skill 双目录、HTTP 客户端、写保护、内置 changelog 命令等设计与对齐说明，作为发版与对内交接的单一来源。
- `.agents/skills/gerrit-cli/` 作为 Skill 编辑源（场景拆分 `reference/*.md`），`scripts/copy-skills.mjs` 在 `pnpm build` 时把它复制到 `skills/gerrit-cli/` 作为 npm 发布产物，与 zentao-cli 保持一致。
- `AGENTS.md`：补齐 v0.0.18 之后新增的 `changelog` 与 `install` 写保护、HTTP 客户端等说明。

### Changed

- `src/api/http-client.ts`：抽出独立 HTTP 客户端，提供共享 undici Agent keepAlive 连接池、GET 15 秒内存缓存、网络错误（`ECONNRESET` / `ETIMEDOUT` / `EAI_AGAIN` / timeout / socket hang up）重试一次；缓存 key 只含 url+method+body，剥离 `Authorization` / `Cookie` / `Set-Cookie` 等敏感头，避免 base64 密码泄露。
- `src/api/gerrit.ts`：分页改为以 Gerrit 服务端 `_more_changes` 字段为准，不再依赖 `page.length < pageSize` 启发式；超出 `limit` 警告改用 `Effect.logWarning`。
- `src/cli/command-helpers.ts`：写命令错误统一改用 `Effect.logError` + `Effect.fail`，不再静默吞错；写命令路径全部接入 `WriteGuardError` 与 `--confirm` / `GERRIT_DISABLE_WRITE` 写保护。
- `src/cli-bootstrap.ts`：去掉手动 `extractRole` argv 扫描，统一交给 commander 解析 `--role`，作为角色过滤的唯一来源。
- `src/cli/commands/{abandon,comment,rebase,restore,retrigger,set-ready,set-wip,submit,topic,vote,install-hook,push,setup}`：参数错误改为 `Effect.fail`，`abandon` / `rebase` / `set-ready` / `set-wip` 等用 `catchAll` 收敛错误输出，`rebase` 退出码与写保护前置修复。
- `src/cli/register-{commands,state-commands,cicd-commands}.ts`：精简冗余，统一 `executeEffect` 入口。
- `src/api/gerrit.ts`：`atob` 改为 `Buffer.from(..., 'base64').toString('utf8')`；`revisionId` 走 `encodeURIComponent`，避免含 `/` / `#` 的 revision 触发 404。
- `vitest.config.ts`：默认 `pool: 'forks'`、`fileParallelism: false`、`maxConcurrency: 1`、`maxWorkers: 1`，强制串行跑测试，与发布前要求一致。
- `scripts/build-dist.ts`：构建期把 `GERRIT_CLI_VERSION` 字面量直接注入 `dist/bin/*.js` 与 `dist/index.js`，根治全局安装取不到 `process.env` 时 `--version` 显示 `0.0.0` 的问题。
- `.lintstagedrc.json`：`biome format` 限制到 `src/` / `tests/`，避免 `scripts/` 在 biome ignore 情况下报错。
- `tests/search.test.ts`：spawn 集成测试加上 15s 超时，修复并发场景下 flaky 超时。
- 错误消息统一改为中文并附 `hint`，便于 CLI 用户和 Agent 决定下一步动作。

### Fixed

- `src/api/http-client.ts`：移除 401 重试（相同凭据重试必然再次 401），401 直接抛业务错误，由 `error-codes.ts` 的 `NOT_AUTHENTICATED` hint 引导重新认证；网络错误仍重试一次。
- `src/api/gerrit.ts`：分页 `_more_changes` 启发式修复，避免 `limit` 边界下重复抓取或漏抓。
- `src/utils/write-guard.ts`：写保护预览输出结构化 JSON（包含 `preview`、`command`、`args`），`tests/write-guard.test.ts` 同步更新；写命令未带 `--confirm` 或 `GERRIT_DISABLE_WRITE=true` 时不再静默通过。
- `src/cli/commands/comment.ts`：写保护前置到 `runComment`，避免已进入 Effect 后才拦截。
- `src/cli/commands/rebase.ts`：退出码修正，命令执行成功但 `git rebase --abort` 触发时不再误报失败。
- `src/cli/commands/abandon.ts`：改用 `catchAll` 收敛 `not found` / `conflict` / 网络异常，避免进程以 0 退出但实际未提交。
- `src/api/gerrit.ts`：连接探测强制 https，不再回落到 http。

## 0.0.18 - 2026-06-24

### Added

- `src/core/change-input.ts`: 统一 change 输入解析入口，集中 `parseChangeInput` / `resolveChangeId` / `buildChangeUrl` / `extractPushOutputChangeUrl` / `parseRemoteHost`，为后续把 `checkout` / `cherry` / `tree-setup` / `workspace` / `open` / `push` 的重复实现收敛到单一来源做准备。
- `tests/unit/core/change-input.test.ts`: 覆盖 URL / change number / Change-ID / `:` 规格 / HEAD 回退 / 远程 host 解析等关键路径。

### Changed

- `skills/gerrit-cli/SKILL.md`: 全文重写为 2 级索引结构（场景索引表 + 命令参考章节），57 个命令 100% 覆盖，每个命令列出关键选项；按使用频度排序，从 226 行精简到 188 行。
- `AGENTS.md`: 命令分类从 50 个扩展到 57 个（按 `CommandMeta.group`），写操作清单从 6 个扩到 21 个，`review` 错名修正为 `reviewers`。

## 0.0.17 - 2026-06-22

### Added

- `report [period]` 聚合报表命令，以及 `daily` / `weekly` / `monthly` / `quarterly` alias；支持默认文本、`--json`、`--xml`、`--md` 四种输出，用于查看个人日/周/月/季变更产出。
- 周报新增按日分布，月报新增项目 Top 10 / 作者 Top 5，季报新增月度趋势，方便直接落盘到运维日报或邮件正文。

### Changed

- 所有命令 help 新增 `预估成本` 与 `下一步推荐`，便于 CLI 用户和 Agent 更快判断调用代价与后续链路。
- `report` / `daily` / `weekly` / `monthly` / `quarterly` / `analyze` 统一归到 `analytics` 分组，并使用同一套默认推荐链。

### Fixed

- `src/cli/command-helpers.ts` 的结构化错误输出现在带 `code`、`recoverable`、`statusCode`、`hint`，JSON/XML 脚本消费更稳定。
- `.github/workflows/publish.yml` 改为明确执行 `pnpm run check:all`，与 npm Trusted Publisher 发布前校验要求保持一致。

## 0.0.16 - 2026-06-18

### Fixed

- `docs/index.html`: 速查页只保留 `gerrit-cli` 的安装、配置与 Gerrit 使用命令，移除混入的开发命令、发布 smoke 与不准确的 CI 命令示例；顶部 hero、命令分类与 footer 文案同步收敛。
- 修正速查页中 `extract-url` 调用为 `gerrit-cli extract-url "jenkins" 12345`，并补充 `set-wip` / `set-ready` 等真实命令示例。

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
