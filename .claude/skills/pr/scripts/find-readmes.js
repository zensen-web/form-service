import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createLogger } from './utils.js'

const log = createLogger('find-readmes')

function main () {
  const missing = []
  const found = []

  if (!existsSync('README.md')) {
    missing.push('README.md')
  } else {
    found.push('README.md')
  }

  if (existsSync('packages')) {
    const entries = readdirSync('packages')

    for (const entry of entries) {
      const dir = join('packages', entry)

      if (!statSync(dir).isDirectory()) continue

      const readme = join(dir, 'README.md')

      if (!existsSync(readme)) {
        missing.push(readme)
      } else {
        found.push(readme)
      }
    }
  }

  if (missing.length > 0) {
    log.fail(
      'Missing expected READMEs:\n'
      + missing.map(p => `  - ${p}`).join('\n'),
    )
  }

  console.log(JSON.stringify(found))
}

main()
