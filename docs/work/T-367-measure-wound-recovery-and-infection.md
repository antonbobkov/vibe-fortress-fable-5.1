# T-367 — Measure wound recovery and infection

**Source:** T-333, [`../../reports/audits/2026-10-17-unmeasured-spec-numbers.md`](../../reports/audits/2026-10-17-unmeasured-spec-numbers.md) (rank 4) · **Size:** M · **Needs:** — · **Status:** open

## Why

Bleeding to death after a fight is the main cause of death in the measured fortress (`balance-status.md`, main fortress deaths). Clotting (`CLOT_TICKS`), the time a treatment takes and the bleeding rate were measured with the wild animals of October; the rest of 17 was not: the severity bounds `LIGHT_MAX` / `SERIOUS_MAX`, `HEAL_BASE_TICKS` and its ×3 and ×6, `PAIN_UNCONSCIOUS`, `BLOOD_UNCONSCIOUS_PERCENT`, `BLOOD_REGEN_PER_TICK`, `INFECTION_PERMILLE`, `INFECTION_DEATH_PERMILLE`, `INFECTION_CURE_DAYS`, `TREAT_FAIL_PERMILLE`, `PAIN_DISCHARGE` and the suture and fracture speeds, all marked *unmeasured*. They decide how long a wounded soldier is out of the squad and whether a dwarf who survives the fight dies of it days later.

## What to do

1. In a stepped hospital fixture (beds, a medic with skill 0 and with skill 5, a stocked hospital chest), inflict each wound kind and severity on dwarves through the damage path, with and without a medic, with and without brightleaf, and with an unclean floor sleep; at least 30 dwarves a case.
2. Record: days to discharge and to full healing, days out of work, the share that fall unconscious, the share infected and the share that die of infection, failed treatments, and the medic's time per patient.
3. Read the result against `balance.md` (a light cut is "a hospital visit"; "Three hits floor a dwarf") and 17. Write the report, add a `balance-status.md` row, and replace the marks the measurement covers.

## What would change the number

If a serious wound keeps a soldier out for more than a season, or untreated infection kills most of those who live through a fight, the healing or infection numbers make the hospital the fortress's bottleneck; if nothing a medic does changes the outcome, they make it pointless. The tune is its own task.

## Done

- The report exists; the health constants it covers carry it instead of the mark; `balance-status.md` has a wound-recovery row.
