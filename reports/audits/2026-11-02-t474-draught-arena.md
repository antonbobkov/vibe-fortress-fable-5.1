# Measurement: a squad with draughts in the combat-pace arena, and no-draught combat unchanged

**Task:** T-474 · **Date:** 2026-11-02 · **Commit examined:** master `8e585308` with the T-474 branch on it · **Kind:** measurement; no constant, formula or content value was changed by it · **Source:** [the T-474 work file](../../docs/work/T-474-runecraft-draughts.md), [the T-473 ward arena](2026-11-02-t473-ward-arena.md)

## The answer

- **Combat with no draught listed is unchanged, draw for draw.** The `open-six` arena below gives exactly T-473's `open-six` figures (repelled 20, squad down 4, 3,043 blood, 5.17 soldiers dead a day later, 9.08 raiders dead). `pp_defence` on its seed gives a record equal as JSON to T-473's (`2026-11-02-t473-pp-defence.json`): end tick 30,440, the same 22 combat events, 11,724 events in all, the same state in all 21 rng streams (`…-t474-pp-defence.json`). The six no-channel arena digests pinned in `t470-no-channel-equivalence.test.ts` still match, and no golden moved.
- **A draught of mending is the one that changes a raid.** Six soldiers in full kit against a peril-2 raid of ten in the open, each carrying one common draught of mending, drink it when a hit finds them below half blood (3.79 of 6 a fight): the squad drives the raid off in **24 of 24** fights against 20 without, loses **2,597** blood a fight against 3,043, and **4.21** soldiers are dead a day later against 5.17.
- **Quickness helps a little; stoutness not at all here.** Quickness (haste 25, drunk by all six when the raid arrives): repelled 21, blood 2,933, dead 4.92; the soldiers swing 87 times a fight against 75 and hit 27 against 22. Stoutness (pain halved): repelled 18, blood 3,064, dead 5.21, no better than none: these soldiers fall by bleeding, not by pain. Listing stoutness then quickness gives the stoutness figures exactly: one draught, then rest, so each soldier drinks only the first.

## What was run

`reports/data/2026-11-02-t474-draught-arena.probe.ts.txt` (a vitest file under `test/perf`, not committed as a test): T-473's `open` squad arena (`t366-squad-open-<i>`), through the real tick loop. Six Novice soldiers (axe, shield, dodge, armour use 2) in an iron helm, mail shirt and greaves with an iron axe and shield, at a station; three civilians eight tiles behind; a peril-2 raid of ten by `arriveParty` (which emits `RaidArrived`, the raid trigger) and 18's spawns. Six common draughts of each listed kind lie in stock beside the post, and the squad's list is set before its members re-equip, so each soldier carries one of each. Each trial runs until one side is down or the party leaves (at most 4,800 ticks), then a day with no medic. One heavy run at a time, nothing else running on the machine. Data: `…-t474-draught-arena.jsonl`.

| Figure | `open-six` (none listed) | `open-stout` | `open-quick` | `open-both` (stout, quick) | `open-mending` |
|---|---|---|---|---|---|
| Outcome (of 24) | repelled 20, squad down 4 | repelled 18, down 6 | repelled 21, down 3 | repelled 18, down 6 | repelled 24 |
| Draughts drunk a fight | 0 | 6 stoutness | 6 quickness | 6 stoutness | 3.79 mending |
| Blood lost by the six at the end (the dead at 612) | 3,043 | 3,064 | 2,933 | 3,064 | 2,597 |
| Soldiers dead a day later (of 6) | 5.17 | 5.21 | 4.92 | 5.21 | 4.21 |
| Raiders dead (of 11) | 9.08 | 8.50 | 9.42 | 8.50 | 10.75 |
| Raider hits on soldiers / damage, a fight | 106.6 / 494 | 106.0 / 501 | 97.4 / 455 | 106.0 / 501 | 112.4 / 514 |
| Soldier swings / hits, a fight | 74.5 / 21.5 | 75.3 / 20.9 | 87.2 / 26.6 | 75.3 / 20.9 | 82.0 / 24.3 |
| Civilians dead a day later (of 3) | 1.17 | 1.17 | 1.00 | 1.17 | 0.25 |

A mended soldier keeps fighting: the raiders land more hits on the mending squad (112 a fight) because more of it is standing, and it kills more of them.

## What this does not measure

- The ambush of four, a squad behind a gate, and a medic: the open raid is the arena where a squad loses, so it shows what a draught can turn.
- Masterwork draughts (a longer duration) and the calming draught; the rest rule, the calming rest, a medic's `give_draught` and the spoiled batch are pinned by tests (`test/unit/runecraft/t474-draughts.test.ts`), not measured for balance.
- The two draughts of T-476 (hollowsight, wyrmblood); their effects' readers exist and are tested, the draughts do not yet.
