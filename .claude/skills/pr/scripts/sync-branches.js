import {
  createLogger,
  createRunner,
  getBranch,
  syncMain,
} from './utils.js'

const log = createLogger('sync')
const runner = createRunner(log)

async function main () {
  const shouldCommit = Bun.argv.includes('--commit')
  const branch = await getBranch(runner)

  if (shouldCommit) {
    const status = await runner.capture(['git', 'status', '--porcelain'])

    if (status) {
      log.info('Staging, committing, and pushing changes...')

      await runner.run(['git', 'add', '-A'])
      await runner.run(['git', 'commit', '-m', 'Implemented'])
      await runner.run(['git', 'push', 'origin', branch])
    } else {
      log.info('Nothing to commit.')
    }
  } else {
    const status = await runner.capture(['git', 'status', '--porcelain'])

    if (status) {
      /* eslint-disable max-len */
      log.fail(`
Working tree is not clean. Commit or discard all changes before running the /pr skill.

${status}
      `.trim())
      /* eslint-enable max-len */
    }
  }

  if (branch === 'main') {
    log.fail('Cannot run the pr skill from the main branch.')
  }

  log.info(`Current branch: ${branch}`)

  await syncMain(branch, log, runner)

  log.info('Pushing branch...')
  await runner.run(['git', 'push', 'origin', branch])

  log.info('Branch synced successfully.')
}

main()
