# T-113 — A full gate run on the restructured repository

**Source:** the owner, 2026-10-06; T-101 rewrote `scripts/gate.mjs` and only exercised `--where` and its argument validation · **Size:** S · **Needs:** U-02, U-07, F-17, T-103 … T-112 · **Status:** open

## Why

The last full gate was the v1.0.0 release gate ([`../../reports/gates/M8-gate.md`](../../reports/gates/M8-gate.md)). Since then the UI fixes, the balance fixes and the docs restructure have landed, and the gate script itself was rewritten: it takes a label, writes `reports/gates/<label>-gate.md`, always runs the build and the performance tier, and adds `docs:check`. Nobody has run it end to end since.

## What to do

1. On a quiet machine (no other agent running tests), run `npm run gate` on `master` with a dated label.
2. If a step fails, fix the cause, or add a `T-1nn` row for it if it is not a quick fix. Do not loosen a check.
3. Confirm the report lists every step, the scenario table, the coverage gates and the per-system timings, and that it does not overwrite an earlier report.
4. Commit the report with the regenerated screenshots.

## Done

- `reports/gates/<date>-gate.md` exists and every step in it passed.
- Any failure found is fixed or has a backlog row.
