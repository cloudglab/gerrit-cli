# AGENTS.md

这是给 AI Agent 和 Skill 维护者的项目说明。README 面向用户，保留安装、场景和入口；工程约束、实现细节、已知限制和发布规则放这里。

## 项目定位

`@cloudglab/gerrit-cli` 是基于 TypeScript 重建的 Gerrit 命令行工具，通过 Gerrit REST API 暴露变更查看、审查、管理、CI 构建状态查询等能力。

核心目标：把 Gerrit 工作流接到命令行、脚本、CI 和 AI Skill。

## 技术栈

- **Runtime**：Bun（源码直跑，不产 dist）
- **语言**：TypeScript，`isolatedDeclarations: true`
- **CLI 框架**：Commander.js + Ink 终端 UI
- **状态管理**：Effect + Effect Schema
- **测试**：Bun test + MSW HTTP mock
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

1. `bun run check:all` 通过
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

## 50 个命令分类

| 分类 | 命令 |
|------|------|
| **查看** | `show`, `diff`, `comments`, `search`, `list` |
| **审查** | `comment`, `vote`, `review`, `add-reviewer`, `remove-reviewer` |
| **管理** | `mine`, `incoming`, `team`, `abandon`, `restore` |
| **工作区** | `checkout`, `push`, `rebase`, `submit`, `workspace`, `tree` |
| **CI/分析** | `build-status`, `failures`, `analyze`, `extract-url` |
| **组** | `groups`, `groups-show`, `groups-members` |
| **配置** | `setup`, `config`, `status`, `init`, `install-hook` |
| **辅助** | `version`, `completion`, `clean`, `open`, `cherry` |

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
- `doctor` 诊断命令和 `install` 一键安装命令尚未实现

## 环境变量

```bash
export GERRIT_HOST="https://gerrit.example.com"
export GERRIT_USERNAME="your-username"
export GERRIT_PASSWORD="your-http-password"
```

`GERRIT_HOST` 传完整 URL（`https://` 前缀），不要只传域名。

`setup` 命令默认把配置写入 `~/.gerrit-cli/config.json`，不在环境变量里存密码。

## 发布链路

已内置 GitHub Actions：
- `ci.yml`：push/main 触发，跑 `check:all`
- `publish.yml`：tag `v*` 触发，校验版本并通过 npm Trusted Publisher 发布

发版步骤：
1. 确保本地 `bun run check:all` 通过
2. 更新 `package.json` 中 `version`
3. `git tag v0.x.x && git push origin v0.x.x`
4. 等待 publish workflow 完成，并验证 npm 包版本

## 与 zentao-cli 架构对齐状态

已对齐：CLI bootstrap 模块化、SDK 导出、config/version/completion/clean 辅助命令、`--json/--xml` 一致性、no `as` type assertion。

待对齐：
- `install` / `update` 命令
- `whoami` / `doctor` 诊断命令
- 每日更新探针
- `docs/index.html` GitHub Pages 速查页
- 角色多入口（`gerrit-dev`, `gerrit-reviewer` 等别名）
- release smoke query
