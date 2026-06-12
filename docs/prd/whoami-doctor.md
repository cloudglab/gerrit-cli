# whoami / doctor 诊断命令设计

## 设计目标

对齐 zentao-cli 的 `whoami` 和 `doctor` 辅助命令，提供身份感知和本地环境诊断能力。

## whoami — 当前身份

### 命令签名

```
gerrit-cli whoami [options]

Options:
  --json       JSON 输出
  --xml        XML 输出
```

### 输出内容

- 当前认证用户名
- 对应 Gerrit 账户信息（full name, email, account ID）
- 配置来源（file / environment）
- Gerrit 服务器地址

### 示例

```bash
$ gerrit-cli whoami
Logged in as: john.doe (John Doe <john@example.com>)
Host:        https://gerrit.example.com
Config:      ~/.gerrit-cli/config.json
Account ID:  1000001
```

### 别名支持

支持 `who am i` 自然语言别名：

```bash
$ gerrit-cli who am i
```

### 实现提点

- 通过 `GET /a/accounts/self` 获取当前账户信息
- 验证认证是否有效（401 → 提示重新 setup）
- 输出中不暴露密码或 token

## doctor — 本地环境诊断

### 命令签名

```
gerrit-cli doctor [options]

Options:
  --json        JSON 输出
  --xml         XML 输出
  --skip-network  跳过网络诊断
```

### 诊断维度

| 维度 | 检查项 | 通过标准 |
|------|--------|----------|
| **Runtime** | Bun 版本 | ≥ 1.2.0 |
| **Runtime** | Bun 安装路径 | which bun |
| **Git** | git 是否可用 | git --version |
| **Git** | 当前目录是否为 git 仓库 | .git 存在 |
| **Hook** | commit-msg hook 已安装 | .git/hooks/commit-msg 存在 |
| **Hook** | hook 可执行 | 文件权限包含 x |
| **Config** | 配置文件存在 | ~/.gerrit-cli/config.json |
| **Config** | 环境变量设置 | GERRIT_HOST/USERNAME/PASSWORD |
| **Config** | 配置格式正确 | JSON 可解析 + schema 校验 |
| **Network** | Gerrit 服务器可连通 | HTTP 200 from /a/accounts/self |
| **Network** | HTTPS 已启用 | URL 以 https:// 开头 |
| **Network** | 认证有效 | 非 401 |

### 输出风格

参考 zentao-cli 风格，使用 ✓ / ✗ 标记：

```
$ gerrit-cli doctor

Gerrit CLI Doctor — v4.0.1
──────────────────────────────────────────

Runtime
  ✓ Bun                v1.2.5
  ✓ Bun path           /usr/local/bin/bun

Git
  ✓ Git                v2.39.0
  ✓ Git repo           /Users/john/project
  ✓ Commit hook        .git/hooks/commit-msg (executable)

Config
  ✓ Config file        ~/.gerrit-cli/config.json
  ✓ Env vars           GERRIT_HOST, GERRIT_USERNAME (password not shown)
  ✓ Config format      Valid

Network
  ✓ HTTPS              https://gerrit.example.com
  ✓ Connection         Connected as john.doe
  ✓ Authentication     Token valid

──────────────────────────────────────────
All checks passed (10/10)
```

### 错误时输出

```
Network
  ✗ Connection         Failed to reach https://gerrit.example.com
                        → Check GERRIT_HOST or run `gerrit-cli setup`
  ✗ Authentication     401 Unauthorized
                        → HTTP password may have expired

──────────────────────────────────────────
6/8 checks passed. 2 issues found.
```

### 非 Git 仓库提示

当不在 Git 仓库中时，跳过 Git/Hook 相关检查，标注为 "skipped (no git repo)"。

## 实现优先级

1. **whoami**（优先级高）：实现简单，用户感知强
2. **doctor**（优先级中）：实用性强，适合排查问题，实现稍复杂

## 与 zentao-cli 的差异

- zentao-cli 的 `whoami` 只输出用户名，gerrit 版本会输出更完整的账户信息
- zentao-cli 没有 `doctor` 命令，这是 gerrit-cli 的差异化能力

## 命令注册

建议注册为：

```typescript
// whoami
program
  .command('whoami')
  .alias('who am i')
  .description('Show current Gerrit login identity')
  .option('--json', 'JSON output')
  .option('--xml', 'XML output')
  .action(whoamiCommand)

// doctor
program
  .command('doctor')
  .description('Diagnose local environment and connectivity')
  .option('--json', 'JSON output')
  .option('--xml', 'XML output')
  .option('--skip-network', 'Skip network diagnostics')
  .action(doctorCommand)
```

## 测试覆盖

whoami 测试：
- 正常路径：返回账户信息
- API 错误：401 提示重新认证
- 网络错误：提示检查网络
- JSON/XML 输出格式

doctor 测试：
- 全量通过场景
- 配置缺失场景
- 网络不通场景
- Git 仓库不存在场景
- --skip-network 跳过网络检查
