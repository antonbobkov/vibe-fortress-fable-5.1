# Measurement: territorial animals keep their ground away from the fortress (T-446)

**Task:** T-446 · **Date:** 2026-10-24 · **Commits examined:** `f4454b9` (master merged on T-427's `bff3bc9`) with the change · **Kind:** rule with before and after rows · **Source:** [T-427's report](2026-10-24-animals-stuck-leaving.md), [boars maul p0-2](2026-10-22-boars-maul-p0-2.md)

## The answer

- **The rule** (08 § Wild behavior, *ground away from the fortress*). A territorial surface animal keeps no home chunk whose centre lies within `TERRITORY_AVOID_RADIUS` tiles of the fortress, horizontally on any level. The fortress is the wagon, built buildings' footprints and zone tiles.
  - When its home is that near, the animal moves its home to the nearest chunk on its level that is not, and wanders there.
  - With no such chunk, it leaves the map.
  - A dwarf who walks into its ground is still attacked.
- **Radius 16 is taken.**
  - At 24, no chunk centre of a 48 × 48 map (the player paths and the three-year fortress) is far enough, so every territorial animal leaves. pp_defence then fails on 2 of 4 seeds: pp-defence-2 and pp-defence-4 had killed a boar and a badger by days 35 and 7, and now no hostile is ever ordered.
  - 32 can only be worse on those maps, so it was not run.
- **With T-427, the wildlife deaths fall below T-425's.** The twenty-seed sweep passes 20 of 20. Deaths to wildlife go from 26 (T-427 alone) to **6**, against 8 at T-425. The living at year 3 rise from 674 to **867**.
- **Total deaths are 158 against a target of about 140. One seed carries the miss:** three-years-p4-6 goes from 5 deaths to **51**, all to raids between days 150 and 189:
  - gloam captain 28, gloam warrior 9, gloam archer 7 and trollkin 5;
  - 20 killed, 29 bled out, 2 dead of infection;
  - the fortress dies out.
  - This rule does not touch raids: the seed's timeline moved at peril 4. Without it, the other nineteen seeds total 107 deaths, against T-425's 117.
- **The annual instrument is unchanged:** 13/6/7/142/8/0/0 at radius 16, the same row as T-427 alone, with the official T-308 check (nothing worsens). Eleven of the twelve hashes are identical ([rows](../data/2026-10-24-t446-wildlife.json)). On its 96 × 96 maps the territorial animals' homes already lie far from the fortress.

## Totals by cause, twenty seeds over three years

| Cause | T-425 (`4b8d8e7`) | T-427 alone (`bff3bc9`) | T-427 and T-446, radius 16 |
|---|---:|---:|---:|
| Dwarf deaths | 122 | 208 | **158** |
| Wildlife | 8 | 26 | **6** |
| Parties (Gloam, trollkin, bandits) | 82 | 140 | 133 |
| Bled out, no killer recorded | 23 | 32 | 14 |
| Infection | 6 | 6 | 3 |
| Starvation | 3 | 4 | 0 |
| Another dwarf | 0 | 0 | 2 |
| Living at year 3 | 919 | 674 | **867** |
| Seeds passed | 20 | 20 | 20 |

## Per seed: deaths / living at year 3

| Seed | T-425 | T-427 alone | T-427 and T-446 |
|---|---|---|---|
| p0-1 | 1 / 57 | 1 / 40 | 0 / 59 |
| p0-2 | 4 / 15 | 2 / 22 | 0 / 40 |
| p0-3 | 0 / 75 | 0 / 75 | 0 / 47 |
| p0-4 | 2 / 54 | 2 / 75 | 0 / 73 |
| p0-5 | 0 / 80 | 1 / 60 | 1 / 54 |
| p0-6 | 0 / 77 | 0 / 45 | 0 / 32 |
| p0-7 | 0 / 78 | 1 / 54 | 0 / 80 |
| p2-1 | 11 / 43 | 15 / 29 | 10 / 51 |
| p2-2 | 7 / 46 | 11 / 0 | 16 / 36 |
| p2-3 | 6 / 54 | 9 / 40 | 4 / 43 |
| p2-4 | 5 / 68 | 13 / 52 | 4 / 48 |
| p2-5 | 4 / 26 | 1 / 34 | 1 / 65 |
| p2-6 | 15 / 6 | 15 / 0 | 13 / 0 |
| p2-7 | 6 / 69 | 10 / 58 | 8 / 65 |
| p4-1 | 6 / 32 | 9 / 47 | 3 / 57 |
| p4-2 | 15 / 0 | 12 / 37 | 25 / 28 |
| p4-3 | 17 / 41 | 55 / 6 | 10 / 15 |
| p4-4 | 6 / 47 | 22 / 0 | 6 / 53 |
| p4-5 | 12 / 0 | 12 / 0 | 6 / 21 |
| **p4-6** | 5 / 51 | 17 / 0 | **51 / 0** |

Data: [`2026-10-24-t446-seeds.json`](../data/2026-10-24-t446-seeds.json).

## Other rows

| Radius | Instrument | pp_defence | Sweep |
|---|---|---|---|
| 16 (taken) | 13/6/7/142/8/0/0 | 4 of 4 | 20 of 20; deaths 158, living 867 |
| 24 | not run | 2 of 4 (no chunk qualifies on 48 × 48 maps) | not run |
| 32 | not run (worse than 24 on 48 × 48 maps) | — | — |

## Test changes

- `test/unit/dwarves/t211-patient-duty.test.ts`: the badger that wounds the soldier now defends its ground (`attack`, its tile defended). An idle badger would move its home off the test's hospital and barracks zones and out of the soldier's sight.
- `test/unit/animals/wild.test.ts`: the count of 08's tuning constants goes from 28 to 29.
