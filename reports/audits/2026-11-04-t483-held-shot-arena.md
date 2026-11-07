# Measurement: the held shot for every launcher, in the combat-pace arenas

**Task:** T-483 · **Date:** 2026-11-04 · **Commit examined:** master `f856463a` (before) and the T-483 branch on it (after, `2d8dced7`) · **Kind:** measurement; no constant, formula or content value was changed by it · **Source:** [the T-483 work file](../../docs/archive/tasks/T-483-marksdwarf-friendly-fire.md), [the caster arena](2026-11-02-t470-caster-arena.md)

## The rule measured

A shooter with a launcher, ammunition or a channel's bolt alike, holds its shot while a creature of its own faction stands on the projectile's ray before its target, and then shoots the nearest other hostile it can reach with a clear line, or waits (16 § Ranged resolution, Held shot). Before, only a caster's bolt held. The rule now holds for marksdwarves, hunters and hostile archers. A natural ranged attack has no such rule. The check draws nothing, so friendly fire after the shot is unchanged.

## The answer

- **The marksdwarf no longer shoots its own squad, but in the ambush it hardly shoots at all.** In the ambush of four it hits a fortress creature 0 times in 24 fights, against 60 hits for 856 damage in 23 fights before. The squad loses **1.04** soldiers a fight, against **1.92** before and **0.88** with no marksdwarf. But it shoots **0.8** bolts a fight instead of 10.5, and kills 3 raiders in 24 fights instead of 35: standing at the squad's station, behind its soldiers, its line to every raider crosses one of them, and it waits. Filed as [a held shooter waits behind its own line](../../docs/archive/tasks/T-498-held-shooter-clear-line.md).
- **In the open the marksdwarf still shoots, and never hits its own.** Against a raid of ten it shoots 9.9 bolts a fight (13.7 before), hits raiders 101 times for 1,950 and its own side 0 times (28 for 422 in 12 fights before), and kills 35 (54 before). The squad is down in 24 of 24 either way.
- **Hostile archers hold too, and that makes raids deadlier in the open.** Before, the raid's archers shot through their own warriors: 116 hits for 1,229 damage on their own party in all 24 open fights, and 4 for 43 in the ambush. After, 0 in both. So fewer raiders die: in the plain open arena the raid loses **1.50** of its 11 instead of **3.42**, and it shoots 42 arrows a fight instead of 70. The squad was already lost in every fight, so its row does not change (3.00 dead). In the ambush every raider dies either way; the soldiers dead a day later stay at 0.88.
- **The caster's rule is unchanged.** With the rule limited, for this check only, to fortress shooters with ammunition (`…-fortress-only.jsonl`), the plain, ember and wand rows are equal to the before rows in every figure, field for field. The caster rows of the full after run move only because the raid's archers in the same fights now hold their shots: ambush-ember 0.71 → 0.67 soldiers dead, 57 hits for 1,184 → 1,185; ambush-wand 0.63 → 0.67; open-ember raiders dead 4.54 → 2.88, repelled 3 → 2.
- **No-channel combat outside these arenas does not move.** The six digests pinned in `test/unit/runecraft/t470-no-channel-equivalence.test.ts` still match: each has one shooter and no ally on its line. `pp_defence` gives the same record before and after on all four seeds (`pp-defence`, `-2`, `-3`, `-4`): the same end tick, the same combat events by digest, the same state of every rng stream and the same event count. No launcher is fired in any of them: the Warband's hunter never gets its hunt (`hunt:no_tool`), and the squad fights with axes. No golden moved. The annual instrument gives its reference row, 13/7/10/149/7/0/0.

## What was run

`reports/data/2026-11-04-t483-arena.probe.ts.txt` is the [T-470 arena probe](2026-11-02-t470-caster-arena.md) with the marksdwarf rows in its default list, and the raiders' own shots and hits on each other counted. Same seeds (`t366-squad-ambush-<i>`, `t366-squad-open-<i>`), 24 trials a row, through the real tick loop, each trial until one side is down or the party leaves (at most 4,800 ticks), then a day with no medic. The set-up of each row is the caster arena's. The marksdwarf (crossbow 10, dodge 2, a tunic, an oak crossbow and 25 iron bolts) is in a ranged squad of its own at the same station. The ambush of four has two archers; the raid of ten, a captain and three archers.

Three runs: before (`…-arena-before.jsonl`, master `f856463a`), after (`…-arena-after.jsonl`, the branch), and a check run on the branch with one temporary line that skipped the rule for every shooter that is not of the fortress (`…-arena-fortress-only.jsonl`; the line is not committed).

