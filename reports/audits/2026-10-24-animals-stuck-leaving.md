# Measurement: wild animals stuck leaving, and the pressure they held down (T-427)

**Task:** T-427 · **Date:** 2026-10-24 · **Commits examined:** `6d4c6d2` (T-425) and master `b9ad97d`, each with the change · **Kind:** fix with a compensation, before and after rows · **Source:** [boars maul p0-2](2026-10-22-boars-maul-p0-2.md)

## The answer

- **The bug.** An animal in `leave` picked its edge tile again on every think, from the four straight-line edge tiles that it could stand on, without checking that it could reach them. Two failures followed:
  - When its row changed, the target flipped between two edge tiles, and the animal walked to and fro. In p0-2 a deer did this for 316 days.
  - When the nearest edge was cut off, the path failed on every think, so the animal never moved. A lynx stayed this way.
- **The fix.** A leaving animal keeps its edge tile while the walk lasts, and chooses only edge tiles it can reach (22's connectivity). It despawns where it is when none can be reached, as before.
  - In p0-2 over three years, before the fix: 43 leaves, 14 of them over a day, 14 still leaving at day 336 (up to 316 days).
  - After the fix: 30 leaves, none over 0.17 days.
- **The stuck leavers had been holding wildlife pressure down.** A leaver counts against its species' cap while it stays. Before the fix, packs past `WILD_LIFETIME_DAYS` were stuck, harmless at the map edge, so fresh hungry packs rarely spawned.
  - With the fix alone, wolf spawns over the instrument's twelve years rise from 60 to 86, and wolf deaths from 8 to 30.
  - Instrument: 13/8/10/150/8/0/0 → 13/4/7/136/8/0/0, below the sum bound of 138.
  - Twenty-seed sweep: deaths 122 → 177, living 919 → 710, two seeds fail.
- **The compensation taken: `WILD_LIFETIME_DAYS` 28 → 42, with the original spawn weights.** A longer stay lowers how often fresh packs arrive, and it changes nothing before the first lifetime ends.
  - Instrument: **13/6/7/142/8/0/0**. Against T-425's row only the sum worsens, so it passes by the T-308 rule. It is the new reference row.
  - Wolf deaths 8 → 15, boar deaths 0 → 1, wolf hunting 0.01 → 0.04. So part of the danger is back, against 30 wolf deaths with the fix alone.
  - pp_defence passes on 4 of 4 seeds, with the same outcomes as master.
  - The twenty-seed sweep result is below.

## Every row

All rows have the fix. The before row is T-425's (`6d4c6d2`), without the fix. The instrument figures are median/worst/second-worst/sum/wildlife-free. Deaths and spawns are summed over the twelve instrument years. Hunting is the mean count of wolves in `hunt` or `attack` at a 20-tick look, summed over the twelve years.

| Variant | Instrument | T-308 | Wolf / boar deaths | Wolf hunting | Wolf / boar spawns | Other gates |
|---|---|---|---|---|---|---|
| Before (no fix) | 13/8/10/150/8 | — | 8 / 0 | 0.01 | 60 / 20 | — |
| Fix alone | 13/4/7/136/8 | fails the sum bound | 30 / 0 | — | 86 / 24 | sweep 18 of 20; deaths 177, living 710 |
| Trial 1: weights set so that wolves present match (wolf taiga 25, forest 10) | 12.5/4/5/124/7 | fails | 19 / 12 | 0.11 | 54 / 37 | — |
| Trial 2: wolf taiga 15, forest 10; boar forest 15 | 12.5/5/11/148/7 | blocked, three figures worse | 9 / 2 | 0.01 | 31 / 16 | — |
| Trial 3: wolf taiga 20, forest 10; boar forest 15 | 12.5/7/12/151/7 | passes | 5 / 2 | 0.01 | 36 / 16 | pp_defence 2 of 4 |
| `WILD_LIFETIME_DAYS` 42 (taken) | **13/6/7/142/8** | passes | 15 / 1 | 0.04 | 67 / 23 | pp_defence 4 of 4; sweep below |
| `WILD_LIFETIME_DAYS` 56 | 13/5/6/142/7 | passes | 14 / 2 | 0.03 | 59 / 34 | pp_defence 4 of 4; sweep 19 of 20 (p4-6 dead in year 1); deaths 141, living 816 |
| `WILD_LIFETIME_DAYS` 84 | 12/3/8/139/5 | blocked | 19 / 0 | 0.05 | 53 / 25 | — |
| Respawn delay 7 days | 11.5/6/7/136/5 | fails | 16 / 6 | 0.04 | 83 / 30 | — |
| Respawn delay 14 days | 12.5/4/5/134/7 | fails | 19 / 10 | 0.02 | 71 / 30 | — |
| Respawn delay 21 days | 12.5/0/9/140/7 | blocked, taiga-4 extinct | 21 / 1 | 0.05 | 60 / 27 | — |
| Respawn delay 28 days | 13/0/8/137/7 | fails | 20 / 2 | 0.05 | 60 / 30 | — |

### Why each lever was not taken

- **Matching the present population (trial 1).** Before the fix, many of the present wolves were old packs, stuck or fed, that never hunted again. Matching their number with fresh, hungry packs gave wolves hunting at 10 times the old rate.
- **Cutting the spawn weights (trials 2 and 3).** Trial 3 passes the instrument, but it lowers pressure from day 1, while the stuck-leaver effect only began after the first lifetime (28 days). pp_defence needs a hostile to arrive and be killed before the fortress's food runs out (about day 37). Two of its four seeds starved: one with only a bear in reach, one with no kill at all.
  - Trial 3 with the same factor applied to every biome (wolf × 2/3, boar × 0.6) was prepared and dropped with it.
- **A respawn delay** ([patch](../data/2026-10-23-t427-respawn-delay.patch.txt)). A wild animal that left by the edge held a slot of its species' cap for N days. Before the fix, stuck leavers held their slots a mean of 3.9 days over all species, 11.3 for wolves and 8.6 over the predators, so the steps started at 7.
  - At 21 and 28 days wolf spawns match the before row (60), yet wolf deaths stay at 20 to 21.
  - Matching how often packs arrive does not restore the safety. A stuck pack used to spend the rest of its life harmless at the edge, while with the fix an active pack takes its place.
- **Longer stays than 42.** 84 fails the instrument. 56 passes it, but p4-6 dies in its first year: boars kill four dwarves on days 49 to 70, a raid kills two, and the rest starve. A longer stay keeps territorial boars by the fortress longer.

## The twenty-seed sweep at 42

The whole file run alone on master `b9ad97d` with the change passes **20 of 20**. Its totals are much worse than T-425's row:

| Run | Passed | Dwarf deaths | By wildlife | By parties | Living at year 3 |
|---|---|---:|---:|---:|---:|
| Before (T-425, `4b8d8e7`) | 20 | 122 | 8 | 82 | 919 |
| Fix alone | 18 | 177 | — | — | 710 |
| `WILD_LIFETIME_DAYS` 56 | 19 | 141 | 20 | 84 | 816 |
| **`WILD_LIFETIME_DAYS` 42 (taken)** | **20** | **208** | **26** | **135** | **674** |

The parties' share comes mostly from one seed: three-years-p4-3 rises from 17 deaths to 55, 37 of them bled out after raids. Two other peril-4 seeds and two peril-2 seeds end extinct, past the first year that the file asserts (p4-4, p4-6, p2-2 and p2-6). Wildlife deaths triple, from 8 to 26: 15 to boars and 4 to badgers, the territorial animals that now stay 42 days. Per-seed rows are in [`2026-10-24-t427-seeds.json`](../data/2026-10-24-t427-seeds.json).

## What was run

- **Probes**, filed in `reports/data`:
  - `2026-10-23-t427-leave.probe.ts.txt`: the leaving animals at day 243 of p0-2, with their edge tiles and walks.
  - `2026-10-23-t427-scan.probe.ts.txt`: every leave in p0-2 over three years, with its length.
  - `2026-10-23-t427-presence.probe.ts.txt`: the instrument's twelve years, sampled every look for present, leaving and hunting animals per species, with the length of each leave. Its living matches the instrument's seed for seed.
- **Instrument rows** at 42: [`2026-10-24-t427-wildlife.json`](../data/2026-10-24-t427-wildlife.json).
- Heavy runs went one at a time.
