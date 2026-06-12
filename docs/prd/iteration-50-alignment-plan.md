# Gerrit CLI 50 轮架构对齐规划

## 目标

这一轮不是零散补功能，而是把 `gerrit-cli` 朝 `zentao-cli` 的“可安装、可发布、可引导、可场景化、可被 Skill/Agent 稳定调用”的整体形态推进。

对齐范围：

- 文档结构：`README`、`docs/prd`、`docs/adr`、`docs/html`
- 发布链路：npm 发布、版本约束、发布前 smoke 检查、更新提示
- CLI 组织：入口、角色/场景、辅助命令、help、安装/更新
- Skill 组织：`skills/` 的说明、示例、场景命中链路
- 自动化测试：命令级集成测试、链路测试、发布前回归测试
- 配置体系：环境变量、配置文件、变量优先级、敏感信息边界
- 参考吸收：`zentao-cli`、`opensource/ger`、`opensource/gerrit-cli`

## 当前判断

### 已经具备的基础

- 已有较完整命令集，当前约 `50` 个子命令。
- 已完成 CLI bootstrap / SDK export 初步对齐。
- 已有 `docs/prd`、`docs/adr` 基础骨架。
- 已有较完整测试集和 CI 工作流。
- 已支持 `completion`、`clean`、`config`、`version` 等基础辅助命令。

### 和 `zentao-cli` 的明显差距

- `README` 仍偏“功能说明书”，不够“安装即用 + 场景入口 + Skill 入口”。
- 缺少 `docs/index.html` 这类极简速查页。
- 缺少 `install/update` 一体化链路和每日更新探针。
- 缺少“角色入口 / 场景入口 / agent 命中链路”文档化设计。
- `skills/gerrit-workflow` 组织还不够像产品化 Skill 包。
- 发布链路需对齐 `zentao-cli` 的 `publish.yml`，强调 npm Trusted Publisher 发布和发版前 smoke 回归。
- 缺少“环境变量位置、启动链路、配置优先级”的统一说明。

## 参考仓库提炼

### 从 `zentao-cli` 学什么

1. `README` 只保留用户真正关心的内容：安装、更新、环境变量、场景、常用命令。
2. 复杂实现、限制、发布说明放 `AGENTS.md`，用户文档和维护者文档分层。
3. 把“角色入口”显式产品化，比如 `dev / qa / pm / full`。
4. 把“自然语言请求 → 命中命令链路”写成可复用资产，服务 Skill / Agent。
5. 提供 `install` / `update` / `whoami` / `list` / `help` 这类低门槛辅助命令。
6. 提供 `docs/index.html` 作为 GitHub Pages 速查页。
7. 发布前做真实 smoke query，而不是只做静态构建。

### 从 `opensource/ger` 学什么

1. CLI 仓库整体结构已经和当前项目接近，可吸收其工程纪律和文档分层。
2. `skills/`、`DEVELOPMENT.md`、`EXAMPLES.md` 这类“给人和给 Agent 各自看的材料”值得继续强化。
3. 保持 Bun 源码直跑模型，对当前项目是优势，不必为了对齐而改成 `dist` 发布模式。

### 从老 `opensource/gerrit-cli` 学什么

1. 文档里的“完整 walkthrough”很强，能把用户真正带进日常工作流。
2. `topic / up / squad / web / clean / completion` 这类老派 CLI 技巧强调“操作闭环”。
3. 命令别名、短路径、工作流命令组合值得继续抽象。

## 50 轮迭代总原则

1. 先补产品骨架，再补命令。
2. 先补文档和链路抽象，再补 UI 细节。
3. 优先沉淀“场景 → 命令 → 输出”的稳定接口。
4. 不盲目复制 `zentao-cli`；只吸收适合 Gerrit 场景的模式。
5. 坚持当前工程约束：Bun、TypeScript、Effect、MSW、无 `as`、文件不过大。
6. `README` 图片先不生成，本轮只预留位置和文案结构。

## 50 轮分阶段规划

## 阶段 A：信息架构与骨架对齐（R1-R10）

### R1. 重写 README 信息架构
- 改成：安装、升级、快速开始、角色入口、日常场景、环境变量、Skill 用法。

### R2. 拆分 README 与维护者文档职责
- 把实现细节、限制、发版约束迁到 `CLAUDE.md` 补充区或新增 `AGENTS.md` 规范文档。

### R3. 增加 docs/html 速查页规划
- 先落 `docs/index.html` 文案和结构，不生成图片。

### R4. 梳理 PRD 文档集合
- 补“场景设计”“角色设计”“安装与启动链路”三个文档。

### R5. ADR 补齐 CLI 产品化决策
- 记录 install/update、角色入口、更新探针、skill 集成等决策。

### R6. 补环境变量总表
- 明确配置项、默认值、优先级、敏感性、适用命令。

### R7. 补启动链路文档
- 从 `bin/gerrit-cli` → `src/cli/index.ts` → `runCli()` → command registry 全链路画清。

### R8. 统一命令分类
- 明确 view / review / manage / workspace / ci / config / automation 分类。

### R9. 统一帮助输出规范
- 为 help 文案定义固定模版和示例风格。

### R10. 建立 50 轮追踪面板
- 用文档记录每轮目标、状态、验收结果。

## 阶段 B：安装、更新、配置链路（R11-R20）

### R11. 设计 `install` 命令
- 目标：一键检查 Bun、安装 hook、初始化配置、提示 skill。

### R12. 设计 `update` 命令
- 目标：统一升级 CLI，自检版本，保留 `--skip-config-check` 一类开关。

