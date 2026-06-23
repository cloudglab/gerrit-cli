# AGENTS.md

这是给 AI Agent 和 Skill 维护者的项目说明。README 面向用户，保留安装、场景和入口；工程约束、实现细节、已知限制和发布规则放这里。

## 项目定位

`@cloudglab/gerrit-cli` 是基于 TypeScript 重建的 Gerrit 命令行工具，通过 Gerrit REST API 暴露变更查看、审查、管理、CI 构建状态查询等能力。

核心目标：把 Gerrit 工作流接到命令行、脚本、CI 和 AI Skill。

## Agent 使用原则

- 优先使用本机 `gerrit-cli` / `gerrit` / 角色入口，不要默认退回临时脚本。
- 查询当前仓库对应的变更时，优先尝试 HEAD commit message 里的 `Change-Id`，再要求用户补 change number。
- 默认读操作可直接执行；写操作（`comment`, `vote`, `add-reviewer`, `remove-reviewer`, `submit`, `abandon`, `restore`, `topic`, `set-ready`, `set-wip`, `push`, `rebase`, `tree`, `clean`, `retrigger`, `install-hook`, `install`, `update`, `upgrade`, `uninstall`, `remove`）必须显式命中命令，并使用 `--confirm` 且未设置 `GERRIT_DISABLE_WRITE`，不做自然语言静默写入。
- 需要脚本消费时优先使用 `--json`；需要给 LLM 保留富文本上下文时再用 `--xml`。
- 遇到 Gerrit / Jenkins 瞬时错误可重试一次；连续失败两次先报告网络或权限阻塞。

## 角色入口

- `full`：`gerrit-cli` / `gerrit`，完整命令集。
- `dev`：`gerrit-dev`，偏提交、查看、checkout、rebase。
- `reviewer`：`gerrit-reviewer`，偏 incoming、diff、comments、comment、vote。
- `lead`：`gerrit-lead`，偏 reviewer 管理、组和团队操作。
- `ci`：`gerrit-ci`，偏构建状态、链接提取、结构化输出。

这些入口会过滤 CLI help 和可见命令范围，但不改变 Gerrit 服务端权限。

## 技术栈

- **Runtime**：Node.js（开发用 `tsx`，构建产物发布到 `dist/bin/*.js`）
- **语言**：TypeScript，`isolatedDeclarations: true`
- **CLI 框架**：Commander.js + Ink 终端 UI
- **状态管理**：Effect + Effect Schema
- **测试**：Vitest + MSW HTTP mock
- **数据库**：SQLite 本地缓存
- **Lint**：oxlint
- **格式化**：Biome

## 工程约束

### 代码规范

- 禁止隐式 `any`
- 禁止 `as` 类型断言（`as const` 和 `as unknown` 除外）
- 只用 `.ts` 文件，不加 `.tsx` / `.jsx`
- 文件不超过 700 行（500 行警告）
- 不允许 `--no-verify`

### 测试要求

- 最低 80% 行/函数/分支/语句覆盖率
- 所有 HTTP mock 必须用 MSW
- 每个命令至少覆盖：正常路径、API 错误、网络错误、参数校验错误

### 发布前核查清单

1. `pnpm run check:all` 通过
2. `package.json` version 与 tag 一致
3. 本地至少执行一次真实 Gerrit 查询或 msw 集成测试通过

### Git 工作流

- conventional commit 消息
- feature 分支从 main 分出
- 不直接提交 main
- 禁止 `--no-verify`

## 架构分层

```
src/cli/           # CLI 命令与 Ink 组件
src/api/           # Gerrit REST API 客户端
src/services/      # Effect 服务（config, git-worktree, commit-hook）
src/schemas/       # Effect Schema 数据模型
src/utils/         # 共享工具（ID 解析、格式化、shell 安全）
tests/             # 测试（unit / integration / mocks / helpers）
```

## 57 个命令分类

按 `CommandMeta.group` 分组（顶层命令 57 个；`config` 另有 `show` / `test` 子命令）：

