# Measurement: a loaded ward's serious cuts die of infection

**Task:** T-411 · **Date:** 2026-10-21 · **Commit examined:** master `b989210` (before) and `b989210` with the T-411 change (after) · **Kind:** diagnosis and re-measure after a rule change; no constant, formula or content value was changed · **Source:** [the first bandage](2026-10-21-first-bandage.md)

## The answer

- **No single step comes late: the medic has no time for any of them.** One skill-5 medic and a serious cut every 400 ticks (three a day): from the start until 2,400 ticks after the thirtieth wound, the medic spends 48% of its time bandaging, 27% asleep, 10% eating and drinking, 10% suturing and 3% cleaning. A cut's suture comes a median 12,245 ticks (10.2 days) after the wound and its cleaning 13,396 (11.2 days); its first infection roll comes at a median 1,800 ticks. 28 of 30 patients were neither sutured nor cleaned before their first roll. The brightleaf was never short (no treatment job was blocked); the brightleaf cleaning of an infected wound came a median 9,645 ticks (8 days) after the infection, for the same reason. 18 of 30 were infected and 10 died of it.
- **Reordering the medic's work does not help.** Suturing at priority 2, ahead of cleaning, with no cleaning for a sutured wound, still left 27 of 30 unprotected at their first roll, and the sutures held the medic from new bandages: 14 of 30 serious cuts died (5 bled out, 9 of infection), against 10.
- **The rule chosen: a bandage keeps the wound it covers clean.** A bandaged wound is not rolled for infection (17 § Infection). Every bleeding wound a medic reaches is bandaged first, so the wait for the suture and the cleaning no longer costs anything. A wound that stopped bleeding before its bandage (a light cut clots in 150 ticks) and every wound in a fortress with no medic roll as before.
- **The loaded ward, before → after:** serious cuts 10 of 30 dead (all of infection) → **0**; serious punctures 13 (9 of infection) → 5 (all bled out); grievous cuts 15 (3 of infection) → 13 (all bled out). Nobody is infected.
- **At one wound a day** the serious burn, which bleeds 1 until bandaged, stops dying of infection: 2 → 0 under the skill-5 medic, 3 → 0 at skill 0; the skill-0 serious cut 2 → 0. Light cuts are unchanged (none infected either way), and the other wounds within one death of their before rows.
- **The medic now cleans wounds that cannot be infected.** A bandaged or sutured wound still asks for `clean_wound`. Filed as [the medic cleans wounds that cannot be infected](../../docs/work/T-NEW-cleaning-a-covered-wound.md).

## What was run

The ward probe of [wound recovery](2026-10-21-wound-recovery.md) (`reports/data/2026-10-21-wound-recovery.probe.ts.txt`), copied to `test/perf/` with two additions that record without changing the run: each patient's log of treatment jobs created, blocked and done, treatments, infection, cure and death with their ticks, and a count of the medic's ticks by job or activity until 2,400 ticks after the last wound. The loaded ward: `med5` at `T367_GAP=400` for the serious cut, the serious puncture and the grievous cut. The one-a-day ward: `med5` and `med0` at `T367_GAP=1200` for the light, serious and grievous cut, the serious puncture and the serious burn. `T367_DAYS=60`. The reorder trial changed `suture` to priority 2 and stopped cleaning sutured wounds, and was then reverted. Summaries and the timeline figures are in [`2026-10-21-bandage-keeps-clean.json`](../data/2026-10-21-bandage-keeps-clean.json).

## One wound every 400 ticks, medic 5

| Wound | Died (bled out, infection), before → after | Infected | Suture, median ticks after the wound | Discharge, days | Healed, days |
|---|---|---|---|---|---|
| Serious cut | 10 (0, 10) → **0** | 18 → 0 | 12,245 → 13,630 | 0.4 → 0.3 | 14.2 → 13.9 |
| Serious puncture | 13 (4, 9) → 5 (5, 0) | 13 → 0 | 12,495 → 13,045 | 0.4 → 0.3 | 13.5 → 13.6 |
| Grievous cut | 15 (12, 3) → 13 (13, 0) | 5 → 0 | 2,565 → 7,689 | 0.3 → 0.4 | 20.8 → 22.2 |

## One wound a day: died, before → after

| Wound | Medic 5 | Medic 0 |
|---|---|---|
| Light cut (9) | 0 → 0 | 0 → 0 |
| Serious cut (21) | 0 → 0 | 2 (infection) → 0 |
| Grievous cut (36) | 6 → 7 (bled out) | 8 → 7 (bled out) |
| Serious puncture (21) | 0 → 0 | 0 → 0 |
| Serious burn (13, arm) | 2 (infection) → 0 | 3 (infection) → 0 |

## Annual wildlife instrument

Before (`b989210`, the T-409 row, not re-run: `src/` is the same as at T-409's commit, whose after row matched the T-405 rows hash for hash): median 13, worst 2, second-worst 8, living 140, wildlife-free 8, extinct 0, hunger/thirst 0. After (`b989210` with this change): the same row, and all twelve world hashes equal to the [T-405 rows](../data/2026-10-21-t405-wildlife.json). The change moves nothing in those twelve years.

## What this does not measure

- A fortress with several medics, where the loaded ward's arithmetic is different.
- Miasma and floor sleep, which double the roll of an uncovered wound.
