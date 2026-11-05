# Measurement: dread hexers and calm armour

**Task:** T-493 · **Date:** 2026-11-05 · **Commit examined:** the T-493 branch at `e69e20de` (master `8796d77e` merged: T-483, T-494, T-495) for the arena, `pp_defence` and the annual instrument; `46920c9a` (the same code, the three-year file's party watch counting Dread) for the twenty-seed file · **Kind:** measurement; `DREAD_HEXER_EVERY` (3) and `calm`'s numbers are new and stay *unmeasured*: nothing here tunes them · **Source:** [the T-493 work file](../../docs/archive/tasks/T-493-hexer-dread-and-calm-armour.md), [hexers measured](2026-11-04-t479-hexers.md), [careless shooters](2026-11-04-t483-careless-shooter-arena.md)

## The rule measured

A hexer whose entity id is a multiple of `DREAD_HEXER_EVERY` carries a wand of dread (sapphire) instead of frost; the choice reads the id and draws nothing (25 § Hexers). An oak wand of dread casts Dread for 280 ticks at range 4, 2 rune a cast, at most once while its last Dread lasts: up to four creatures of the fortress, nearest first, each after the Willpower resist roll, run `FLEE_EFFECT_TILES` (12) from it and come back. A dwarf runs by 10's brain through 16's `stepFled`, a soldier on duty too: it drops its job (back to the board with its progress) and what it carries, and its squad does not move it while it runs. A `calm` armour piece (sapphire) keeps its wearer from being put to flight, by Dread or a fearsome blow, and adds 25 to its resist roll against Daze. A dwarf put to flight thinks `put_to_flight`, −2 for 12 hours.

## The answer

- **A dread hexer casts in almost every open fight and sends two or three soldiers running.** In T-479's peril-4 arena (six Novice soldiers in full iron against a raid of ten in the open) a dread hexer casts Dread in 23 fights of 24, 1.5 times a fight, and puts 2.6 soldiers to flight (2.4 different soldiers); its soldiers spend 515 soldier-ticks fleeing a fight, and while fleeing they take 17.6 hits for 186 damage. A frost hexer, for comparison, casts 5.7 bolts and hits 2.4 times.
- **It does not change who wins in the arena.** The squad goes down in every fight of every variant, with or without hexers, frost or dread: the raid of ten at gear tier 3 is too much for six Novices since T-483 made raid archers careless again. The squad's blood lost and the raiders killed stay within noise (below).
- **Calm answers it entirely.** With every soldier in a calm iron helm, the dread hexer never casts: it needs two creatures it can take within 4.
- **Nothing moves without hexers.** `pp_defence` on its four seeds gives T-483's record field for field (pass, end tick, combat events and their digest, every rng stream, the event count). The annual instrument gives its reference row, 13/7/10/149/7/0/0.
- **The twenty-seed file keeps its set rule and barely moves.** 19 / 19 alive at year 1, 7 / 7 peril-0 seeds grown, 0 / 7 with need deaths. **121 deaths and 914 living** in nineteen seeds against T-483's 121 and 902. Peril 0 and peril 2 are T-483's to the dwarf, seed for seed. At peril 4 four seeds are T-483's exactly; `p4-4` lives with 42 instead of 30 (10 deaths either way). `p4-3` stops on day 197 on the same invariant as in T-483 (`party.active-over-10d`, filed as T-501). No hexer cast Dread in any seed: 27 hexers came, two seeds' hexers cast 17 frost bolts, and as T-479 found, most raids loot outside a locked gate.

## What was run

One heavy process at a time on this machine; each run waited until no `vitest.perf` process was running.

| Run | What | Data |
|---|---|---|
| Dread arena | `reports/data/2026-11-05-t493-dread-arena.probe.ts.txt`: T-479's hexer arena, same seeds (`t479-arena-<i>`), 24 trials a row; `plain` as in year 1, `hexer` as in year 2 with its wand set to amethyst, `dread` with it set to sapphire, `dread-calm` as `dread` with every soldier's iron helm set with `calm`, `mixed` with a second hexer as a siege brings, one of each | `reports/data/2026-11-05-t493-dread-arena.jsonl` |
| `pp_defence` | T-483's probe on the four seeds | `reports/data/2026-11-05-t493-pp-defence.jsonl`, against `2026-11-04-t483-careless-pp-defence.jsonl` |
| Annual instrument | `test/perf/wildlife_year.test.ts` | the console row |
| Twenty seeds | `test/perf/three_years_seeds.test.ts`, whole, once, at the end, after `npm test` passed | `reports/data/2026-11-05-t493-sweep.json` |

## The arena

| Figure, a fight | `plain` | `hexer` (frost) | `dread` | `dread-calm` | `mixed` |
|---|---|---|---|---|---|
| Outcome (24 fights) | squad down 24 | squad down 24 | squad down 24 | squad down 24 | squad down 24 |
| Fight length, ticks | 1,145 | 1,129 | 1,137 | 1,148 | 1,101 |
| Blood lost by the six at the end (the dead at their whole) | 3,335 | 3,314 | 3,327 | 3,361 | 3,376 |
| Raiders dead a day later | 1.50 of 11 | 1.25 of 12 | 1.38 of 12 | 1.75 of 12 | 1.42 of 13 |
| Spells cast / fights with a cast | — | 5.71 / 24 | 1.50 / 23 | 0 / 0 | 7.92 / 24 |
| Dread casts | — | — | 1.50 | 0 | 1.58 |
| Soldiers put to flight (different soldiers) | — | — | 2.63 (2.38) | 0 | 2.92 (2.75) |
| Soldier-ticks under Dread | 0 | 0 | 515 | 0 | 526 |
| Raider hits on a fleeing soldier / damage | — | — | 17.6 / 186 | — | 18.6 / 187 |
| Frost hits on a soldier | — | 2.42 | — | — | 2.08 |
| Frost hits on their own side (all fights) | — | 13 | — | — | 15 |
| Raider hits on soldiers / damage | 78.5 / 874 | 81.8 / 892 | 78.0 / 846 | 76.2 / 851 | 74.7 / 792 |
| Hexers dead a day later | — | 0.13 | 0.29 | 0.33 | 0.33 |

A soldier put to flight is a soldier the raid hits at +10 with no parry or block, and one the squad lacks while it runs: a fifth of all raider hits in the `dread` fights land on a fleeing soldier. In this arena the squad loses anyway, so the trade shows only as where the hits land. A cast sends 1.75 soldiers on average: the rest are out of its range of 4 or resist (Willpower near 50, about one roll in four).

The frost hexer's 13 hits on its own side are T-483's careless rule (runecraft 8 in a raid: one weighing in ten). A dread hexer has no bolt and never hits its own.

## What this does not measure

- Whether one in three is the right share, or 25 the right Daze resist: both are *unmeasured*. No dwarf is ever dazed (only fortress casters hold a diamond, and Daze takes only hostiles), so `daze_resist` does nothing in play today; it is the row's flavour, and the rule's for a later Daze caster on the other side.
- A fight the squad can win: the arena's raid is too strong for its squad in every variant. The twenty seeds show the fortress.

## The twenty-seed file

`test/perf/three_years_seeds.test.ts`, whole, once, on `46920c9a`, after `npm test` passed. Reference: [careless shooters](2026-11-04-t483-careless-shooter-arena.md) (`c55d25cc`), 121 deaths and 902 living in nineteen seeds. Data: `reports/data/2026-11-05-t493-sweep.json`.

| Peril | Reference: deaths / living at year 3 | T-493 | Note |
|---|---|---|---|
| 0 (7 seeds) | 3 / 389 | **3 / 389** | every seed equal to the reference in deaths and population |
| 2 (7 seeds) | 57 / 283 | **57 / 283** | every seed equal: peril 2 brings no hexer and draws nothing new |
| 4 (6 seeds) | 61 / 230 in five; `p4-3` stopped on day 197 | **61 / 242** in five; `p4-3` stopped on day 197 | `p4-1`, `p4-2`, `p4-5`, `p4-6` equal; `p4-4` 10 / 42 (10 / 30) |
| All | 121 / 902 in nineteen | **121 / 914** in nineteen | |

Set rule: alive at year 1 **19 / 19** counted (needs 18), peril 0 grown **7 / 7** (needs 6), peril-0 need deaths **0 / 7** (at most 1). The set test passed. The file failed on one seed, `p4-3`, on the invariant `party.active-over-10d` at tick 235,200, as in the reference ([a siege stays engaged with fortress dogs](../../docs/archive/tasks/T-501-siege-engaged-with-dogs.md)), and on nothing else.

**Hexers in the seeds.** The party watch now counts Dread casts and fortress creatures a hexer put to flight. 27 hexers came to the five peril-4 seeds that ran three years; those of `p4-2` cast 8 frost bolts (3 hits, one dwarf killed, as in the reference) and those of `p4-6` 9 (6 hits); none cast Dread and none put a dwarf to flight. A dread hexer needs two of the fortress within 4 tiles in its line of sight, and the raids that bring hexers mostly loot outside a locked gate. The one seed that moved, `p4-4`, has no cast of either kind: a dread hexer in it stands and walks where a frost hexer would not (it holds 4 tiles from its target, not 8), or the seed moved with master's T-495, merged since the reference; this run does not separate the two. Its deaths are unchanged.
