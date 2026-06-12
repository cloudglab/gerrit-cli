# 辅助命令盘点与路线图

## 盘点方法

对比三个来源：
1. `zentao-cli` 的辅助命令集（`install`/`update`/`whoami`/`list`/`help`/`version`/`doctor`/`completion`）
2. 老 `opensource/gerrit-cli` 的工作流命令（`web`/`squad`/`topic`/`up`/`draft`/`ninja`/`clean`/`completion`）
3. 当前 `gerrit-cli` 已有辅助命令（`setup`/`config`/`status`/`version`/`completion`/`clean`/`open`/`init`/`install-hook`）

## 盘点结果

### ✅ 已有且完工的辅助命令

| 命令 | 状态 | 说明 |
|------|------|------|
| `setup` | ✅ 已实现 | 交互式配置引导 |
| `config show/test` | ✅ 已实现 | 配置查看/测试连接（R16 增强） |
| `status` | ✅ 已实现 | 连接状态检查 |
| `version` | ✅ 已实现 | 版本号输出 |
| `completion` | ✅ 已实现 | bash/zsh/fish 补全生成 |
| `clean` | ✅ 已实现 | 清理已合并分支 |
| `open` | ✅ 已实现 | 浏览器打开 change |
| `init` | ✅ 已实现 | 初始化仓库配置 |
| `install-hook` | ✅ 已实现 | 安装 commit-msg hook |

### ⚠️ 已设计但未实现

| 命令 | 设计文档 | 优先级 |
|------|----------|--------|
| `install` | ADR-0024, install-update-chain.md | 高 |
| `update` | ADR-0024, install-update-chain.md | 高 |
| `whoami` | whoami-doctor.md | 高 |
| `doctor` | whoami-doctor.md | 中 |
| `update-probe` | ADR-0026, 已实现 | ✅ |

### ❌ 未覆盖

| 命令 | 参考来源 | 评估 |
|------|----------|------|
| `list`（独立版） | gerrit-cli 已有 `list` 作为 `mine` 别名 | 现状可接受 |
| `web` | 老 gerrit-cli | 已有 `open`，等同 |
| `squad`（审查人预设组） | 老 gerrit-cli | 低优先级，Gerrit 已有 group 机制 |
| `help`（独立命令） | Commander 内置 | 现状可接受 |
| `draft`（推送草稿） | 老 gerrit-cli | `push --wip` 已等同 |
| `ninja`（推送+合入） | 老 gerrit-cli | 低优先级，可脚本组合 |
| `up`（推送别名） | 老 gerrit-cli | `push` 已等同 |
| `install --skill-source` | zentao-cli | 中优先级，Skill 安装引导 |

## `list` 命令评估

### 当前状态

`list` 是 `mine` 的别名。执行 `gerrit-cli list` 等同于 `gerrit-cli mine`，列出自己的 open changes。

### 评估结论

**建议保持现状**。理由：
- `mine` 语义更清晰（"我的变更"）
- `incoming` 语义也清晰（"待我审查的"）
- `list` 不需要额外独立行为，增加维护成本
- 如果需要通用列表，用 `search` 更灵活

## `whoami` 命令实现要点

### 最小可行实现

```bash
gerrit-cli whoami
# 输出：
# Logged in as: john.doe (John Doe <john@example.com>)
# Host:        https://gerrit.example.com
# Config:      ~/.gerrit-cli/config.json
```

### 实现步骤

1. 创建 `src/cli/commands/whoami.ts`
2. 调用 `GET /a/accounts/self` 获取账户信息
3. 读取配置显示 host 和来源
4. 支持 `--json` / `--xml` / `--plain`
5. 注册到 `register-commands.ts`
6. 测试：正常路径、401、网络错误、JSON/XML 输出

### 依赖

- `GerritApiService`（已有 `testConnection` 类似调用可用）
- `ConfigService`（已有）

## `doctor` 命令实现要点

### 最小可行实现

9 维诊断：Runtime（Bun 版本 + 路径）、Git（git 可用 + 仓库 + hook）、Config（文件 + 环境变量 + 格式）、Network（HTTPS + 连通性 + 认证）。

### 实现步骤

