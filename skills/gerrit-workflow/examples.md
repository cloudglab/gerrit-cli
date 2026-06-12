# gerrit-cli 场景式示例

按角色组织的真实工作流示例，覆盖 dev / reviewer / lead / automation 四类场景。

## 场景命中链路

Skill/Agent 处理自然语言请求的固定路由：

`用户表达 → 角色识别 → 命令选择 → 参数补全 → 执行 → 输出`

---

## 开发者（dev）场景

### 日常推送

```bash
# 写代码，提交，推送
git add src/app.ts
git commit -m "feat: add login page"
gerrit-cli push -t auth-feature -r alice@example.com

# 推送 WIP（不通知审查人）
gerrit-cli push --wip
```

### 工作区隔离

```bash
# 检出变更到本地测试（不影响当前分支）
gerrit-cli checkout 12345

# 创建工作树（完全隔离的 workspace）
gerrit-cli tree setup 12345
cd .gerrit-cli/12345
git diff
gerrit-cli tree cleanup 12345
```

### 管理自己的变更

```bash
# 列出所有变更
gerrit-cli mine

# 丢弃不需要的
gerrit-cli abandon 12345 -m "No longer needed"

# 恢复误丢弃的
gerrit-cli restore 12345

# 重基过期的变更
gerrit-cli rebase 12345

# 标记就绪（取消 WIP）
gerrit-cli set-ready 12345 -m "Ready for review"
```

### 查看 CI 结果

```bash
# 等当前分支的 CI 跑完
gerrit-cli build-status --watch --exit-status

# 提取构建链接
gerrit-cli extract-url "jenkins" | tail -1

# 重跑 CI
gerrit-cli retrigger 12345
```

### Cherry-Pick

```bash
# 把某个 change 拣选到当前分支
gerrit-cli cherry 12345
gerrit-cli cherry 12345/3              # 指定 patchset
gerrit-cli cherry https://gerrit.example.com/c/project/+/12345
```

### 安装 Hook

```bash
gerrit-cli install-hook                # 安装 commit-msg hook
gerrit-cli install-hook --force        # 强制覆盖
```

---

## 审查者（reviewer）场景

### 审查队列概览

```bash
# 待审查列表
gerrit-cli incoming
gerrit-cli team

# 按项目过滤
gerrit-cli incoming --filter "project:canvas-lms"

# 结构化输出
gerrit-cli incoming --json | jq '.[].change_number'
```

### 深入审查单个变更

```bash
# 1. 先看概览
gerrit-cli show 12345

# 2. 看文件清单
gerrit-cli files 12345

# 3. 看完整 diff
gerrit-cli diff 12345

# 4. 看已有评论
gerrit-cli comments 12345

# 5. 看审查人
gerrit-cli reviewers 12345
```

### 发表审查意见

```bash
# 总评评论
gerrit-cli comment 12345 -m "LGTM, just one nit about error handling"

# 行评论
gerrit-cli comment 12345 --file src/app.ts --line 42 -m "Consider using const"

# 标记未解决
gerrit-cli comment 12345 --file src/api.ts --line 100 -m "Security concern" --unresolved

# 管道输入
echo "Overall review: good work, please add tests" | gerrit-cli comment 12345
```

### 投票

```bash
# Code-Review +2（批准）
gerrit-cli vote 12345 --code-review 2 -m "Approved"

# Code-Review -1（拒绝）
gerrit-cli vote 12345 --code-review -1 -m "Needs major rework"

# Verified +1
gerrit-cli vote 12345 --verified 1

# 自定义标签
gerrit-cli vote 12345 --label "API-Review" 2
```

### 批量评论（管道）

```bash
# JSON 数组输入，一次发布多条行评论
echo '[
  {"file": "src/app.ts", "line": 10, "message": "Add type annotation"},
  {"file": "src/utils.ts", "line": 25, "message": "Extract to constant"},
  {"file": "src/api.ts", "line": 100, "message": "Handle error", "unresolved": true}
]' | gerrit-cli comment 12345 --batch
```

### 批量审查脚本

```bash
#!/bin/bash
# 逐个审查 incoming 列表中的变更
gerrit-cli incoming --json | jq -r '.[].change_number' | while read id; do
  echo "=== Reviewing $id ==="
  gerrit-cli show $id --xml | head -20
  # 决定是否继续...
done
```

---

## 团队 Lead（lead）场景

### 分配审查人

