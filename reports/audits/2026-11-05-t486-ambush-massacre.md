# Audit: the peril-4 ambush that killed a fortress, and the ambushes of today

**Task:** T-486 · **Date:** 2026-11-05 · **Commits examined:** `82bc5fda` (the T-479 version whose hexer kit drew on 18's stream, where the massacre happened); master `6831a699` with T-501 (`947c303c`) merged, on the T-486 branch at `96df461f` before the fix and after it · **Kind:** a journal of one ambush, a census of every peril-4 ambush in 30 timelines, one fault fixed · **Source:** [the T-486 work file](../../docs/work/T-486-ambush-massacre.md), [hexers measured](2026-11-04-t479-hexers.md) § What moved the peril-4 seeds

## The answer

- **What it was.** On day 317 of `three-years-p4-6` (at `82bc5fda`) an ambush of ten Gloam warriors and archers came to a fortress of 68. The script raised the hearth alert at once; the civilians on the surface ran for the gate, and a warrior followed the last of them into the south doorway of the gatehouse. A door does not close on a creature in its doorway, a hostile included (14 § Doors), so the gate stood open with the warrior in it, and from there it fought the squad posted on the stair tile behind it. The squad killed two and was killed: five soldiers by the end of day 317. Then the eight walked down the stairwell (days 318–319: seven dwarves on the stairwell, three of them going up for a need) and stood at its foot in the halls, the one way out of every room, for days 320–322: 47 dwarves there, 41 of them bleeding out after a blow at the hearth hall's door. 67 of the fortress's 68 were killed by that party; it was extinct on day 322. The party loitered two days with nobody left and went home on day 325.
- **Why the fortress could not answer it.** It had one entrance and one line: five soldiers of 68, posted on the stair behind the gate. When they fell, nothing that could hurt a peril-4 warrior was left. The civilians sheltered, as the hearth alert has them do, in the halls below the gate, a dead end with the raiders at its mouth; they killed none of them. The script raises no new soldiers while the alert stands (T-387) and orders no kill on a party's raider indoors (T-461 answers only hostiles of no party).
- **Why it did not break or leave.** It lost two of ten, and `RETREAT_LOSS_PERCENT` needs five. Under today's rules it would not break either: an ambush starts at morale 75, its two losses take 20, and each of 67 dwarves felled gives 5, so it stands at 100. It has no captain (T-466's rule does not apply), and it strikes blows all the time, so T-501's stall rule does not apply. An engaged party stays engaged while any member has a reachable target in perception, and the halls were full. It ended when the fortress did. **It did end**, and it could have been answered (§ What a player has), so this is the edge of peril 4, not a fault.
- **Does it still happen?** Not with an ambush, in 30 timelines of today's code: the six peril-4 seeds, each with five shifts of 18's stream (the probe's hexer draws 0 to 4 times before its kit, as the old kit did), **213 ambushes**, none of which killed from inside the fortress; the longest stayed **4.0** days on the map and **1.5** in `engage`; all 213 ended, 196 `looted` (they wait at the locked gate and pick up what lies outside) and 17 `withdrew`. The way in is still there: one **siege** of 35 did it in two of the 30 timelines (`p4-3`, day 186, the timeline T-501 looked at), a trollkin and a warrior in the north doorway killing the squad on the stair and the captain then in the halls, 28 killed, extinct day 188. A peril-4 siege may destroy a fortress.
- **A fault found on the way, fixed.** On day 169 of `three-years-p4-1`, in all five timelines, an ambush of five (eight once the rest trickled in) arrived at the north edge on the tick the autumn wave of eleven immigrants began to arrive there. The first immigrant sprang it; the other ten kept arriving, one every 20 ticks, into it. A wave still arriving stopped only on `RaidArrived`, which an ambush never emits (it announces itself by `AmbushSprung`), and a season's evaluation deferred only for a raid or a siege. 10 to 19 dwarves died a timeline, the ambush losing 0 to 2. Now a sprung ambush is a battle for immigration (21 § Evaluation, § Arrival): the same timeline (shift 1) loses **1** dwarf to it instead of **19**, the ten wait at the edge and come in on day 171 after it leaves, and the seed ends year 3 with **50** living and 5 deaths against 36 and 25.
- **Recommendation: no rule for the gate.** Keep 14's door rule, the morale scale and 18's engage rule as they are; peril 4 destroys a fortress that loses its gate and its one squad, and the census shows it is rare now (0 of 213 ambushes, 1 of 30 sieges). If the owner wants ambushes to keep their character, the cheapest rule is that an ambush does not storm the halls: it engages only what is outdoors and, with nobody outdoors, goes home as a raid that finds its goal locked does. It is not proposed as a fix; nothing measured asks for it.

## The journal of the massacre

`three-years-p4-6` at `82bc5fda`, through the three-year file's own `runThreeYearsSeed` (the probe below with no shift: that commit's kit draws). Party `889193751`, ten members (warriors and archers, no captain), arrived hidden on day 317. The alert went to `hearth` on tick 379,220 (the script answers any party but a thief at once); the ambush sprang on tick 379,298.

