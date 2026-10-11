// Verifies that a computed version is publishable for every given package.
//
// Usage: bun .github/scripts/check-registry.mjs <version> <package...>
//
// For each package this asserts two things:
//   1. the version is not already published, so the name@version is available
//   2. the version is greater than the package's current `latest`, which
//      catches manifest drift that would publish a non-latest version
//
// Every package is checked before exiting so a bad invocation reports all of
// its problems in one run rather than one per attempt.

const REGISTRY = 'https://registry.npmjs.org'

// Orders two semver strings per https://semver.org/#spec-item-11, returning
// 1, 0, or -1. Build metadata is ignored, as the spec requires.
function compareVersions (a, b) {
  const parse = version => {
    const [core, pre] = version.split('+')[0].split(/-(.*)/s)

    return {
      core: core.split('.').map(Number),
      pre: pre ? pre.split('.') : [],
    }
  }

  const left = parse(a)
  const right = parse(b)

  for (let i = 0; i < 3; i++) {
    if (left.core[i] !== right.core[i]) {
      return left.core[i] > right.core[i] ? 1 : -1
    }
  }

  // A version without a prerelease tag outranks one with it.
  if (!left.pre.length || !right.pre.length) {
    return Math.sign(right.pre.length - left.pre.length)
  }

  for (let i = 0; i < Math.max(left.pre.length, right.pre.length); i++) {
    const x = left.pre[i]
    const y = right.pre[i]

    if (x === undefined) return -1
    if (y === undefined) return 1
    if (x === y) continue

    const xNum = /^\d+$/.test(x)
    const yNum = /^\d+$/.test(y)

    if (xNum && yNum) return Number(x) > Number(y) ? 1 : -1
    if (xNum) return -1
    if (yNum) return 1

    return x > y ? 1 : -1
  }

  return 0
}

async function fetchPackument (name) {
  const response = await fetch(`${REGISTRY}/${name}`)

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new Error(`Registry lookup failed for ${name}: ${response.status}`)
  }

  return response.json()
}

async function checkPackage (name, version) {
  const packument = await fetchPackument(name)

  if (!packument) {
    console.info(`${name}: unpublished, ${version} is available`)

    return []
  }

  const errors = []
  const latest = packument['dist-tags']?.latest
  const versions = Object.keys(packument.versions ?? {})

  if (versions.includes(version)) {
    errors.push(
      `${name}: ${version} is already published. `
      + 'npm never allows a version to be reused.',
    )
  }

  if (latest && compareVersions(version, latest) !== 1) {
    errors.push(
      `${name}: ${version} is not greater than the published `
      + `latest (${latest}). It would not become the latest version.`,
    )
  }

  if (!errors.length) {
    console.info(`${name}: ${version} available, latest is ${latest}`)
  }

  return errors
}

const [version, ...names] = process.argv.slice(2)

if (!version || !names.length) {
  console.error('Usage: check-registry.mjs <version> <package...>')
  process.exit(1)
}

const results = await Promise.all(
  names.map(name => checkPackage(name, version)),
)

const errors = results.flat()

if (errors.length) {
  console.error(`\nRegistry pre-flight failed for ${version}:\n`)
  errors.forEach(error => console.error(`  ${error}`))
  process.exit(1)
}

console.info(`\nRegistry pre-flight passed for ${version}`)
