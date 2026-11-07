# T-488 — three-years-p2-7 ends without its dining hall

**Source:** [hexers measured](../../reports/audits/2026-11-04-t479-hexers.md) § The answer · **Size:** S · **Needs:** — · **Status:** open

The twenty-seed file on master `37da07a4` (with T-479, which draws nothing new at peril 2) fails `three-years-p2-7` on its T-156 witness: `fortressWitnesses` returns `['a dining hall']` at the end of year 3. The seed also has 2 dwarf deaths of starvation, a cause the reference sweep (`reports/data/2026-11-02-batch-t461-t465-sweep.json`, `3ea1517e`) did not show for it. Its figures are in `reports/data/2026-11-04-t479-sweep.json`. Master moved between the two runs (T-466 to T-476, T-481, T-484).

## Decisions

- Find which change since `3ea1517e` stops the script's dining hall in this seed (the cold-cave rule of T-484 and the shrub conversion of T-468 are the first suspects), and whether the starvation deaths follow from it.
- Fix the script if the fixture asks for something the game now forbids; fix the game if a rule is wrong.

## Done

- `three-years-p2-7` passes its witnesses, and the cause is named in the commit.

## Also seen (2026-11-07)

Seed `p2-4` at shift 50 fails the same kind of witness (no hearth or dining hall, one dwarf left at year 3), in T-513's reference sweep and since; the same seed goes extinct at shift 100. Treat it with this task.
