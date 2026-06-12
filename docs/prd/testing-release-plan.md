# 测试、发布与交付计划

## 测试分层重整（R41）

### 当前测试分层

```
tests/
├── unit/                  # 纯函数 + schema 单元测试
├── integration/           # API 集成测试 (MSW)
├── mocks/                 # MSW handler
├── helpers/               # 测试辅助工具
├── <command>.test.ts      # 命令级测试 (混合 unit + integration)
```

### 问题

- 根目录 `.test.ts` 文件与 `tests/unit/commands/` 下的测试职责不清
- 缺少端到端 workflow 测试
- 缺少 install/update 场景测试

### 建议分层

```
tests/
├── unit/                  # 纯函数、schema、工具函数
│   ├── schemas/
│   ├── utils/
│   └── services/
├── integration/           # 单命令 + MSW HTTP mock
│   └── commands/          # 每个命令一个文件
├── workflow/              # 多步骤链路测试（新增）
│   ├── review-workflow.test.ts
│   ├── push-workflow.test.ts
│   └── ci-workflow.test.ts
├── smoke/                 # 发版前真实查询回归（新增）
│   └── release-smoke.test.ts
├── mocks/                 # MSW handlers
└── helpers/               # 测试辅助
```

### 迁移计划

1. 将根目录的 `<command>.test.ts` 移入 `integration/commands/`
2. 新增 `workflow/` 目录，编写 3 条链路测试
3. 新增 `smoke/` 目录，定义发版前最小查询集

## workflow 测试设计（R42）

### 候选链路

| 链路 | 步骤 | 验证点 |
|------|------|--------|
| **审查链路** | `show` → `diff` → `comments` → `comment` → `vote` | 每步正确执行，输出连贯 |
| **推送链路** | `push --wip` → `set-ready` → `submit` → `mine` | 状态变更正确 |
| **CI 链路** | `build-status` → `extract-url` | 链式输出被下一步消费 |
| **安装链路** | `setup` → `config test` → `status` | 配置写入后连接可用 |
| **搜索链路** | `search` → `show` → `checkout` | 搜索结果可被后续命令消费 |

### 实现要点

- 使用 MSW 模拟完整 Gerrit API 序列
- 每个步骤的输出可作为下一步的输入
- 验证状态变更的一致性（如 abandon 后 mine 不再出现）

## install/update 测试设计（R43）

### install 测试矩阵

| 场景 | 初始状态 | 预期结果 |
|------|----------|----------|
| 全新安装 | 无配置、无 hook | 引导输入→保存配置→安装 hook |
| 已有配置 | config.json 存在 | 跳过配置引导→测试连接 |
| 已有 hook | hook 已安装 | 跳过 hook 安装 |
| 无 Git 仓库 | 不在 repo 中 | 跳过 hook 安装 |
| 认证失败 | 配置错误 | 提示重新 setup |
| `--skip-config-check` | — | 跳过所有配置校验 |
| `--skip-hook` | — | 跳过 hook 安装 |

### update 测试矩阵

| 场景 | 初始版本 | 预期结果 |
|------|----------|----------|
| 有新版本 | 旧版已安装 | 检测→提示→升级 |
| 已是最新 | 最新版已安装 | 提示"已是最新" |
| npm 不可达 | 网络断开 | 静默跳过或超时提示 |
| 配置失效 | 升级后配置不可用 | 提示校验配置 |
| `--skip-config-check` | — | 跳过配置校验 |
| 自举更新 | 旧版 update 异常 | `npx ... update` 回退 |

## release smoke 设计（R44）

### 参考 zentao-cli

zentao-cli 发版前运行 `pnpm release:smoke-query`，用固定测试数据执行真实查询回调。

### gerrit-cli smoke 设计

**环境要求**：一个可访问的 Gerrit 实例 + 有效认证 + 至少 1 个已知 change。

**最小查询集**：

| 查询 | 命令 | 验证 |
|------|------|------|
| 连接检查 | `config test` | 返回 connected=true |
| 读取 change | `show <known-id>` | 返回有效 change 信息 |
| 列出 changes | `mine` / `search "status:open"` | 返回非空列表 |
| Diff 获取 | `diff <known-id>` | 返回 diff 内容 |
| 评论读取 | `comments <known-id>` | 无报错 |
| 配置展示 | `config show` | 返回配置摘要 |

**环境变量**：

```bash
export GERRIT_SMOKE_HOST="https://gerrit.example.com"
export GERRIT_SMOKE_USERNAME="smoke-user"
export GERRIT_SMOKE_PASSWORD="$GERRIT_SMOKE_TOKEN"
export GERRIT_SMOKE_CHANGE_ID="12345"  # 已知存在的 change
```

**运行方式**：

```bash
# 本地运行
GERRIT_HOST=$GERRIT_SMOKE_HOST \
GERRIT_USERNAME=$GERRIT_SMOKE_USERNAME \
GERRIT_PASSWORD=$GERRIT_SMOKE_PASSWORD \
  bun test tests/smoke/release-smoke.test.ts

# CI 中运行（需要 secrets）
```

**注意**：smoke 查询是只读操作，不对线上数据做任何修改。

## publish workflow 重构（R45）

### 当前 publish.yml

- tag `v*` 触发
- 校验 tag version 与 `package.json` version 一致
- 运行 `bun run check:all`
- 使用 npm Trusted Publisher 执行 `npm publish --provenance --access public`

### 问题

- 缺少 smoke 查询
- GitHub Release 作为可选补充，不再作为主发布入口

### 建议 workflow