| 分类 (group) | 命令 |
|------|------|
| **配置 (config)** | `setup`, `init`, `status`, `config` (`show`/`test`), `whoami`, `doctor` |
| **辅助 (utility)** | `version`, `completion`, `install`, `update`, `upgrade`, `uninstall`, `remove` |
| **审查 (review)** | `show`, `diff`, `comments`, `comment`, `vote`, `reviewers`, `add-reviewer`, `remove-reviewer` |
| **变更 (change)** | `list`, `mine`, `incoming`, `team`, `search`, `projects`, `files`, `open`, `topic`, `submit`, `abandon`, `restore`, `set-ready`, `set-wip` |
| **分析 (analytics)** | `report`, `daily`, `weekly`, `monthly`, `quarterly`, `analyze` |
| **工作区 (workspace)** | `checkout`, `push`, `rebase`, `workspace`, `tree` (`setup`/`cleanup`/`rebase`), `trees`, `cherry`, `clean` |
| **CI (ci)** | `build-status`, `failures`, `extract-url`, `retrigger`, `install-hook` |
| **组 (groups)** | `groups`, `groups-show`, `groups-members` |

## 场景链路模型

Skill / Agent 处理 Gerrit 请求时按下面链路路由：

`用户表达 → 命中命令 → 缺参追问 → 执行 → 输出`

### 我的变更

- “我有哪些变更” / “我的 open list” → `mine`
- “查看 12345” → `show 12345`
- “show 当前分支的 change” → 不传参数，自动检测 HEAD Change-Id

### 审查流程

- “待审查列表” / “有哪些 incoming” → `incoming`
- “看 12345 的 diff” → `diff 12345`
- “给 12345 评论” → `comment 12345 -m "..."` 或管道输入
- “给 12345 打分 +2” → `vote 12345 --code-review 2`
- “12345 有多少条评论” → `comments 12345`

### CI 构建

- “12345 构建成功了吗” → `build-status 12345`
- “watch 到构建完成” → `build-status 12345 --watch --exit-status`
- “找 Jenkins URL” → `extract-url "jenkins"`

### 变更生命周期

- “推送变更” → `push`
- “丢弃变更” → `abandon 12345`
- “恢复变更” → `restore 12345`
- “合入变更” → `submit 12345`
- “重基变更” → `rebase 12345`
- “检出变更” → `checkout 12345`

## 已知限制

- 不支持 3.0 之前的 Gerrit 版本
- 变更创建仍通过 `git push`，CLI 只做 push 封装
- 复杂管理员操作（如项目创建、权限编辑）仍需 Web UI
- `doctor` 诊断命令提供本地配置 / 连接 / git remote / commit-msg hook / HEAD Change-Id 检查

## 环境变量

```bash
export GERRIT_HOST="https://gerrit.example.com"
export GERRIT_USERNAME="your-username"
export GERRIT_PASSWORD="your-http-password"
```

`GERRIT_HOST` 传完整 URL（`https://` 前缀），不要只传域名。

`setup` 命令默认把配置写入 `~/.gerrit-cli/config.json`，不在环境变量里存密码。

可设置 `GERRIT_DISABLE_WRITE=true` 临时禁用受保护写操作；缺少 `--confirm` 时写命令只输出预览，不执行 Gerrit 写入。

## 发布链路

已内置 GitHub Actions：
- `ci.yml`：push/main 触发，跑 `check:all`
- `publish.yml`：tag `v*` 触发，校验版本并通过 npm Trusted Publisher 发布
- `pages.yml`：main 更新后部署 `docs/` 到 GitHub Pages

Pages 速查页源码在 `docs/index.html`；它由 workflow 单独部署，不随 npm tarball 发布。

发布前本地 smoke：
- `pnpm run release:smoke-query`：默认 dry-run，检查命令 help 面是否可达
- `pnpm run release:smoke-query:live`：需要 `GERRIT_*` 配置，做真实 Gerrit 只读查询回归
- live smoke 可用 `GERRIT_SMOKE_CHANGE_ID`、`GERRIT_SMOKE_QUERY`、`GERRIT_SMOKE_BUILD_KEYWORD` 覆盖默认查询样本

发版步骤：
1. 确保本地 `pnpm run check:all` 通过
2. 执行 `pnpm run release:smoke-query`
3. 更新 `package.json` 中 `version` 和 `CHANGELOG.md`
4. `git tag v0.x.x && git push origin main && git push origin v0.x.x`
5. 等待 publish workflow 完成，并验证 npm 包版本

## 与 zentao-cli 架构对齐状态

已对齐：CLI bootstrap 模块化、SDK 导出、config/version/completion/clean 辅助命令、`--json/--xml` 一致性、no `as` type assertion、每日更新探针、GitHub Pages 速查页、角色多入口、`--role` help/命令过滤、全局写保护、`whoami`、`doctor`、配置合并、manifest 生成、release smoke query、Trusted Publisher 发布链路。

待对齐：
- `uninstall` 更完整的配置清理链路
- 更完整的 workflow 级真实 Gerrit smoke 矩阵
