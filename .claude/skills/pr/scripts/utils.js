const BOLD = '\x1b[1m'
const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RESET = '\x1b[0m'

export const POLL_INTERVAL_MS = 10_000

export function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function createLogger (prefix) {
  return {
    info (msg) {
      console.log(`${GREEN}[${prefix}]${RESET} ${msg}`)
    },

    warn (msg) {
      console.log(`${YELLOW}[${prefix}]${RESET} ${msg}`)
    },

    fail (msg) {
      console.error(
        `${RED}${BOLD}[${prefix}] Error:${RESET} ${msg}`,
      )

      process.exit(1)
    },
  }
}

export function createRunner (logger) {
  async function run (args) {
    const proc = Bun.spawn(args, {
      stdout: 'inherit',
      stderr: 'inherit',
    })

    const code = await proc.exited

    if (code !== 0) {
      logger.fail(
        `"${args.join(' ')}" exited with code ${code}`,
      )
    }
  }

  async function capture (args) {
    const proc = Bun.spawn(args, { stderr: 'inherit' })
    const text = await new Response(proc.stdout).text()
    const code = await proc.exited

    if (code !== 0) {
      logger.fail(
        `"${args.join(' ')}" exited with code ${code}`,
      )
    }

    return text.trim()
  }

  return {
    run,
    capture,
  }
}

export async function getBranch (runner) {
  return runner.capture([
    'git', 'rev-parse', '--abbrev-ref', 'HEAD',
  ])
}

export async function syncMain (branch, logger, runner) {
  logger.info('Syncing local branch with main...')

  await runner.run(['git', 'checkout', 'main'])
  await runner.run(['git', 'pull', 'origin', 'main'])
  await runner.run(['git', 'checkout', branch])

  const merge = Bun.spawn(
    ['git', 'merge', 'main'],
    {
      stdout: 'inherit',
      stderr: 'inherit',
    },
  )

  const mergeCode = await merge.exited

  if (mergeCode !== 0) {
    const conflicts = await runner.capture([
      'git', 'diff', '--name-only', '--diff-filter=U',
    ])

    if (conflicts) {
      await runner.run(['git', 'merge', '--abort'])


      logger.fail(`
Merge conflicts detected. Resolve them manually before continuing.

Conflicting files:
${conflicts}
      `.trim())

    }

    logger.fail(
      `Merge failed with exit code ${mergeCode}`,
    )
  }

  logger.info('Local branch synced with main.')
}
