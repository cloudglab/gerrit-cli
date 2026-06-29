# 审查命令

适合 reviewer 日常使用：看 diff / 评论 / 投票 / 加 CC。所有写操作必须 `--confirm`。

## 读

- `show [id]` — 变更详情（带 diff / 评论 / 消息）
- `diff <id> [--file <f>] [--format unified|json|files] [--base <revision>]` — 单变更 diff
- `comments <id>` — 全部评论（带 diff 上下文）
- `reviewers [id]` — 审查人 / CC 列表，缺省取 HEAD
- `incoming` — 待我审查 / CC 列表
- `team` — 同 `incoming`（别名）
- `mine` — 我的 open 变更
- `analyze [--start-date YYYY-MM-DD] [--end-date YYYY-MM-DD] [--reviewer]` — 按 review 视角统计

## 写

- `comment <id> -m "..." [--file <f> --line <n>] [--reply-to <id>] [--unresolved] [--batch] --confirm` — 发评论
  - 从 stdin 读 message / JSON 数组。
  - `--batch` 时 stdin 必须是 JSON 数组。
- `vote <id> [--code-review -2..2] [--verified -1..1] [--label <k> <v>] [-m "..."] --confirm` — 投票
- `review <id> [-m "..."] [--no-submit] [--no-verified] --confirm` — 一键走“无问题”路径：投票 + 评论 + 可选 submit
- `review <id> --reject --file <path> --line <n> -m "..." --confirm` — 一键走“严重问题”路径：仅留行级 reject 评论，不投票不 submit
- `add-reviewer <email...> -c <id> [--cc] [--group] [--notify none|owner|owner_reviewers|all] --confirm` — 加审查人 / CC / 组
- `remove-reviewer <email...> -c <id> [--notify none|owner|owner_reviewers|all] --confirm` — 移除

## 评论参数

| 参数 | 作用 |
| --- | --- |
| `-m <text>` | 评论正文 |
| `--file <path>` | 关联文件 |
| `--line <n>` | 关联行号（指新版本行号） |
| `--range <start>-<end>` | 关联行范围 |
| `--reply-to <id>` | 回复某条评论（标记已解决） |
| `--unresolved` | 保留未解决状态 |
| `--batch` | 从 stdin 读 JSON 数组批量发 |

## 投票标签

Gerrit 内置常用标签：

- `Code-Review`：`-2` 到 `+2`
- `Verified`：`-1` 到 `+1`

自定义 label 通过 `--label <name> <value>` 传入，例如 `--label QA-Review 1`。

## 写保护

- 写操作缺 `--confirm` → 返回 preview。
- `GERRIT_DISABLE_WRITE=true` → 完全禁用（仅严格 `'true'`）。
- 错误统一格式：`code` / `recoverable` / `statusCode` / `hint`。
