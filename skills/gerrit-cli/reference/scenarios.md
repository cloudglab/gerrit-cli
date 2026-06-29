# 场景化组合

典型用户意图 → 命令组合示例。所有写操作必须传 `--confirm`。

## 1. 查一个变更的完整上下文

```bash
gerrit show 12345                  # diff + 评论 + 消息
gerrit diff 12345                  # 只 diff
gerrit comments 12345              # 全部评论
gerrit reviewers 12345             # 审查人 / CC
```

## 2. 我的变更（普通开发者）

```bash
gerrit mine                        # 我的 open
gerrit show                        # HEAD Change-Id 对应的变更
gerrit diff                        # HEAD 变更的 diff
```

## 3. 待我审查

```bash
gerrit incoming                    # reviewer / cc 列表
gerrit show 12345                  # 单个变更详情
gerrit vote 12345 --code-review 2 --confirm
```

## 4. CI 构建

```bash
gerrit build-status 12345                                # 当前状态
gerrit build-status 12345 --watch --exit-status          # 阻塞到完成
gerrit failures 12345                                    # 拿 Jenkins 失败链接
gerrit extract-url "jenkins" 12345                       # 抽 URL
gerrit retrigger 12345 --confirm                         # 重跑 CI
```

## 5. 变更生命周期

```bash
# 推送
gerrit push -b main -t feature-x --confirm

# 标 WIP
gerrit set-wip 12345 -m "still working" --confirm

# 标 ready
gerrit set-ready 12345 -m "ready for review" --confirm

# 重基
gerrit rebase 12345 --confirm

# 合入
gerrit submit 12345 --confirm

# 丢弃
gerrit abandon 12345 -m "abandoned" --confirm

# 恢复
gerrit restore 12345 -m "back to life" --confirm
```

## 6. 多 worktree 并行开发

```bash
# 基于变更建 worktree
gerrit tree setup 12345

# 在 worktree 里继续 rebase
gerrit tree rebase --onto main

# 列出所有 worktree
gerrit trees

# 清理已合入或丢弃的本地分支
gerrit clean -f
```

## 7. 报告与统计

```bash
gerrit report daily                # 个人日报
gerrit weekly                      # 周报
gerrit monthly                     # 月报
gerrit quarterly                   # 季报

# 自定义区间
gerrit report --since 2026-05-01 --until 2026-05-31 --reviewer
```

## 8. 排查问题

```bash
gerrit help <command>              # 校对参数名
gerrit list                        # 列全部命令
gerrit --version                   # CLI 版本
gerrit whoami                      # 当前登录账号
gerrit doctor                      # 本地配置 / 连接 / hook 体检
```

## 9. 角色过滤

```bash
# 完整命令集
gerrit show 12345

# 仅审查向
gerrit --role reviewer incoming

# 仅 CI 向
gerrit --role ci build-status 12345

# 仅开发者向
gerrit --role dev push
```

## 10. URL → 命令

| URL 形态 | 命令 |
| --- | --- |
| `/c/<project>/+/<changeNumber>` | `gerrit show <changeNumber>` |
| `/q/<query>` | `gerrit search "<query>"` |
| `/admin/projects/<name>` | `gerrit projects --pattern <name>` |
| `/settings/` | `gerrit setup` |

## 11. Agent 推荐链路

```text
用户表达 → 命中命令 → 缺参追问 → 执行 → 输出
```

- 如果命令使用 `--json --recommend`，优先读取返回里的 `meta.next`，直接沿用 CLI 已声明的下一步。
- `meta.next` 里的 `tool` 表示目标命令，`args` 是已预填参数，`example` 是可直接执行的命令示例。
- 只有当 `meta.next` 缺失、为空，或与当前用户意图明显不符时，再退回 Agent 自己判断下一步。

最小示例：

```json
{
  "meta": {
    "next": [
      {
        "tool": "diff",
        "args": { "changeId": "12345" },
        "example": "gerrit-cli diff 12345"
      }
    ]
  }
}
```

- "我有哪些变更" → `mine`
- "查看 12345" → `show 12345`
- "12345 的 diff" → `diff 12345`
- "给 12345 评论" → `comment 12345 -m "..."` 或管道输入
- "12345 有多少评论" → `comments 12345`
- "12345 构建成功了吗" → `build-status 12345`
- "找 Jenkins URL" → `extract-url "jenkins" 12345`
- "丢弃 12345" → `abandon 12345 --confirm`
- "合入 12345" → `submit 12345 --confirm`
