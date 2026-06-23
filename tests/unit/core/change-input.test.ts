import { describe, expect, test } from '@test/compat'
import { Effect } from 'effect'
import {
  buildChangeUrl,
  type ChangeInput,
  extractPushOutputChangeUrl,
  InvalidChangeInputError,
  parseChangeInput,
  parseRemoteHost,
  resolveChangeId,
} from '@/core/change-input'

describe('parseChangeInput', () => {
  test('parses plain change number', () => {
    const r: ChangeInput = parseChangeInput('12345')
    expect(r).toEqual({ raw: '12345', kind: 'number', changeId: '12345', empty: false })
  })

  test('parses change number with /patchset', () => {
    const r = parseChangeInput('12345/3')
    expect(r).toEqual({
      raw: '12345/3',
      kind: 'spec',
      changeId: '12345',
      patchset: 3,
      empty: false,
    })
  })

  test('parses change number with :patchset', () => {
    const r = parseChangeInput('12345:2')
    expect(r.kind).toBe('spec')
    expect(r.changeId).toBe('12345')
    expect(r.patchset).toBe(2)
  })

  test('parses Change-ID (I + 40 hex)', () => {
    const id = 'If5a3ae8cb5a107e187447802358417f311d0c4b1'
    const r = parseChangeInput(id)
    expect(r).toEqual({ raw: id, kind: 'change-id', changeId: id, empty: false })
  })

  test('parses URL with project + change number', () => {
    const r = parseChangeInput('https://gerrit.example.com/c/project/+/12345')
    expect(r.kind).toBe('url')
    expect(r.changeId).toBe('12345')
    expect(r.project).toBe('project')
    expect(r.host).toBe('https://gerrit.example.com')
    expect(r.empty).toBe(false)
  })

  test('parses URL with hash format', () => {
    const r = parseChangeInput('https://gerrit.example.com/#/c/project/+/12345')
    expect(r.kind).toBe('url')
    expect(r.changeId).toBe('12345')
    expect(r.project).toBe('project')
  })

  test('parses URL with patchset', () => {
    const r = parseChangeInput('https://gerrit.example.com/c/project/+/12345/3')
    expect(r.kind).toBe('url')
    expect(r.changeId).toBe('12345')
    expect(r.patchset).toBe(3)
  })

  test('trims whitespace around input', () => {
    const r = parseChangeInput('  12345/2  ')
    expect(r.changeId).toBe('12345')
    expect(r.patchset).toBe(2)
  })

  test('marks invalid patchset as kind=invalid and strips it', () => {
    const r = parseChangeInput('12345/abc')
    expect(r.kind).toBe('invalid')
    expect(r.changeId).toBe('12345/abc')
    expect(r.empty).toBe(true)
  })

  test('marks empty input as empty+invalid', () => {
    const r = parseChangeInput('   ')
    expect(r.empty).toBe(true)
    expect(r.kind).toBe('invalid')
  })

  test('marks garbage input as invalid', () => {
    const r = parseChangeInput('not-a-change')
    expect(r.kind).toBe('invalid')
    expect(r.empty).toBe(true)
  })

  test('does not treat partial Change-ID as change-id', () => {
    // `Iabc` is short of 40 hex; it must NOT match the strict Change-ID branch.
    const r = parseChangeInput('Iabc')
    expect(r.kind).toBe('invalid')
  })

  test('decodes URL-encoded project name (best-effort)', () => {
    // Project name with %2F is the same project as one with a / on the wire.
    const r = parseChangeInput('https://gerrit.example.com/c/foo%2Fbar/+/12345')
    expect(r.kind).toBe('url')
    expect(r.changeId).toBe('12345')
    // Project is exposed as-is from the URL pathname (the browser keeps %2F
    // encoded in the path segment; downstream code can decodeURIComponent
    // before comparing against project names returned by the Gerrit API).
    expect(r.project).toBe('foo%2Fbar')
  })
})

