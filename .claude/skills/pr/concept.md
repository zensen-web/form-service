**IGNORE THIS**

This is only here for historic purposes, and should not be used by the skill's logic.

# Overview

Create a new skill called "pr". This skill should **ONLY** ever be triggered manually, and it should be idempotent. This skill should come with a few scripts that it runs, and are detailed below.

Follow these steps if a script fails for any reason:

1. Let the user know that the script failed
2. Tell the user why it failed
3. Stop and bail on any further skill execution
4. **DO NOT** attempt to make any fixes --only observe and report

Use the GitHub CLI for any communications with GitHub.

## Skill Params

All params should be optional, and have defaults

- [major|minor|patch]:
    - Description: The version bump to apply to the package(s) during auto-publish
    - Type: positional
    - Required
- [$skip]
    - Description option to skip the certain phases
    - Type: named
    - Options:
        - `auto-merge`: skips the `auto-merge` phase and all further phases
        - `auto-publish`: skips the `auto-publish` phase and all further phases
        - Throw an error if no valid option is provided

## Process

### 1. Clean and Sync Branches

Write a script that does the following:

1.  Throw an error if there's any uncommitted state
2.  Run the `kbase` skill to update the internal knowledge base
3.  Commit and push any changes made to files in the `kbase` skill
4.  Switch to the `main` branch
5.  Pull the latest from `main` to ensure the local `main` branch is up-to-date
6.  Switch back to previous branch
7.  Merge the local `main` branch into the current branch
8.  Throw an error if there are any merge conflicts
9.  Push the branch

Finally, run this script for this phase of the skill.

### 2. Sync CHANGELOG

This needs to be done via your reasoning and not a script:

1. Compare the changes between the latest commit on this branch and the latest commit on `main`
2. Write up those changes in the CHANGELOG under the `## [Unreleased]` section

The CHANGELOG should have the following format (use `###` heading):

- `Added`: for new things added/pure enhancements that don't change existing functionality
- `Removed`: for things that were removed
- `Changed`: for changes in existing functionality that weren't already covered by `Added` or `[Removed`
- `Deprecated`: for soon-to-be removed features
- `Security`: in case of vulnerabilities
- `Fixed`: for any bug fixes
- `Documentation`: for documentation changes (only include if no other sections are provided)

Here are some other notes:
- Only provide sections that have content
- Breaking features are now implied (stop using **Breaking:** prefix)
- **ONLY** document changes in the changelog for things related to the package's functionality
- **DO NOT** document the following changes to any sort of project structure/config changes such as:
    - Linting
    - Testing
    - NPM commands
    - etc

Finally, prompt the user, asking them to review changes before proceeding. Provide the following options:
- Proceed:
    1. Stage, commit, and push all changes
    2. Continue with the skill
- Stop: stop the skill's execution

### 3. Update README Docs

Write a script that does the following:

1. Find each README
    - There should always be a readme at the top-level
    - If the `/packages` directory exists, then each sub-directory will have its own README
    - Throw an error if any expected READMEs are missing
2. For each README:
    1. Compare functionality changes between the latest `main` and latest commit on this branch
    2. Update README accordingly
    3. Deploy a sub-agent that updates the README according to scope

Finally, run this script for this phase of the skill. Once the script's finished, prompt the user, asking them to review changes before proceeding. Provide the following options:
- Proceed:
    1. Stage, commit, and push all changes
    2. Continue with the skill
- Stop: stop the skill's execution
### 4. Manage PR

Write a script that does the following:

1. Extract everything under the `## [Unreleased]` section and output it as a string
2. If no PR exists for this branch:
    - Creates a PR for it
    - Target the `main` branch
3. Set the PR's description to the `[Unreleased]` section of the CHANGELOG

Finally, run this script for this phase of the skill.

Once the script's finished, prompt the user, asking them to review changes before proceeding. Provide the following options:
- Proceed: continue with the skill
- Stop: stop the skill's execution

Skip prompting the user if `skip-auto-merge` is set.

### 5. Auto-Merge PR

Write a script that does the following:

1. Wait for the PR to finish building (check every 5 seconds)
2. Throw an error if the build fails
3. Merge (sqaush) the PR, which will kick off build for the `main` branch
4. Wait for the `main` build to finish (check every 5 seconds)
5. Throw an error if that build fails

Finally, run this script for this phase of the skill.

### 6. Auto-Publish PR

Write a script that does the following:

1. Run the _Publish_ GitHub Actions workflow using the provided `major|minor|patch` argument
2. Wait for the GHA workflow is finished (check every 5 seconds)
3. Throw an error if publish fails

Finally, run this script for this phase of the skill.
