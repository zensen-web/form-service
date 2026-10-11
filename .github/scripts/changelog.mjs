/*
 *  Reads and rewrites the root CHANGELOG.md around its `## Unreleased`
 *  section.
 *
 *  Usage:
 *    node .github/scripts/changelog.mjs check
 *      Exits non-zero when the Unreleased section has no entries. Guards
 *      against cutting a release with nothing to say.
 *
 *    node .github/scripts/changelog.mjs extract
 *      Prints the Unreleased body. Used for the GitHub Release notes.
 *
 *    node .github/scripts/changelog.mjs promote <version> <date>
 *      Renames `## Unreleased` to a `## [<version>](<npm>) - <date>` heading
 *      linking to that release on npm, and inserts a fresh empty Unreleased
 *      above it.
 */

import { readFile, writeFile } from 'node:fs/promises'

const NPM = 'https://www.npmjs.com/package/@zensen/form-service/v'
const PATH = 'CHANGELOG.md'
const UNRELEASED = '## Unreleased'

function readSections (text) {
  const start = text.indexOf(UNRELEASED)

  if (start === -1) {
    throw new Error(`${PATH} has no "${UNRELEASED}" heading`)
  }

  const afterHeading = start + UNRELEASED.length
  const next = text.indexOf('\n## ', afterHeading)
  const end = next === -1 ? text.length : next

  return {
    head: text.slice(0, start),
    body: text.slice(afterHeading, end).trim(),
    tail: text.slice(end),
  }
}

function check (text) {
  const { body } = readSections(text)

  if (!body) {
    console.error(
      `${PATH} has an empty "${UNRELEASED}" section. `
      + 'Add entries describing this release before publishing.',
    )

    process.exit(1)
  }

  console.info(`${PATH}: Unreleased section has content`)
  process.exit(0)
}

function extract (text) {
  const { body } = readSections(text)

  console.log(body)
  process.exit(0)
}

async function promote (text, version, date) {
  const { head, body, tail } = readSections(text)

  if (!version || !date) {
    console.error('Usage: changelog.mjs promote <version> <date>')
    process.exit(1)
  }

  // The heading carries its own link, so there is no definition block to keep
  // in sync — and `Unreleased` stays unlinked, having nothing to point at yet.
  const next = [
    head + UNRELEASED,
    '',
    `## [${version}](${NPM}/${version}) - ${date}`,
    '',
    body,
    tail.trimEnd(),
    '',
  ].join('\n')

  await writeFile(PATH, next)

  console.info(`${PATH}: promoted Unreleased to ${version} (${date})`)
  process.exit(0)
}

async function main () {
  const [command, version, date] = process.argv.slice(2)
  const text = await readFile(PATH, 'utf8')

  switch (command) {
    case 'check':
      check(text)
      break

    case 'extract':
      extract(text)
      break

    case 'promote':
      await promote(text, version, date)
      break

    default:
      console.error('Usage: changelog.mjs <check|extract|promote>')
      process.exit(1)
      break
  }
}

main()
