---
name: gerrit-cli
description: Gerrit CLI 技能包 - 代码审查、变更管理、CI 构建状态查询
triggers:
  - gerrit
  - code review
  - change review
  - build status
  - gerrit-cli
argument-hint: "[command] [change-id]"
---

# @cloudglab/gerrit-cli

## 概览

把 Gerrit 代码审查能力暴露给命令行 / 智能体使用，默认带写保护。

核心能力：变更查看、审查评论、投票、CI 构建状态查询、变更生命周期管理。

## 命令选择强制规则

- 不确定命令名或参数时，先运行 `gerrit help <command>` 确认；本机没有安装时用 `npx -y @cloudglab/gerrit-cli@latest help <command>`。
- 如果用户给的是 Gerrit Web URL，先提取 change number 或 Change-ID，再映射到对应 CLI 命令。
- 如果 CLI 返回参数错误，立即运行 `gerrit help <command>` 校对参数。
- 查询当前仓库对应的变更时，优先尝试 HEAD commit message 里的 `Change-Id`，再要求用户补 change number。

## 角色入口

| 入口 | 适用场景 | 命令范围 |
|------|---------|---------|
| `gerrit` / `gerrit-cli` | 完整命令集 | 全部 50+ 命令 |
| `gerrit-dev` | 提交、查看、checkout、rebase | 开发者日常工作 |
| `gerrit-reviewer` | incoming、diff、comments、vote | 审查者工作流 |
| `gerrit-lead` | reviewer 管理、组操作 | 团队管理 |
| `gerrit-ci` | build-status、failures、extract-url | CI/构建分析 |

角色过滤 CLI help 和可见命令面，不改变 Gerrit 服务端权限。

## 入口优先级

1. 本机已安装 `gerrit`：直接执行
2. 未安装时：先 `npm i -g @cloudglab/gerrit-cli@latest`
3. 如果当前环境不方便安装，再临时用 `npx -y @cloudglab/gerrit-cli@latest`
4. 默认只 preview；写操作必须显式 `--confirm`

## 安装 / 更新 / 卸载

```bash
# 安装
npm i -g @cloudglab/gerrit-cli@latest
gerrit setup                    # 交互式配置
gerrit install                  # 安装 commit hook

# 更新
gerrit update

# 卸载（默认预览，需 --confirm 才执行）
gerrit uninstall
gerrit uninstall --confirm
gerrit uninstall --confirm --remove-config
```

## 环境变量

```bash
export GERRIT_HOST="https://gerrit.example.com"
export GERRIT_USERNAME="your-username"
export GERRIT_PASSWORD="your-http-password"
```

`GERRIT_HOST` 传完整 URL（`https://` 前缀），不要只传域名。

`setup` 命令默认把配置写入 `~/.gerrit-cli/config.json`，不在环境变量里存密码。

可设置 `GERRIT_DISABLE_WRITE=true` 临时禁用受保护写操作；缺少 `--confirm` 时写命令只输出预览，不执行 Gerrit 写入。

## 场景链路

处理用户请求时，按以下结构路由：

`用户表达 → 命中命令 → 缺参追问 → 执行 → 输出`

### 我的变更

- "我有哪些变更" / "我的 open list" → `mine`
- "查看 12345" → `show 12345`
- "show 当前分支的 change" → 不传参数，自动检测 HEAD Change-Id

### 审查流程

- "待审查列表" / "有哪些 incoming" → `incoming`
- "看 12345 的 diff" → `diff 12345`
- "给 12345 评论" → `comment 12345 -m "..."` 或管道输入
- "给 12345 打分 +2" → `vote 12345 --code-review 2`
- "12345 有多少条评论" → `comments 12345`

### CI 构建

- "12345 构建成功了吗" → `build-status 12345`
- "watch 到构建完成" → `build-status 12345 --watch --exit-status`
- "找 Jenkins URL" → `extract-url "jenkins"`

### 变更生命周期

- "推送变更" → `push`
- "丢弃变更" → `abandon 12345`
- "恢复变更" → `restore 12345`
- "合入变更" → `submit 12345`
- "重基变更" → `rebase 12345`
- "检出变更" → `checkout 12345`

## 写保护

所有写操作（comment、vote、submit、abandon、restore、add-reviewer、remove-reviewer）统一受 write guard 保护：

- 缺少 `--confirm` 时输出 preview，不执行真实写入
- `GERRIT_DISABLE_WRITE=true` 完全禁用写操作
- 错误信息统一格式

## 输出格式

- `--json`：结构化 JSON，适合脚本消费
- `--xml`：CDATA 包裹的 XML，适合 LLM 上下文
- 默认：纯文本，人类可读

大多数命令支持 `--json` 和 `--xml`。

## 自检 / 诊断

- `gerrit whoami`：查看当前账号、配置来源、认证状态
- `gerrit doctor`：检查本地配置、Gerrit 连接、git remote、`commit-msg` hook、HEAD `Change-Id`
- `gerrit install-hook`：安装 Gerrit `commit-msg` hook

## 典型工作流

```bash
# 审查一个变更
gerrit show 12345
gerrit diff 12345
gerrit comments 12345
gerrit comment 12345 -m "LGTM" --confirm
gerrit vote 12345 --code-review 2 --confirm

# 检查 CI
gerrit build-status 12345
gerrit failures 12345

# 管理变更
gerrit checkout 12345
gerrit push
gerrit submit 12345 --confirm
```

## 运行时要求

- Bun >= 1.2.0（开发 / 构建）
- Node.js >= 16（发布产物）
- Gerrit >= 3.0

## 适用场景

- 命令行手工操作 Gerrit
- 智能体自动化审查
- CI 脚本集成
