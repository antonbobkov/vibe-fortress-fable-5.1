# Measurement: a light burn admits no one

**Task:** T-419 · **Date:** 2026-10-22 · **Commit examined:** master `8747f1e` (before; `src/` as at `ab4d40e`) and `8747f1e` with the T-419 change (after) · **Kind:** re-measure after a rule change; no constant, formula or content value was changed · **Source:** [p4-2 dies in year 1](2026-10-22-p4-2-year-one.md)

## The answer

- **The rule:** a light burn admits no one, as a light bruise does not. Its dwarf keeps working. The treatments its wounds need (`dress_burn`, `clean_wound`) are still made for it where it is, while a burn is undressed, and its infection rolls are unchanged. A serious or grievous burn admits its dwarf as before.
- **p4-2 is alive at day 112, with one dwarf.** The day-37 fire now gives 32 light burns to 7 dwarves (64 on 9 before; the timeline moved). Only four of them are admitted, and only after an infection (days 38.6 to 41). The burned medics work, and in days 36 to 50 they dress 4 burns and clean 7 wounds (3 and 1 before). Infection deaths fall from 6 to 4. The raid of day 66 to 68 still kills most of the fortress: 9 bled out and 1 killed against 5 and 2. **p4-2 stays marginal.** One dwarf is left, and the infections still came quickly: a dwarf with several light burns rolls once for each burn, and is infected within a day or two of the fire.
- **All thirteen peril-2 and peril-4 seeds are alive at day 112:** p4-1 to p4-6 have 11, 1, 11, 12, 11 and 13 dwarves; p2-1 to p2-7 have 12, 6, 16, 14, 12, 10 and 18.
- **The burn wards hold.** At one wound a day, a light burn's patients are no longer admitted, deaths and infections stay at 0, and the medic spends 433 ticks a patient instead of 571 (skill 5; 539 instead of 606 at skill 0). A serious burn is unchanged to the tick. Under load (a light burn every 400 ticks), infections fall from 10 to 5 and infection deaths go from 2 to 3. Burns that heal before their dressing are not dressed: cloth 26 → 22.
- **Step 2 of the decision (one infection roll a day per dwarf, not per wound) was not taken,** because step 1 met its condition. p4-2's single survivor is the reason to keep it in view.

## What was run

- **p4-2:** `reports/data/2026-10-22-p4-2-year-one.probe.ts.txt` to day 112. The before row is the `ab4d40e` run of [the bisection](2026-10-22-p4-2-year-one.md), with the same `src/`.
- **The thirteen seeds:** a copy of `three_years_seeds`' `runThreeYearsSeed` stopped at day 112, with its invariant watcher, filtered to the seeds.
- **The wards:** the ward probe of [wound recovery](2026-10-21-wound-recovery.md), with the T-413 recording additions and a light burn case (`burn-L`: 5 burn damage to the right arm). `med5` and `med0` at `T367_GAP=1200`, and `med5` at `T367_GAP=400`, for the light and the serious burn, `T367_DAYS=60`.

Figures are in [`2026-10-22-light-burn.json`](../data/2026-10-22-light-burn.json).

## p4-2 at day 112

| | Living | Dwarf deaths (infection, bled out, killed, starvation) | Infections | Burns from the fire |
|---|---|---|---|---|
| Before | 0 | 15 (6, 5, 2, 2) | 21 | 64 on 9 dwarves, all admitted |
| After | **1** | 14 (4, 9, 1, 0) | 16 | 32 on 7 dwarves, 4 admitted after an infection |

## Burn wards, before → after

| Case | Died | Infected | Admitted for the burn | Cloth | Medic ticks per patient | Healed, days |
|---|---|---|---|---|---|---|
| Light burn, medic 5, one a day | 0 → 0 | 0 → 0 | 30 → 0 | 33 → 33 | 571 → 433 | 5 → 5 |
| Light burn, medic 0, one a day | 0 → 0 | 0 → 0 | 30 → 0 | 33 → 33 | 606 → 539 | 5 → 5 |
| Serious burn, medic 5, one a day | 0 → 0 | 0 → 0 | 30 → 30 | 67 → 67 | 541 → 541 | 15 → 15 |
| Serious burn, medic 0, one a day | 0 → 0 | 0 → 0 | 30 → 30 | 66 → 66 | 605 → 605 | 15 → 15 |
| Light burn, medic 5, every 400 ticks | 2 → 3 (infection) | 10 → 5 | 30 → 0 | 26 → 22 | 593 → 405 | 5 → 5 |
| Serious burn, medic 5, every 400 ticks | 0 → 0 | 0 → 0 | 30 → 30 | 62 → 62 | 488 → 488 | 15 → 15 |

## Annual wildlife instrument

Before (`8747f1e`, the T-415 row, not re-run: `src/` is unchanged since T-415): median 13, worst 1, second-worst 8, living 139, wildlife-free 8, extinct 0, hunger/thirst 0. After (`8747f1e` with this change): **the same row**. All twelve world hashes are unchanged, so no burn in those twelve years was light and undressed long enough to matter.
