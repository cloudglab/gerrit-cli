# 安装与启动链路

## 设计目标

让新用户从零到可用的最小步数 ≤ 3：

1. 安装 Bun
2. 安装 gerrit-cli
3. 运行 setup

## 安装链路

### 当前状态

```
curl -fsSL https://bun.sh/install | bash
bun install -g @cloudglab/gerrit-cli
gerrit-cli setup
```

不足：
- 没有 `install` 命令做一站式引导。
- 没有 `update` 命令做平滑升级。
- 新用户不知道 `setup` 之后还要装 hook。

### 目标链路

```bash
# 一键安装（未来的 install 命令）
npx -y @cloudglab/gerrit-cli@latest install
```

`install` 命令职责：
1. 检查 Bun 版本（≥ 1.2.0）
2. 引导输入配置（如果 `~/.gerrit-cli/config.json` 不存在或 `GERRIT_HOST` 未设置）
3. 测试连接（如配置完整）
4. 安装 commit-msg hook（在当前 git 仓库或提示用户）
5. 提示 Skill 安装方式
6. 输出当前版本和可用命令

### 安装命令参数

```bash
gerrit-cli install [options]

Options:
  --skip-config-check  跳过配置校验
  --skip-hook          跳过 commit-msg hook 安装
  --force              强制覆盖已有配置
  --skill-source       Skill 安装源 (cli|npm|git)
```

## 升级链路

### 当前状态

```bash
bun update -g @cloudglab/gerrit-cli
```

不足：
- 不知道 npm 上是否有新版本。
- 升级后不知道配置是否需要迁移。

### 目标 update 命令

```bash
gerrit-cli update [options]

Options:
  --skip-config-check  跳过配置校验
  --cli-only           仅升级 CLI
  --skill-only         仅升级 Skill
```

`update` 命令职责：
1. 检查全局 CLI 版本与 npm latest 版本
2. 如有新版本，执行 `bun update -g`
3. 如配置校验失败，提示但不阻塞
4. 提示 Changelog 链接

自举更新：当旧版 `update` 行为异常时：

```bash
npx -y @cloudglab/gerrit-cli@latest update
```

## 每日更新探针

参考 `zentao-cli` 的每日更新探针设计：

### 行为

- 每天首次执行任何命令时，异步检查 npm 上是否有新版本。
- 如有新版本，在 stderr 输出一行提示（不阻塞命令执行）。
- 不自动修改本机环境。

### 实现要点

- 检查记录写入 `~/.gerrit-cli/.last-update-check`，24h 内不重复检查。
- 可通过 `GERRIT_SKIP_UPDATE_CHECK=true` 环境变量关闭。
- 可通过 `gerrit-cli config set checkUpdate false` 持久关闭。

### 提示格式

```
gerrit-cli v4.0.2 is available (currently on v4.0.1). Run `gerrit-cli update` to upgrade.
```

## 启动链路

### 当前架构

```
bin/gerrit-cli
  → src/cli/index.ts (#!/usr/bin/env bun)
    → import { runCli } from '../cli-bootstrap'
      → ensureBunVersion()    // Bun ≥ 1.2.0
      → createProgram()       // new commander Command + addHelpText + registerCommands
      → program.parseAsync()
```

### 与 zentao-cli 对比

| 项目 | gerrit-cli | zentao-cli |
|------|------------|------------|
| CLI 框架 | Commander.js | 自研 InMemoryCliRegistry + Zod |
| 版本获取 | 读 package.json | 硬编码常量 |
| help | Commander 内置 | 手写 help 文案 |
| 角色过滤 | 无 | `--role` 参数 |
| 更新探针 | 无 | `runDailyUpdateProbe()` |
| 页名快捷 | 无 | `execution-bug-1234.html` 解析 |
| 多二进制 | 无 | `zentao-dev/qa/pm` 三个别名 |

### 建议增强

在 `runCli()` 中插入以下步骤（不改变现有架构）：

```typescript
export async function runCli(argv: string[]): Promise<void> {
  ensureBunVersion()

  // [NEW] 轻量更新探针（非阻塞，异步检查）
  if (!process.env.GERRIT_SKIP_UPDATE_CHECK) {
    runDailyUpdateProbe().catch(() => {}) // 静默失败
  }

  const program = createProgram()
  await program.parseAsync(argv)
}
```

## 配置优先级

```
命令行参数 > 环境变量 > ~/.gerrit-cli/config.json > 默认值
```

### 环境变量总表

| 变量 | 作用 | 必需 | 默认值 |
|------|------|------|--------|
| `GERRIT_HOST` | Gerrit 服务器 URL | 否* | 配置文件中的值 |
| `GERRIT_USERNAME` | HTTP 认证用户名 | 否* | 配置文件中的值 |
| `GERRIT_PASSWORD` | HTTP 密码/token | 否* | 配置文件中的值 |
| `GERRIT_SKIP_UPDATE_CHECK` | 跳过每日更新检查 | 否 | false |
| `GERRIT_DISABLE_WRITE` | 禁用写操作 | 否 | false |

*环境变量和配置文件至少有一个提供完整认证信息。

## 安装/升级失败诊断

### 常见失败场景

| 失败 | 原因 | 解决 |
|------|------|------|
| `bun: command not found` | Bun 未安装 | `curl -fsSL https://bun.sh/install \| bash` |
| `Bun version too old` | Bun < 1.2.0 | `bun upgrade` |
| `ConfigError` | 配置缺失 | `gerrit-cli setup` |
| `ApiError 401` | 认证失败 | 检查密码/token |
| `ApiError 404` | 地址错误 | 确认 `GERRIT_HOST` 格式（含 `https://`） |
| `ECONNRESET` | 网络问题 | 重试一次 |
| Hook 安装失败 | .git 不存在 | 在 git 仓库中运行 |

## 参考

- zentao-cli: `install` 命令含 CLI + Skill 安装 + 配置引导 + 登录校验
- zentao-cli: `update` 命令含 CLI + Skill 升级 + `--skip-config-check` / `--cli-only` / `--skill-only`
- zentao-cli: 每日更新探针在 `runCli()` 中非阻塞执行，写 `.last-update-check` 时间戳
