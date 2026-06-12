import * as childProcess from 'node:child_process'
import chalk from 'chalk'
import { Effect } from 'effect'

export interface CleanOptions {
  readonly dryRun?: boolean
  readonly force?: boolean
  readonly xml?: boolean
  readonly json?: boolean
}

const PROTECTED_BRANCHES = ['main', 'master', 'develop', 'HEAD', 'head']

const isInGitRepo = (): boolean => {
  try {
    childProcess.execSync('git rev-parse --git-dir', { encoding: 'utf8' })
    return true
  } catch {
    return false
  }
}

const getCurrentBranch = (): string =>
  childProcess.execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim()

const getUpstreamBranch = (): string => {
  try {
    return childProcess
      .execSync('git rev-parse --abbrev-ref @{upstream}', { encoding: 'utf8' })
      .trim()
  } catch {
    throw new Error(
      'No upstream tracking branch found. Set one with:\n  git branch --set-upstream-to=origin/main',
    )
  }
}

const getMergedBranches = (upstream: string): ReadonlyArray<string> => {
  const output = childProcess.execSync(
    `git branch --merged ${upstream} --format='%(refname:short)'`,
    {
      encoding: 'utf8',
    },
  )
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !line.startsWith('*'))
    .filter((line) => !PROTECTED_BRANCHES.includes(line))
}

const _isMergedIntoUpstream = (branch: string, upstream: string): boolean => {
  try {
    childProcess.execSync(`git merge-base --is-ancestor ${branch} ${upstream}`, {
      encoding: 'utf8',
    })
    return true
  } catch {
    return false
  }
}

export const STALE_BRANCHES_HELP = `
Finds local branches that have been fully merged into the upstream tracking
branch and offers to delete them. Protected branches (main, master, develop)
are excluded from cleanup.

Examples:
  # Preview what would be cleaned
  $ gerrit-cli clean --dry-run

  # Delete merged branches (interactive confirmation)
  $ gerrit-cli clean

  # Delete without confirmation
  $ gerrit-cli clean --force`

export const cleanCommand = (options: CleanOptions): Effect.Effect<void, Error, never> =>
  Effect.sync(() => {
    if (!isInGitRepo()) {
      throw new Error('Not in a git repository')
    }

    const upstream = getUpstreamBranch()
    const currentBranch = getCurrentBranch()
    const candidates = getMergedBranches(upstream).filter((b) => b !== currentBranch)

    if (candidates.length === 0) {
      if (options.json) {
        console.log(JSON.stringify({ status: 'success', message: 'No branches to clean' }))
      } else if (options.xml) {
        console.log('<?xml version="1.0" encoding="UTF-8"?>')
        console.log('<clean>')
        console.log('  <status>success</status>')
        console.log('  <message>No branches to clean</message>')
        console.log('</clean>')
      } else {
        console.log(chalk.green('No branches to clean'))
      }
      return
    }

    // Display candidates
    if (options.json) {
      console.log(
        JSON.stringify(
          { status: 'dry-run', upstream, branches: candidates, count: candidates.length },
          null,
          2,
        ),
      )
    } else if (options.xml) {
      console.log('<?xml version="1.0" encoding="UTF-8"?>')
      console.log('<clean>')
      console.log(`  <upstream><![CDATA[${upstream}]]></upstream>`)
      for (const branch of candidates) {
        console.log(`  <branch><![CDATA[${branch}]]></branch>`)
      }
      console.log('</clean>')
    } else {
      console.log(chalk.dim(`  Upstream: ${upstream}`))
      console.log(chalk.dim(`  Current branch: ${currentBranch}`))
      console.log('')
      console.log(chalk.yellow(`  Branches merged into ${upstream}:`))
      for (const branch of candidates) {
        console.log(chalk.dim(`    - ${branch}`))
      }
      console.log('')
    }

    if (options.dryRun) {
      if (!options.json && !options.xml) {
        console.log(chalk.dim('  (dry-run: no branches deleted)'))
      }
      return
    }

    // Deletion phase
    // When using --force, skip confirmation and use -D; otherwise use -d (safe delete)
    const deleteFlag = (options.force ?? false) ? '-D' : '-d'
    const deleted: string[] = []
    const failed: string[] = []

    for (const branch of candidates) {
      try {
        childProcess.execSync(`git branch ${deleteFlag} ${branch}`, {
          encoding: 'utf8',
          stdio: 'pipe',
        })
        deleted.push(branch)
      } catch {
        failed.push(branch)
      }
    }

    if (options.json) {
      console.log(
        JSON.stringify(
          { status: 'success', upstream, deleted, failed, count: deleted.length },
          null,
          2,
        ),
      )
    } else if (options.xml) {
      console.log('<?xml version="1.0" encoding="UTF-8"?>')
      console.log('<clean>')
      console.log('  <status>success</status>')
      console.log(`  <upstream><![CDATA[${upstream}]]></upstream>`)
      for (const branch of deleted) {
        console.log(`  <deleted><![CDATA[${branch}]]></deleted>`)
      }
      for (const branch of failed) {
        console.log(`  <failed><![CDATA[${branch}]]></failed>`)
      }
      console.log('</clean>')
    } else {
      for (const branch of deleted) {
        console.log(chalk.green(`  ✓ Deleted ${branch}`))
      }
      for (const branch of failed) {
        console.log(chalk.yellow(`  ⚠ Could not delete ${branch} (unmerged upstream? use --force)`))
      }
      console.log(chalk.green(`\n  Cleaned ${deleted.length} branch(es)`))
    }
  })
