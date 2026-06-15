# gerrit-cli 学习 zentao-cli 通用模式的迁移清单

> 对比基准
> - zentao-cli: `/Users/lixiaoming/Desktop/desktop/personal/zentao-cli` (v0.1.25)
> - gerrit-cli: `/Users/lixiaoming/Desktop/desktop/personal/gerrit-cli` (v0.0.6)
>
> 目标：把 zentao-cli 近期演化出的通用能力迁移到 gerrit-cli，提升可维护性、AI 集成、安装卸载和角色过滤体验。

## 1. 角色与命令过滤（高优先级）

**差异**：zentao-cli 用 `src/core/roles.ts` + `src/core/manifest.ts` 在 build 时生成 `commandToGroup` 和 `manifest.json`，CLI 启动时只加载当前 role 可见的命令；gerrit-cli 的角色入口 (`gerrit-dev` / `gerrit-reviewer` 等) 只是调用同一个 CLI 的别名，没有命令过滤，help 里会显示全部 50+ 命令。

**学习点**：
- `src/core/tool-registry.ts` 的 `groupLoaders` 按需动态加载命令组。
- `scripts/generate-manifest.ts` 生成 `src/core/command-groups.generated.ts` + `dist/manifest.json`。
- `src/cli.ts` 支持 `--role full|dev|pm|qa` 和内联 `zentao dev ...` 两种写法。

**落地动作**：
1. 在 `src/cli/` 下新增 `roles.ts`，定义 role → command group 的映射（如 `dev`、`reviewer`、`lead`、`ci`、`full`）。
2. 把现有命令按领域拆成 group：`view`、`review`、`management`、`workspace`、`ci`、`groups`、`config`、`auxiliary`。
3. 新增 `scripts/generate-manifest.ts`，build 时输出 `src/cli/command-groups.generated.ts` 和 `dist/manifest.json`。
4. 改造 `src/cli-bootstrap.ts`：解析 `--role` / `-r` 或入口名，调用 `buildRegistryForCommand` 只注册可见命令，help 只列当前 role 的命令。
5. 保留现有 `bin/*-entry.ts` 入口，但让它们在 `argv` 中注入对应 role。

## 2. 命令注册层：从 Commander 到 schema-driven registry（高优先级）

**差异**：zentao-cli 的命令是 `tool(name, zodSchema, handler)`，天然可被 AI / MCP 消费；gerrit-cli 每个命令直接调用 `program.command(...).option(...).action(...)`，schema 与 CLI 解析强耦合。

**学习点**：
- `src/core/cli-registry.ts`：`InMemoryCliRegistry`、`parseCommandInput`、Zod schema 校验、布尔/数字/数组/JSON 参数转换。
- `src/tools/*.ts`：每个领域一个注册文件，handler 返回统一 `JsonContentResult`。
- `src/core/cli-output.ts`：`formatCommandOutput` 统一处理文本/JSON 输出。

**落地动作**：
1. 新增 `src/cli/registry.ts` 和 `src/cli/command-schema.ts`，定义命令 schema 类型与参数解析器（可用 Effect Schema 替代 Zod）。
2. 把现有 `src/cli/commands/*.ts` 改造为“注册函数”：返回 `name, schema, handler`。
3. `src/cli/register-commands.ts` 改为遍历 registry 注册到 Commander，作为兼容层，而不是每个命令手写 Commander chain。
4. 统一输出格式：handler 返回结构化数据，`executeEffect` / 新 formatter 负责渲染 `--json` / `--xml` / 文本。

## 3. 全局写保护 Write Guard（高优先级）

**差异**：zentao-cli 所有写操作共用 `src/core/write-guard.ts`：默认可写，但真实执行必须传 `--confirm true`，可被 `ZENTAO_DISABLE_WRITE=true` 禁用，错误信息统一。gerrit-cli 的写命令（`comment`、`vote`、`submit`、`abandon`、`restore` 等）各自实现确认逻辑，不统一。

