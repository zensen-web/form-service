---
paths:
  - "**/*.test.js"
  - "**/*.test.ts"
---

# Writing tests

Guidelines for tests in this repo, on top of what's already in `CLAUDE.md`. Applies to both
unit tests (colocated `*.test.js`) and integration tests
(`packages/server/tests/<category>/<case>/integration.test.js`).

## Structure

- Follow **AAA** (_Arrange_, _Act_, _Assert_) within each `test()` body.
- `describe()` block usage:
  - Use to group tests for functions, classes, and class methods
  - Avoid using for high-level tests (such as E2E tests)
  - Class methods (static and instance) get a nested `describe()` block
  - Function/instance method example: `describe('createMessage()')`
  - Static method example: `describe('.connect()')` (leading dot, no class name)
- Every `test()` name starts with `"when …"`
  - Test labels
    - Describe the "cause" (_Act_ portion)
    - **DOES NOT** describe the "effect" (_Assert_ portion)
  - Assertions will articulate the expected "effect"
  - Example: `test('when the queue is empty', ...)`
- Write and order **failure cases before success cases** within a `describe()` block.
- Avoid mixing the _Act_ and _Assert_ phases where possible
- Don't write helper functions that mix _Act_ and _Assert_ phases

## Assertions

- Prefer `.toHaveBeenCalledOnce()` over `.toHaveBeenCalledTimes(1)`.
- For whole-object assertions, use `expect(actual).toStrictEqual({...})` with the full expected
  shape spelled out, rather than checking individual fields piecemeal.
- When an object contains a generated/non-deterministic field (e.g. a uuid `id`), echo the actual
  value back into the expected object (`id: actual.id`) instead of asserting on it separately —
  this keeps `toStrictEqual` exact everywhere else without fighting randomness.
- When testing functions that should throw an error
  - If synchronous:
    1. Wrap the function call into a variable called `fn`
    2. Pass `fn` into `expect()`
  - If asynchronous:
    1. Call the function, assign return value to a variable called `promise`
    2. Pass `promise` into `await expect()`

## Named Constants

- Use `StatusCode` and `ServerCloseSignals`/`ClientCloseSignals` instead of numeric literals for status codes and close codes.
- Import from `sleepy-serv` in E2E tests, and from the relative `../src` path in integration and unit tests.

## References

- For detailed architecture regarding unit, integration, and E2E setups, see `@.claude/kbase/architecture/testing.md`.
- For guidelines on fake timers and mocking philosophy, see `@.claude/kbase/guides/testing-patterns.md`.
