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

Gerrit REST API 命令行工具：变更查看 / 审查 / 投票 / CI / 生命周期 / 报告。默认带写保护。

## 命令选择规则

- 不确定命令 → `gerrit help <cmd>`（未装则 `npx -y @cloudglab/gerrit-cli@latest help <cmd>`）
- URL → 提取 change number 或 Change-Id，再映射命令
- HEAD commit 有 Change-Id → `show` / `diff` 等可不传参

## 场景索引（按使用频度）

| 场景 | 命令 |
|------|------|
| 日常审查 | `mine` `show` `diff` `comments` `reviewers` `comment` `vote` `incoming` `team` |
| CI 状态 | `build-status` `failures` `analyze` `extract-url` `retrigger` |
| 变更生命周期 | `push` `checkout` `submit` `abandon` `restore` `rebase` `topic` `set-wip` `set-ready` `cherry` `workspace` (deprecated) |
| 变更浏览 | `list` `search` `projects` `files` `open` |
| 多 worktree | `tree setup` `tree cleanup` `tree rebase` `trees` `clean` |
| 报告 | `report` `daily` `weekly` `monthly` `quarterly` |
| 审查人管理 | `add-reviewer` `remove-reviewer` |
| 组管理 (lead) | `groups` `groups-show` `groups-members` |
| 自检 | `whoami` `doctor` `status` `config show` `config test` `install-hook` |
| 配置 / 安装 | `setup` `init` `install` `update` `upgrade` `uninstall` `remove` |
| 辅助 | `version` `completion` |

## 命令参考

### 日常审查

- `mine` — 我的 open 变更（`list` 别名）
- `show [id]` — 变更详情，缺省取 HEAD Change-Id
- `diff <id> [--file <f>] [--files-only] [--format unified|json|files]` — 变更 diff
- `comments <id>` — 全部评论（带 diff 上下文）
- `reviewers [id]` — 审查人 / CC 列表，缺省取 HEAD
- `comment <id> -m "..." [--file <f> --line <n>] [--reply-to <id>] [--unresolved] [--batch] --confirm` — 发评论
- `vote <id> [--code-review -2..2] [--verified -1..1] [--label <k> <v>] [-m "..."] --confirm` — 投票
- `incoming` — 待我审查 / CC 列表
- `team` — 同 `incoming`（别名）

### CI 状态

- `build-status [id] [--watch] [--exit-status] [--interval <s>] [--timeout <s>]` — 构建状态，watch 阻塞到完成
- `failures <id>` — 拿最近 Jenkins 失败链接
- `analyze [--start-date YYYY-MM-DD] [--end-date YYYY-MM-DD] [--repo <p>] [--markdown|--csv|--json] [--output <f>]` — 个人贡献分析
- `extract-url <pattern> [id]` — 从消息/评论中抽 URL（"jenkins"/"console"等）
- `retrigger [id] --confirm` — 发 retrigger 评语触发 CI

### 变更生命周期

- `push [-b <branch>] [-t <topic>] [-r <email>...] [--cc <e>...] [--wip|--ready] [--hashtag ...] [--private] [--dry-run]` — 推送变更
- `checkout <id> [--detach] [--remote <name>]` — 拉取并切到变更
- `submit <id> --confirm` — 合入
- `abandon [id] [-m "..."] --confirm` — 丢弃，无参走交互
- `restore <id> [-m "..."] --confirm` — 恢复
- `rebase [id] [--base <ref>] [--allow-conflicts] --confirm` — 重基，缺省取 HEAD
- `topic [id] [<new-topic>] [--delete]` — 读 / 改 / 清 topic
- `set-ready <id> [-m "..."] --confirm` — 标 ready
- `set-wip <id> [-m "..."] --confirm` — 标 WIP
- `cherry <id> [--no-commit] [--no-verify] [--remote <name>]` — 拉取并 cherry-pick
- `workspace <id>` — deprecated，等价 `tree setup <id>`

### 变更浏览

- `list [--status open|merged|abandoned] [--limit <n>] [--detailed] [--reviewer]` — 通用列表
- `search [<query>] [--limit <n>]` — Gerrit 查询语法，如 `search "status:open owner:me"`
- `projects [--pattern <regex>]` — 项目列表
- `files [id]` — 变更文件清单，缺省取 HEAD
- `open <id>` — 浏览器打开变更

### 多 worktree

