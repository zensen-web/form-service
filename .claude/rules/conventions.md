---
paths:
  - "**/*.js"
  - "**/*.ts"
---

# Conventions

Small, mechanical conventions for source in this repo. These are not enforced by ESLint, so
apply them by hand when writing or editing code.

## Numbers

- Use `Number.parseInt()` instead of the global `parseInt()`.
- Always pass an explicit radix of `10`: `Number.parseInt('123', 10)`.
