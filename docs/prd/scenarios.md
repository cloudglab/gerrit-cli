# 场景命中链路

## 设计原则

Skill / Agent 收到自然语言请求后，按“场景 → 命令 → 参数 → 执行”的固定链路路由。

链路要求：
1. 每个场景有明确的触发词（用户表达）。
2. 每个场景有明确的命令和参数模板。
3. 缺参时有固定追问策略。
4. 失败时有固定回退路径。

## 场景链路模型

```
用户表达 → 场景匹配 → 命令选择 → 缺参检查 → 追问/补参 → 执行 → 输出格式化
```

## 场景索引

### 1. 我的变更（开发者视角）

| 用户表达 | 命令 | 追加行为 |
|----------|------|----------|
| "我有哪些变更" | `mine` | 默认终端列表 |
| "我的 open list" | `mine` | 默认终端列表 |
| "查看我的变更" | `mine` | |
| "我有哪些 open 的 change" | `mine` | `--json` 可选 |
| "给我看看 mine" | `mine` | |
| "今天我的变更有哪些" | `mine` | 无时间筛选，全量 |

缺参：无必需参数，直接执行。

### 2. 查看变更详情

| 用户表达 | 命令 | 追加行为 |
|----------|------|----------|
| "查看 12345" | `show 12345` | |
| "show 当前分支的 change" | `show` | 自动检测 HEAD Change-Id |
| "这个 change 的详情" | `show` | 自动检测 |
| "查看 Iabc123... 的详情" | `show Iabc123...` | |
| "12345 的状态" | `show 12345` | |

缺参：如无 change id 参数，自动检测 HEAD commit 的 Change-Id footer。

### 3. 审查流程

| 用户表达 | 命令 | 追加行为 |
|----------|------|----------|
| "待审查列表" | `incoming` | |
| "有哪些 incoming" | `incoming` | |
| "我有哪些要 review 的" | `incoming` | |
| "帮我 review 12345" | `show 12345` + `diff 12345` + `comments 12345` | 多步串联 |
| "看 12345 的 diff" | `diff 12345` | |
| "12345 的文件改动" | `diff 12345 --files-only` | |
| "给 12345 评论 LGTM" | `comment 12345 -m "LGTM"` | |
| "给 12345 打分 +2" | `vote 12345 --code-review 2` | |
| "12345 有多少条评论" | `comments 12345` | |
| "12345 有哪些审查人" | `reviewers 12345` | |
| "给 12345 加审查人 alice" | `add-reviewer alice -c 12345` | |

缺参（comment）：`-m` 和 stdin 都没有时，可能需要追问或引导 `--help`。

### 4. CI 构建

| 用户表达 | 命令 | 追加行为 |
|----------|------|----------|
| "12345 构建成功了吗" | `build-status 12345` | |
| "当前分支的构建状态" | `build-status` | 自动检测 |
| "watch 到构建完成" | `build-status --watch` | |
| "等构建完成然后部署" | `build-status --watch --exit-status && deploy.sh` | 脚本链 |
| "找 Jenkins URL" | `extract-url "jenkins"` | |
| "提取构建链接" | `extract-url "build-summary"` | `| tail -1` |

### 5. 变更生命周期

| 用户表达 | 命令 | 追加行为 |
|----------|------|----------|
| "推送变更" | `push` | |
| "推到 Gerrit" | `push` | |
| "推到 topic X" | `push -t X` | |
| "放弃 12345" | `abandon 12345` | |
| "恢复 12345" | `restore 12345` | |
| "合入 12345" | `submit 12345` | |
| "重基 12345" | `rebase 12345` | |
| "检出 12345" | `checkout 12345` | |
| "标记 12345 为 WIP" | `set-wip 12345` | |
| "标记 12345 就绪" | `set-ready 12345` | |

### 6. 搜索与过滤

| 用户表达 | 命令 | 追加行为 |
|----------|------|----------|
| "搜索某某项目的变更" | `search "project:xxx"` | |
| "找 project X 的 open changes" | `search "project:X status:open"` | |
| "最近一周 merged 的" | `search "status:merged age:7d"` | |
| "alice 的 open changes" | `search "owner:alice status:open"` | |
| "列一下项目列表" | `projects` | |

### 7. 组管理

| 用户表达 | 命令 | 追加行为 |
|----------|------|----------|
| "有哪些组" | `groups` | |
| "project-reviewers 组有哪些人" | `groups-members project-reviewers` | |
| "administrators 组的详情" | `groups-show administrators` | |

### 8. 配置与诊断

| 用户表达 | 命令 | 追加行为 |
|----------|------|----------|
| "初始化 gerrit 配置" | `setup` | |
| "我的 Gerrit 连接正常吗" | `status` | |
| "看看当前配置" | `config show` | |
| "测试配置" | `config test` | |
| "安装 hook" | `install-hook` | |
| "清理已合并分支" | `clean --dry-run` | 先 dry-run |

### 9. LLM/AI 集成

| 用户表达 | 命令 | 追加行为 |
|----------|------|----------|
| "AI 审查 12345" | `diff 12345 | llm "Review this"` | 管道 |
| "让 AI 给建议评论" | `show 12345 | llm "Post inline comments"` | |
| "总结 12345 的审查状态" | `show 12345 \| llm "Summarize"` | |

### 10. 批量操作

| 用户表达 | 命令 | 追加行为 |
|----------|------|----------|
| "批量评论 12345" | `comment 12345 --batch` | stdin JSON |
| "批量加审查人" | `add-reviewer a b c -c 12345` | |

## 补充策略

### 缺参追问模版

当关键参数缺失时，Agent 按以下优先级追问：

1. 能从 git 上下文推断的，自动补全（如 HEAD Change-Id）。
2. 能从之前命令输出推断的，自动补全（如从 `mine` 结果中选 change id）。
3. 无法推断的，用最小追问获取缺失参数。

### 错误回退

1. 认证失败：提示重新 `setup` 或检查环境变量。
2. 网络错误：重试一次，两次失败后报告网络阻塞。
3. 404/不存在：确认 change id 是否正确，提示搜索。
4. 403/权限不足：提示检查账号权限。

### 输出格式化偏好

- 人类对话：默认纯文本。
- Agent 内部决策：使用 `--json` 或 `--xml` 获取结构化数据。
- 管线消费：默认 `--json`，用 `jq` 提取字段。
