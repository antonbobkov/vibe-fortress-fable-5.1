# Measurement: the medic cleans only wounds that can be infected

**Task:** T-413 · **Date:** 2026-10-21 · **Commit examined:** master `69e8dd0` (before) and `69e8dd0` with the T-413 change (after) · **Kind:** re-measure after a rule change; no constant, formula or content value was changed · **Source:** [a bandage keeps a wound clean](2026-10-21-bandage-keeps-clean.md)

## The answer

- **`cleaned` had no other effect.** In the code it is read by the daily infection roll, by the cleaning need and by the inspector's wound flags, and nothing else: healing, pain, discharge and admission never read it. So cleaning a covered wound (bandaged or sutured) prevented nothing. Neither did cleaning a bruise, fracture or frost wound, which can never be infected. Both were asked for until now.
- **The rule:** `clean_wound` is asked only for a cut, puncture or burn that is not cleaned, sutured or bandaged, or for an infected wound whose cure has not started (the brightleaf cleaning is the cure). A cleaning job made during admission ends once no wound asks for it, admitted or not. Without that last part the change would do nothing: a dwarf whose only wound is a serious cut is discharged when the cut is bandaged, and the cleaning job made at admission went on.
- **The medic's time falls by 5% to 30%** wherever a wound is bandaged, sutured or cannot be infected. At one wound a day, a skill-5 medic's ticks per patient drop from 681 to 559 for a serious cut, 783 to 556 for a grievous cut, 965 to 756 for a grievous fracture and 775 to 635 for a serious burn. In the loaded ward the time freed goes to sutures: a serious puncture is sutured a median 9,031 ticks after the wound instead of 13,045, a grievous cut 4,553 instead of 7,689.
- **Nothing gets worse.** Nobody is infected before or after, discharge and healing days hold or shorten (a serious burn leaves in 0.7 days instead of 1.2), and deaths hold, except a grievous cut at skill 0 (7 → 12). Four seeds of that case give 45 deaths of 120 before and 43 after, so the 7 → 12 is chance.
- **Light cuts are unchanged:** they clot (150 ticks) before the medic arrives, stay uncovered and are cleaned as before (32 cleanings of 30 patients). Their dwarves are discharged at the clot, and the `stop_bleeding` job made at admission is still done afterwards: it uses a unit of cloth and bandages nothing, 18% of the medic's time in that ward. Filed as [a discharged dwarf's care jobs outlive their need](../../docs/work/T-414-discharged-care-jobs-outlive-their-need.md).

## What was run

The ward probe of [wound recovery](2026-10-21-wound-recovery.md) (`reports/data/2026-10-21-wound-recovery.probe.ts.txt`), copied to `test/perf/` with additions that record without changing the run: each patient's log of treatment jobs and treatments with their ticks, a count of the medic's ticks by job or activity until 2,400 ticks after the thirtieth wound, and an optional seed suffix. The loaded ward: `med5`, `T367_GAP=400`, serious cut, serious puncture, grievous cut. The one-a-day ward: `med5` and `med0`, `T367_GAP=1200`, all seven wounds. `T367_DAYS=60`. The grievous cut was re-run on three more seeds (`-a`, `-b`, `-c`) before and after. Figures are in [`2026-10-21-clean-exposed-wounds.json`](../data/2026-10-21-clean-exposed-wounds.json).

## One wound every 400 ticks, medic 5, before → after

| Wound | Died | Cleaning jobs | Medic ticks, all patients | Medic time cleaning / suturing | Suture, median ticks after the wound | Healed, days |
|---|---|---|---|---|---|---|
| Serious cut | 0 → 0 | 27 → 0 | 17,977 → 16,647 | 3% / 13% → 0% / 15% | 13,630 → 12,147 | 13.9 → 13.5 |
| Serious puncture | 5 → 4 | 25 → 0 | 17,668 → 15,555 | 4% / 9% → 0% / 13% | 13,045 → 9,031 | 13.6 → 12.5 |
| Grievous cut | 13 → 14 | 23 → 0 | 15,282 → 11,768 | 9% / 15% → 0% / 22% | 7,689 → 4,553 | 22.2 → 21.3 |

Discharge is 0.3 to 0.4 days in every case before and after. All deaths bleed out; nobody is infected.

## One wound a day, before → after

| Wound | Died, medic 5 / medic 0 | Cleaning jobs, medic 5 | Medic ticks per patient, medic 5 / medic 0 | Discharge, days (medic 5) | Healed, days (medic 5) |
|---|---|---|---|---|---|
| Light cut (9) | 0 / 0 → 0 / 0 | 32 → 32 | 557 / 628 → 557 / 628 | 0.1 → 0.1 | 5 → 5 |
| Serious cut (21) | 0 / 0 → 0 / 0 | 33 → 0 | 681 / 755 → 559 / 642 | 0.3 → 0.2 | 10.3 → 10.2 |
| Grievous cut (36) | 7 / 7 → 7 / 12 | 28 → 1 | 783 / 764 → 556 / 527 | 0.3 → 0.2 | 20.3 → 20.3 |
| Serious puncture (21) | 0 / 0 → 0 / 0 | 33 → 0 | 744 / 718 → 592 / 629 | 0.3 → 0.2 | 10.3 → 10.2 |
| Serious fracture (13, leg) | 0 / 0 → 0 / 0 | 33 → 0 | 809 / 909 → 772 / 794 | 1.1 → 1.1 | 15.8 → 15.8 |
| Grievous fracture (22, leg) | 0 / 1 → 0 / 1 | 38 → 0 | 965 / 1,108 → 756 / 921 | 30.6 → 30.5 | 30.6 → 30.6 |
| Serious burn (13, arm) | 0 / 0 → 0 / 0 | 38 → 2 | 775 / 812 → 635 / 705 | 1.2 → 0.7 | 15 → 15 |

Grievous cut on four seeds (the case's own and `-a`, `-b`, `-c`), died of 30: medic 0 before 7, 13, 11, 14, after 12, 12, 7, 12; medic 5 before 7, 7, 4, 2, after 7, 6, 1, 7.

## Annual wildlife instrument

Before (`69e8dd0`, the T-411 row, not re-run: `src/` is the same as at T-411's commit, whose rows matched the [T-405 rows](../data/2026-10-21-t405-wildlife.json) hash for hash): median 13, worst 2, second-worst 8, living 140, wildlife-free 8, extinct 0, hunger/thirst 0. After (`69e8dd0` with this change): **the same row**. Ten seeds keep their world hash; forest seed 3 and taiga seed 3 change hash with the same outcome (taiga seed 3's last death moves from day 90 to day 91). Every guarded figure holds, and none worsens.

## What this does not measure

- Miasma and floor sleep, which double the roll of an uncovered wound and make its cleaning more urgent.
- A fortress with several medics.