```yaml
jobs:
  # 1. Smoke 查询（需要 secrets，可选）
  release-smoke:
    - 使用 GERRIT_SMOKE_* 环境变量
    - 运行 smoke 测试

  # 2. NPM 发布
  npm-publish:
    needs: release-smoke
    - 校验 tag version 与 package.json version
    - bun run check:all
    - npm publish --provenance --access public
```

### 决策点

- npm 发布是首选交付方式（Bun 源码直跑，但需要 npm 注册）
- 平台二进制不作为当前主交付物
- smoke 查询应在 npm 发布之前运行

## GitHub Pages 交付（R46）

### 现状

`docs/index.html` 已创建（R3），内容完整。

### 待完成

1. 创建 `.github/workflows/pages.yml`
2. 配置 GitHub Pages source 为 `gh-pages` 分支或 GitHub Actions
3. 验证 `https://cloudglab.github.io/gerrit-cli/` 可访问

### pages.yml

```yaml
name: Deploy GitHub Pages

on:
  push:
    branches: [main]
    paths:
      - 'docs/index.html'

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pages: write
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: docs
      - uses: actions/deploy-pages@v4
```

## README 与 pages 联动（R47）

### 现状

README 中已有链接：
```markdown
- [命令速查页](https://cloudglab.github.io/gerrit-cli/) — GitHub Pages 极简速查
```

### 待补充

- pages 页面中加回链到 GitHub 仓库
- README 底部"进阶"中保持链接
- pages 部署后验证链接可点击

## 技能包交付检查（R48）

### 检查清单

| 文件 | 检查项 | 状态 |
|------|--------|------|
| `SKILL.md` | frontmatter 完整（name/description/allowed-tools） | ✅ |
| `SKILL.md` | 角色路由引导 | ✅ R29 |
| `SKILL.md` | 自然语言路由表 | ✅ R29 |
| `SKILL.md` | 错误处理策略 | ✅ R29 |
| `SKILL.md` | 命令速查 | ✅ 已有 |
| `reference.md` | 所有 50+ 命令完整覆盖 | ✅ R29 补全 |
| `reference.md` | 每个命令有语法+选项+示例 | ✅ |
| `examples.md` | 按角色组织场景 | ✅ R29 重写 |
| `examples.md` | 覆盖 dev/reviewer/lead/automation | ✅ |
| `examples.md` | 包含管道示例 | ✅ |

### 待改进

- 增加 Skill 之间的链接（SKILL.md → reference.md → examples.md）
- 增加 Skill 版本号与 CLI 版本的对应关系

## 迭代验收清单（R49）

### 第一批 R1-R5（文档骨架）

- [x] R1: README 重写
- [x] R2: AGENTS.md 新建
- [x] R3: docs/index.html
- [x] R4: PRD（roles/scenarios/install-update-chain）
- [x] R5: ADR（0024/0025/0026）

### 第二批 R11-R16（安装/配置链路）

- [x] R11: install 设计（ADR/PRD 完成）
- [x] R12: update 设计（ADR/PRD 完成）
- [x] R13: 每日更新探针实现
- [x] R14: 配置优先级文档
- [x] R15: whoami/doctor 设计
- [x] R16: config show 增强

### 第三批 R21-R30（角色/场景/Skill）

- [x] R21-R23: 角色/场景文档（R4 完成）
- [x] R24-R27: 各角色场景 walkthrough（R29 完成）
- [x] R28: 场景命中链路（R4 完成）
- [x] R29: Skill 包增强
- [x] R30: 角色别名决策（ADR-0025）

### 第四批 R31-R40（辅助命令）

- [x] R31-R40: 辅助命令路线图（本文档）
- [ ] R33: whoami 实现（待编码）
- [ ] R34: doctor 实现（待编码）
- [ ] R11/R12: install/update 实现（待编码）

### 第五批 R41-R50（测试/发布/交付）

- [x] R41-R50: 测试/发布/交付计划（本文档）
- [ ] R42: workflow 测试（待编码）
- [ ] R44: release smoke（待编码+配置）
- [ ] R46: GitHub Pages 部署（待 CI 配置）

## 总收口（R50）

### 本轮 50 轮完成后状态

**文档层**：
- README（面向用户）✅
- AGENTS.md（面向维护者）✅
- docs/index.html（GitHub Pages）✅
- docs/prd/（5 份 PRD + 3 份新增）✅
- docs/adr/（23 份现有 + 3 份新增）✅
- skills/gerrit-workflow/（3 文件全面增强）✅

**代码层**：
- 每日更新探针（`src/update-probe.ts`）✅
- config show 增强（来源标识）✅
- whoami 设计（待实现）
- install/update 设计（待实现）

**待实现命令**（下一阶段）：
1. `whoami` — 高优先级，实现简单
2. `install` — 高优先级，用户感知强
3. `update` — 中优先级，依赖 install
4. `doctor` — 中优先级，诊断价值高

**待配置项**：
1. GitHub Pages workflow（`.github/workflows/pages.yml`）
2. Release smoke secrets（CI 环境变量）
3. npm trusted publisher（npm 侧配置）

### 下一阶段 backlog

```
里程碑 M1: 辅助命令落地
  - whoami 实现 + 测试
  - install 实现 + 测试
  - update 实现 + 测试

里程碑 M2: 诊断与交付
  - doctor 实现 + 测试
  - GitHub Pages 部署
  - release smoke 集成

里程碑 M3: 测试增强
  - workflow 测试
  - install/update 测试
  - 测试分层整理

里程碑 M4: 体验打磨
  - 输出模板统一
  - completion 增强
  - 性能优化
```
