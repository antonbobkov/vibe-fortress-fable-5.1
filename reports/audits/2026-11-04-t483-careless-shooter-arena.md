# Measurement: careless shooters, in the combat-pace arenas and the twenty-seed file

**Task:** T-483 · **Date:** 2026-11-04 (runs of 2026-11-04 and 2026-11-05) · **Commit examined:** the T-483 branch at `921cba17` (master `9267b7fd` with T-479 and T-487 merged, and the held-shot branch `a5405a56` under it) · **Kind:** measurement; `CARELESS_SHOT_PERCENT` and `CARELESS_SAFE_SKILL` are new and stay *unmeasured*: nothing here tunes them · **Source:** [the T-483 work file](../../docs/archive/tasks/T-483-marksdwarf-friendly-fire.md), [the held-shot arena](2026-11-04-t483-held-shot-arena.md), [the caster arena](2026-11-02-t470-caster-arena.md)

## The rule measured

A shooter with a launcher, ammunition or a channel's bolt, with one of its own on the projectile's ray before its target, holds its shot unless it is careless this time (16 § Ranged resolution, Held shot). The chance falls with the shooting skill (the launcher's skill, `runecraft` for a caster): 50% at 0, 5% less a level, 0 from Proficient (10). It is one draw, made only with an ally on the line and the shooter's attack cooldown elapsed, on 16's stream for a launcher with ammunition and on 25's for a caster. A careless shooter shoots its held target through the ally; a careful one shoots another clear target or waits, and after a draw it takes its attack cooldown before it weighs again. At a chance of 0 nothing is drawn, so a Proficient shooter behaves as in the held-shot version. Raiders' skills are `2 + 2 × gear tier`: a peril-2 raid's archers have 6 (20% careless), a raid's hexer 8 (10%), a siege's 10 (never).

## The answer

- **A Novice marksdwarf shoots its own squad again, less than before the held shot.** In the ambush of four a marksdwarf at crossbow 2 hits a fortress creature 26 times for 381 in 17 fights of 24, and the squad loses **1.46** soldiers a fight. Before any held shot a Proficient one did 60 for 856 in 23 fights (1.92 lost); with the held shot a Proficient one does 0 (1.04). Its own careless shots are about four in ten of its 7.3 a fight; it kills 12 raiders in 24 fights.
- **A Proficient marksdwarf is unchanged in kind.** It never fires through its line: 0.8 bolts a fight, as in the held-shot version, and 1.04 soldiers lost. Its one hit on its own side (11 damage in one fight) is friendly fire after the shot.
- **An apprentice caster singes its squad a little.** At runecraft 2 (rune 50, to keep the comparison to skill) it hits its own side 5 times for 73 in 5 ambush fights of 24, and the squad loses **0.96** (0.75 with a Proficient caster, 0.88 with none). Its bolts miss more: 22 hits for 454 against 57 for 1,183. In the open it hits its own side 19 times for 306 in 10 fights. A Proficient caster draws nothing and never fires through.
- **Raid archers pepper their own front again.** In the plain open arena a peril-2 raid's archers hit their own party 34 times for 359 in 18 fights of 24 (116 for 1,229 in 24 before the held shot, 0 with it). The raid loses **2.17** of its 11 (3.42 before, 1.50 with the held shot). The squad is down in every open fight either way. In the ambush of four, archers rarely have a fellow on their line: 0 to 2 hits on their own a variant.
- **The twenty-seed file keeps its set rule.** 19 / 19 alive at year 1, 7 / 7 peril-0 seeds grown, 0 / 7 with need deaths; peril 0 is the reference to the dwarf. Peril 2 gives 57 deaths and 283 living (45 and 345), peril 4 61 and 230 in five seeds (86 and 132). The same code with every shooter always holding moves the same seeds as far, so these are the timeline's moves, not the rule's. One seed, `p4-3`, stopped on day 197 on an invariant after its fortress fell (a siege stays engaged with two fortress dogs; filed).
- **No-launcher combat and the scripted checks do not move.** `pp_defence` gives the held-shot record on all four seeds, field for field (no launcher is fired in any of them). The annual instrument gives its reference row, 13/7/10/149/7/0/0.

## What was run

`reports/data/2026-11-04-t483-careless-arena.probe.ts.txt` is the [held-shot arena](2026-11-04-t483-held-shot-arena.md) probe with the shooter's skill in the row's name: `-xbow2` and `-ember2` are Novice (crossbow or runecraft 2), `-xbow` and `-ember` Proficient (10). Same seeds (`t366-squad-ambush-<i>`, `t366-squad-open-<i>`), 24 trials a row, through the real tick loop, each until one side is down or the party leaves (at most 4,800 ticks), then a day with no medic. The marksdwarf (dodge 2, a tunic, an oak crossbow and 25 iron bolts) is in a ranged squad of its own at the squad's station; the caster (rune 50, a tunic, an iron staff of embers) is the fourth member of the squad. Data: `reports/data/2026-11-04-t483-careless-arena.jsonl`.

Each cell gives the original (before any held shot, `…-t483-arena-before.jsonl`), the held-shot version (`…-t483-arena-after.jsonl`) and now, where the row exists; a Novice row has only now.

| Figure | `ambush` | `ambush-xbow2` | `ambush-xbow` | `ambush-ember2` | `ambush-ember` |
|---|---|---|---|---|---|
| Outcome | repelled 24 (24, 24) | repelled 24 | repelled 24 (24, 24) | repelled 24 | repelled 24 (24, 24) |
| Soldiers dead a day later (of 3) | 0.88 / 0.88 / **0.88** | **1.46** | 1.92 / 1.04 / **1.04** | **0.96** | 0.71 / 0.67 / **0.75** |
| Shooter dead a day later | — | 3 | 1 / 0 / 0 | 1 | 0 / 0 / 0 |
| Shots a fight | — | 7.3 | 10.5 / 0.8 / 0.8 | 7.0 | 5.0 / 5.0 / 5.0 |
| Hits on raiders / damage | — | 22 / 491 | 93 / 2,088 → 7 / 154 → 6 / 134 | 22 / 454 | 57 / 1,184 → 57 / 1,185 → 57 / 1,183 |
| Hits on fortress creatures / damage (fights) | — | **26 / 381 (17)** | 60 / 856 (23) → 0 → 1 / 11 (1) | **5 / 73 (5)** | 0 → 0 → 0 |
| Kills by the shooter | — | 12 | 35 / 3 / 4 | 1 | 7 / 7 / 6 |
| Civilians dead a day later (of 3) | 1.46 / 1.42 / 1.33 | 1.58 | 1.79 / 1.17 / 1.17 | 1.08 | 1.29 / 1.38 / 1.42 |
| Raiders' shots a fight | 24.3 / 23.3 / 23.2 | 25.5 | 26.8 / 21.1 / 21.6 | 20.8 | 23.9 / 23.3 / 23.7 |
| Raider hits on raiders / damage (fights) | 4 / 43 (3) → 0 → 0 | 1 / 10 (1) | 1 / 12 (1) → 0 → 2 / 22 (1) | 0 | 2 / 21 (2) → 0 → 1 / 11 (1) |

| Figure | `open` | `open-xbow2` | `open-xbow` | `open-ember2` | `open-ember` |
|---|---|---|---|---|---|
| Outcome | squad down 24 (24, 24) | squad down 24 | down 23, repelled 1 (down 22 / 24) | squad down 24 | squad down 24 (down 21 / 22) |
| Soldiers dead a day later (of 3) | 3.00 everywhere | 3.00 | 3.00 | 3.00 | 3.00 |
| Shooter dead a day later | — | 24 | 23 / 24 / 24 | 24 | 24 / 23 / 24 |
| Raiders dead (of 11) | 3.42 / 1.50 / **2.17** | 2.62 | 4.42 / 2.46 / 3.33 | 2.33 | 4.54 / 2.88 / 2.46 |
| Shots a fight | — | 11.1 | 13.7 / 9.9 / 10.3 | 8.3 | 5.2 / 7.7 / 5.8 |
| Hits on raiders / damage | — | 58 / 1,136 | 129 / 2,501 → 101 / 1,950 → 115 / 2,301 | 16 / 291 | 43 / 804 → 78 / 1,474 → 57 / 1,058 |
| Hits on fortress creatures / damage (fights) | — | **9 / 135 (6)** | 28 / 422 (12) → 0 → 0 | **19 / 306 (10)** | 0 → 0 → 0 |
| Kills by the shooter | — | 37 | 54 / 35 / 41 | 13 | 21 / 30 / 21 |
| Raiders' shots a fight | 70.2 / 42.3 / 47.7 | 56.2 | 73.2 / 46.3 / 56.9 | 58.3 | 75.5 / 55.4 / 59.7 |
| Raider hits on raiders / damage (fights) | 116 / 1,229 (24) → 0 → **34 / 359 (18)** | 24 / 267 (14) | 113 / 1,181 (24) → 0 → 24 / 265 (16) | 32 / 321 (17) | 116 / 1,215 (24) → 3 / 33 (2) → 29 / 285 (18) |

The Proficient rows move from the held-shot version only through the raiders, who are careless again: the Proficient shooter itself draws nothing.

### pp_defence

`reports/data/2026-11-04-t483-pp-defence.probe.ts.txt`, run again on the branch, writes `reports/data/2026-11-04-t483-careless-pp-defence.jsonl`. On all four seeds (`pp-defence`, `-2`, `-3`, `-4`) every field is the held-shot version's after record: passes, end tick (30,440, 30,380, 22,040, 8,620), combat events by digest, the state of every rng stream, and the event count. No launcher is fired in any of them, so no shot is weighed.

### The annual instrument

`test/perf/wildlife_year.test.ts` on the branch gives the reference row exactly: median 13, worst 7, second-worst 10, sum of the living 149, 7 of 12 years without a wildlife dwarf death, no extinction, no hunger or thirst death.

## The twenty-seed file

`test/perf/three_years_seeds.test.ts`, whole, once, on `c55d25cc`, after `npm test` passed (418 files; the one failure of that run was a link to this report, not yet written). Reference: [hexers measured](2026-11-04-t479-hexers.md) (`659cc62e`), 134 deaths and 866 living in nineteen seeds, without `p4-4`. Master has T-487 since, so `p4-4` now plays its three years. Data: `reports/data/2026-11-05-t483-sweep.json`.

| Peril | Reference: deaths / living at year 3 | T-483 | Note |
|---|---|---|---|
| 0 (7 seeds) | 3 / 389 | **3 / 389** | every seed equal to the reference, field for field in deaths and population |
| 2 (7 seeds) | 45 / 345 | **57 / 283** | `p2-1`, `p2-4`, `p2-5` as the reference; `p2-2` 12 / 11 (10 / 12), `p2-3` 2 / 71 (4 / 69), `p2-6` 6 / 40 (4 / 72), `p2-7` 13 / 35 (3 / 66), which passes its dining-hall witness this time |
| 4 (6 seeds) | 86 / 132 in five; `p4-4` stopped on day 251 | **61 / 230** in five; `p4-3` stopped on day 197 | `p4-4` 10 / 30 (new); `p4-2` lives (14 / 55, was 22 / 0); `p4-3` falls on day 188 as before, then a T-176 finding (below) |
| All | 134 / 866 in nineteen | **121 / 902** in nineteen; 111 / 872 in the eighteen both runs counted | |

Set rule: alive at year 1 **19 / 19** counted (needs 18), peril 0 grown **7 / 7** (needs 6), peril-0 need deaths **0 / 7** (at most 1). The set test passed. The file failed on one seed, `p4-3`, on the invariant `party.active-over-10d`, and on nothing else. No dwarf in any seed was killed by a fortress creature.

**Why seeds moved.** A weighing is a draw on 16's stream, and every later hit roll, parry and wound of the fortress moves with it, so a seed whose raids weigh even one shot plays a different war. The same code with `CARELESS_SHOT_PERCENT` at 0 (every shooter always holds; `reports/data/2026-11-05-t483-careless-pairs.probe.ts.txt`) gives `p2-7` 11 deaths and 57 living, `p2-6` 8 and 23, and `p4-3` 26 deaths, extinct on day 188, passing: as far from the reference as the careless run, in both directions. The moves at peril 2 and 4 are the timeline's, not a trend; the twenty seeds cannot tell careless shooters from the held shot. With the rule, the same probe counts every shooter's hit on its own faction: in `p2-6`, `p2-7` and `p4-3` no raider and no dwarf hit one of its own (the raids shoot 32 to 84 arrows a seed, mostly from outside a locked gate, and the fortress 0 to 2 bolts). In the scripted fortresses the careless shot is rare; it shows in an open fight. Data: `reports/data/2026-11-05-t483-careless-pairs.txt`.

**The `p4-3` finding.** The fortress is extinct on day 188, two days after a siege of 35 arrives, as in the reference. The siege then stays in `engage` to day 197: its captain holds one of two fortress dogs it never reaches, every other member holds nothing, and the party's `stateSince` is set again about every 3,000 ticks, so neither engage's nor loiter's limit runs out. The siege's members have skill 10 and never weigh a shot; the careless rule only changed which creatures were left. Filed as [a siege stays engaged with fortress dogs](../../docs/work/T-501-siege-engaged-with-dogs.md). Data: `reports/data/2026-11-05-t483-p4-3-siege.txt`.

## What this does not measure

- Whether 50% and Proficient are the right ends of the curve: both constants are *unmeasured*. A player who wants no friendly fire trains marksdwarves to Proficient or gives them a fortification or a station of their own.
- A Novice caster with a Novice's rune (10): the caster rows keep rune 50 so that only the skill differs.
- Sieges (archers and hexers at skill 10 are never careless), and the other raid arenas in `balance-status.md` (filed as [re-measure the raid arenas](../../docs/work/T-499-raid-arenas-after-held-shot.md)).
