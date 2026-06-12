# ADR-0024: install 和 update 命令设计

## 状态

提议 (Proposed)

## 日期

2026-06-12

## 背景

当前 gerrit-cli 没有 `install` 和 `update` 命令。用户安装依赖外部指令（`bun install -g` 然后手动 `setup`），升级也依赖 `bun update -g`，缺少：

1. 一站式引导（install → setup → hook → skill 提示）
2. 平滑升级体验（版本检查、配置迁移提示）
3. 更新探针（主动通知用户有新版本）

zentao-cli 已实现完整的 `install` / `update` / 每日探针链路，需要对齐。

## 决策

### install 命令

实现 `gerrit-cli install`，作为一站式引导命令：

```
gerrit-cli install [options]

Options:
  --skip-config-check   跳过配置校验
  --skip-hook           跳过 commit-msg hook 安装
  --force               强制覆盖已有配置
```

执行流程：
1. 检查 Bun 版本（复用现有 `ensureBunVersion()`）
2. 如果配置缺失，引导输入配置（复用 `setup` 逻辑提取为服务）
3. 测试 Gerrit 连接
4. 如果在 git 仓库内，检查并安装 commit-msg hook
5. 提示 Skill 安装方式
6. 输出可用命令速览

### update 命令

实现 `gerrit-cli update`，作为升级命令：

```
gerrit-cli update [options]

Options:
  --skip-config-check   跳过配置校验
  --cli-only            仅升级 CLI 二进制
```

执行流程：
1. 对比本地版本与 npm latest 版本
2. 如有新版本，执行 `bun update -g @cloudglab/gerrit-cli`
3. 校验配置可用性
4. 输出升级结果和 Changelog 链接

支持自举更新：

```bash
npx -y @cloudglab/gerrit-cli@latest update
```

### 每日更新探针

在 `runCli()` 启动时插入非阻塞的更新检查：

- 检查 `~/.gerrit-cli/.last-update-check` 时间戳，24h 内跳过
- 异步请求 npm registry 获取 latest 版本
- 如有新版本，在 stderr 输出一行提示
- 静默失败，不影响命令执行
- 可通过 `GERRIT_SKIP_UPDATE_CHECK=true` 关闭

## 后果

### 正面

- 降低新用户上手门槛
- 与 zentao-cli 保持一致的安装体验
- 用户及时知道有新版本可用
- 不影响现有命令行为（更新探针非阻塞）

### 负面

- 增加 `cli.ts` 启动链路复杂度
- 需要处理 npm registry 网络失败的静默回退
- `install` 与现有 `setup` 有职责重叠，需要重构 `setup` 可复用逻辑

### 风险缓解

- 更新探针全部 try/catch，失败不影响主命令
- 提供关闭开关（环境变量 + 配置项）

## 替代方案

### 不实现 install/update，保持现状

- 优点：零实现成本
- 缺点：与 zentao-cli 体验差距明显，AI Skill 引导用户安装时不流畅

### 用 bash 脚本包装

- 优点：实现简单
- 缺点：跨平台问题，与 TypeScript 技术栈不一致

**结论：选择 TypeScript 实现路径。**

## 参考资料

- zentao-cli `src/install.ts` — install/update 命令实现
- zentao-cli `src/update-probe.ts` — 每日更新探针实现
- zentao-cli `src/cli.ts` — `runCli()` 启动链路