**学习点**：
- `previewOrAssertWriteAllowed(input)` 返回 preview 或 diagnostic，handler 用 `runWithPreview` 包装。
- 环境变量 `ZENTAO_DISABLE_WRITE` 作为安全开关。

**落地动作**：
1. 新增 `src/utils/write-guard.ts`，提供 `isWriteEnabled()`、`previewOrAssertWriteAllowed(input)`。
2. 环境变量命名为 `GERRIT_DISABLE_WRITE=true`。
3. 所有写命令统一在 action 前调用 write guard；缺 `confirm: true` 时输出 preview（包含 action + payload），不执行真实调用。
4. 修改 AGENTS.md 写操作规则：从“显式命中命令”升级为“显式命中命令 + confirm / 未被禁用”。

## 4. 自安装 / 自更新 / 自卸载（中优先级）

**差异**：zentao-cli 内置 `install`、`update`、`uninstall` 命令，能安装全局 CLI + Skill、清理 npm 残留、校验配置、保留/删除配置。gerrit-cli 的 `install` 只是安装 commit hook，`update` 命令不存在，`uninstall` 只有配置清理雏形。

**学习点**：
- `src/install.ts`：`runInstallCommand` / `runUpdateCommand` / `runUninstallCommand`。
- `--skill-source local|git|npm`、`--cli-only`、`--skill-only`、`--skip-config-check`。
- 卸载预览模式：先打印步骤，必须 `--confirm true` 才执行。

**落地动作**：
1. 新增 `src/cli/commands/self-update.ts` 和 `src/cli/commands/self-uninstall.ts`。
2. `gerrit update`：调用 `npm install -g @cloudglab/gerrit-cli@latest`，支持 `--skip-config-check`。
3. `gerrit uninstall`：打印预览（删除全局包、清理 npm 残留、删除 `~/.gerrit-cli/config.json`），加 `--confirm` 执行。
4. 如果后续提供 Skill，新增 `skills/gerrit-cli/SKILL.md` 并在 install 中通过 `npx skills add` 安装。

## 5. `whoami` 与连接诊断（中优先级）

**差异**：zentao-cli 提供 `whoami` 命令，调用 `api.getToken()` 校验账号并打印 mask 后的配置。gerrit-cli 已把 `whoami` / `doctor` 列在 AGENTS.md 待对齐项中，但尚未实现。

**学习点**：
- `src/core/auth.ts`：token 获取、MD5 密码回退、错误分类。
- `src/core/config.ts`：`maskConfig()`。

**落地动作**：
1. 新增 `src/cli/commands/whoami.ts`，调用 Gerrit `/config/server/version` 或 `/accounts/self` 校验凭据。
2. 输出 mask 后的 `host`、`username` 和连接状态。
3. 后续可扩展为 `doctor` 命令，检查 git remote、Change-Id hook、凭据、网络。

## 6. 配置加载：环境变量覆盖与交互式输入（中优先级）

**差异**：zentao-cli 的配置加载会合并文件配置与环境变量（环境变量优先级高），缺失或失效时会交互式提示输入。gerrit-cli 当前是文件或环境二选一，没有合并逻辑，`setup` 也没有交互式补全。

**学习点**：
- `src/core/config.ts`：`loadConfig()` 合并 env + file，`normalizeConfig()` 统一 URL、API 版本，`saveConfig()` 设置 0o700/0o600 权限。

**落地动作**：
1. 改造 `src/services/config.ts` 的 `getFullConfig`：先读文件，再用 `GERRIT_HOST/USERNAME/PASSWORD` 等环境变量覆盖对应字段。
2. `src/cli/commands/setup.ts` 支持交互式提示（url / username / password），使用 `@inquirer/prompts`。
3. 新增 `maskConfig()` 辅助函数，给 `config show` 和 `whoami` 使用。
4. 文件权限保持 `0o700` 目录 + `0o600` 文件。

## 7. 每日更新探针增强（低优先级）

**差异**：zentao-cli 的更新探针记录 `update-check.json`，用 detached 子进程在后台执行 `npm view`，避免阻塞命令；跳过命令集合更细。gerrit-cli 在 `runDailyUpdateProbe()` 中直接 `fetch`，会占用命令启动时间（虽然设置了 5s timeout）。

