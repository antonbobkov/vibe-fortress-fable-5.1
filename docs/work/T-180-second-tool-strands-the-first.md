# T-180 — A dwarf that fetches a second tool puts the first one down

**Source:** T-115 and its report, [`../../reports/audits/2026-10-09-bug-hunt-spec-reading.md`](../../reports/audits/2026-10-09-bug-hunt-spec-reading.md) (bug 16) · **Size:** M · **Needs:** — · **Status:** open

## Why

A dwarf that holds a pick and takes a chop job fetches an axe and keeps the pick. `Worker.toolId` then names the axe. The pick stays carried by the dwarf: no search finds it, no job counts it as held, and the stocks call it available. Every dig job is blocked with `no_tool` from then on. New dwarves have every labor on, so this is what happens in a fortress whose player has not split mining and woodcutting. It breaks a fortress: an embark has two picks and two axes.

## Reproduction

[`toolswap.probe.ts`](../../reports/data/2026-10-09-bug-hunt-toolswap.probe.ts.txt): one dwarf with `mining` and `woodcutting`, one pick, one axe, two channel tiles, then two trees, then four channel tiles and a second miner. After the chop the dwarf carries both tools and `toolId` is the axe; the four channel jobs are `blocked: no_tool` 23 days later.

Read: `src/systems/jobs/steps.ts:113–119` writes `toolId` over the old tool. `hasTool` (`src/systems/jobs/items-adapter.ts:116`) reads `toolId` only.

## What to do

**Decision.** A worker holds one tool. The code is wrong and the spec is silent; write the rule and make the code follow it.

- **The rule (11 § Assignment, after "Workers keep their tool after the job"):** a worker that equips a tool of another kind first drops the tool it holds on its own tile, through the item API, unowned and unreserved, and `ToolDropped` is emitted for it. The dropped tool is ordinary stock again: hauling takes it to a stockpile and another worker can fetch it.
- **Why drop and not carry both:** `Worker.toolId` is one item in `components.md`, 16 reads it as the dwarf's weapon, and a dwarf with a pick and an axe would keep both out of the hands of a dwarf that needs one. Dropping keeps "a held tool is unavailable" true for exactly one tool per dwarf.
- **A tool in the weapon slot counts as held** (C21 of the report): `hasTool` also accepts a pick or an axe that is the worker's `Equipment.weapon`, as 16 § Equipment already says. A dwarf that arrives with an axe as a weapon then chops with it instead of fetching another.
- **A tool already stranded in a save:** on load, a pick or an axe carried by a living fortress dwarf that is neither its `toolId` nor in its `Equipment` is dropped at the dwarf's tile by the same path. Write this into 11 as part of the rule ("a worker carries no tool it does not hold"), checked each jobs tick, so no migration step is needed.

1. Amend 11 § Assignment and § Hauling.
2. Implement in `src/systems/jobs/steps.ts` (the fetch step), `items-adapter.ts` (`hasTool`, and the stranded-tool check beside `dropUnusedTools`).
3. Tests, `describe('T-180 …')`: the probe's scenario digs the last four tiles; a dwarf with an axe in the weapon slot chops without `ToolEquipped`; a world built with a stranded pick drops it on the first tick. Add the invariant "a dwarf carries at most one pick or axe outside its `Equipment`" to the checker of T-176.

## Done

- The tests pass. The world hashes of the long fixtures move only if a dwarf in them swaps tools; say in the commit which did.
