# T-475 — Runecraft 8: Call and the three summons

**Source:** runecraft [design](../../reports/designs/2026-11-01-runecraft-magic-system.md) · **Size:** M · **Needs:** T-473 · **Status:** open

## What to do

Design § 6. The glowstone stone's spell, the `Summoned` state, following, fading with no corpse and no grief, the shoe choosing what answers, and the shade that turns. `wisp_loose` from T-469 uses the same creature row.

## Done

- 50 ± 15 turned in 1,000 castings of the deep shade. A turned shade is `deep` and a squad of three in iron kills it.
- Summons fade at the day's end and at 0 hp. They count toward `MAX_CREATURES`, and do not count as dwarves for morale, grief, the legend or burial.
