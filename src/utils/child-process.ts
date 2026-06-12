import type * as NodeChildProcess from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const childProcess = require('node:child_process') as typeof NodeChildProcess

export const exec: typeof NodeChildProcess.exec = childProcess.exec
export const execSync: typeof NodeChildProcess.execSync = childProcess.execSync
export const spawn: typeof NodeChildProcess.spawn = childProcess.spawn
export const spawnSync: typeof NodeChildProcess.spawnSync = childProcess.spawnSync
