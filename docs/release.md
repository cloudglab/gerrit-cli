# Release Notes

## 发布经验

- 命令系统有新增、删除或改名时，必须同时检查并同步 `skills/` 下的说明文档与参考文件。
- `gerrit-cli` 还有 `.agents/skills/` 作为 skills 源目录；改命令时必须同时改 `.agents/skills/gerrit-cli/` 和发布目录 `skills/gerrit-cli/`，否则源码命令和发布技能会漂移。
- 发版前至少做三件事：
  - 重新生成 `dist/manifest.json` 并核对命令是否都在。
  - 检查 `gerrit help` / `gerrit list` / `gerrit help <command>` 是否能看到新增命令。
  - 检查 skills reference、README 示例、构建产物是否与源码注册一致。
