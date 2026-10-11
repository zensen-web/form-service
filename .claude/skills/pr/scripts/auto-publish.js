import {
  POLL_INTERVAL_MS,
  createLogger,
  createRunner,
  getBranch,
  syncMain,
  sleep,
} from './utils.js'

const VALID_BUMPS = ['major', 'minor', 'patch']

const log = createLogger('auto-publish')
const runner = createRunner(log)
const { capture } = runner

async function main () {
  const bump = Bun.argv[2]

  if (!bump || !VALID_BUMPS.includes(bump)) {
    log.fail(
      `Invalid bump type: "${bump}". `
      + `Must be one of: ${VALID_BUMPS.join(', ')}`,
    )
  }

  const branch = await getBranch(runner)

  log.info(`Triggering publish workflow with bump=${bump}...`)

  await capture([
    'gh', 'workflow', 'run', 'publish.yml',
    '-f', `bump=${bump}`,
  ])

  log.info('Waiting for publish workflow to start...')

  await sleep(POLL_INTERVAL_MS)

  while (true) {
    const json = await capture([
      'gh', 'run', 'list',
      '-w', 'publish.yml',
      '--limit', '1',
      '--json', 'status,conclusion,name,databaseId',
    ])

    const runs = JSON.parse(json)

    if (runs.length === 0) {
      log.warn('No publish workflow runs found yet. Retrying...')

      await sleep(POLL_INTERVAL_MS)
      continue
    }

    const latest = runs[0]

    if (latest.status !== 'completed') {
      log.warn(`Publish workflow is ${latest.status}...`)

      await sleep(POLL_INTERVAL_MS)
      continue
    }

    if (latest.conclusion !== 'success') {
      log.fail(
        'Publish workflow finished with '
        + `conclusion: ${latest.conclusion}`,
      )
    }

    log.info('Publish workflow completed successfully.')

    break
  }

  await syncMain(branch, log, runner)
}

main()
