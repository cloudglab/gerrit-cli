# ADR-0026: 每日更新探针

## 状态

提议 (Proposed)

## 日期

2026-06-12

## 背景

当前 gerrit-cli 没有版本更新通知机制。用户除非主动运行 `bun update -g`，否则不会知道有新版本可用。

zentao-cli 实现了每日更新探针：每天首次执行任何命令时，异步检查 npm 上是否有新版本，如有则在 stderr 输出提示。

## 决策

在 `runCli()` 中实现每日更新探针，对齐 zentao-cli 行为：

### 实现要点

1. **检查频率**：24 小时内只检查一次，记录在 `~/.gerrit-cli/.last-update-check`
2. **非阻塞**：异步执行，不影响命令正常执行
3. **静默失败**：网络异常时静默跳过，不抛错
4. **可关闭**：`GERRIT_SKIP_UPDATE_CHECK=true` 环境变量或配置文件关闭
5. **输出版本差异**：提示格式为 `<package> v<new> is available (currently on v<old>). Run \`<cmd>\` to upgrade.`

### 集成位置

```typescript
// src/cli-bootstrap.ts (runCli)
export async function runCli(argv: string[]): Promise<void> {
  ensureBunVersion()

  // 非阻塞更新检查
  if (!process.env.GERRIT_SKIP_UPDATE_CHECK) {
    runDailyUpdateProbe().catch(() => {})
  }

  const program = createProgram()
  await program.parseAsync(argv)
}
```

### npm registry 查询

使用 `https://registry.npmjs.org/@cloudglab/gerrit-cli/latest` 获取最新版本号，对比 `package.json` 中的 `version`。

不走 `bun update`（那是实际升级），只做版本比较。

## 后果

### 正面

- 用户及时知道有新版本可用，减少滞留旧版的情况
- 完全非侵入式，不影响任何命令行为
- 可灵活关闭

### 负面

- 每次执行命令多一个 HTTP 请求（24h 内一次）
- 在网络受限环境（如内网 CI）可能产生超时日志

### 风险缓解

- 5 秒超时
- 失败完全静默
- 提供 `GERRIT_SKIP_UPDATE_CHECK` 环境变量

## 替代方案

### 不做通知

- 优点：零实现成本，零网络开销
- 缺点：用户不知道新版本，尤其是 bug 修复和安全隐患

### 每次执行都检查

- 优点：实时性最好
- 缺点：不必要的网络开销

**结论：选择每日一次的非阻塞检查。**

### 用 bun 自带机制

- `bun update` 没有内置的通知机制
- npm 的 `update-notifier` 包不适用 Bun 生态

## 参考资料

- zentao-cli `src/update-probe.ts` — 每日更新探针实现
- zentao-cli `src/cli.ts:86` — 探针调用位置
- zentao-cli README — `ZENTAO_SKIP_UPDATE_CHECK` 环境变量文档
