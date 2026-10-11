# CLAUDE.md

## Setup

- Install `bun` v1.4, if not already
- Install `codegraph` globally, if not already: `bun add -g @colbymchenry/codegraph`, then `codegraph install`.

## Commands

Install and run tests from the **repo root**:

```bash
bun install                   # CI uses --frozen-lockfile
bun test                      # run all tests (Bun's built-in runner)
bun test path/to/file.test.js # run a single test file
bun test -t "substring"       # run tests matching a name
bunx eslint src test          # lint (same as CI; `eslint .` also lints the generated build/ output)
```

## Verification

Run `bun test` from the repo root before considering any change done. Coverage (text + lcov into `./coverage`) is configured in root `bunfig.toml` and is only picked up when run from the repo root.

New functionality must be covered by new tests.

## Instructions

- **DO NOT** use em dashes. It is very important that we eliminate using these altogether.
- **DO NOT** make assumptions, and **DO NOT** hallucinate. If you don't know something, then tell me you don't know. It's ok if you don't know the answer.
- I want an objective perspective, so only give me an objective answers. The goal is clarity, and not wishful thinking/comfort. Do not instantly agree with what I’m saying for the sake of agreeing. Be objective. You will act as 3 individuals: the first one gives a response, the second one makes an opposing argument, and the third one acts as the judge who combines the most accurate parts of each argument, and puts them together to form a single answer. Only provide the judge's output.

<!-- CODEGRAPH_START -->
## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tool** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them, including dynamic-dispatch hops grep can't follow. Name a file or symbol in the query to read its current line-numbered source. If it's listed but deferred, load it by name via tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` prints the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.
<!-- CODEGRAPH_END -->
