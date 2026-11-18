# T-NEW — An ambush stays engaged in the fortress for more than ten days

**Source:** [T-580's sweeps](../../reports/data/2026-11-17-t580-ambush-surface-work.md) · **Size:** M · **Needs:** — · **Status:** open

## Why

On every sweep of T-580's script (runs 44153194457, 44168651404, 44184857348, 44200076970, 44215426824) the seed job `three-years-p2-3` at shift 50 fails its T-176 invariant `party.active-over-10d`: an ambush of six that arrived on tick 385200 (day 321) was still in `engage` on tick 398400, and from day 322 to day 331 it killed 20 dwarves, nearly all bled out. The seed's figures still count in the verdict. The sweep of T-576's head (run 44104161842) had no such failure: with the dwarves at work below ground, this ambush found nobody outdoors, made for the hearth (18 § Party AI) and fought in the halls for ten days without breaking or stalling.

## What to do

Replay that timeline (the probe `test/perf/t580_exposure_probe.test.ts` with `THREE_YEARS_SHIFT=50` on `three-years-p2-3`) and find why the party neither breaks (18 § Morale), stalls (`ENGAGE_STALL_TICKS`) nor retreats while it keeps killing dwarves who come to it one at a time, and whether the script's answer to an ambush in the halls (the soldiers stood down, T-575) is what feeds it. Fix a game rule only if the spec says the party should have left; otherwise the script's answer.

## Done

The seed's invariant holds on the sweep, or the invariant's limit is shown wrong and changed with the spec.