### R13. 设计每日更新探针
- 参考 `zentao-cli`，默认只提示，不自动修改环境。

### R14. 配置优先级标准化
- 明确文件配置、环境变量、命令参数覆盖顺序。

### R15. 增加 `whoami` / `doctor` 规划
- `whoami` 看当前 Gerrit 身份；`doctor` 做本地环境诊断。

### R16. 配置展示增强
- 扩展 `config show/test`，加入来源标识和脱敏显示。

### R17. 变量命名标准化
- 统一 `GERRIT_*` 环境变量命名和文档说明。

### R18. 安装/升级失败诊断链路
- 定义常见失败：Bun 不存在、配置缺失、认证失败、hook 安装失败。

### R19. 安装回归测试方案
- 为 install/update/config/test 设计集成测试矩阵。

### R20. 完成安装链路 ADR
- 固化是否自动写配置、是否自动装 skill、是否自动装 hook。

## 阶段 C：角色、场景、链路设计（R21-R30）

### R21. 定义 Gerrit 角色模型
- 建议至少定义：`dev`、`reviewer`、`lead`、`ci`、`full`。

### R22. 角色与命令映射
- 哪些角色默认暴露哪些命令，先做文档映射，再决定是否实现多入口。

### R23. 设计自然语言场景索引
- 像 `zentao-cli` 一样整理“用户怎么说”。

### R24. 提炼日常开发场景
- 我的变更、待 review、查看 diff、评论、投票、push、submit。

### R25. 提炼 reviewer 场景
- 批量 review、自动提取构建链接、build-status watch、批量评论。

### R26. 提炼 lead / owner 场景
- reviewer 分配、组查询、团队 incoming、CI 失败清单。

### R27. 提炼 automation / agent 场景
- JSON/XML 输出、stdin 输入、无交互运行、exit code 约束。

### R28. 编写“场景命中链路”文档
- `用户表达 → 命中命令 → 补参 → 执行 → 输出`。

### R29. 补 Skill 参考材料
- 把命令模式、示例问法、失败回退写进 `skills/gerrit-workflow`。

### R30. 决定是否实现角色别名入口
- 如 `gerrit-dev`、`gerrit-reviewer`，先做 trade-off 决策。

## 阶段 D：辅助命令与工作流闭环（R31-R40）

### R31. 盘点缺失辅助命令
- 对比 `zentao-cli` 和老 `gerrit-cli`，列出 install/update/help/list/whoami/doctor/web 等差距。

### R32. 评估 `list` 命令
- 输出命令清单、分类、可机器读取格式。

### R33. 评估 `whoami` 命令
- 查询当前用户、邮箱、可访问实例。

### R34. 评估 `doctor` 命令
- 检查 Bun、git、hook、config、网络、认证、repo 状态。

### R35. 评估 `open/web` 增强
- 打开 change、patchset、diff、checks 页面。

### R36. 评估 workflow 宏命令
- 如 `review-flow`、`submit-flow`、`ci-flow` 是否有必要。

### R37. completion 再深化
- 子命令、参数、枚举值、shell 体验再抛光。

### R38. 输出模板统一
- 文本 / JSON / XML 的字段对齐和错误结构对齐。

### R39. 命令示例库建设
- 为常用命令补稳定 example 集。

### R40. 形成辅助命令路线图
- 哪些本轮实现，哪些后续再做。

## 阶段 E：测试、发布、交付面（R41-R50）

### R41. 测试分层重整
- 区分 unit / integration / workflow / smoke。

### R42. workflow 测试设计
- 例如“show → diff → comments → comment → vote”的整链路测试。

### R43. install/update 测试设计
- 覆盖无配置、坏配置、认证失败、skip check。

### R44. release smoke 设计
- 参考 `zentao-cli` 的 release smoke query，设计最小真实查询集。

### R45. release workflow 重构
- 明确 npm 发布、tag 校验、smoke、是否生成 GitHub Release。

### R46. GitHub Pages 交付
- 发布 `docs/index.html`。

### R47. README 与 pages 联动
- README 链到速查页和 skill 文档。

### R48. 技能包交付检查
- `skills/gerrit-workflow` 的 `SKILL.md`、`reference.md`、`examples.md` 完整化。

### R49. 迭代验收清单
- 对照 50 轮逐条验收，标记完成/延期/取消。

### R50. 总收口
- 清理文档重复、补 ADR、更新路线图、准备下一阶段 backlog。

## 优先级建议

如果不是一次性真做满 50 个提交，而是要按“最小可见成效”推进，建议优先顺序是：

1. `R1-R4`：先把文档骨架立住。
2. `R11-R18`：再把 install/update/config/doctor 链路定下来。
3. `R21-R29`：再把角色和场景抽象出来。
4. `R41-R48`：最后补测试、发布、pages、skill 完整交付。

## 建议的第一批落地项

最值得先做的 10 项：

1. README 重写
2. 新增 `docs/index.html`
3. 新增“角色设计”PRD
4. 新增“场景命中链路”PRD
5. 新增“安装与更新链路”PRD
6. 设计 `install` 命令
7. 设计 `update` 命令
8. 设计 `whoami` / `doctor`
9. 增强 `skills/gerrit-workflow`
10. 设计 release smoke

## 本次规划的直接输出

本次只完成规划，不直接实施 50 轮代码改造。

本规划产出后，下一步建议按“小批次、可验证”的方式推进：

- 第一批：`R1-R5`
- 第二批：`R11-R16`
- 第三批：`R21-R29`
- 第四批：`R41-R48`

这样更容易在每一轮后看见结构性变化，也方便你逐步验收。