| Figure | `ambush` | `ambush-xbow` | `ambush-ember` | `ambush-wand` | `open` | `open-xbow` | `open-ember` |
|---|---|---|---|---|---|---|---|
| Outcome, before | repelled 24 | repelled 24 | repelled 24 | repelled 24 | squad down 24 | down 22, repelled 2 | down 21, repelled 3 |
| Outcome, after | repelled 24 | repelled 24 | repelled 24 | repelled 24 | squad down 24 | squad down 24 | down 22, repelled 2 |
| Soldiers dead a day later (of 3), before → after | 0.88 → 0.88 | 1.92 → **1.04** | 0.71 → 0.67 | 0.63 → 0.67 | 3.00 → 3.00 | 3.00 → 3.00 | 3.00 → 3.00 |
| Shooter dead a day later, before → after | — | 1 → 0 | 0 → 0 | 0 → 0 | — | 23 → 24 | 24 → 23 |
| Raiders dead (of 4 or 11), before → after | 4.00 → 4.00 | 4.00 → 4.00 | 4.00 → 4.00 | 4.00 → 4.00 | 3.42 → **1.50** | 4.42 → 2.46 | 4.54 → 2.88 |
| Shots a fight, before → after | — | 10.5 → **0.8** | 5.0 → 5.0 | 6.3 → 6.3 | — | 13.7 → 9.9 | 5.2 → 7.7 |
| Hits on raiders / damage, before → after | — | 93 / 2,088 → 7 / 154 | 57 / 1,184 → 57 / 1,185 | 72 / 844 → 72 / 844 | — | 129 / 2,501 → 101 / 1,950 | 43 / 804 → 78 / 1,474 |
| Hits on fortress creatures / damage (fights), before → after | — | 60 / 856 (23) → **0** | 0 → 0 | 0 → 0 | — | 28 / 422 (12) → **0** | 0 → 0 |
| Kills by the shooter, before → after | — | 35 → 3 | 7 → 7 | 2 → 2 | — | 54 → 35 | 21 → 30 |
| Civilians dead a day later (of 3), before → after | 1.46 → 1.42 | 1.79 → 1.17 | 1.29 → 1.38 | 1.08 → 1.04 | 2.88 → 2.92 | 2.79 → 2.92 | 2.79 → 2.96 |
| Raiders' shots a fight, before → after | 24.3 → 23.3 | 26.8 → 21.1 | 23.9 → 23.3 | 20.3 → 20.3 | 70.2 → 42.3 | 73.2 → 46.3 | 75.5 → 55.4 |
| Raider hits on raiders / damage (fights), before → after | 4 / 43 (3) → 0 | 1 / 12 (1) → 0 | 2 / 21 (2) → 0 | 0 → 1 / 12 (1) | 116 / 1,229 (24) → **0** | 113 / 1,181 (24) → 0 | 116 / 1,215 (24) → 3 / 33 (2) |

The few raider hits on raiders after the rule are friendly fire after the shot: a miss flying on, or a member stepping into the path.

With the rule for fortress shooters only, `ambush-xbow` gives 1.00 soldiers dead, 0.96 shots a fight, 7 hits for 158, 0 on its own side and 4 kills; `open-xbow` 20 squads down and 4 repelled, 10.3 shots, 112 hits for 2,195, 0 on its own side, 49 kills and 5.04 raiders dead. Every other row is equal to before.

### pp_defence

`reports/data/2026-11-04-t483-pp-defence.probe.ts.txt` plays `pp_defence` as the scenario does, on its seed and three more, and records whether it passes, the end tick, a digest of the rng streams and of every combat event, and every `ProjectileFired`. `…-t483-pp-defence.jsonl` holds the before and after records: equal in every field.

| Seed | Passes | End tick | Combat events | Launcher shots | Kill |
|---|---|---:|---:|---:|---|
| `pp-defence` | yes / yes | 30,440 | 22 | 0 | a wolf |
| `pp-defence-2` | yes / yes | 30,380 | 12 | 0 | a badger |
| `pp-defence-3` | yes / yes | 22,040 | 17 | 0 | a boar |
| `pp-defence-4` | yes / yes | 8,620 | 4 | 0 | a badger |

### The annual instrument

`test/perf/wildlife_year.test.ts` on the branch gives the reference row exactly: median 13, worst 7, second-worst 10, sum of the living 149, 7 of 12 years without a wildlife dwarf death, no extinction, no hunger or thirst death. Its hunters shoot (1 to 13 hunts a year), and the rule did not change the row.

## What this does not measure

- A marksdwarf on a fortification or an overlook, or on a station of its own away from the melee squad.
- Sieges, the other raid arenas in `balance-status.md` (combat pace, ward, enchantment, draughts), and the scripted fortresses (`defence_year`, the three-year and twenty-seed runs). Their raids have archers, so their figures can move; the twenty-seed sweep was not run. Filed as [re-measure the raid arenas](../../docs/archive/tasks/T-499-raid-arenas-after-held-shot.md).
- Hunting with a dog: no hunt took place in `pp_defence` ([filed](../../docs/work/T-500-warband-hunt-no-tool.md)).
