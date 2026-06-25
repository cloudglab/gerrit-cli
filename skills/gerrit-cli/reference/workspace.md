# 工作区 / worktree 命令

适合多分支并行开发、worktree 维护、变更生命周期管理。

## 检出与推送

- `checkout <id> [--detach] [--remote <name>]` — 拉取并切到变更
- `push [-b <branch>] [-t <topic>] [-r <email>...] [--cc <e>...] [--wip|--ready] [--hashtag ...] [--private] [--dry-run] --confirm` — 推送变更
- `cherry <id> [--no-commit] [--no-verify] [--remote <name>]` — 拉取并 cherry-pick

## 变更生命周期

- `rebase [id] [--base <ref>] [--allow-conflicts] --confirm` — 重基，缺省取 HEAD
- `submit <id> --confirm` — 合入
- `abandon [id] [-m "..."] --confirm` — 丢弃，无参走交互
- `restore <id> [-m "..."] --confirm` — 恢复
- `set-ready <id> [-m "..."] --confirm` — 标 ready
- `set-wip <id> [-m "..."] --confirm` — 标 WIP
- `topic [id] [<new-topic>] [--delete]` — 读 / 改 / 清 topic

## 多 worktree

- `tree setup <id>` — 基于变更建 worktree（推荐用 `gerrit worktree <id>` 替代）
- `tree cleanup [id] [--force]` — 清理（无参清全部）
- `tree rebase [--onto <branch>] [--interactive]` — 拉取并 rebase 当前 worktree
- `trees [--all]` — 列出 worktree
- `workspace <id>` — deprecated，等价 `tree setup <id>`
- `clean [-n|--dry-run] [-f|--force]` — 删已合入 upstream 的本地分支

## worktree 维护流程

```bash
# 基于变更建 worktree
gerrit tree setup 12345

# 在 worktree 里继续开发后同步远端
gerrit tree rebase

# 已合入或已丢弃的本地分支清理
gerrit clean          # dry-run 模式列出
gerrit clean -f       # 真正删除
```

## 写保护

- 写操作（`push` / `rebase` / `submit` / `abandon` / `restore` / `set-ready` / `set-wip` / `tree` / `clean`）必须 `--confirm`。
- `GERRIT_DISABLE_WRITE=true` 全部禁用。
- `topic` 在传新值或 `--delete` 时也是写操作。
