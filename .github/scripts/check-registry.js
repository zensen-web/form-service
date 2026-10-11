// Verifies that a computed version is publishable for every given package.
//
// Usage: bun .github/scripts/check-registry.js <version> <package...>
//
// For each package this asserts two things:
//   1. the version is not already published, so the name@version is available
//   2. the version is greater than the package's current `latest`, which
//      catches manifest drift that would publish a non-latest version
//
// Every package is checked before exiting so a bad invocation reports all of
// its problems in one run rather than one per attempt.

const REGISTRY = 'https://registry.npmjs.org'

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

  if (latest && Bun.semver.order(version, latest) !== 1) {
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

const [version, ...names] = Bun.argv.slice(2)

if (!version || !names.length) {
  console.error('Usage: check-registry.js <version> <package...>')
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
