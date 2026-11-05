# Measurement: a runecaster in the combat-pace arena, and no-channel combat unchanged

**Task:** T-470 · **Date:** 2026-11-02 · **Commit examined:** master `2a4e5832` (before) and the T-470 branch on it (after, with the cast-when rule) · **Kind:** measurement; no constant, formula or content value was changed by it · **Source:** [the T-470 work file](../../docs/archive/tasks/T-470-runecraft-runeforge-staffs-bolts.md), [the combat-pace tune](2026-10-21-combat-pace-tune.md)

## The answer

- **Combat with no channel in play is unchanged, draw for draw.** `pp_defence` on its seed ends on the same tick (30,440, day 25) with the same 22 combat events byte for byte, the same 11,724 events in all, and every one of the 21 rng streams in the same state, before and after (re-checked after the cast-when rule). Six stepped arenas (a duel against two goblins, a warhammer against a trollkin, a crossbow in the open and through a fortification, the magma wyrm's `burn` breath, a war dog) give the same events, wounds and stream states as on `2a4e5832`; their digests are pinned in `test/unit/runecraft/t470-no-channel-equivalence.test.ts`. The flat-test world hashes move only because `Skills.level` grew by the `runesmithing` byte: with that one skill row (and the recipes that name it) taken out, all six old hashes return exactly, with every other T-470 change in place. The annual wildlife instrument gives the same row after as before: median 12.5, worst 7, second-worst 11, sum of the living 149, 7 of 12 years without a wildlife dwarf death, no extinction, no hunger or thirst death.
- **A Proficient runecaster with an iron staff of embers helps a squad of three meet an ambush, and is never touched.** Against a peril-2 ambush of four, three Novice soldiers in full kit drive it off in 24 of 24 fights either way; the soldiers dead a day later fall from **1.08** a fight to **0.58** with the ember staff, **0.75** with a frost staff and **0.58** with a wand of embers. The caster, standing back at the station in a tunic, is never downed. It casts 4.8 bolts a fight (a wand 6.8) and hits with 46% of them for 20.8 a hit against tier-2 bronze (a wand 11.8, a frost staff 8.6, and 39 raiders slowed in 24 fights).
- **The caster no longer shoots its own soldiers by choice.** It holds a bolt while one of its own stands on the line to its target, and throws at another target with a clear line or waits (25 § Casting). Its bolts hit a fortress creature in 0 of 24 ambush fights with the ember staff and the wand, and once with the frost staff (9 damage), against 28 hits for 443 damage in 14 fights before the rule. It casts half as often, and the squad loses fewer soldiers than before the rule (0.58 against 0.88).
- **Marksdwarves hit their own side at least as often, and the rule does not touch them.** A Proficient marksdwarf (crossbow 10, oak crossbow, 25 iron bolts, a tunic) in a ranged squad of its own at the same station hits a fortress creature in 21 of 24 ambush fights: 65 hits for 895 damage, against 91 hits for 2,043 on the raiders; in the open, 23 hits for 369 in 12 of 24. With the marksdwarf the squad loses **2.04** soldiers a fight to the ambush against 1.08 without. Filed as [marksdwarves shoot their own squad](../../docs/archive/tasks/T-483-marksdwarf-friendly-fire.md); crossbow behaviour is unchanged here.
- **A caster does not save a squad in the open against a raid of ten.** Without it the squad is down in 24 of 24 (all three soldiers dead a day later, the raid losing 1.3 of its 11). With an ember staff the squad and the caster are down in 23 of 24 (the raid turned back with losses in the other, the squad already on the ground) and the raid loses 2.0; once the raiders reach it the caster clubs (203 swings) and dies in all 24. Its bolts hit its own side once.
- **Magic trails steel, as 25 says:** the caster's bolts did 46 damage a fight in the ambush, a fraction of the three axes', and a deepsilver masterwork great axe (68 on a bare part) still out-damages the best staff (49).

## What was run

`reports/data/2026-11-02-t470-caster-arena.probe.ts.txt` (a vitest file under `test/perf`, not committed as a test): the squad arenas of [the combat-pace tune](2026-10-21-combat-pace-tune.md), on the same seeds (`t366-squad-ambush-<i>`, `t366-squad-open-<i>`), through the real tick loop. Each trial runs until one side is down or the party leaves (at most 4,800 ticks), then a day with no medic. One heavy run at a time, nothing else running on the machine.

| Arena | Trials | Set-up |
|---|---:|---|
| `ambush` | 24 | three Novice soldiers (axe, shield, dodge, armour use 2) in an iron helm, mail shirt and greaves with an iron axe and shield, at a station; three civilians eight tiles behind; a peril-2 ambush of four by `arriveParty` and 18's spawns |
| `ambush-ember`, `-frost`, `-wand` | 24 each | the same and a fourth member: runecraft 10 (Proficient), a full rune of 50, dodge 2, a tunic and no metal, holding a common iron staff of embers, an iron staff of frost, or an oak wand of embers |
| `ambush-xbow` | 24 | the same three and a marksdwarf (crossbow 10, dodge 2, a tunic) with an oak crossbow and 25 iron bolts, in a ranged squad of its own at the same station |
| `open`, `open-ember`, `open-xbow` | 24 each | the same squad, alone, with the ember caster, or with the marksdwarf, against a peril-2 raid of ten in the open |

The `ambush` and `open` rows are the no-channel game: by the equivalence above they are what `2a4e5832` plays. The caster and marksdwarf rows are with the cast-when rule (`…-t470-caster-arena-cast-when.jsonl`); the caster rows before it are in `…-t470-caster-arena.jsonl`.

| Figure | `ambush` | `ambush-ember` | `ambush-frost` | `ambush-wand` | `ambush-xbow` | `open` | `open-ember` | `open-xbow` |
|---|---|---|---|---|---|---|---|---|
| Outcome | repelled 24 | repelled 24 | repelled 23, wiped out 1 | repelled 24 | repelled 24 | squad down 24 | squad down 23, raid turned back 1 | squad down 20, raid turned back 4 |
| Soldiers dead a day later (of 3) | 1.08 | 0.58 | 0.75 | 0.58 | 2.04 | 3.00 | 3.00 | 3.00 |
| Shooter down at the end / dead a day later | — | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 1 | — | 24 / 24 | 23 / 23 |
| Raiders dead (of 4 or 11) | 3.83 | 3.96 | 3.92 | 4.00 | 3.96 | 1.33 | 2.00 | 3.46 |
| Bolts shot a fight | — | 4.8 | 6.0 | 6.8 | 10.8 | — | 4.4 | 13.3 |
| Hits on raiders / damage | — | 53 / 1,105 | 63 / 544 | 80 / 944 | 91 / 2,043 | — | 40 / 742 | 133 / 2,571 |
| Missed / blocked by a shield | — | 68 / 1 | 86 / 1 | 83 / 0 | 90 / 15 | — | 63 / 5 | 158 / 23 |
| Hits on fortress creatures / damage (fights with any) | — | 0 / 0 (0) | 1 / 9 (1) | 0 / 0 (0) | 65 / 895 (21) | — | 1 / 18 (1) | 23 / 369 (12) |
| Kills by the shooter | — | 4 | 1 | 1 | 34 | — | 21 | 54 |
| Raiders slowed | — | — | 39 | — | — | — | — | — |
| Civilians dead a day later (of 3) | 1.29 | 1.38 | 1.21 | 1.50 | 1.79 | 2.96 | 2.88 | 2.75 |

Before the cast-when rule the casters hit their own side 28 times for 443 damage in 14 ambush fights (ember), 39 for 208 (frost) and 26 for 193 (wand), and 82 times for 1,357 in 23 open fights; the soldiers dead a day later were 0.88, 0.63 and 0.63.

### No-channel equivalence

`reports/data/2026-11-02-t470-pp-defence.probe.ts.txt` runs `pp_defence` as the scenario does and records the end tick, the state of every rng stream and a digest of every combat event. `…-t470-pp-defence-before.json` is `2a4e5832`, `…-after.json` the branch with the cast-when rule: equal in every field.

## What this does not measure

- The ward row of the worked numbers (T-473), vials (T-473), and casters against the trollkin or the wyrm.
- A caster in a ranged squad, or behind a fortification: the arena's caster stands on open ground at the squad's station.
- Hexers (T-479): no hostile casts.
