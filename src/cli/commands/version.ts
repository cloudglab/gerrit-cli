import { getCliVersion } from '@/version'

interface VersionOptions {
  json?: boolean
  xml?: boolean
}

export function versionCommand(options: VersionOptions): void {
  const version = getCliVersion()

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          name: 'gerrit-cli',
          version,
          hint: 'Run gerrit-cli update to check for updates',
        },
        null,
        2,
      ),
    )
  } else if (options.xml) {
    console.log(`<?xml version="1.0" encoding="UTF-8"?>`)
    console.log(`<version_info>`)
    console.log(`  <name>gerrit-cli</name>`)
    console.log(`  <version>${version}</version>`)
    console.log(`  <hint>Run gerrit-cli update to check for updates</hint>`)
    console.log(`</version_info>`)
  } else {
    console.log(version)
    console.log(`Run gerrit-cli update to check for updates`)
  }
}