| Where | Day | Killed | Soldiers | Bled out | What they were doing |
|---|---|---|---|---|---|
| the gate, on the surface | 317 | 7 | 2 | 2 | retreat 2, duty 2, flee, work, patient |
| the stairwell | 317 | 4 | 3 | 2 | duty 2, work, patient |
| the stairwell | 318–319 | 7 | 0 | 0 | need 3, patient 2, retreat 2 |
| the halls | 317, 319 | 2 | 0 | 2 | patient, need |
| the halls | 320 | 18 | 0 | 16 | flee 8, patient 4, need 3, idle 3 |
| the halls | 321 | 26 | 0 | 23 | flee 17, patient 7, need 2 |
| the halls | 322 | 3 | 0 | 2 | need, retreat, patient |

The gatehouse is a stair between two doors (`cx+6`, rows `cy+5` and `cy+7`); the squad's post during a raid is the stair. The first kills of soldiers are by a warrior on the south door's tile (31,14,32) striking the stair (31,13,32); the halls' kills are nearly all by warriors at the stair's foot and in the corridor beside it (25 to 31,13,26), most of them on dwarves who were hit at the hearth hall's door and ran back in to bleed. Members standing: 10 at the spring, 8 from tick 380,150 to the end. The party left `engage` for `loiter` on day 318 and on day 322 when it saw nobody, and went back each time a dwarf came into its perception. Data: [the journal](../data/2026-11-05-t486-p4-6-at-82bc5fda.jsonl), [phase script](../data/2026-11-05-t486-phases.mjs.txt).

## What a player has

The fortress could have answered it, and the script did not: a cage trap or a weapon trap on the gate tile takes the warrior in the doorway; a second door, or a hatch over the stair, behind the post; a squad that does not stand alone (T-504: six Skilled soldiers in iron lose to a peril-4 raid of ten, so a gate at peril 4 needs more than the script's five or six Novices); civilians kept out of the dead end. None of these is a rule the game lacks.

## The census of today's ambushes

`reports/data/2026-11-05-t486-ambush.probe.ts.txt`, run on GitHub for the six peril-4 seeds with shifts 0 to 4 (`measure.yml` suite `probe` on this branch): run 42123373441 at `6abcc945` (master `6831a699`, before the fix) and run 42128707276 at `96df461f` (T-501 merged, the fix in). Each row of the tables: [before](../data/2026-11-05-t486-peril4-probes-before.md), [after](../data/2026-11-05-t486-peril4-probes-after.md), from [the table script](../data/2026-11-05-t486-probe-table.mjs.txt).

| Before the fix | Parties | Dwarves killed | Killed from inside the fortress | Longest on the map (days) | Longest in `engage` | Endings |
|---|---|---|---|---|---|---|
| Ambush | 213 | 175 | 0 | 4.0 | 1.5 | looted 196, withdrew 17 |
| Raid | 130 | 92 | 0 | 2.7 | 0.6 | looted 125, withdrew 4, one still on the map at the end |
| Siege | 30 | 62 | 2 (the same siege, `p4-3` shifts 1 and 2) | 7.7 | 2.1 | looted 29, withdrew 1 |

AFTER_TABLE

The heaviest ambushes before the fix were all the one of `p4-1` day 169 (10, 12, 13, 13 and 19 killed in the five timelines; 8 in `p4-4` shift 1 day 225 was the next). The shift-0 timeline of each seed is the sweep's own: `p4-6` shift 0 gives the sweep's 17 deaths and 56 living to the dwarf, and the probe gives the same figures on a local machine and on GitHub.

## The immigrants

[Before](../data/2026-11-05-t486-p4-1-shift1-before.jsonl) and [after](../data/2026-11-05-t486-p4-1-shift1-after.jsonl), `three-years-p4-1` shift 1, locally.

| | Before | After |
|---|---|---|
| The ambush of day 169 | sprang tick 201,601; 8 of the wave of 11 killed within 600 ticks of their arrival, and 11 residents on the surface; the ambush lost nobody | sprang tick 201,601 on the wave's first arrival, who was killed; the others waited and arrived on day 171 after it left (`looted`) |
| Year 3 | 36 living, 25 deaths | 50 living, 5 deaths |

Test: `test/unit/immigration/t486-sprung-ambush.test.ts`. A hidden ambush still defers nothing (nobody knows of it), so a wave can still walk into one and spring it.

## Fun

- **The cousins' road.** A wave that walks into a hidden ambush loses its first arrival to it; the rest wait at the edge until the ambush has gone, and come in two days late.
- **Ambushes loot.** With every dwarf behind the gate, 196 of 213 ambushes made for the hearth, waited two days at the locked gate and went home with whatever lay outside.
- **The stragglers hold the gate open.** The old massacre began with a warrior following the last civilian into the doorway, where the door cannot close on it.

## Twenty seeds, `defence_year`, CI

SWEEP_SECTION

## Reproduce

- The probe: copy it to `test/perf/t486_ambush_probe.test.ts` and run `npx vitest run -c vitest.perf.config.ts test/perf/t486_ambush_probe.test.ts -t "T-486 probe"` with `T486_SEED=three-years-p4-6:4`, `T486_SHIFT=<n>` and `T486_OUT=<file>`. For the massacre, check out `82bc5fda` and run it there with no shift.
- The census: the `probe` job of `measure.yml` at `6abcc945` (a matrix of the six seeds and shifts 0 to 4); `node <table script> <download dir>`.
