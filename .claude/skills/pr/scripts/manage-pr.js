import {
  createLogger,
  createRunner,
  getBranch,
} from './utils.js'

const log = createLogger('manage-pr')
const runner = createRunner(log)

async function extractChangelog () {
  const proc = Bun.spawn(
    ['bun', '.github/scripts/changelog.js', 'extract'],
    { stderr: 'pipe' },
  )

  const text = await new Response(proc.stdout).text()

  await proc.exited

  return text.trim()
}

function buildBody (changelog, structural) {
  const sections = []

  if (changelog) {
    sections.push('## Changelog\n\n' + changelog)
  }

  if (structural) {
    sections.push('## Structural\n\n' + structural)
  }

  return sections.join('\n\n')
}

async function main () {
  const structural = Bun.argv[2] || ''
  const changelog = await extractChangelog()
  const body = buildBody(changelog, structural)

  if (!body) {
    log.fail(
      'No PR description available. The [Unreleased] '
      + 'section is empty and no structural summary '
      + 'was provided.',
    )
  }

  if (changelog) {
    log.info('Changelog entries found.')
  }

  if (structural) {
    log.info('Structural summary provided.')
  }

  const branch = await getBranch(runner)

  const prJson = await runner.capture([
    'gh', 'pr', 'list',
    '--head', branch,
    '--json', 'number',
    '--limit', '1',
  ])

  const prs = JSON.parse(prJson)

  if (prs.length === 0) {
    log.info('No existing PR found. Creating one...')

    await runner.capture([
      'gh', 'pr', 'create',
      '--base', 'main',
      '--head', branch,
      '--title', branch,
      '--body', body,
    ])

    log.info('PR created.')
  } else {
    const number = prs[0].number

    log.info(`Updating existing PR #${number}...`)

    await runner.capture([
      'gh', 'pr', 'edit', String(number),
      '--body', body,
    ])

    log.info(`PR #${number} updated.`)
  }
}

main()
