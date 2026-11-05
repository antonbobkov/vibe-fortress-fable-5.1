# Measurement: why `defence_year`'s defence never turned a raid back, and the captain who holds it together

**Task:** T-466 · **Date:** 2026-11-05 · **Commits examined:** master `c9f2f6be` (T-483 merged) for the journal and the before rows; the T-466 branch at `4d8ffd2f` for the after rows · **Kind:** journal, cause and a rule change, with a set rule and its noise · **Source:** [the T-466 work file](../../docs/archive/tasks/T-466-defence-never-repels-a-raid.md), [defence_year noise](2026-11-01-defence-year-noise.md)

## The answer

- **The cause.** The kill corridor takes the head of the raid and nothing else. A raid's captain leads it (18 § Party AI: the leader paths to the goal, the rest follow), the goal is the corridor's end at the locked north door, so the captain walks the corridor first, and the cage trap catches it. That happened in 7 of 8 seeds, before any loot. The other ten never come in. They stand outside the walls for the two days of loiter, pick up what lies within `LOOT_RADIUS` (the general stockpile beside the gate, felled logs, drink, bags, clothes), and leave `looted`. The squad never meets them: the script never sallies on a raid, and nobody stands behind the fortifications, whose back is open ground. The traps kill 0 or 1 of 10 or 11, far from `RETREAT_LOSS_PERCENT` (50).
- **Not a fault in the game or the script.** The loot rule, the loiter and the retreat on losses all do what 18 says, and the loot is the fortress's own, not foreign gear. The script uses the defence as it was written. What was missing is raid morale: 18 already said the captain "holds the party together", and no rule gave that any effect.
- **The fix: the captain holds the party together.** A party that arrived with captains (a raid's one, a siege's one or more) and has none still standing with it (dead, unconscious, caged, or fled off the map) fights on while it is in `engage`, and goes home as soon as it is not: it neither approaches nor loiters without them. The ending is `repelled` if it carries nothing, `looted` if it does. A member caged by a trap now counts on the trap's `TrapTriggered`, as a death or a fall counts on its own event, rather than at the next party think up to 50 ticks later. That window mattered: without it, three of the eight raids picked up loot between the cage and the think.
- **The result.** The announced raid ends `repelled` on **7 of 8** seeds (0 of 8 before), with no raider dead. The set rule is at least **5 of 8**. Its noise: 7 of 8 at the script's cadence, 6 of 7 at another (the eighth seed stopped on a script fault, filed).
- **Raids stay dangerous.** In the open arena three Novice soldiers in full kit still lose to a raid of ten in **24 of 24** fights, with 3.00 soldiers and 2.96 civilians dead a day later (3.00 and 3.00 before). A raid whose captain falls in a fight it is winning finishes the fight first. Against the fortress with no corridor, a raid that keeps its captain loots as before (unit test). The twenty-seed file does not move: 121 deaths and 902 living on 19 seeds, as the reference.
- **A first version was too strong, and was not kept.** Breaking a raid on its captain's loss in any state turned the open-arena raid back in **22 of 24** fights: the captain leads the charge and is the first one down. That would have made an untrained squad a winning one, so the rule now waits for the fight to end.

## Journal: `defence-year`, the raid of day 116

Coordinates are relative to the fortress origin: the corridor is x = 6, y = 2..4 (weapon trap, cage trap, stone-fall trap), the bridge y = 0..1, the north door y = 5, the gate stair y = 6. The map's north edge is y = −4, so the raid walks east along the edge to the gate.

| Tick | What happened |
|---|---|
| 138,001 | Raid of 10, plus its captain, arrives at the north edge. The goal (the hearth) is behind locked doors, so it is the nearest reachable tile, the corridor's end (6, 4). |
| 138,215–138,221 | The captain, leading, steps on the weapon trap (a miss), then the cage trap: **caged**. The party is in `loiter` from the captain's arrival. The others are still 6 to 25 tiles back along the edge. |
| 138,376–138,776 | The ten loot what lies within 6 tiles of where they stand: 6 bags, 2 drinks, a splint and a buckler, from the stockpile west of the gate (x −4..2, y −3..13). |
| 138,564 | An archer, now leading, walks the corridor with its splint: the weapon trap hits it (edge 10). |
| 138,739 | The lever pull raises the bridge behind it. The archer flees, falls unconscious and bleeds out in the corridor (day 117). |
| 139,176–140,576 | The other nine stand outside the raised bridge, at (4, −1), for the rest of their two days of loiter. The squad holds the gate stair behind the locked north door, and no soldier strikes a raider. |
| 140,676–140,751 | Retreat on the loiter timeout. Nine members leave by the north edge, each with one item. **`looted`**. Losses: 2 of 11 (18%). |

