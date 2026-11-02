# T-NEW — Runecraft 9b: Gloam hexers in raids and sieges

**Source:** runecraft [design](../../reports/designs/2026-11-01-runecraft-magic-system.md), through T-467 · **Size:** M · **Needs:** T-473 · **Status:** open

The specification is [25 Runecraft](../02-systems/25-runecraft.md) § Hexers. Split from T-476 because the measuring needs its own runs.

## Decisions

- Hexers hold a wand of frost only. No Dread on dwarves.
- On top of party size, like the captain. Peril 3 from year 3, peril 4 from year 2, two in a siege.
- Role `hexer` counts as an archer in `threats/ai.ts`.

## Done

- A hexer casts until its rune is gone, then closes to melee. Its wand is foreign until recovered, and then only a squad member with `runecraft` claims it.
- Peril 2 draws nothing new.
- The hexers' effect is measured: `three_years_seeds` at peril 4 and `pp_defence` compared with the row before them, one process at a time. Rules or numbers change if the set survival rule breaks. The figures go in a dated report and `balance-status.md`.
