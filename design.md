# gerrit-cli 工程设计对齐

> 本文档说明 `gerrit-cli` 复用的工程约定。
> 详细通用规范请参考 [zentao-cli design.md](https://github.com/cloudglab/zentao-cli/blob/main/design.md)。
> 与 zentao-cli 的差异（gerrit-cli 的特定约束）独立标注。

## 1. 文档定位

`gerrit-cli` 是面向命令行 / AI Skill / CI 脚本的 Gerrit REST 客户端，使用 Effect-TS + Commander.js 重建。

## 2. 核心约束

- **运行时**：Node.js ≥ 18，`pnpm@10.24.0`。
- **语言**：TypeScript strict，`isolatedDeclarations: true`，`module: "ESNext"`，`moduleResolution: "Bundler"`。
- **HTTP 客户端**：自建 `src/api/http-client.ts`，基于 undici `Agent`，统一 keepAlive / 15s GET 缓存 / 401 重试 / 网络错误重试。
- **CLI 框架**：Commander.js + Effect Layer 注入。`executeEffect` 在 `src/cli/command-helpers.ts`。
- **Skill**：`.agents/skills/gerrit-cli/` 是编辑源，`skills/gerrit-cli/` 是 `pnpm build` 产物。

## 3. 写保护

- `WriteGuardError`（`src/utils/write-guard.ts`）带 `kind: 'preview' | 'disabled' | 'unsupported'` 字段。
- `executeEffect` 识别 `WriteGuardError` 后输出 `{ ok: false, preview: true, kind, reason, action, target, hint }` 结构，**不**走通用 error 通道。
- `GERRIT_DISABLE_WRITE` 严格判定：仅当值为字符串 `'true'` 时禁用。
- 所有写命令 schema 必须显式带 `--confirm` 选项；缺 `--confirm` 时返回 preview，**不抛错**。

## 4. HTTP 客户端行为

| 维度 | 行为 |
| --- | --- |
| 底层 | undici `Agent`，全局共享一个连接池 |
| 缓存 | GET 请求 15 秒内存缓存，命中注入 `cacheHit: true` |
| 401 | 清空缓存后重试一次（让上层重新拼装 Authorization 头） |
| 网络错误 | `ECONNRESET` / `ETIMEDOUT` / `EAI_AGAIN` / timeout / socket hang up → 重试一次 |
| 错误包装 | `HttpClientError` 含 `statusCode` / `responseBody`；`ApiError` 暴露相同字段 |
| 超时 | 默认 30 秒 |

## 5. 错误结构

CLI 输出统一 JSON / XML / 文本三档。`toStructuredError` 优先从 `error.statusCode` 读，回退到 `error.status`。

```json
{
  "status": "error",
  "error": "Gerrit 返回错误: 401",
  "code": "NOT_AUTHENTICATED",
  "recoverable": true,
  "statusCode": 401,
  "hint": "运行 gerrit-cli setup 重新认证"
}
```

中文错误消息写在前端；hint 字段给 Agent 一个明确的下一步建议。

## 6. 配置文件

- 默认位置：`~/.gerrit-cli/config.json`，目录权限 `0o700`，文件 `0o600`。
- 环境变量优先级：`GERRIT_HOST` / `GERRIT_USERNAME` / `GERRIT_PASSWORD` / `GERRIT_RETRIGGER_COMMENT` 覆盖文件。
- 配置文件损坏抛 `配置文件损坏，请检查 <path>：<message>`。

## 7. 角色入口

- `gerrit-cli` / `gerrit` — `full`
- `gerrit-dev` — 提交 / 查看 / checkout / rebase
- `gerrit-reviewer` — incoming / diff / comments / vote
- `gerrit-lead` — reviewer 管理 / 组
- `gerrit-ci` — build-status / failures / extract-url
- `--role <name>` 在 `gerrit-cli` 主入口下也支持，bin 入口只过滤 help，不改变 Gerrit 服务端权限。

## 8. Skill 双目录

- `.agents/skills/gerrit-cli/SKILL.md` — 编辑源
- `.agents/skills/gerrit-cli/reference/*.md` — 场景拆分
- `skills/gerrit-cli/` — `pnpm build` 复制产物，npm 发布内容
- `scripts/copy-skills.mjs` — 复制脚本，构建时由 `scripts/build-dist.ts` 调用

## 9. 场景推荐输出

`gerrit-cli` 已支持在 JSON 输出里注入结构化的下一步推荐，供 Agent / 脚本继续衔接命令链路。

触发规则：

- 仅在显式传 `--recommend` 时生效；不传或传 `--recommend=false` 都不注入。
- 仅影响 JSON 输出；纯文本和 XML 保持现状。
- 输出位置固定为 `meta.next`。

返回形状：

```json
{
  "status": "success",
  "meta": {
    "next": [
      {
        "tool": "diff",
        "reason": "继续查看该变更的代码差异",
        "priority": 2,
        "args": { "changeId": "12345" },
        "example": "gerrit-cli diff 12345"
      }
    ]
  }
}
```

声明位置：

- 命令元数据在 `src/cli/command-meta.ts` 的 `CommandMeta.recommendations`。
- JSON 注入辅助在 `src/cli/recommendations.ts`。

参数映射规则：

- `source: 'input' | 'payload'` 指定参数来源。
- `path` 使用点号路径，例如 `changes.0.number`。
- 可选 `template` 支持简单字符串模板，目前只支持 `{{value}}` 替换。
- 路径解析失败时，保留推荐条目，但省略 `args` 和 `example`。

排序与过滤：

- 按 `priority` 倒序输出。
- 当前 `--role` 看不到的目标命令会被过滤。

示例声明：

```ts
{
  tool: 'search',
  reason: '继续搜索该项目下的变更',
  priority: 1,
  args: {
    query: {
      source: 'payload',
      path: 'projects.0.name',
      template: 'project:{{value}}',
    },
  },
}
```

实现约束：

- 推荐系统只做轻量路径映射和模板替换，不支持表达式求值。
- `build-status --watch` 这类流式 JSON 输出不注入推荐，避免破坏逐行脚本消费。
- 新增 JSON 命令时，如适合 Agent 串联，优先补 `recommendations`，并复用 `printJsonWithRecommendations()` 或 `attachRecommendations()`。

## 10. 与 zentao-cli 的差异

| 维度 | zentao-cli | gerrit-cli |
| --- | --- | --- |
| CLI 框架 | 自建 CliRegistry + Zod schema | Commander.js + Effect Layer |
| HTTP 客户端 | axios | undici fetch（自建 src/api/http-client.ts）|
| 状态管理 | Zod | Effect Schema |
| 凭据形式 | Token（自动重试） | Basic Auth（401 时清缓存重拼头）|
| 测试框架 | vitest + @vitest/coverage-v8 | vitest + MSW + @vitest/coverage-v8 |
| 终端 UI | 无 | 计划接入 Ink（基础命令已用 chalk）|

## 11. 可执行规则清单

- [x] `package.json` 使用 ESM、pnpm、Node engines、bin 多入口、`files` 白名单。
- [x] `tsconfig.json` 使用 `ESNext`、`Bundler`、`strict`、`declaration`、`sourceMap`。
- [x] 建立 `src/api`、`src/cli`、`src/services`、`src/schemas`、`src/utils`。
- [x] 所有 Effect API 显式带错误类型。
- [x] 写命令统一 `confirm` + `WriteGuardError` preview。
- [x] API 层封装 HTTP 重试、错误包装。
- [x] 建立 `.agents/skills/gerrit-cli` 作为 Skill 源。
- [x] 构建时复制 `.agents/skills` 到 `skills`。
- [x] `SKILL.md` 保持短，场景细节下沉到 `reference/`。
- [x] `vitest.config.ts` 串行运行，显式 import vitest API。
- [x] 添加 `pnpm check:all` 和 husky pre-commit。
- [x] 添加 `release:smoke-query`。
- [x] 添加 `.github/workflows/publish.yml`，tag `v*` 触发 npm provenance publish。
- [x] 添加 `.opencode/opencode.json` 的 `/release` 模板。
- [x] 发布前固定运行 `pnpm check:all` 和 `pnpm release:smoke-query`。

## 12. 刻意使用 Bundler 解析

`tsconfig.json` 用 `module: "ESNext"` + `moduleResolution: "Bundler"`，刻意不切到 NodeNext。

原因：

- gerrit-cli 通过 tsup 打包为 ESM 产物，运行时 Node.js 直接消费 `dist/bin/*.js`。
- 源码里大量 `import '@/...'` 路径别名和 `.ts` 引用，Bundler 解析允许不写 `.js` 后缀即可正确解析。
- 改 NodeNext + 加 `.js` 后缀的收益小、改动大、且会让 tsup 打包增加额外处理。
- 测试使用 vitest + 自定义 alias，Bundler 解析天然兼容。

如果未来接入 Node 单文件发布（不经过打包），再评估迁移到 NodeNext + `.js` 后缀。
