# T-486 — A peril-4 ambush can kill a whole fortress over five days

**Source:** [hexers measured](../../reports/audits/2026-11-04-t479-hexers.md) § What moved the peril-4 seeds · **Size:** M · **Needs:** — · **Status:** open

While measuring hexers, a run of `three-years-p4-6` whose threat stream had shifted (an earlier version of the hexer's kit drew on 18's stream; the filed code does not) met an ambush of Gloam warriors and archers on day 317 of year 3. It killed 68 dwarves between days 317 and 322: 21 killed outright and 47 bled out, all by members of that one ambush party, every one of them while the party stood in `engage`. The fortress, of 33 at the start of year 3 and more after its waves, was extinct on day 322. The same seed with that ambush not rolled ends year 3 with 47 dwarves. An ambush at peril 4 has at most 10 members (`threat-schedules.md` § Ambushes).

The trace is the T-479 sweep probe (`reports/data/2026-11-02-t479-hexer-sweep.probe.ts.txt`, `T479_KILLS=1`): one line per dwarf death with the killer's species, role, party and the party's state.

## Decisions

- Find why the dwarves of a living fortress keep reaching one ambush party for five days: whether the three-year script's alert and sheltering let them walk out to it, whether the squad is sent piecemeal, or whether the party never retreats although it should (`RETREAT_LOSS_PERCENT`).
- Fix the cause in the game if it is a game rule, or in the fixture if it is the script; no number moves to hide it.

## Done

- The cause is named in a dated report, with the trace.
- If the game was at fault, a test pins the rule, and the twenty-seed file is re-run once.