```bash
# 加审查人
gerrit-cli add-reviewer alice@example.com bob@example.com -c 12345

# 加组
gerrit-cli add-reviewer --group frontend-reviewers -c 12345

# 加 CC（知会但不要求审查）
gerrit-cli add-reviewer --cc manager@example.com -c 12345

# 静默添加（不发邮件）
gerrit-cli add-reviewer --notify none user@example.com -c 12345

# 移除审查人
gerrit-cli remove-reviewer user@example.com -c 12345
```

### 组管理

```bash
# 组列表
gerrit-cli groups
gerrit-cli groups --pattern "^team-.*"
gerrit-cli groups --owned

# 看组里有哪些人
gerrit-cli groups-show frontend-reviewers
gerrit-cli groups-members frontend-reviewers
```

### 团队进度跟踪

```bash
# 团队变更列表
gerrit-cli team

# 搜索某人的 open changes
gerrit-cli search "owner:alice status:open"

# 搜索等待审查的
gerrit-cli search "status:open -is:wip -label:Code-Review+2"

# 分析团队近期合并情况
gerrit-cli analyze --start-date 2026-01-01
```

### 项目层面

```bash
# 项目列表
gerrit-cli projects

# 按模式过滤
gerrit-cli projects --pattern "^canvas-.*"
```

---

## CI / 自动化（automation）场景

### CI 管线集成

```bash
# 轮询构建直到完成，失败时非零退出
gerrit-cli build-status --watch --exit-status

# 自定义轮询间隔和超时
gerrit-cli build-status 12345 --watch --interval 5 --timeout 3600

# CI 脚本中的典型用法
gerrit-cli build-status --watch --exit-status && deploy.sh || notify-failure.sh
```

### URL 提取与管线组合

```bash
# 提取最新的 Jenkins 构建链接
JENKINS_URL=$(gerrit-cli extract-url "jenkins.inst-ci.net" | tail -1)

# 提取构建摘要链接
BUILD_URL=$(gerrit-cli extract-url "build-summary-report" 12345 | tail -1)

# 正则提取
gerrit-cli extract-url "job/[^/]+/job/[^/]+/\d+/$" --regex
```

### 脚本化搜索

```bash
# 找所有 WIP 变更
gerrit-cli search "is:wip" --json | jq -r '.[] | "\(.change_number) \(.subject)"'

# 找某项目最近一周 merged
gerrit-cli search "project:my-project status:merged age:7d" -n 50 --json

# 找出等待 CI 验证的变更
gerrit-cli search "status:open -is:wip -label:Verified+1" --json
```

### JSON/XML 管道消费

```bash
# JSON → jq 提取
gerrit-cli incoming --json | jq '.[] | {id: .change_number, subject: .subject, owner: .owner.name}'

# XML → LLM 消费
gerrit-cli show 12345 --xml | llm "Summarize this change"

# JSON → 脚本变量
CHANGE_ID=$(gerrit-cli mine --json | jq -r '.[0].change_number')
```

### AI 集成

```bash
# AI 审查变更
gerrit-cli diff 12345 | llm "Review this code. Point out issues."

# AI 生成评论后发布
llm "Give me inline comments for change 12345" | gerrit-cli comment 12345 --batch

# AI 总结审查状态
gerrit-cli show 12345 --xml | llm "Summarize the review status and highlight blockers"
```

### 非交互脚本环境

```bash
export GERRIT_HOST="https://gerrit.example.com"
export GERRIT_USERNAME="ci-bot"
export GERRIT_PASSWORD="$GERRIT_TOKEN"
export GERRIT_SKIP_UPDATE_CHECK=true

gerrit-cli build-status --watch --exit-status --json
```

---

## 其他场景

### 搜索技巧

```bash
gerrit-cli search "owner:self status:open"
gerrit-cli search "project:my-project branch:main status:open"
gerrit-cli search "status:merged after:2026-01-01" -n 100
gerrit-cli search "reviewer:self status:open"
```

### 工作树操作

```bash
gerrit-cli workspace create 12345       # 创建一个工作树
gerrit-cli trees                        # 查看所有工作树
```

### 配置诊断

```bash
gerrit-cli status                       # 连接状态
gerrit-cli config show                  # 显示配置
gerrit-cli config test                  # 测试连接
gerrit-cli setup                        # 交互式配置
gerrit-cli clean --dry-run              # 预览清理已合并分支
```

### Shell 别名

```bash
alias gm='gerrit-cli mine'
alias gi='gerrit-cli incoming'
alias gt='gerrit-cli team'
alias gs='gerrit-cli show'
alias gd='gerrit-cli diff'
alias gc='gerrit-cli comment'
alias gp='gerrit-cli push'

# CI 等待
gbuild() {
  gerrit-cli build-status --watch --exit-status && \
    gerrit-cli extract-url "build-summary-report" | tail -1
}
```
