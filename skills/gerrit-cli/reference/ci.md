# CI 构建状态命令

适合持续集成 / Jenkins / 流水线场景。从 Gerrit change messages / comments 抽取构建链接，触发重跑，提取失败原因。

## 读

- `build-status [id] [--watch] [--exit-status] [--interval <s>] [--timeout <s>]` — 构建状态
  - `--watch` 阻塞到完成（类似 `gh run watch`）。
  - `--exit-status` 失败时退出码非 0，便于 CI 串联。
  - `--interval` 轮询间隔（默认 10 秒）。
  - `--timeout` 最大等待（默认 1800 秒）。
- `failures <id>` — 拿最近 Jenkins 失败链接
- `extract-url <pattern> [id]` — 从消息/评论中抽 URL
  - 常用 pattern：`jenkins` / `console` / `pipeline` / `BUILD_URL`
- `analyze [--start-date YYYY-MM-DD] [--end-date YYYY-MM-DD] [--repo <p>] [--markdown|--csv|--json] [--output <f>]` — 个人贡献分析
- `install-hook` — 装 commit-msg hook（自动生成 Change-Id，让 CI 关联构建）

## 写

- `retrigger [id] --confirm` — 发 retrigger 评语触发 CI
  - 评语模板可由 `GERRIT_RETRIGGER_COMMENT` 覆盖（默认 `retrigger`）。
  - `[id]` 缺省取 HEAD Change-Id。

## 典型用法

### 看构建结果

```bash
gerrit build-status 12345
```

### 阻塞等待构建完成

```bash
gerrit build-status 12345 --watch --exit-status
```

### 拿 Jenkins 失败链接

```bash
gerrit failures 12345
```

### 抽 URL

```bash
gerrit extract-url "jenkins" 12345
```

### 重跑 CI

```bash
gerrit retrigger 12345 --confirm
```

## 在 CI 脚本里用

```bash
# 阻塞到构建完成；失败时让 CI 任务退出非 0
gerrit build-status "$CHANGE_ID" --watch --exit-status

# 抽 Jenkins 链接给日志
JENKINS_URL=$(gerrit extract-url "jenkins" "$CHANGE_ID" | tail -1)
echo "Jenkins: $JENKINS_URL"
```
