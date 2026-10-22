# T-420 — Infection rolls once a day per dwarf, not per wound

**Source:** T-419, [a light burn admits no one](../../reports/audits/2026-10-22-light-burn.md) (step 2 of its decision) · **Size:** S · **Needs:** — · **Status:** open

## Why

After T-419, `three-years-p4-2` is alive at day 112 with one dwarf. Its fire still infects four dwarves within a day or two: each light burn that is not cleaned, sutured or bandaged rolls `INFECTION_PERMILLE` (100) each day, so a dwarf with eight burns is infected on most days (1 − 0.9⁸ = 57%). A dwarf with one serious wound rolls once.

## Decided (orchestrator)

Each `DayPassed`, a creature with any exposed wound (a cut, puncture or burn that is not cleaned, sutured or bandaged, older than one day) rolls `INFECTION_PERMILLE` once, doubled in miasma or after a floor sleep, and on a hit one of those wounds is infected (the first in body-part/wound order). `INFECTION_PERMILLE` is unchanged.

Adopt it only if every peril-2 and peril-4 seed of `three_years_seeds` stays alive at year 1, p4-2 gains margin, and the annual wildlife instrument holds by the T-308 rule. Otherwise record the figures and close it as not taken.

## Done

- 17 § Infection says the rule, pinned by a unit test (a dwarf with many exposed wounds rolls once a day).
- Measured: p4-2 to day 112, the thirteen peril seeds to year 1, the burn and cut wards (one a day and loaded), and the instrument, with before and after rows in a new dated report.
