# @cloudglab/gerrit-cli

![gerrit-cli hero](./assets/readme/gerrit-cli-hero.png)

让 Gerrit 代码审查流程进入命令行。支持查看变更、提交评论、管理审查、检查 CI 构建状态，以及直接面向 LLM 和自动化脚本输出结构化数据。

## 安装

```bash
# 安装 Bun 运行时
curl -fsSL https://bun.sh/install | bash

# 全局安装 gerrit-cli
bun install -g @cloudglab/gerrit-cli
```

## 升级

```bash
bun update -g @cloudglab/gerrit-cli
```

## 快速开始

```bash
# 初始化配置（交互式引导输入 Gerrit 地址、用户名、密码）
gerrit-cli setup

# 验证连接
gerrit-cli status
```

## 角色入口

| 入口 | 适用场景 | 核心命令 |
|------|----------|----------|
| **开发者** | 提交变更、查看状态 | `push`, `mine`, `show`, `rebase`, `checkout` |
| **审查者** | 代码审查、投票 | `incoming`, `diff`, `comments`, `comment`, `vote` |
| **CI/自动化** | 构建检查、脚本集成 | `build-status --watch`, `extract-url`, `--json`, `--xml` |
| **团队 Lead** | 分配审查、组管理 | `add-reviewer`, `groups`, `groups-members`, `team` |

> 角色不改变服务端权限，只描述常用的 CLI 命令组合。

## 日常场景

### 提交变更

```bash
git commit -m "feat: add login page"
gerrit-cli push -t my-feature -r alice@example.com
```

### 审查代码

```bash
# 查看待审查列表
gerrit-cli incoming

# 查看变更详情
gerrit-cli show 12345

# 查看 diff
gerrit-cli diff 12345

# 查看已有评论
gerrit-cli comments 12345

# 发布评论
gerrit-cli comment 12345 -m "LGTM, just one nit"

# 投票
gerrit-cli vote 12345 --code-review 2 -m "Approved"
```

### 等待 CI 构建

```bash
# 轮询直到构建完成，失败时非零退出
gerrit-cli build-status --watch --exit-status && deploy.sh

# 提取构建链接
gerrit-cli extract-url "jenkins.inst-ci.net" | tail -1
```

### 管理工作区

```bash
# 检出变更到本地测试
gerrit-cli checkout 12345

# 工作树隔离环境
gerrit-cli workspace create 12345
```

### 批量操作（管线）

```bash
# 批量发布行评论（JSON 数组 stdin）
echo '[{"file":"src/app.ts","line":42,"message":"Use const"}]' \
  | gerrit-cli comment 12345 --batch

# 批量添加审查人
gerrit-cli add-reviewer alice@example.com bob@example.com -c 12345
```

## 环境变量

```bash
export GERRIT_HOST="https://gerrit.example.com"
export GERRIT_USERNAME="your-username"
export GERRIT_PASSWORD="your-http-password"
```

配置优先级：命令行参数 > 环境变量 > `~/.gerrit-cli/config.json`

## 输出格式

大多数命令支持三种输出：

| 格式 | 标志 | 适用场景 |
|------|------|----------|
| 纯文本 | 默认 | 人类阅读 |
| JSON | `--json` | 脚本解析、jq 管道 |
| XML | `--xml` | LLM 消费（CDATA 包裹） |

## Skill / Agent 用法

本仓库包含 `skills/gerrit-workflow` 技能包，适合 AI Agent 和 IDE 插件使用。

### 安装 Skill

```bash
# 通过 Claude Code 插件系统安装
/plugin marketplace add cloudglab/gerrit-cli
/plugin install gerrit-workflow@gerrit-cli
```

### 自然语言示例

安装 Skill 后可直接用自然语言请求：

- “查看我的待审查变更”
- “审查 12345 这个 change”
- “拉出 diff 并贴出建议评论”
- “帮我 watch 当前分支的 CI 构建”

### Skill 包结构

```
skills/gerrit-workflow/
├── SKILL.md         # 主指令
├── reference.md     # 完整命令索引
└── examples.md      # 真实场景示例
```

## LLM 集成

```bash
# AI 审查当前变更
gerrit-cli diff 12345 | llm "Review this code"

# AI 生成评论并发布
llm "Review change 12345" | gerrit-cli comment 12345

# 完整变更分析
gerrit-cli show 12345 | llm "Summarize this change and review status"
```

## 进阶

- [命令速查页](https://cloudglab.github.io/gerrit-cli/) — GitHub Pages 极简速查
- [DEVELOPMENT.md](./DEVELOPMENT.md) — 开发者贡献指南
- [EXAMPLES.md](./EXAMPLES.md) — SDK 程序化调用示例
- [docs/prd/](./docs/prd/) — 产品需求文档
- [docs/adr/](./docs/adr/) — 架构决策记录

## License

MIT