describe('buildChangeUrl', () => {
  test('builds canonical URL with project', () => {
    const url = buildChangeUrl({
      host: 'https://gerrit.example.com',
      project: 'my-project',
      changeNumber: 12345,
    })
    expect(url).toBe('https://gerrit.example.com/c/my-project/+/12345')
  })

  test('builds URL without project (legacy form)', () => {
    const url = buildChangeUrl({ host: 'https://gerrit.example.com', changeNumber: 12345 })
    expect(url).toBe('https://gerrit.example.com/c/+/12345')
  })

  test('appends patchset when provided', () => {
    const url = buildChangeUrl({
      host: 'https://gerrit.example.com',
      project: 'p',
      changeNumber: 12345,
      patchset: 3,
    })
    expect(url).toBe('https://gerrit.example.com/c/p/+/12345/3')
  })

  test('normalises host without protocol', () => {
    const url = buildChangeUrl({
      host: 'gerrit.example.com/',
      project: 'p',
      changeNumber: 1,
    })
    expect(url).toBe('https://gerrit.example.com/c/p/+/1')
  })

  test('encodes special characters in project name', () => {
    // encodeURIComponent escapes spaces; encodeURI leaves `/` and `?` alone,
    // so the project path naturally keeps the `/` separator.
    const url = buildChangeUrl({
      host: 'https://gerrit.example.com',
      project: 'weird/name with space',
      changeNumber: 1,
    })
    expect(url).toContain('weird/name%20with%20space')
  })
})

describe('extractPushOutputChangeUrl', () => {
  test('extracts the change URL from push output', () => {
    const output = `remote: Processing changes: new: 1, done
remote:
remote: SUCCESS
remote:
remote:   https://gerrit.example.com/c/project/+/12345 Fix auth bug [NEW]
remote:`
    expect(extractPushOutputChangeUrl(output)).toBe('https://gerrit.example.com/c/project/+/12345')
  })

  test('returns null when no change URL is present', () => {
    const output = `Everything up-to-date\nremote: no new changes`
    expect(extractPushOutputChangeUrl(output)).toBeNull()
  })
})

describe('parseRemoteHost', () => {
  test('parses SSH remote', () => {
    expect(parseRemoteHost('git@gerrit.example.com:project.git')).toBe('gerrit.example.com')
  })

  test('parses HTTPS remote', () => {
    expect(parseRemoteHost('https://gerrit.example.com/project')).toBe('gerrit.example.com')
  })

  test('returns null for unknown shapes', () => {
    expect(parseRemoteHost('not a url')).toBeNull()
  })

  test('returns null for malformed URLs', () => {
    expect(parseRemoteHost('https://')).toBeNull()
  })
})

describe('resolveChangeId', () => {
  test('returns parsed changeId for a number', async () => {
    const id = await Effect.runPromise(resolveChangeId('12345'))
    expect(id).toBe('12345')
  })

  test('returns parsed changeId for a Change-ID', async () => {
    const cid = 'If5a3ae8cb5a107e187447802358417f311d0c4b1'
    const id = await Effect.runPromise(resolveChangeId(cid))
    expect(id).toBe(cid)
  })

  test('returns parsed changeId from a URL', async () => {
    const id = await Effect.runPromise(
      resolveChangeId('https://gerrit.example.com/c/project/+/12345'),
    )
    expect(id).toBe('12345')
  })

  test('fails with InvalidChangeInputError on garbage when allowHead=false', async () => {
    const exit = await Effect.runPromiseExit(resolveChangeId('garbage'))
    expect(exit._tag).toBe('Failure')
    if (exit._tag === 'Failure') {
      const err = exit.cause
      expect(String(err)).toContain(InvalidChangeInputError.name)
    }
  })

  test('fails with InvalidChangeInputError on empty input', async () => {
    const exit = await Effect.runPromiseExit(resolveChangeId('   '))
    expect(exit._tag).toBe('Failure')
  })
})
