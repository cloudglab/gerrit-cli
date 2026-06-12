# ADR-0025: 角色多入口设计

## 状态

提议 (Proposed)

## 日期

2026-06-12

## 背景

zentao-cli 通过多二进制入口（`zentao-dev`, `zentao-qa`, `zentao-pm`）和 `--role` 参数实现角色过滤：

```json
{
  "bin": {
    "zentao": "dist/bin/zentao.js",
    "zentao-dev": "dist/bin/zentao-dev.js",
    "zentao-qa": "dist/bin/zentao-qa.js",
    "zentao-pm": "dist/bin/zentao-pm.js"
  }
}
```

当前 gerrit-cli 只有单一入口 `gerrit-cli`，所有 50 个子命令对所有人可见。不同角色用户（开发者、审查者、CI 工程师）面临不同的认知负担。

## 决策

采用分阶段策略：

### 阶段 1：文档定义（本轮）

在 `docs/prd/roles.md` 中定义角色和命令映射，不改变 CLI 入口。Skill 和 Agent 通过文档约定按角色路由命令。

### 阶段 2：`--role` 参数（后续）

```bash
gerrit-cli --role reviewer incoming
gerrit-cli --role dev mine
```

在 `runCli()` 中解析 `--role` 参数，按角色过滤 help 输出和可用命令。不改变服务端权限。

### 阶段 3：多二进制入口（按需评估）

如阶段 2 反馈良好且用户有别名需求，再决定是否实现多二进制入口：

```json
{
  "bin": {
    "gerrit-cli": "./bin/gerrit-cli",
    "gerrit-dev": "./bin/gerrit-dev",
    "gerrit-reviewer": "./bin/gerrit-reviewer"
  }
}
```

不直接跳到阶段 3，原因：
1. gerrit-cli 是 Bun 源码直跑模式，多二进制需要额外维护
2. zentao-cli 的多角色切分基于禅道明显的 QA/PM/Dev 角色边界，Gerrit 场景的角色边界较模糊
3. 先用 `--role` 参数验证需求再投入

## 角色定义

详见 `docs/prd/roles.md`。核心四个角色：

- **dev**：写代码、推送变更、管理自己的 change
- **reviewer**：批量审查、打分、评论
- **lead**：分配审查人、组管理、团队跟踪
- **ci**：CI 管线、脚本集成、结构化输出

## 后果

### 正面

- 降低不同角色用户的认知负担
- 为 Skill/Agent 提供更精准的命令路由
- 与 zentao-cli 的角色设计理念对齐

### 负面

- `--role` 实现需要修改命令注册逻辑
- 角色边界可能不够清晰（部分命令如 `show` 所有角色都需要）

### 风险缓解

- `full` 角色暴露所有命令，作为兜底
- 角色过滤是客户端行为，不影响 Gerrit 服务端权限

## 参考资料

- zentao-cli `src/cli.ts` — `--role` 参数解析和过滤逻辑
- zentao-cli `src/bin/` — 多二进制入口实现
- zentao-cli AGENTS.md — 角色入口说明
