# Reference 索引

按场景拆分的二级文档。`SKILL.md` 保持精简，命令细节下沉到本目录。

## 场景文档

| 文档 | 场景 | 关键命令 |
| --- | --- | --- |
| [daily.md](./daily.md) | 日常开发 | `mine` `list` `show` `search` `projects` `files` `open` `setup` `whoami` `doctor` `status` |
| [review.md](./review.md) | 审查 | `show` `diff` `comments` `reviewers` `comment` `vote` `review` `incoming` `team` `add-reviewer` `remove-reviewer` |
| [ci.md](./ci.md) | CI 构建 | `build-status` `failures` `extract-url` `retrigger` `install-hook` `analyze` |
| [workspace.md](./workspace.md) | 工作区 / worktree | `push` `checkout` `cherry` `rebase` `topic` `set-ready` `set-wip` `tree` `trees` `clean` |
| [scenarios.md](./scenarios.md) | 典型组合 | 多命令串联场景 |
| [cheatsheet.md](./cheatsheet.md) | 全量命令速查 | 全部 57 个命令 |

## 启动

```bash
gerrit help
gerrit list
gerrit version
gerrit whoami
gerrit --role ci build-status 12345
```

未装时：

```bash
npx -y @cloudglab/gerrit-cli@latest
npx -y @cloudglab/gerrit-cli@latest --role ci
```

## 角色

`--role full|dev|reviewer|lead|ci` 只过滤 CLI 暴露的命令，不改变 Gerrit 登录身份或服务端权限。

## 验证

跑下面命令校验 reference 与 CLI 命令注册一致：

```bash
pnpm test:coverage:check
```

CLI 应当 100% 覆盖 57 个命令。
