# Measurement: a runecaster in the combat-pace arena, and no-channel combat unchanged

**Task:** T-470 · **Date:** 2026-11-02 · **Commit examined:** master `2a4e5832` (before) and the T-470 branch on it (after) · **Kind:** measurement; no constant, formula or content value was changed by it · **Source:** [the T-470 work file](../../docs/work/T-470-runecraft-runeforge-staffs-bolts.md), [the combat-pace tune](2026-10-21-combat-pace-tune.md)

## The answer

- **Combat with no channel in play is unchanged, draw for draw.** `pp_defence` on its seed ends on the same tick (30,440, day 25) with the same 22 combat events byte for byte, the same 11,724 events in all, and every one of the 21 rng streams in the same state, before and after. Six stepped arenas (a duel against two goblins, a warhammer against a trollkin, a crossbow in the open and through a fortification, the magma wyrm's `burn` breath, a war dog) give the same events, wounds and stream states as on `2a4e5832`; their digests are pinned in `test/unit/runecraft/t470-no-channel-equivalence.test.ts`. The flat-test world hashes move only because `Skills.level` grew by the `runesmithing` byte: with that one skill row (and the recipes that name it) taken out, all six old hashes return exactly, with every other T-470 change in place. The annual wildlife instrument gives the same row after as before: median 12.5, worst 7, second-worst 11, sum of the living 149, 7 of 12 years without a wildlife dwarf death, no extinction, no hunger or thirst death.
- **A Proficient runecaster with an iron staff of embers helps a squad of three meet an ambush, and is never touched.** Against a peril-2 ambush of four, three Novice soldiers in full kit drive it off in 24 of 24 fights either way; the soldiers dead a day later fall from **1.08** a fight to **0.88** with the ember staff, **0.63** with a frost staff and **0.63** with a wand of embers. The caster, standing back at the station in a tunic, is never downed. It casts 9.5 bolts a fight (13.8 with the wand, whose cooldown is 14 ticks against the staff's 26), and hits with 41% of them for 20.4 damage a hit against tier-2 bronze (a wand 11.5, a frost staff 9.1, and 42 raiders slowed in 24 fights).
- **The caster shoots its own soldiers about one fight in two.** Its bolts hit a fortress creature in 14 of 24 ambush fights: 28 hits for 443 damage, against 95 hits for 1,940 on the raiders. The frost staff hit allies 39 times (208 damage), the wand 26 times (193). Spec 25 makes friendly fire real by construction; the weight of it is filed as [a caster behind its squad shoots its own soldiers](../../docs/work/T-NEW-caster-friendly-fire.md).
- **A caster does not save a squad in the open against a raid of ten; it makes it worse.** Without it the squad is down in 24 of 24 (all three soldiers dead a day later, the raid losing 1.3 of its 11). With an ember staff the squad and the caster are down in 20 of 24 (the raid turned back with losses in the other 4, the squad already on the ground), the raid loses 2.5, and the caster's bolts land on the soldiers 82 times for 1,357 damage, almost as often as on the raiders (84 hits, 1,495). Once the raiders reach it the caster clubs (212 swings) and dies in all 24.
- **Magic trails steel, as 25 says:** the caster's bolts did 81 damage a fight against the three soldiers' 174 (ember), and a deepsilver masterwork great axe (68 on a bare part) still out-damages the best staff (49).

## What was run

`reports/data/2026-11-02-t470-caster-arena.probe.ts.txt` (a vitest file under `test/perf`, not committed as a test): the squad arenas of [the combat-pace tune](2026-10-21-combat-pace-tune.md), on the same seeds (`t366-squad-ambush-<i>`, `t366-squad-open-<i>`), through the real tick loop. Each trial runs until one side is down or the party leaves (at most 4,800 ticks), then a day with no medic. One heavy run, nothing else running on the machine.

| Arena | Trials | Set-up |
|---|---:|---|
| `ambush` | 24 | three Novice soldiers (axe, shield, dodge, armour use 2) in an iron helm, mail shirt and greaves with an iron axe and shield, at a station; three civilians eight tiles behind; a peril-2 ambush of four by `arriveParty` and 18's spawns |
| `ambush-ember`, `-frost`, `-wand` | 24 each | the same and a fourth member: runecraft 10 (Proficient), a full rune of 50, dodge 2, a tunic and no metal, holding a common iron staff of embers, an iron staff of frost, or an oak wand of embers |
| `open`, `open-ember` | 24 each | the same squad, without and with the ember caster, against a peril-2 raid of ten in the open |

The `ambush` and `open` rows are the no-channel game: by the equivalence above they are what `2a4e5832` plays.

| Figure | `ambush` | `ambush-ember` | `ambush-frost` | `ambush-wand` | `open` | `open-ember` |
|---|---|---|---|---|---|---|
| Outcome | repelled 24 | repelled 24 | repelled 24 | repelled 24 | squad down 24 | squad down 20, raid turned back 4 |
| Soldiers dead a day later (of 3) | 1.08 | 0.88 | 0.63 | 0.63 | 3.00 | 3.00 |
| Caster down at the end / dead a day later | — | 0 / 0 | 0 / 0 | 0 / 0 | — | 24 / 24 |
| Raiders dead (of 4 or 11) | 3.83 | 3.92 | 4.00 | 3.96 | 1.33 | 2.46 |
| Fight length, median ticks | 1,404 | 1,580 | 1,637 | 1,627 | 913 | 1,068 |
| Bolts cast a fight | — | 9.5 | 11.1 | 13.8 | — | 15.5 |
| Bolt hits on raiders / damage | — | 95 / 1,940 | 100 / 908 | 151 / 1,730 | — | 84 / 1,495 |
| Missed / blocked by a shield | — | 110 / 4 | 128 / 5 | 150 / 8 | — | 186 / 28 |
| Hits on fortress creatures / damage (fights with any) | — | 28 / 443 (14) | 39 / 208 (15) | 26 / 193 (13) | — | 82 / 1,357 (23) |
| Kills by the caster | — | 13 | 5 | 11 | — | 50 |
| Raiders slowed | — | — | 42 | — | — | — |
| Civilians dead a day later (of 3) | 1.29 | 1.92 | 1.63 | 1.50 | 2.96 | 2.92 |

The data, one line a trial, is `reports/data/2026-11-02-t470-caster-arena.jsonl`.

### No-channel equivalence

`reports/data/2026-11-02-t470-pp-defence.probe.ts.txt` runs `pp_defence` as the scenario does and records the end tick, the state of every rng stream and a digest of every combat event. `…-t470-pp-defence-before.json` is `2a4e5832`, `…-after.json` the branch: equal in every field.

## What this does not measure

- The ward row of the worked numbers (T-473), vials (T-473), and casters against the trollkin or the wyrm.
- A caster in a ranged squad, or behind a fortification: the arena's caster stands on open ground at the squad's station.
- Hexers (T-479): no hostile casts.
