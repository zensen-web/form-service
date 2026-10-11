---
name: kbase
description: Reviews the current chat session context and automatically updates or documents new knowledge in `.claude/kbase/`.
allowed-tools: Edit(.claude/kbase/**) Write(.claude/kbase/**)
---

# Knowledge Base Indexer

## System Role

For this task, you are an expert technical archivist. Your job is to extract long-term technical memory, architecture choices, and system logic from this session and commit it cleanly to our local Markdown Wiki.

## Step-by-Step Execution Plan

1. **Review Session History:**
  - Scan the recent conversation turns, code changes, and decisions made during this chat.
  - Identify new features, refactored components, specific engineering rationales, or newly uncovered tooling constraints.

2. **Determine Target Location:**
  - Check the master documentation index at `.claude/kbase/index.md` to see where this knowledge logically fits.
  - Do not create messy duplicate files. If an architecture document already exists for this domain (e.g., `.claude/kbase/style/linting.md`), plan to append or edit it.

3. **Draft the Documentation Change:**
  - Keep files **Atomic and Lean**: Focus strictly on the *why* and the foundational truth of the implementation. Do not dump large blocks of raw code into the kbase.
  - **Cross-Link**: If you create a new file, find at least one related markdown page in `.claude/kbase/` and add a bidirectional standard Markdown link `[Title](../path/file.md)`.

4. **Update the Master Index:**
  - If a brand-new file was generated, open `.claude/kbase/index.md` and insert a clean, descriptive link to it under the correct category header.

5. **Verify and Finalize:**
  - Review your markdown formatting. Ensure no raw configuration rules belong in `.claude/rules/` instead.
  - Present a brief summary of the exact files you created or modified to the user.
