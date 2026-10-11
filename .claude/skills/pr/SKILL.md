---
name: pr
description: Automates the full PR workflow -- sync branches, update CHANGELOG/READMEs, create/update PR, optionally merge and publish.
arguments: []
argument-hint: "[auto-commit] [version-bump=<patch|minor|major>]"
allowed-tools:
  - Bash
  - Skill
  - Edit
  - Write
  - AskUserQuestion
---

# PR Workflow

## System Role

You are a release engineer executing a structured, multi-phase PR workflow. You follow each phase in order, run scripts for mechanical operations, and use your own reasoning for content generation. If any script exits non-zero, report the failure and stop immediately. Do not attempt fixes.

## Argument Validation

Before starting any phase:

1. Parse `$ARGUMENTS` for an optional `version-bump=<value>`. If present, the value must be `patch`, `minor`, or `major`. If present with any other value, stop and tell the user the value is invalid.
2. Parse `$ARGUMENTS` for an optional `auto-commit` keyword. If present, the sync script will stage, commit, and push any uncommitted changes before syncing.
3. Determine the phase behavior:
   - `version-bump=` set: run all phases (1-7)
   - No `version-bump=`: run phases 1-5, skip phases 6-7 (Auto-Merge and Auto-Publish)

## Phase 1: Clean and Sync Branches

1. Run the sync script. If `auto-commit` is present in `$ARGUMENTS`, pass `--commit`:
   ```
   bun .claude/skills/pr/scripts/sync-branches.js --commit
   ```
   Otherwise, run without the flag:
   ```
   bun .claude/skills/pr/scripts/sync-branches.js
   ```
   If it exits non-zero, report the error and stop.

2. Invoke the `kbase` skill to update the internal knowledge base.

3. Check if any files in `.claude/kbase/` were modified. If so, stage, commit, and push those changes.

## Phase 2: Lint

1. Run the lint script:
   ```
   bun .claude/skills/pr/scripts/lint.js
   ```
   If it exits non-zero, report the error and stop. The script runs `lint:fix` then `lint`, and commits any fixes automatically.

## Phase 3: Sync CHANGELOG

This phase uses your reasoning, not a script.

1. Run `git diff main...HEAD` to identify all changes on the branch.
2. Draft CHANGELOG entries for the `## [Unreleased]` section using these headings (only include sections that have content):
   - `### Added`: new features or pure enhancements that do not change existing functionality
   - `### Changed`: changes to existing functionality not covered by Added or Removed
   - `### Deprecated`: features that will be removed in a future release
   - `### Removed`: features or capabilities that were removed
   - `### Fixed`: bug fixes
   - `### Security`: vulnerability fixes
   - `### Documentation`: documentation-only changes (include only if no other sections apply)
3. Follow the existing CHANGELOG entry format: bolded summary followed by explanation text.
4. Do not use `**Breaking:**` or `**Breaking (package):**` prefixes.
5. Only document changes related to package functionality. Do not document changes to linting, testing, NPM commands, or other project structure/config.
6. Present the drafted entries to the user via `AskUserQuestion`:
   - **Proceed**: stage, commit, and push all changes, then continue
   - **Stop**: halt skill execution
7. If the user chooses Proceed, edit `CHANGELOG.md` with the drafted entries, then stage, commit, and push.

## Phase 4: Update README Docs

1. Run the find-readmes script:
   ```
   bun .claude/skills/pr/scripts/find-readmes.js
   ```
   If it exits non-zero, report the error and stop. The script outputs a JSON array of README paths.

2. Run `git diff main...HEAD` to determine what functionality changed on this branch.

3. For each README path returned by the script, update its content to reflect the changes identified in the diff. Focus on API changes, new features, removed features, and changed behavior.

4. Present the README changes to the user via `AskUserQuestion`:
   - **Proceed**: stage, commit, and push all changes, then continue
   - **Stop**: halt skill execution
5. If the user chooses Proceed, stage, commit, and push.

## Phase 5: Manage PR

The PR description is assembled from two sections:
- **Changelog**: the `## Unreleased` entries from `CHANGELOG.md` (may be empty)
- **Structural**: non-functionality changes (tooling, CI, documentation, skill development, config)

1. Identify structural changes by running `git diff main...HEAD --stat`. Look for changes that were not documented in the CHANGELOG (because they are not package functionality). If any exist, draft a concise Markdown summary of those changes. If there are no structural changes, skip this step.

2. Present the drafted structural summary to the user via `AskUserQuestion`:
   - **Proceed**: continue with this description
   - **Stop**: halt skill execution

3. Run the manage-pr script, passing the structural summary as an argument:
   ```
   bun .claude/skills/pr/scripts/manage-pr.js "<structural summary>"
   ```
   If there is no structural summary, run without arguments:
   ```
   bun .claude/skills/pr/scripts/manage-pr.js
   ```
   The script extracts the `[Unreleased]` changelog content itself and combines both sections into the final PR description. If it exits non-zero, report the error and stop.

4. If `version-bump=` was not provided, the skill is done. Do not prompt the user.

5. Otherwise, present via `AskUserQuestion`:
   - **Proceed**: continue to auto-merge and auto-publish
   - **Stop**: halt skill execution

## Phase 6: Auto-Merge

Skip this phase entirely if `version-bump=` was not provided.

1. Run the auto-merge script:
   ```
   bun .claude/skills/pr/scripts/auto-merge.js
   ```
   If it exits non-zero, report the error and stop.

## Phase 7: Auto-Publish

Skip this phase entirely if `version-bump=` was not provided.

1. Run the auto-publish script with the version bump type:
   ```
   bun .claude/skills/pr/scripts/auto-publish.js <version value>
   ```
   If it exits non-zero, report the error and stop.
