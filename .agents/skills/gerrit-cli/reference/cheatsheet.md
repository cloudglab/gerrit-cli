# 全量命令速查

> 兜底文档。CLI 注册的全部 57 个命令在此处都有名字 + 关键选项。
> 写操作示例和参数细节见对应场景文档（`daily.md` / `review.md` / `ci.md` / `workspace.md`）。

## 配置 (config)

| 命令 | 简介 | 写 |
| --- | --- | --- |
| `setup` | 交互式写入 `~/.gerrit-cli/config.json` | 否 |
| `init` | `setup` 别名 | 否 |
| `status` | 连接状态简报 | 否 |
| `config show` | 当前配置（密码脱敏） | 否 |
| `config test` | 用当前配置测一次连接 | 否 |
| `whoami` | 当前账号 / 认证状态 | 否 |
| `doctor` | 本地配置 / 连接 / git remote / commit-msg hook 体检 | 否 |

## 辅助 (utility)

| 命令 | 简介 | 写 |
| --- | --- | --- |
| `version` | 版本信息 | 否 |
| `completion` | 生成 shell 补全脚本 | 否 |
| `install` | 装 CLI + skill | 是 |
| `update` | 更新 CLI + skill | 是 |
| `upgrade` | `update` 别名 | 是 |
| `uninstall` | 卸载 CLI + skill | 是 |
| `remove` | `uninstall` 别名 | 是 |

## 审查 (review)

| 命令 | 简介 | 写 |
| --- | --- | --- |
| `show` | 变更详情（diff / 评论 / 消息） | 否 |
| `diff` | 变更 diff | 否 |
| `comments` | 全部评论 | 否 |
| `comment` | 发评论 | 是 |
| `vote` | 投票 | 是 |
| `review` | 一键 review（通过 / reject 双路径） | 是 |
| `reviewers` | 审查人 / CC 列表 | 否 |
| `add-reviewer` | 加审查人 / CC / 组 | 是 |
| `remove-reviewer` | 移除审查人 | 是 |

## 变更 (change)

| 命令 | 简介 | 写 |
| --- | --- | --- |
| `list` | 通用列表 | 否 |
| `mine` | 我的 open 变更 | 否 |
| `incoming` | 待我审查 | 否 |
| `team` | `incoming` 别名 | 否 |
| `search` | Gerrit 查询语法 | 否 |
| `projects` | 项目列表 | 否 |
| `files` | 变更文件清单 | 否 |
| `open` | 浏览器打开变更 | 否 |
| `topic` | 读 / 改 / 清 topic | 是（改 / 清时） |
| `submit` | 合入 | 是 |
| `abandon` | 丢弃 | 是 |
| `restore` | 恢复 | 是 |
| `set-ready` | 标 ready | 是 |
| `set-wip` | 标 WIP | 是 |

## 分析 (analytics)

| 命令 | 简介 | 写 |
| --- | --- | --- |
| `report` | 周期报告 | 否 |
| `daily` | 日报 | 否 |
| `weekly` | 周报 | 否 |
| `monthly` | 月报 | 否 |
| `quarterly` | 季报 | 否 |
| `analyze` | 个人贡献分析 | 否 |

## 工作区 (workspace)

| 命令 | 简介 | 写 |
| --- | --- | --- |
| `checkout` | 拉取并切到变更 | 否 |
| `push` | 推送变更 | 是 |
| `rebase` | 重基 | 是 |
| `workspace` | deprecated，用 `tree setup` | 否 |
| `tree` | worktree 子命令（setup / cleanup / rebase） | 是 |
| `trees` | 列出 worktree | 否 |
| `cherry` | cherry-pick | 否 |
| `clean` | 删已合入 upstream 的本地分支 | 是 |

## CI (ci)

| 命令 | 简介 | 写 |
| --- | --- | --- |
| `build-status` | 构建状态 | 否 |
| `failures` | 拿最近 Jenkins 失败链接 | 否 |
| `extract-url` | 从消息/评论中抽 URL | 否 |
| `retrigger` | 发 retrigger 评语触发 CI | 是 |
| `install-hook` | 装 commit-msg hook | 是 |

## 组 (groups)

| 命令 | 简介 | 写 |
| --- | --- | --- |
| `groups` | 列出组 | 否 |
| `groups-show` | 组详情 | 否 |
| `groups-members` | 组成员 | 否 |