The other journaled seeds (`-2`, `-4`, `-5`, `-6`) tell the same story: the captain caged at the corridor, before any loot, then logs, drink, bars or clothes picked up outside, then `looted` on the loiter timeout. On `-4` the raid also fought dwarves who were shut outside. The 3 bandits of every seed go straight to the same stockpile and take what is there before anything meets them. Bandits have no captain, so the rule does not touch them, and they still loot.

After the fix the journal of `-2`, `-3` and `-6` is short: the captain is caged on tick t, and the party has left with nothing on tick t + 1. The members still walking along the north edge are at a map edge already when they turn, so they leave at once.

## `defence_year` on eight seeds

One process per state. "Raid" is the announced raid (`RaidArrived` of kind `raid`): its size plus the captain, its ending, its members dead, and what became of the captain.

| Seed | Before (`c9f2f6be`) | First rule, no trap-event count (`3597f1f7`) | After (`4d8ffd2f`) | After, script cadence 25 |
|---|---|---|---|---|
| `defence-year` | 10+1, looted, 1 dead, caged | repelled | **repelled**, 0, caged | repelled |
| `defence-year-2` | 10+1, looted, 1 dead, caged | looted | **repelled**, 0, caged | repelled |
| `defence-year-3` | 10+1, looted, 1 dead, caged | looted | **repelled**, 0, caged | repelled |
| `defence-year-4` | 9+1, looted, 0, caged | repelled | **repelled**, 0, caged | repelled |
| `defence-year-5` | 9+1, looted, 0, caged | repelled | **repelled**, 0, caged | repelled |
| `defence-year-6` | 9+1, looted, 1 dead, caged | looted | **repelled**, 0, caged | stopped on day 64: a script fault (below) |
| `defence-year-7` | 7+1, looted, 0, left | looted | looted, 0, left | looted |
| `defence-year-8` | 9+1, looted, 0, caged | repelled | **repelled**, 0, caged | repelled |
| **Repelled or wiped** | **0 / 8** | 4 / 8 | **7 / 8** | **6 / 7** |

