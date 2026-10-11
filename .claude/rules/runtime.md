---
paths:
  - "**/*.js"
  - "**/*.mjs"
  - "**/*.ts"
---

# Runtime

## Tech Stack & Environment

- **Runtime & Package Manager:** Always use `bun` instead of `npm`, `pnpm`, or `yarn`.
- **Package Management:** Run `bun install <package>`, never `npm install`.
- **Executing Scripts:** Use `bun run <script>` for project scripts.

## Testing & Verification

- **Test Command:** Use `bun test` to run test suites.
- **Verification:** Before marking a task as complete, always run `bun test` and ensure all tests pass.
- **Linting:** Run `bun run lint` to catch syntax or formatting issues before committing code.

## Coding Standards

- **TypeScript:** Use native Bun typing configurations.
- **Build & Run:** Use `bun run dev` for local development servers and `bun build` for bundling.
