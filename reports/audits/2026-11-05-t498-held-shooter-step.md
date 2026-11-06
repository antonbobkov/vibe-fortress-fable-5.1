# Measurement: a held soldier steps aside to a clear line

**Task:** T-498 · **Date:** 2026-11-05 · **Commit examined:** master `6c923f67` (before) and the T-498 branch on it (after, `3b0ffe22`) · **Kind:** measurement of a rule change; no constant, formula or content value was changed · **Source:** [the T-498 work file](../../docs/work/T-498-held-shooter-clear-line.md), [the careless-shooter arena](2026-11-04-t483-careless-shooter-arena.md), [the held-shot arena](2026-11-04-t483-held-shot-arena.md)

## The rule measured

Before, a careful shooter whose ray to every hostile in range crossed one of its own waited where it stood (16 § Ranged resolution, Held shot). Now a soldier on duty that does not shoot while one of its own stands on its held target's ray, and that has no other clear target, steps aside as kiting picks a step: to the first legal adjacent tile by tile index on its level that is no nearer its held target than where it stands, has no melee threat within `RANGED_KITE_TRIGGER_DISTANCE`, and from which its held target or another hostile in range has a clear ray. It keeps its target, the step draws nothing, and it weighs its shot again from the new tile. Carelessness is unchanged: when its cooldown runs out with an ally on the line, a Novice still draws and may fire through. Every other shooter (a raid's archers and hexers, a hunter, a dwarf off duty) still waits.

## The answer

