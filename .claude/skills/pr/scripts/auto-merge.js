import {
  POLL_INTERVAL_MS,
  createLogger,
  createRunner,
  getBranch,
  syncMain,
  sleep,
} from './utils.js'

const log = createLogger('auto-merge')
const runner = createRunner(log)
const { capture } = runner

async function getPrNumber () {
  const branch = await getBranch(runner)

  const prJson = await capture([
    'gh', 'pr', 'list',
    '--head', branch,
    '--json', 'number',
    '--limit', '1',
  ])

  const prs = JSON.parse(prJson)

  if (prs.length === 0) {
    log.fail(`No PR found for branch "${branch}".`)
  }

  return prs[0].number
}

async function waitForPrChecks (prNumber) {
  log.info(`Waiting for PR #${prNumber} checks to complete...`)

  while (true) {
    const requiredJson = await capture([
      'gh', 'pr', 'checks', `${prNumber}`,
      '--json', 'name,bucket',
      '--required',
    ])

    const required = JSON.parse(requiredJson)
    const requiredFailed = required.filter(check => check.bucket === 'fail')

    if (requiredFailed.length > 0) {
      const names = requiredFailed
        .map(check => check.name)
        .join(', ')

      log.fail(`Required checks failed: ${names}`)
    }

    const allJson = await capture([
      'gh', 'pr', 'checks', `${prNumber}`,
      '--json', 'name,bucket',
    ])

    const all = JSON.parse(allJson)

    if (all.length === 0) {
      log.warn('No checks found yet. Retrying...')

      await sleep(POLL_INTERVAL_MS)

      continue
    }

    const pending = all.filter(check => check.bucket === 'pending')

    if (pending.length === 0) {
      log.info('All checks finished. Required checks passed.')

      return
    }

    const names = pending
      .map(check => check.name)
      .join(', ')

    log.warn(`Waiting on: ${names}`)

    await sleep(POLL_INTERVAL_MS)
  }
}

async function waitForMainBuild () {
  log.info('Waiting for main branch build to complete...')

  await sleep(POLL_INTERVAL_MS)

  while (true) {
    const json = await capture([
      'gh', 'run', 'list',
      '--branch', 'main',
      '--limit', '1',
      '--json', 'status,conclusion,name',
    ])

    const runs = JSON.parse(json)

    if (runs.length === 0) {
      log.warn('No workflow runs found on main yet. Retrying...')

      await sleep(POLL_INTERVAL_MS)

      continue
    }

    const run = runs[0]

    if (run.status !== 'completed') {
      log.warn(`Build "${run.name}" is ${run.status}...`)

      await sleep(POLL_INTERVAL_MS)

      continue
    }

    if (run.conclusion !== 'success') {
      log.fail(
        `Main branch build "${run.name}" `
        + `finished with conclusion: ${run.conclusion}`,
      )
    }

    log.info('Main branch build passed.')

    return
  }
}

async function main () {
  const branch = await getBranch(runner)
  const prNumber = await getPrNumber()

  await waitForPrChecks(prNumber)

  log.info(`Merging PR #${prNumber} (squash)...`)

  await capture([
    'gh', 'pr', 'merge', String(prNumber), '--squash',
  ])

  log.info(`PR #${prNumber} merged.`)

  await waitForMainBuild()
  await syncMain(branch, log, runner)

  log.info('Auto-merge complete.')
}

main()
