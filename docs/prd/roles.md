# 角色设计

## 设计目标

Gerrit CLI 的用户不是单一角色。不同角色对命令的关心范围不同，需要的最小暴露面也不同。角色设计的目标：

1. 降低认知负担：角色入口让用户只看到自己关心的命令子集。
2. Service Skill/Agent 路由：Agent 可根据当前用户角色选择默认命令集。
3. 不影响服务端权限：角色只过滤 CLI 暴露，不改变 Gerrit 服务端 RBAC。

## 角色定义

### dev（开发者）

**定位**：日常写代码、推送变更、管理自己的 change。

**核心命令**：
- `show` — 查看变更详情
- `mine` — 我的变更列表
- `push` — 推送变更到 Gerrit
- `checkout` — 检出变更到本地
- `rebase` / `submit` / `abandon` / `restore` — 变更生命周期
- `diff` / `files` — 查看 diff 和文件变动
- `build-status` — 检查 CI
- `topic` — 管理 topic
- `set-wip` / `set-ready` — WIP 开关

**次要命令**：
- `comment` — 回复审查意见
- `comments` — 查看评论
- `search` — 搜索变更
- `extract-url` — 提取 URL
- `status` / `version` / `setup` / `config` — 辅助

### reviewer（审查者）

**定位**：批量审查变更、打分、评论、跟踪审查队列。

**核心命令**：
- `incoming` — 待审查列表
- `show` — 查看变更详情
- `diff` — 查看 diff
- `comments` — 查看评论
- `comment` — 发布评论（支持管道输入和批量）
- `vote` — 打分
- `review` — 完整审查流程（含 AI 审查）
- `reviewers` — 查看审查人

**次要命令**：
- `search` — 搜索变更
- `add-reviewer` / `remove-reviewer` — 管理审查人
- `analyze` — 分析变更
- `checkout` — 检出测试
- `build-status` — 查看 CI 状态
- `status` / `version` / `setup` / `config` — 辅助

### lead（团队 Lead/负责人）

**定位**：分配审查人、管理组、跟踪团队变更。

**核心命令**：
- `team` — 团队变更列表
- `add-reviewer` / `remove-reviewer` — 管理审查人
- `groups` / `groups-show` / `groups-members` — 组管理
- `incoming` — 审查队列
- `search` — 高级搜索

**次要命令**：
- `show` / `diff` / `comments` / `vote` — 偶尔亲自审查
- `projects` — 项目列表
- `analyze` — 分析变更
- `status` / `version` / `setup` / `config` — 辅助

### ci（CI/自动化工程师）

**定位**：脚本化和管线集成，关注结构化输出和 exit code。

**核心命令**：
- `build-status` — CI 构建状态检查（含 `--watch --exit-status`）
- `extract-url` — 提取 Jenkins/构建 URL
- `failures` — CI 失败分析
- `retrigger` — 重新触发 CI
- `analyze` — 分析变更
- `search` — 结构化查询
- `show` — 结构化变更信息

**关键标志**：
- `--json` / `--xml` — 机器可读输出
- `--exit-status` — 非零退出码
- `--watch` — 轮询模式

**次要命令**：
- `comment` — 自动评论
- `vote` — 自动打分
- `status` / `version` / `setup` / `config` — 辅助

### full（完整能力）

**定位**：不限制，暴露全部 50 个子命令。默认角色。

## 命令-角色映射

| 命令 | dev | reviewer | lead | ci |
|------|-----|----------|------|----|
| show | ✓ | ✓ | | ✓ |
| diff | ✓ | ✓ | | |
| comments | ✓ | ✓ | | |
| search | | ✓ | ✓ | ✓ |
| list | ✓ | | | |
| comment | | ✓ | | |
| vote | | ✓ | | |
| review | | ✓ | | |
| add-reviewer | | | ✓ | |
| remove-reviewer | | | ✓ | |
| reviewers | | ✓ | ✓ | |
| mine | ✓ | | | |
| incoming | | ✓ | ✓ | |
| team | | | ✓ | |
| abandon | ✓ | | | |
| restore | ✓ | | | |
| submit | ✓ | | | |
| checkout | ✓ | | | |
| push | ✓ | | | |
| rebase | ✓ | | | |
| workspace | ✓ | | | |
| tree | ✓ | | | |
| topic | ✓ | | | |
| set-wip | ✓ | | | |
| set-ready | ✓ | | | |
| build-status | ✓ | | | ✓ |
| extract-url | | | | ✓ |
| failures | | | | ✓ |
| retrigger | | | | ✓ |
| analyze | | | | ✓ |
| files | ✓ | ✓ | | |
| groups | | | ✓ | |
| groups-show | | | ✓ | |
| groups-members | | | ✓ | |
| projects | | | ✓ | |
| setup | ✓ | ✓ | ✓ | ✓ |
| config | ✓ | ✓ | ✓ | ✓ |
| status | ✓ | ✓ | ✓ | ✓ |
| version | ✓ | ✓ | ✓ | ✓ |
| completion | ✓ | ✓ | ✓ | ✓ |
| clean | ✓ | ✓ | ✓ | ✓ |
| open | ✓ | ✓ | ✓ | ✓ |
| cherry | ✓ | | | |
| install-hook | ✓ | | | |
| init | ✓ | ✓ | ✓ | ✓ |

## 入口实现方式（待定）

### 选项 A：多二进制入口（zentao-cli 模式）

```json
{
  "bin": {
    "gerrit-cli": "./bin/gerrit-cli",
    "gerrit-dev": "./bin/gerrit-dev",
    "gerrit-reviewer": "./bin/gerrit-reviewer"
  }
}
```

优点：用户安装后直接有别名可用。缺点：增加维护面。

### 选项 B：`--role` 参数

```bash
gerrit-cli --role reviewer incoming
```

优点：实现简单，无额外二进制。缺点：用户需要记住 `--role`。

### 选项 C：`help` 页面引导 + 文档约定

不改 CLI 入口，只在文档和 Skill 里按角色组织命令。

优点：零实现成本。缺点：Agent 拿到 help 仍是全命令列表。

**建议**：先做选项 B + C 并行。选项 A 留待后续评估。

## 与 zentao-cli 的差异

zentao-cli 的角色主要是“功能过滤”：
- `qa` 只看到 Bug/测试/构建相关命令
- `pm` 只看到产品/需求/计划相关命令

gerrit-cli 的角色类似但有 Gerrit 领域特殊性：
- Gerrit 没有“测试”和“产品”的天然分界
- 更多是“工作流阶段”的差异（写代码 vs 审查 vs 管理 vs CI）