- `tree setup <id>` — 基于变更建 worktree
- `tree cleanup [id] [--force]` — 清理（无参清全部）
- `tree rebase [--onto <branch>] [--interactive]` — 拉取并 rebase 当前 worktree
- `trees [--all]` — 列出 worktree
- `clean [-n|--dry-run] [-f|--force]` — 删已合入 upstream 的本地分支

### 报告

- `report [period] [--period daily|weekly|monthly|quarterly] [--since YYYY-MM-DD] [--until YYYY-MM-DD] [--status merged|open|abandoned|all] [--reviewer] [--user <name>] [--limit <n>] [--md] [--json] [--xml]` — 周期报告
- `daily` / `weekly` / `monthly` / `quarterly` — `report --period <p>` 的别名

### 审查人管理

- `add-reviewer <email...> -c <id> [--cc] [--group] [--notify none|owner|owner_reviewers|all] --confirm` — 加审查人 / CC / 组
- `remove-reviewer <email...> -c <id> [--notify none|owner|owner_reviewers|all] --confirm` — 移除

### 组管理 (lead)

- `groups [--pattern <regex>] [--owned] [--project <p>] [--user <a>] [--limit <n>]` — 列出组
- `groups-show <group-id>` — 组详情
- `groups-members <group-id>` — 组成员

### 自检

- `whoami` — 当前账号 / 认证状态
- `doctor` — 本地配置 / 连接 / git remote / commit-msg hook / HEAD Change-Id 体检
- `status` — 连接状态简报
- `config show` — 当前配置（密码脱敏）
- `config test` — 用当前配置测一次连接
- `install-hook [--force]` — 装 commit-msg hook（自动生成 Change-Id）

### 配置 / 安装

- `setup` — 交互式配置（写入 `~/.gerrit-cli/config.json`）
- `init` — `setup` 别名
- `install [--cli-only|--skill-only] [--skill-source local|git|npm] [--skill-local-path <p>] [--skip-config-check]` — 装 CLI + skill
- `update` / `upgrade` — 同 `install`（upgrade 是别名）
- `uninstall --confirm [--keep-config|--remove-config] [--cli-only|--skill-only]` — 卸载
- `remove` — `uninstall` 别名

### 辅助

- `version` — 版本信息
- `completion <bash|zsh|fish>` — 生成 shell 补全脚本

## 角色入口

| 入口 | 范围 |
|------|------|
| `gerrit` / `gerrit-cli` | 全部 57 个命令 |
| `gerrit-dev` | 开发者向（提交 / 查看 / checkout / rebase） |
| `gerrit-reviewer` | 审查向（incoming / diff / comments / vote） |
| `gerrit-lead` | 团队管理（reviewer 管理 / 组） |
| `gerrit-ci` | CI 向（build-status / failures / extract-url） |

## 入口优先级

1. 本机 `gerrit` → 直接用
2. 未装 → `npm i -g @cloudglab/gerrit-cli@latest`
3. 临时 → `npx -y @cloudglab/gerrit-cli@latest`
4. 默认只 preview，写操作需 `--confirm`

## 环境变量

```bash
export GERRIT_HOST="https://gerrit.example.com"   # 完整 URL，含 https://
export GERRIT_USERNAME="your-username"
export GERRIT_PASSWORD="your-http-password"
export GERRIT_DISABLE_WRITE=true                  # 完全禁用写操作
export GERRIT_RETRIGGER_COMMENT="retrigger"        # retrigger 评语模板
```

`setup` 写入 `~/.gerrit-cli/config.json`，不在环境变量存密码。

## 写保护

所有写操作统一受 write guard 保护：

- **业务写操作**（变更 / 审查 / 工作区）：`comment` `vote` `add-reviewer` `remove-reviewer` `submit` `abandon` `restore` `topic` `set-ready` `set-wip` `push` `rebase` `tree` `clean` `retrigger` `install-hook`
- **包管理写操作**：`install` `update` `upgrade` `uninstall` `remove`

规则：

- 缺 `--confirm` → 输出 preview，不执行
- `GERRIT_DISABLE_WRITE=true` → 完全禁用
- 错误统一格式：`code` / `recoverable` / `statusCode` / `hint`

## 输出格式

- `--json`：结构化 JSON，脚本消费
- `--xml`：CDATA 包裹 XML，LLM 上下文
- 默认：纯文本，人可读

## 运行时

- Node.js ≥ 18
- pnpm ≥ 10（仓库开发）
- Gerrit ≥ 3.0

## 适用场景

- 命令行手工操作 Gerrit
- 智能体自动化审查
- CI 脚本集成
