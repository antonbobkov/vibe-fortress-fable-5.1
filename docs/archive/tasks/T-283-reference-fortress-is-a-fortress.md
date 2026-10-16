# T-283 — The 80-dwarf reference fortress has workshops, farms, a squad, a depot and a gate

**Closed:** 2026-10-16, in e2f0e4d, 6086caa.

**Source:** T-116 and its report, [`../../reports/audits/2026-10-12-ui-ux.md`](../../../reports/audits/2026-10-12-ui-ux.md) (§ 4, § 9) · **Size:** M · **Needs:** — · **Status:** open (test side; no change to the game)

## Why

`test/fixtures/reference-fortress.deepholm` is the fixture for "a mature fortress": the performance tier times it and the UI audit used it for everyday tasks. It holds 80 dwarves, 99 beds, 100 each of chairs, tables, statues and chain posts, 15 four-tile stockpiles and 15 bedrooms. It has no workshop, no farm plot, no squad, no trade depot, no door and no trap, and every labor of every dwarf is on. So the audit could not measure re-equipping a squad, answering a raid or reading a busy order list there, and a timing taken on it says nothing about workshops, farming or the military.

## Reproduction

Load the fixture through Load › Import and read the hook's readers, as the capture's flow 3 did (the paragraph "What the reference fortress contains" in [`capture-index.md`](../../../reports/audits/2026-10-12-ui-ux/capture-index.md)).

## What the spec says

- [`performance-budget.md`](../../01-architecture/performance-budget.md): what the reference fortress is and which budgets are measured on it.
- [`testing-strategy.md`](../../process/testing-strategy.md): fixtures and how they are built.

## What to do

**Decisions.**
- The fixture is built by its script, not edited by hand. The script gains, with fixed positions and the fixture's seed:
  - one of each workshop that has recipes, twelve of them with a standing order that its stock can feed for at least a season;
  - six farm plots (two surface, four cave) with a crop for every season, and seeds;
  - food, drink and a still, so that nobody starves within the fixture's measured span;
  - two squads of six with weapons and armor in stock, a barracks each, one on Train;
  - a hospital zone with beds, a chest, cloth, thread and brightleaf;
  - a trade depot, and an entrance with a door set to lock on alert, a drawbridge with a lever, and four cage traps;
  - stockpiles of realistic size (at least 5×5) with the presets a played fortress uses, in place of the fifteen 2×2 ones;
  - labors set by profession templates, so that not every labor is on for everyone.
- The old fixture is kept under the name `reference-fortress-furniture.deepholm` for the budgets that were measured on it, so that no number changes meaning silently. `performance-budget.md` says, for each budget, which fixture it is measured on, and a budget about a system that only the new fixture exercises is re-measured on the new one and reported as a new figure, with the old one marked "not exercised".
- No UI or simulation code changes. If building the fixture finds a defect, it becomes a backlog row.

1. Amend `performance-budget.md` (the two fixtures and which budget uses which).
2. Implement in the fixture's build script under `scripts/` or `test/` and regenerate the fixture; keep the old file under its new name.
3. Tests: the fixture's own check asserts what it contains (counts of workshops, plots, squads, the depot, the gate), in the way T-156 asks of the long fixtures. `npm run test:perf` is run once on the new fixture and its figures are reported in a new dated report under `reports/audits/`.

## Done

- The new fixture loads, runs a season with nobody starving, and its check lists what it contains.
- `performance-budget.md` names the fixture for every budget.
- The verification commands of [`../process/agent-workflow.md`](../../process/agent-workflow.md) are green, with `npm run test:perf`.
