# Measurement: a dwarf under attack flees whatever its needs (T-425, step 1)

**Task:** T-425 · **Date:** 2026-10-23 · **Commits examined:** `2f6b22c` and `4b8d8e7` (T-426), each with the change · **Kind:** fix with before and after rows · **Source:** [boars maul p0-2](2026-10-22-boars-maul-p0-2.md)

## The answer

- **The patient's trap is closed.** A hostile attacks a dwarf when it holds the dwarf as its combat target (16 § Targeting). Under attack within `THREAT_RADIUS`, step 1's exception for a critical need no longer applies:
  - the dwarf flees, or fights when cornered;
  - a need activity in progress ends at the threat scan;
  - a cornered fight is not left for a critical need.
  - So a patient never rests within the reach of a hostile that attacks it. Before, a wounded, critically thirsty dwarf alternated between fleeing and resting beside the boar.
  - Once nothing attacks it, a critical need may again take the dwarf back through the danger.
- **The annual instrument improves:** 13/4/8/142/8/0/0 → **13/8/10/150/8/0/0**.
  - Only taiga seed 3 changes, from 4 to 12. It loses one dwarf to wolves instead of nine; the other eleven years are hash-identical.
  - The sum of 150 is the best measured, so the sum bound rises from 136 to 138.
- **The twenty seeds over three years, the whole file alone, pass 20 of 20.**
  - Dwarf deaths go from 123 to **122**, and the living at year 3 from 907 to **919**.
  - Five seeds keep their hash.
  - p0-2 ends with **15** dwarves instead of 0.
  - Single seeds move both ways, as timeline-only changes move them: p2-1 rises from 17 to 43, p2-6 falls from 34 to 6, and p4-1 falls from 52 to 32.

## Rows

| Measure | Before | After |
|---|---|---|
| Annual instrument (median/worst/2nd-worst/sum/wildlife-free/extinct/need deaths) | 13/4/8/142/8/0/0 ([T-418 rows](../data/2026-10-22-t418-wildlife.json)) | 13/8/10/150/8/0/0 ([rows](../data/2026-10-23-t425-wildlife.json)) |
| Instrument, taiga-3 | 4 living, nine wolf deaths | 12 living, one wolf death |
| `three_years_seeds`, passed | 19 of 20 with p0-2 printed (the gate of 2026-10-22c) | 20 of 20 |
| Dwarf deaths over the 20 seeds | 123 | 122 |
| Living at year 3 over the 20 seeds | 907 | 919 |
| p0-2 living at year 3 | 0 | 15 |

Per-seed rows are in [`2026-10-23-t425-seeds.json`](../data/2026-10-23-t425-seeds.json).

The before row is the gate of 2026-10-22c on `d491732`, whose source is that of `2f6b22c`. The after row was run twice, with the same totals:

- on `2f6b22c` with the change;
- on `4b8d8e7` (T-426, which rebuilds burnt gate walls) with the change, which is the row filed.

## Step 2, not yet measured

The second rule, fleeing out of a territorial animal's ground, is measured next against this row.