On `defence-year-7` the captain is not caught (the cage trap's one catch in that run is another creature), and the raid loots.

**The set rule.** `test/perf/defence_year_seeds.test.ts` asserts that at least 5 of the 8 seeds end every announced raid `repelled` or `wiped`. The cadence-25 run (the script looking at the defence every 25 ticks instead of 20, which moves only the job timeline) moved no seed's ending. It lost one seed to a script fault, not to the raid. A bound of 5 leaves room for two more flips. `defence-year-4` and `-8` never finish the bridge trial (as in the [noise report](2026-11-01-defence-year-noise.md)), so the scenario's own assertions would fail on them. Their raids are still counted.

**The script fault.** On `defence-year-6` at cadence 25 the script zoned the archery range over the target's tile, which another zone had taken first: `CreateZone rejected (overlap)` on tick 75,976. Filed as [T-NEW: the archery range overlaps](../../docs/work/T-503-defence-script-archery-range-overlap.md).

## Is the raid still dangerous?

**The open arena.** The [careless-shooter arena](2026-11-04-t483-careless-shooter-arena.md) probe, `open` and `ambush`, 24 trials each, seeds `t366-squad-<kind>-<i>`, with the captain's fate added. The arena's outcome is the party's ending, if the party ended in the day after the fight.

| Variant | Before (T-483) | First rule (`153d79d8`) | Kept rule (`4d8ffd2f`) |
|---|---|---|---|
| `open`: 3 Novice soldiers, full iron kit, raid of 10 | squad down 24 | **repelled 22**, squad down 2 | squad down 24 at the fight's end; the raid then leaves, `repelled`, in 12 within the day |
| Soldiers / civilians dead a day later (of 3 / 3) | 3.00 / 3.00 | 2.33 / 0.46 | **3.00 / 2.96** |
| Captain downed in the fight | not recorded | 22 | 22 |
| `ambush` of 4 (no captain) | repelled 24, 0.88 / 1.33 | the same | the same, field for field |

A raid that has won in the open and lost its captain goes home without loiter, so it loots nothing it has not already taken. In a fortress a squad that downs the captain and then falls still costs the raid its loot. That is the trade-off of the kept rule: the defence has to be there and fight, and it does not have to win.

**`pp_defence`.** `reports/data/2026-11-04-t483-pp-defence.probe.ts.txt` on its four seeds, run on the branch: every field equal to T-483's record (passes, end ticks 30,440 / 30,380 / 22,040 / 8,620, combat digests, rng digests, event counts). No party comes, so nothing here can move.

**The annual instrument** (`test/perf/wildlife_year.test.ts`, on GitHub): median 13, worst 7, second-worst 10, sum of the living 149, 7 of 12 without a wildlife dwarf death, no extinction, no hunger or thirst death. That is the reference row. Peril 0 in year 1 sends no party.

**The twenty-seed file** moves nowhere (§ The twenty-seed file).

## The twenty-seed file

`test/perf/three_years_seeds.test.ts`, whole, once, on GitHub (`measure.yml` suite `sweep`, run 42071590769, commit `4d8ffd2f`), after `npm test` passed there (`ci.yml`: 422 files, 3,512 tests in four shards, e2e 38 passed). Reference: the [careless-shooter arena](2026-11-04-t483-careless-shooter-arena.md) file, 121 deaths and 902 living on 19 seeds, with `p4-3` stopped on its siege. Summary: [data](../data/2026-11-05-t466-sweep-summary.md).

| Peril | Reference: deaths / living at year 3 | T-466 |
|---|---|---|
| 0 (7 seeds) | 3 / 389 | **3 / 389** |
| 2 (7 seeds) | 57 / 283 | **57 / 283** |
| 4 (5 counted) | 61 / 230 | **61 / 230** |
| All | 121 / 902 in nineteen | **121 / 902** in nineteen |

Every counted seed has the reference's year-1 and year-3 populations and deaths. Set rule: alive at year 1 **19 / 19** (needs 18), peril-0 grown **7 / 7** (needs 6), peril-0 seeds with need deaths **0** (at most 1); it holds. The summary job marks the run failed because `p4-3` produced no result: it stops on tick 235,200 on `party.active-over-10d`, the siege that stays engaged with two fortress dogs ([T-501](../../docs/work/T-501-siege-engaged-with-dogs.md)), as in the reference. No raid or siege in these fortresses lost its captains outside a fight before it ended: their raids meet a locked gate with the captain alive, and loot or withdraw as before.

## Fun

Catch the captain, and the raid goes home. A wooden cage on the right tile sends eleven armed gloam back over the hill without a blow, while the captain sits in the cage at the gate, alive. It comes from the rule, not from a tuned number, and it gives the player something to aim for: the captain leads, so the first trap meets it.

## What this does not measure

- Sieges at peril 4 with cage traps: no scripted fortress builds one. A siege has one captain per 20 of its size plus one, and breaks only when it has lost them all.
- Whether `RETREAT_LOSS_PERCENT` (50, *unmeasured*) is right; it did not move.
- The squad's part: in `defence_year` it still never meets a raid. A script that sallies, or mans the fortifications with marksdwarves, is a different defence.

## Reproduce

- Journal probe: [probe](../data/2026-11-05-t466-raid-journal.probe.ts.txt); journals [before](../data/2026-11-05-t466-journals-before.txt) and [after](../data/2026-11-05-t466-journals-after.txt). Copy it to `test/perf/`, run it with `DEFENCE_SEEDS=<seeds>` and `DEFENCE_OUT=<dir>` and `vitest.perf.config.ts`, or on GitHub with a step added to `measure.yml` on a branch (tooling.md § Running tests on GitHub).
- Seeds: `test/perf/defence_year_seeds.test.ts`, or `measure.yml` suite `defence_seeds` (input `watch` for the cadence). Rows: [before](../data/2026-11-05-t466-defence-seeds-before.jsonl) (seeds 3, 7, 8; the other five are the journals' ends), [first rule](../data/2026-11-05-t466-defence-seeds-first-rule.jsonl), [after](../data/2026-11-05-t466-defence-seeds-after.jsonl), [after, cadence 25](../data/2026-11-05-t466-defence-seeds-after-watch25.jsonl).
- Arena: [probe](../data/2026-11-05-t466-captain-arena.probe.ts.txt), rows of the [kept rule](../data/2026-11-05-t466-captain-arena.jsonl) and the [first rule](../data/2026-11-05-t466-captain-arena-first-rule.jsonl). `pp_defence`: [rows](../data/2026-11-05-t466-pp-defence.jsonl).
