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

## 入口优先级

1. 本机 `gerrit` → 直接用
2. 未装 → `npm i -g @cloudglab/gerrit-cli@latest`
3. 临时 → `npx -y @cloudglab/gerrit-cli@latest`
4. 默认只 preview，写操作需 `--confirm`

## 命令选择规则

- 不确定命令 → `gerrit help <cmd>`（未装则 `npx -y @cloudglab/gerrit-cli@latest help <cmd>`）
- URL → 提取 change number 或 Change-Id，再映射命令
- HEAD commit 有 Change-Id → `show` / `diff` 等可不传参
- 缺参数时先查 `reference/<场景>.md`，再 `gerrit help <cmd>` 校对

## 写保护

- 缺 `--confirm` → 输出 preview，不执行（返回 `{ ok: false, preview: true, reason, action, payload }`）
- `GERRIT_DISABLE_WRITE=true` → 完全禁用（严格判定，仅 `true` 生效）
- 错误统一格式：`code` / `recoverable` / `statusCode` / `hint`

## Reference 路由

| 场景 | 文档 |
| --- | --- |
| 日常开发 | `reference/daily.md` |
| 审查 | `reference/review.md` |
| CI 构建 | `reference/ci.md` |
| 工作区 / worktree | `reference/workspace.md` |
| 全量命令速查 | `reference/cheatsheet.md` |
| 典型组合 | `reference/scenarios.md` |
| 路由入口 | `reference/index.md` |

## 角色入口

| 入口 | 范围 |
|------|------|
| `gerrit` / `gerrit-cli` | 全部 57 个命令 |
| `gerrit-dev` | 开发者向（提交 / 查看 / checkout / rebase） |
| `gerrit-reviewer` | 审查向（incoming / diff / comments / vote） |
| `gerrit-lead` | 团队管理（reviewer 管理 / 组） |
| `gerrit-ci` | CI 向（build-status / failures / extract-url） |

## 环境变量

```bash
export GERRIT_HOST="https://gerrit.example.com"   # 完整 URL，含 https://
export GERRIT_USERNAME="your-username"
export GERRIT_PASSWORD="your-http-password"
export GERRIT_DISABLE_WRITE=true                  # 完全禁用写操作（仅严格 'true' 生效）
export GERRIT_RETRIGGER_COMMENT="retrigger"        # retrigger 评语模板
```

`setup` 写入 `~/.gerrit-cli/config.json`，不在环境变量存密码。

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