**学习点**：
- `src/update-probe.ts`：`triggerBackgroundVersionCheck()` 用 `spawn(process.execPath, ['-e', script])` 后台检查。
- `SKIP_COMMANDS` 包含 `help/list/version/install/update/upgrade`。

**落地动作**：
1. 把 gerrit-cli 的更新检查改为后台子进程模式，记录 `~/.gerrit-cli/update-check.json`。
2. 增加 `SKIP_COMMANDS`，过滤 help/version/install/update/uninstall/completion。
3. 提示信息改为可执行命令：`gerrit update`（对齐 zentao 习惯）。

## 8. Skill 与 AI 集成（低优先级）

**差异**：zentao-cli 在 `skills/zentao-cli/SKILL.md` 中提供完整的命令参考和自然语言示例，并通过 `install` 自动安装到 OpenCode。gerrit-cli 没有 Skill。

**学习点**：
- `skills/zentao-cli/SKILL.md` 的结构：安装、环境变量、角色入口、场景链路、命令参考。
- `scripts/generate-manifest.ts` 保证 manifest 与命令同步。

**落地动作**：
1. 新增 `skills/gerrit-cli/SKILL.md`，覆盖：
   - 安装/升级/卸载
   - 环境变量 `GERRIT_HOST/USERNAME/PASSWORD`
   - 角色入口 `gerrit-dev` / `gerrit-reviewer` / `gerrit-lead` / `gerrit-ci`
   - 场景链路：我的变更 / 审查 / CI / 变更生命周期（与 AGENTS.md 一致）
2. `npm pack` 时把 `skills/` 加入 `files`。
3. `gerrit install` 支持安装 skill（依赖第 4 项）。

## 9. Manifest 与命令发现（中优先级）

**差异**：zentao-cli build 时生成 `dist/manifest.json`，包含 version、commands、groups、commandToGroup，方便 Skill/Agent 做命令发现。gerrit-cli 没有这类元数据文件。

**落地动作**：
1. 在 `scripts/generate-manifest.ts` 中为 gerrit-cli 生成 `dist/manifest.json`。
2. manifest 结构：
   ```json
   {
     "version": "0.0.6",
     "commands": ["show", "diff", ...],
     "groups": { "view": [...], "review": [...] },
     "commandToGroup": { "show": "view", ... },
     "roles": { "dev": ["view", "workspace"], ... }
   }
   ```
3. `release:smoke-query` 读取 manifest 做命令面覆盖检查，而不是硬编码 `commandSurface` 数组。

## 10. 发布与构建流程对齐（低优先级）

**差异**：zentao-cli 的 build 是标准 `tsc` + manifest 生成；gerrit-cli 用 `bun build --compile` 产出独立二进制，体验更好。两者不必互相替换，但 release smoke 可以互相学习。

**落地动作**：
1. `scripts/release-query-smoke.ts` 增加 `--dry-run` 默认行为（与 zentao 一致），避免误跑真实查询。
2. smoke 脚本读取 `dist/manifest.json` 动态生成命令面，而不是手写 `commandSurface`。
3. 保留 `bun build --compile`，但在 build 前插入 `generate-manifest` 步骤。

## 建议实施顺序

```
Phase 1（安全与体验）：
  3 全局写保护 → 6 配置合并与交互 setup → 5 whoami

Phase 2（架构统一）：
  2 schema-driven registry → 1 角色过滤 → 9 manifest 生成

Phase 3（生态与发布）：
  4 自安装/更新/卸载 → 8 Skill → 7 更新探针 → 10 release smoke 优化
```

## 验证标准

- `bun run check:all` 通过。
- `bun run release:smoke-query` 33/33 通过，且命令面从 manifest 读取。
- 每个写命令缺 `--confirm` 时输出 preview，不执行真实写入。
- `gerrit --role reviewer --help` 只显示 reviewer 可见命令。
- 新增 `gerrit whoami` 能校验并输出 mask 后的配置。