- **A Proficient marksdwarf now does more than a Novice, and more than no marksdwarf.** In the ambush of four it shoots **9.1** bolts a fight instead of 0.8, hits raiders 110 times for 2,483 (6 for 134), kills 13 in 24 fights (4), and the squad loses **0.54** soldiers a fight (1.04; 0.88 with no marksdwarf). It never fires through its line: 0 hits on its own side.
- **A Novice marksdwarf is still careless, less often.** In the ambush it shoots 10.4 bolts a fight (7.3) and hits its own side **8** times for 107 in 6 fights of 24 (26 for 381 in 17); the squad loses **0.88** (1.46). It steps for a clear line during its cooldown, so its line is blocked less often when it weighs a shot. In the open it hits its own side 6 times for 96 in 5 fights (9 for 135 in 6).
- **In the open the squad still falls**, and the marksdwarf takes more of the raid with it: Proficient, raiders dead 3.92 of 11 (3.33), 53 kills (41), 2 fights repelled (1); Novice 2.96 (2.63). The squad is down in 22 to 24 of 24 either way.
- **A caster steps too** (the rule holds for a channel's bolt): a Proficient caster in the open throws 10.1 bolts a fight (5.8) and hits 84 times for 1,544 (57 for 1,058), and the raid loses 3.13 of 11 (2.46). In the ambush, where the caster stands in the melee squad's line, it barely moves: 0.71 soldiers dead (0.75). A Novice caster still singes its squad: 5 hits for 75 in 4 ambush fights (5 for 73 in 5), 16 for 242 in 9 open fights (19 for 306 in 10).
- **Hostile archers are unchanged in rule.** They do not step; their figures move only through the fights around them (raiders' shots a fight 21.6 → 24.5 in the Proficient ambush, 56.9 → 53.7 in the open). The plain rows with no fortress shooter (`ambush`, `open`) are the same fights field for field: the step changes nothing where no soldier on duty shoots.
- **`pp_defence` does not move**: all four seeds give the same record before and after, field for field (no launcher is fired in any of them).

## What was run

The [careless-shooter probe](../data/2026-11-04-t483-careless-arena.probe.ts.txt), unchanged, on master `6c923f67` (before) and on the branch (after): seeds `t366-squad-ambush-<i>` and `t366-squad-open-<i>`, 24 trials a row, through the real tick loop, each until one side is down or the party leaves (at most 4,800 ticks), then a day with no medic. The marksdwarf (dodge 2, a tunic, an oak crossbow, 25 iron bolts) is in a ranged squad of its own at the squad's station; the caster (rune 50, a tunic, an iron staff of embers) is the squad's fourth member. `-xbow2`, `-ember2` are Novice (skill 2), `-xbow`, `-ember` Proficient (10). The before rows equal the T-483 careless-shooter rows. Data: `reports/data/2026-11-05-t498-arena-before.jsonl`, `…-after.jsonl`.

| Figure, before → after | `ambush-xbow2` | `ambush-xbow` | `open-xbow2` | `open-xbow` |
|---|---|---|---|---|
| Outcome | repelled 24 → 24 | repelled 24 → 24 | down 24 → down 23, repelled 1 | down 23, repelled 1 → down 22, repelled 2 |
| Soldiers dead a day later (of 3) | 1.46 → **0.88** | 1.04 → **0.54** | 3.00 → 3.00 | 3.00 → 2.96 |
| Shooter dead a day later | 3 → 2 | 0 → 0 | 24 → 24 | 24 → 23 |
| Raiders dead (of 4 or 11) | 4.00 → 4.00 | 4.00 → 4.00 | 2.63 → 2.96 | 3.33 → **3.92** |
| Shots a fight | 7.3 → 10.4 | 0.8 → **9.1** | 11.1 → 12.9 | 10.3 → 12.6 |
| Hits on raiders / damage | 22 / 491 → 46 / 1,047 | 6 / 134 → **110 / 2,483** | 58 / 1,136 → 64 / 1,208 | 115 / 2,301 → 122 / 2,420 |
| Hits on fortress creatures / damage (fights) | 26 / 381 (17) → **8 / 107 (6)** | 1 / 11 (1) → 0 | 9 / 135 (6) → 6 / 96 (5) | 0 → 2 / 44 (2) |
| Kills by the shooter | 12 → 6 | 4 → 13 | 37 → 36 | 41 → 53 |
| Civilians dead a day later (of 3) | 1.58 → 1.46 | 1.17 → 1.63 | 3.00 → 2.96 | 2.83 → 2.79 |
| Raiders' shots a fight | 25.5 → 24.8 | 21.6 → 24.5 | 56.2 → 60.0 | 56.9 → 53.7 |
| Raider hits on raiders / damage (fights) | 1 / 10 (1) → 0 | 2 / 22 (1) → 1 / 10 (1) | 24 / 267 (14) → 29 / 321 (15) | 24 / 265 (16) → 25 / 276 (14) |

| Figure, before → after | `ambush-ember2` | `ambush-ember` | `open-ember2` | `open-ember` |
|---|---|---|---|---|
| Outcome | repelled 24 → 24 | repelled 24 → 24 | down 24 → 24 | down 24 → down 22, repelled 2 |
| Soldiers dead a day later (of 3) | 0.96 → 0.96 | 0.75 → 0.71 | 3.00 → 3.00 | 3.00 → 2.96 |
| Raiders dead (of 4 or 11) | 4.00 → 4.00 | 4.00 → 4.00 | 2.38 → 2.21 | 2.46 → **3.13** |
| Shots a fight | 7.0 → 7.3 | 5.0 → 5.3 | 8.3 → 9.9 | 5.8 → **10.1** |
| Hits on raiders / damage | 22 / 454 → 22 / 454 | 57 / 1,183 → 60 / 1,239 | 16 / 291 → 22 / 397 | 57 / 1,058 → 84 / 1,544 |
| Hits on fortress creatures / damage (fights) | 5 / 73 (5) → 5 / 75 (4) | 0 → 0 | 19 / 306 (10) → 16 / 242 (9) | 0 → 0 |
| Kills by the caster | 1 → 0 | 6 → 6 | 13 → 16 | 21 → 26 |

The plain rows (`ambush`, `open`) were run before only: no soldier on duty there has a launcher, so the step never applies and the after fights are the before fights. The `open` row, run after as a check, is equal field for field.

The Proficient marksdwarf's 2 hits on its own side in the open are friendly fire after the shot (a miss flying on, or a soldier stepping into the path); at Proficient nothing is ever drawn.

### pp_defence

[The T-483 probe](../data/2026-11-04-t483-pp-defence.probe.ts.txt), unchanged, on `pp-defence`, `-2`, `-3`, `-4`, before and after: every field equal (passes, end tick 30,440, 30,380, 22,040, 8,620, the combat events by digest, the state of every rng stream, the event count). No launcher is fired in any of them. Data: `reports/data/2026-11-05-t498-pp-defence.jsonl` (lines 1 to 4 before, 5 to 8 after).

RUNS_GO_HERE

## What this does not measure

- A shooter whose ally stands midway along the ray, with no adjacent tile that clears it: it waits, as before (the step looks one tile ahead, then again from wherever it stands).
- Raid archers stepping aside: they do not, by choice, so their weight in a raid is the held-shot version's.
- A marksdwarf on a fortification or an overlook, and sieges.
