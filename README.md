# @cloudglab/gerrit-cli

![gerrit-cli hero](./assets/readme/gerrit-cli-hero.png)

让 Gerrit 代码审查流程进入命令行。支持查看变更、提交评论、管理审查、检查 CI 构建状态，以及直接面向 LLM 和自动化脚本输出结构化数据。

## 安装

```bash
npm install -g @cloudglab/gerrit-cli
```

安装完成后会打印 ASCII banner 和快速开始指引。

### 无预装方式（npx）

如果不想先全局安装，可以直接用 npx 运行：

```bash
# 首次安装（无需预装）
npx -y @cloudglab/gerrit-cli@latest install

# 更新到最新版
npx -y @cloudglab/gerrit-cli@latest update

# 卸载
npx -y @cloudglab/gerrit-cli@latest uninstall --confirm

# 直接运行任意命令
npx -y @cloudglab/gerrit-cli@latest --help
npx -y @cloudglab/gerrit-cli@latest setup
```

> `npx` 方式适合本机 CLI 已损坏或不想依赖本地旧版本时使用。

## 升级

```bash
npm update -g @cloudglab/gerrit-cli

# 或走 CLI 更新入口
gerrit update

# 或通过 npx 直接更新
npx -y @cloudglab/gerrit-cli@latest update
```

## 卸载

```bash
# 先看预览
gerrit uninstall

# 确认执行
gerrit uninstall --confirm

# 同时删除 ~/.gerrit-cli 配置目录（含凭证）
gerrit uninstall --confirm --remove-config

# 通过 npx 卸载（适合 CLI 已损坏时）
npx -y @cloudglab/gerrit-cli@latest uninstall --confirm
```

## 命令速查页

项目提供 GitHub Pages 速查页，适合复制安装、角色入口、审查链路、CI 命令和发布前 smoke：

```text
https://cloudglab.github.io/gerrit-cli/
```

页面源码位于 `docs/index.html`，由 GitHub Pages workflow 自动部署；npm 包不包含 `docs/`，只保留 CLI 入口、源码、发布脚本、README 和 CHANGELOG。

## 快速开始

```bash
# 初始化配置（交互式引导输入 Gerrit 地址、用户名、密码）
gerrit-cli setup

# 验证连接
gerrit-cli status

# 查看当前身份与配置来源
gerrit-cli whoami

# 诊断本地环境（配置、连接、git remote、commit-msg hook）
gerrit-cli doctor
```

## 角色入口

| 入口 | 适用场景 | 核心命令 |
|------|----------|----------|
| `gerrit-dev` | 提交变更、查看状态 | `push`, `mine`, `show`, `rebase`, `checkout` |
| `gerrit-reviewer` | 代码审查、投票 | `incoming`, `diff`, `comments`, `comment`, `vote` |
| `gerrit-ci` | 构建检查、脚本集成 | `build-status --watch`, `extract-url`, `--json`, `--xml` |
| `gerrit-lead` | 分配审查、组管理 | `add-reviewer`, `groups`, `groups-members`, `team` |

> 这些入口与 `gerrit-cli` 共享同一套命令，但会自动过滤为该角色常用的命令子集，减少干扰。用 `--role` 可在任意入口切换角色视角。

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

## 写保护

所有写操作（评论、投票、提交、放弃、恢复、添加/移除审查人）默认为预览模式，需要 `--confirm` 才会真正执行：

```bash
# 预览（不执行）
gerrit-cli vote 12345 --code-review 2

# 确认执行
gerrit-cli vote 12345 --code-review 2 --confirm
```

可通过 `GERRIT_DISABLE_WRITE=true` 临时禁用所有写操作。

## 输出格式

大多数命令支持三种输出：

| 格式 | 标志 | 适用场景 |
|------|------|----------|
| 纯文本 | 默认 | 人类阅读 |
| JSON | `--json` | 脚本解析、jq 管道 |
| XML | `--xml` | LLM 消费（CDATA 包裹） |

## Skill / Agent 用法

本仓库包含 `skills/gerrit-cli` 技能包，适合 AI Agent 和 IDE 插件使用。

### 安装 Skill

```bash
# 通过 Claude Code 插件系统安装
/plugin marketplace add cloudglab/gerrit-cli
/plugin install gerrit-cli@gerrit-cli
```

### 自然语言示例

安装 Skill 后可直接用自然语言请求：

- “查看我的待审查变更”
- “审查 12345 这个 change”
- “拉出 diff 并贴出建议评论”
- “帮我 watch 当前分支的 CI 构建”

### Skill 包结构

```
skills/gerrit-cli/
└── SKILL.md         # 主指令（命令索引、角色入口、场景链路、写保护说明）
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

## 发布前 smoke

```bash
# 默认只检查命令 help 面，适合 release 前无凭证环境
bun run release:smoke-query

# 如需真实 Gerrit 查询，先配置 GERRIT_*，再打开 live 模式
bun run release:smoke-query:live
```

live 模式默认只做只读查询，可用下面变量覆盖样本：

```bash
export GERRIT_SMOKE_CHANGE_ID="12345"
export GERRIT_SMOKE_QUERY="status:open"
export GERRIT_SMOKE_BUILD_KEYWORD="jenkins"
```

如果当前机器没有全局 CLI，也可以在仓库内直接运行脚本做发布前 smoke：

```bash
bun run release:smoke-query
```

## License

MIT
