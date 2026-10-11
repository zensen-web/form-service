import {
  createLogger,
  createRunner,
  getBranch,
} from './utils.js'

const log = createLogger('lint')
const runner = createRunner(log)

async function main () {
  log.info('Running lint:fix...')

  await runner.run(['bun', 'run', 'lint:fix'])

  const status = await runner.capture(['git', 'status', '--porcelain'])

  if (status) {
    log.info('Committing lint fixes...')

    const branch = await getBranch(runner)

    await runner.run(['git', 'add', '-A'])
    await runner.run(['git', 'commit', '-m', 'Linting'])
    await runner.run(['git', 'push', 'origin', branch])

    log.info('Lint fixes committed and pushed.')
  } else {
    log.info('No lint changes to commit.')
  }

  log.info('Running lint...')

  await runner.run(['bun', 'run', 'lint'])

  log.info('Lint passed.')
}

main()
