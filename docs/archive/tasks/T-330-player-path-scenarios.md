# T-330 — Player-path scenarios for the seven production chains

**Closed:** 2026-10-16, in 77c5e27, a5c9aef, 2b822db, 76ec232, fa5ca3f, 73e69ad, d7a3875.

**Source:** the process review, [`../../reports/audits/2026-10-15-process-review.md`](../../../reports/audits/2026-10-15-process-review.md) · **Size:** L · **Needs:** — · **Status:** open

## Why

Most bugs since v1.0.0 were features that never worked from end to end, because each scenario staged the state the system under test should have produced (process review § 1). No test plays a chain from player commands alone.

## What to do

- One scenario per chain in [`../process/player-paths.md`](../../process/player-paths.md): food, drink, crafts and forge, hospital, trade, defence, pasture. The rules are in [`../process/testing-strategy.md`](../../process/testing-strategy.md) § Player-path scenarios: commands only after the embark, no spawning of what the chain produces or delivers, wild animals on unless the scenario says why.
- Prefer a short `generated` or `{ region }` world and the default embark. A scenario may run up to a season; put any that run longer in the perf tier and say so in the list.
- A chain that does not work from commands alone is a finding: write a work file for it (the fault, the seed, the day, the trace), mark the chain "fails: T-xxx" in the list, and keep the scenario as an expected failure only through the project's existing way of recording one. Do not fix the game in this task.
- Update the Scenario column of the list as each chain is covered.

## Done

- Seven scenarios exist, or a work file explains each chain that cannot be played yet.
- `player-paths.md` is up to date.