1. 创建 `src/cli/commands/doctor.ts`
2. 每项检查返回 `{ name, status: 'pass'|'fail'|'skip', detail }`
3. 汇总输出，✓ 绿色 / ✗ 红色
4. 支持 `--json` / `--xml` / `--skip-network`
5. 注册到 `register-commands.ts`
6. 测试

### 优先级

`whoami` 高于 `doctor`。`doctor` 可在 `whoami` 完成后做。

## workflow 宏命令评估

### 候选宏命令

| 宏命令 | 组合 | 评估 |
|--------|------|------|
| `review-flow <id>` | `show`→`diff`→`comments`→`reviewers` | 4 步串联，有价值 |
| `submit-flow <id>` | 检查可合入→`submit`→验证结果 | 两步，价值一般 |
| `ci-flow <id>` | `build-status --watch`→`extract-url` | 两步，价值一般 |

### 评估结论

**不建议实现独立宏命令**。理由：
- 每个工作流只有 2-4 步，用户/AI 组合命令更灵活
- 宏命令增加维护面（参数传递、错误处理、输出一致性）
- 在 Skill 的 "Natural Language Routing" 中记录组合模式即可

## completion 再深化

### 当前状态

`gerrit-cli completion bash/zsh/fish` 生成补全脚本，支持子命令补全（如 `tree setup`）。

### 可增强点

1. 参数值补全（如 `--branch` 补全本地分支名）
2. 动态补全（如 change-id 从 `mine --json` 获取）
3. 枚举值补全（如 `--status` 的 open/merged/abandoned）

### 优先级

低。当前补全已覆盖命令和子命令层级。值补全在 Skill/Agent 场景下价值有限（Agent 不会用 shell 补全）。

## 输出模板统一

### 当前输出模式

不同命令的输出格式不完全一致：

| 命令 | 文本输出 | JSON 输出 | XML 输出 |
|------|----------|-----------|----------|
| `show` | 结构化文本 | 完整 JSON | 完整 XML |
| `mine` | 表格 | JSON 数组 | XML 文档 |
| `config show` | 键值对 | 单对象 JSON | 扁平 XML |

### 统一建议

1. 文本输出：遵循 `标题 → 分隔线 → 内容 → 分隔线 → 提示` 格式
2. JSON 输出：顶层统一包含 `status` 字段（`success`/`error`）
3. XML 输出：根元素统一为 `<gerrit_response>`，包含 `<status>` 子元素
4. 错误输出：JSON/XML 模式也输出结构化错误，不只是文本

### 优先级

中。不是阻塞性问题，但影响 SDK 和脚本消费体验。建议在下一个大版本中统一。

## 命令示例库建设

### 当前状态

- `EXAMPLES.md`：SDK 程序化调用示例（TypeScript 代码）
- `skills/gerrit-workflow/examples.md`：角色化场景示例（R29 完成）
- README：日常场景示例

### 建议

三处示例已覆盖不同受众，不需要新建独立的命令示例库。维护好现有三处即可。

## 辅助命令路线图

```
Phase 4a (当前): whoami 实现
  └── R33: 实现 whoami 命令

Phase 4b (下一批): install/update 实现
  └── R11: 实现 install 命令
  └── R12: 实现 update 命令

Phase 4c (后续): doctor 实现
  └── R34: 实现 doctor 命令

Phase 4d (远期): 体验优化
  └── R37: completion 值补全
  └── R38: 输出模板统一
```

## 与 zentao-cli 对比总结

| 维度 | zentao-cli | gerrit-cli（当前） | gerrit-cli（目标） |
|------|-----------|-------------------|-------------------|
| install | ✅ 一键安装 | ⚠️ 设计完成 | 实现 |
| update | ✅ 自举升级 | ⚠️ 设计完成 | 实现 |
| update-probe | ✅ 每日探针 | ✅ 已实现 R13 | — |
| whoami | ✅ | ⚠️ 设计完成 | 实现 |
| doctor | ❌ 没有 | ⚠️ 设计完成 | 实现 |
| list | ✅ 命令清单 | ✅ mine 别名 | 保持 |
| help | ✅ 手写 | ✅ Commander | 保持 |
| completion | ❌ | ✅ bash/zsh/fish | 增强 |
| 角色别名 | ✅ dev/qa/pm 多二进制 | ❌ | 评估后定 |
| 页名快捷 | ✅ URL 解析 | N/A | N/A |
