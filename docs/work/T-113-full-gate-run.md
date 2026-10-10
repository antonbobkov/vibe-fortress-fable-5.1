# T-113 — A full gate run on the restructured repository

**Source:** the owner, 2026-10-06; T-101 rewrote `scripts/gate.mjs` and only exercised `--where` and its argument validation · **Size:** S · **Needs:** T-140, T-144, T-145, T-188 · **Status:** open

## Why

The last full gate was the v1.0.0 release gate ([`../../reports/gates/M8-gate.md`](../../reports/gates/M8-gate.md)). Since then the UI fixes, the balance fixes and the docs restructure have landed, and the gate script itself was rewritten: it takes a label, writes `reports/gates/<label>-gate.md`, always runs the build and the performance tier, and adds `docs:check`. Nobody has run it end to end since.

**Order changed, orchestrator, 2026-10-08.** The gate's performance tier runs the 20-seed balance sweep, and [the T-123 diagnosis](../../reports/audits/2026-10-08-economy-at-default-priority.md) shows that sweep cannot pass until the walking-speed and fixture tasks land. So the audits T-114 to T-116 no longer wait for the gate, and the gate runs after T-140 to T-145.

**To check in this run (2026-10-09).** With wild animals spawning (T-192), one loaded-machine run of `test/perf/per-system.test.ts` measured system 08 at 0.73 ms average against its 0.40 ms allocation: inside the test's 2× tolerance, far above the allocation. Measure it on the quiet machine. If it holds near 0.7 ms, add a row for it: either the allocation is raised from the table's headroom, or wild-animal work is made cheaper.

## What to do

1. On a quiet machine (no other agent running tests), run `npm run gate` on `master` with a dated label.
2. If a step fails, fix the cause, or add a `T-1nn` row for it if it is not a quick fix. Do not loosen a check.
3. Confirm the report lists every step, the scenario table, the coverage gates and the per-system timings, and that it does not overwrite an earlier report.
4. Commit the report with the regenerated screenshots.

## Done

- `reports/gates/<date>-gate.md` exists and every step in it passed.
- Any failure found is fixed or has a backlog row.
