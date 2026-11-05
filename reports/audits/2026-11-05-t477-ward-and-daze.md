# Measurement: the ward against two more soldiers, and Daze on a captain, under raid morale

**Task:** T-477 · **Date:** 2026-11-05 · **Commit examined:** master `d0794187` (T-504's raid morale) with the T-477 branch on it · **Kind:** measurement and one content change: the ward spell's `base` from 6 to 4 · **Source:** [the T-477 work file](../../docs/work/T-477-runecraft-whole-loop-scenario.md) (the balance item from T-473), [the T-473 ward arena](2026-11-02-t473-ward-arena.md), [T-504's raid morale](2026-11-05-t504-raid-morale.md)

## The answer

- **One ward caster was worth more than two soldiers, so the ward is lowered.** Against a peril-2 raid of ten in the open, five Novice soldiers in full iron kit and a Proficient caster with a common iron staff of warding (7 armour for 720 ticks) turned the raid back in **44 of 48** fights; the same five with two more axedwarves in its place **36 of 48**, with an axedwarf and a Proficient marksdwarf **32 of 48**. The warded squad also lost fewer dwarves: 3.58 soldiers and 0.35 casters dead a day later, of six, against 5.69 of seven. By the owner's rule the ward came down: the spell's `base` is now **4**, a ward of **5** from an iron staff (3 from a wand), lasting as before.
- **At 5 armour a caster is worth two soldiers.** The same arena: **36 of 48**, exactly the two axedwarves' figure, with 4.02 soldiers and 0.69 casters dead a day later (4.7 of six) against 5.69 of seven. In the ambush of four the ward still all but saves the squad: 0.04 soldiers dead against 0.62 alone and 0.50 with two more.
- **Daze on a captain is strong, and the re-stun never decides anything.** A Proficient caster with an iron staff of stillness, in a squad of its own ordered to kill the raid's captain, turns the raid back in **44 of 48** fights (5 soldiers alone: 3 of 24). It dazes the captain once, at the head of the raid; the axes kill the captain while it lies stunned (hit at +40), the raid loses its captain early and its morale falls before it has felled anyone. In 120 fights at 180 ticks no captain lived to wake and be dazed again. At 90 ticks the re-stun happens (in 23 fights of 48) and the result is the same, 44 of 48: the stun's length is not what decides. Kept: a strong choice that costs a diamond, a Proficient caster and a kill order each raid.
- **The smoke run first.** Under T-504 a lost captain is a drop of 30 in morale, not a retreat. In the arena the captain falls at the same tick in every variant of a seed, and the variants still part: five soldiers alone lose 21 of 24, with a ward caster they win, so the arena measures the squad and not the captain rule.

## What was run

`reports/data/2026-11-05-t477-balance-arena.probe.ts.txt`, a vitest file run from `test/perf` with `vitest.perf.config.ts`, locally, one heavy run at a time: the squad arenas of T-473 on the same seeds (`t366-squad-<arena>-<i>`), through the real tick loop, each trial until one side is down or the party leaves (at most 4,800 ticks), then a day with no medic. Five Novice soldiers (axe, shield, dodge and armour use 2) in an iron helm, mail shirt and greaves with an iron axe and shield, at a station, three civilians eight tiles behind, and in place of a sixth:

| Variant | Who |
|---|---|
| `five` | nobody |
| `ward` | a Proficient runecaster (runecraft 10, rune 50, a tunic) with a common iron staff of warding, in the squad |
| `daze` | the same caster with a common iron staff of stillness, a squad of its own with a kill order on the captain |
| `six`, `seven` | one or two more axedwarves in the same kit (a second squad for the seventh) |
| `marks` | a Proficient marksdwarf (crossbow 10, a tunic, an oak crossbow, 25 iron bolts) in a ranged squad of its own |
| `sixmarks` | one more axedwarf and the marksdwarf |

Data: `…-t477-arena-ward6.jsonl` (the ward at its old base, Daze at 150 ticks: seeds 0–23 for every variant, 24–71 for `ward`, `daze`, `seven`, `sixmarks`), `…-t477-arena-ward4.jsonl` (the ward at base 4, seeds 0–47), `…-t477-arena-daze75.jsonl` (Daze at 75 ticks, seeds 0–47).

## Figures

The peril-2 raid of ten in the open (a raid of eleven with its captain). Seeds 0–47 where the row has 48 fights, 0–23 where it has 24. "Dwarves dead" counts the soldiers and the sixth or seventh, a day after the fight.

| Variant | Fights | Repelled | Squad down | Dwarves dead | Fielded | Raiders dead | Raider hits on the squad / damage | Raiders who lost their nerve |
|---|---:|---:|---:|---:|---:|---:|---|---:|
| `five` | 24 | 3 | 21 | 5.00 | 5 | 3.2 | 94.8 / 472 | 0.0 |
| `six` | 24 | 11 | 13 | 5.42 | 6 | 6.2 | 101.3 / 497 | 1.7 |
| `marks` | 24 | 9 | 15 | 5.71 | 6 | 5.6 | 110.4 / 530 | 0.2 |
| `seven` | 48 | 36 | 12 | 5.69 | 7 | 7.8 | 106.7 / 509 | 1.3 |
| `sixmarks` | 48 | 32 | 16 | 5.77 | 7 | 8.2 | 112.4 / 533 | 0.7 |
| `ward`, base 6 (7 armour) | 48 | 44 | 4 | 3.93 | 6 | 10.4 | 149.3 / 353 | 1.7 |
| **`ward`, base 4 (5 armour)** | 48 | **36** | 12 | **4.71** | 6 | 7.9 | 135.9 / 409 | 1.2 |
| `daze`, 150 ticks (180 from the staff) | 48 | 44 | 4 | 3.27 | 6 | 9.8 | 62.0 / 234 | 2.9 |
| `daze`, 75 ticks (90) | 48 | 44 | 3 | 3.67 | 6 | 9.5 | 69.9 / 262 | 2.3 |

The warded raids hit the squad more often and for less, as in T-473: the ward works by armour on every part. The Daze fights are shorter and the raiders hit less: the captain falls early and about three raiders run on their own before the party breaks.

The peril-2 ambush of four, seeds 0–23 (the ward at base 4: 0–47): every variant repels it in every fight; soldiers dead a day later 0.62 alone, 0.54 with one more, 0.50 with two more, 0.04 warded at 7 armour and 0.04 at 5.

## What changed

- `weapons-and-armor.md` § Spells: the ward's `base` 6 → 4 (`src/content/spells.json` exported). An iron staff's ward is 5 armour for 720 ticks, a wand's 3 for 420. 25 § Spells says how strong the ward and Daze are, with this report.
- Nothing else reaches combat: no number moves without a ward cast, so `pp_defence`, the instrument and the sweep are untouched.

## What this does not measure

- Skilled or Proficient soldiers beside the caster, a caster behind a fortification, or a raid at peril 4.
- A Daze caster with no kill order: standing at the squad's station it rarely comes within 6 tiles of a conscious captain before the axes reach it (in a trial of the open arena it cast nothing).
