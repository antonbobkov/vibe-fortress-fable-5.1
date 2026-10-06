# T-111 — UI audit follow-up: what the U tasks changed

**Source:** [`../../reports/audits/ui-audit.md`](../../reports/audits/ui-audit.md); the closing instruction of [`../archive/ui-fixes/README.md`](../archive/ui-fixes/README.md) ("When all eight are done …") · **Size:** S · **Needs:** U-02, U-04, U-05, U-07 · **Status:** open

## Why

The UI fixes plan ends with a follow-up: once all eight U tasks are done, record which audit item each one closed, and walk through the game again. An audit is never updated, so the follow-up is a new report and not an edit of `ui-audit.md`.

## What to do

1. Write a new dated report, `reports/audits/<YYYY-MM-DD>-ui-audit-follow-up.md`, with:
   - a table: audit item (the audit's own ids: issues 1–10, Q1 … Q14, M1 … M12, S1 … S9, § 4.x, § 5.x) → task (U-01 … U-08) → commit → state (fixed, partly fixed, open);
   - the hands-on walkthrough of the audit's § 2 ("A new player's first 20 minutes"), run again on the current build, saying what changed and what is still wrong.
2. For every item that is still open or only partly fixed, add a `T-1nn` row to [`../backlog.md`](../backlog.md) with the new report as its source.
3. Do not edit `reports/audits/ui-audit.md`.

## Done

- The report exists, and every audit item appears in its table exactly once.
- The verification commands of [`../process/agent-workflow.md`](../process/agent-workflow.md) are green.
