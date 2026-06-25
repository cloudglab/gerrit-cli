#!/usr/bin/env node
// 在 build 时把 .agents/skills/gerrit-cli 复制到 skills/gerrit-cli，
// 让 .agents/skills 作为编辑源、skills 作为发布产物。
// 参考 zentao-cli/scripts/copy-skills.mjs。

import { cp, rm } from 'node:fs/promises'
import path from 'node:path'

const source = path.resolve('.agents/skills/gerrit-cli')
const target = path.resolve('skills/gerrit-cli')

await rm(target, { recursive: true, force: true })
await cp(source, target, { recursive: true })
process.stdout.write(`Copied skill from ${source} to ${target}\n`)
