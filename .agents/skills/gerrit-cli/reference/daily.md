# 日常开发命令

适合代码提交、查看、配置、自检的常用命令。所有命令缺省返回纯文本，`--json` / `--xml` 用于脚本消费。

## 列出与搜索

- `mine [--status open|merged|abandoned] [--limit <n>] [--detailed] [--reviewer]` — 我的 open 变更（默认 limit 25）
- `list [--status open|merged|abandoned] [--limit <n>] [--detailed] [--reviewer]` — 通用列表
- `search [<query>] [--limit <n>]` — Gerrit 查询语法，如 `search "status:open owner:me reviewer:me"`
- `projects [--pattern <regex>]` — 项目列表（按名字排序）
- `files [id]` — 变更文件清单，缺省取 HEAD Change-Id
- `open <id>` — 浏览器打开变更（用 `GERRIT_HOST` + change number 拼 URL）

## 查看单个变更

- `show [id]` — 变更详情（含 diff、评论、消息），缺省取 HEAD Change-Id
- `diff <id> [--file <f>] [--files-only] [--format unified|json|files]` — 仅 diff；`--files-only` 只列文件
- `topic [id] [<new-topic>] [--delete]` — 读 / 改 / 清 topic

## 配置

- `setup` / `init` — 交互式写入 `~/.gerrit-cli/config.json`
- `config show` — 当前配置（密码脱敏）
- `config test` — 用当前配置测一次连接
- `whoami` — 当前账号 / 认证状态
- `status` — 连接状态简报
- `doctor` — 本地配置 / 连接 / git remote / commit-msg hook / HEAD Change-Id 体检
- `install-hook [--force]` — 装 commit-msg hook（自动生成 Change-Id）

## 报告

- `report [period] [--period daily|weekly|monthly|quarterly] [--since YYYY-MM-DD] [--until YYYY-MM-DD] [--status merged|open|abandoned|all] [--reviewer] [--user <name>] [--limit <n>] [--md] [--json] [--xml]` — 周期报告
- `daily` / `weekly` / `monthly` / `quarterly` — `report --period <p>` 的别名
- `analyze [--start-date YYYY-MM-DD] [--end-date YYYY-MM-DD] [--repo <p>] [--markdown|--csv|--json] [--output <f>]` — 个人贡献分析

## 辅助

- `version` — 版本信息
- `completion <bash|zsh|fish>` — 生成 shell 补全脚本

## Change-Id 解析

`show` / `diff` / `topic` / `rebase` / `extract-url` / `comments` / `vote` / `build-status` / `retrigger` / `abandon` / `restore` / `set-ready` / `set-wip` / `submit` 在未传 change-id 时，自动从 HEAD commit message 里的 `Change-Id: Ixxxx` footer 推断。

## URL → 命令

| URL 形态 | 命令 |
| --- | --- |
| `/c/<project>/+/<changeNumber>` | `show <changeNumber>` |
| `/q/<query>` | `search "<query>"` |
| `/admin/projects/<name>` | `projects --pattern <name>` |
