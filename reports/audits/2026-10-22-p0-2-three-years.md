# Bisection: three-years-p0-2 dies out in year 3

**Date:** 2026-10-22 · **Commits examined:** `ab4d40e`, `1851dfa` (T-419), `e803b69` (T-418) · **Kind:** bisection of a gate failure; nothing was changed · **Source:** the T-113 gate on `e8b6c8c`, `three_years_seeds`: "three-years-p0-2 (peril 0) grew past embark size: expected 0 > 7"

## The answer

- **T-418 changes the timeline. Boars do the killing.** p0-2 ends year 3 with 12 dwarves at `ab4d40e` and at T-419, and with none at T-418. The first difference is on day 218: a dwarf with the medicine labor cleaned its own light punctures there before T-418. Under T-418 another medic walks over and does it, most of a day later. From then on the fortress's moves differ, and with them where wild animals arrive and whom they meet (08 § Wild spawning spawns away from every dwarf).
- **The nine extra deaths are boar maulings, not failed care.** At T-418, boars attack on days 242 to 251 and again on days 265 to 270. Every attack on the fortress in this run is by a boar, before and after. Each victim takes 4 to 8 tusk hits of 11 damage (punctures, most of them serious, bleeding 4 a health tick each) in a few minutes, and bleeds out 0.14 to 0.39 days after the first hit. One victim died 0.55 days after a single serious puncture to the leg, with the boar still about. Five of the nine were fleeing (one of them was struck again in its hospital bed on the surface), three were soldiers on duty, and one was fetching a drink. No treatment was finished after day 242; a bleeding dwarf bitten 4 to 8 times dies before any bandage can come, and a remembered hostile near the patient keeps the medic away (17, care under an alert).
- **The boars stay.** At T-418 the hearth alert is raised and lowered 35 to 50 times in each 28 days of year 3, about every half day: boars keep coming near. One boar mauled the fortress for eight days before the soldiers killed it. At `ab4d40e` the alert changes 39 times in days 196 to 224 and never after.
- **The four earlier deaths are the same at every commit:** boars on days 21 and 22 and on day 196.
- **So it is a flip, not a health fault.** A rule changes who cleans a wound on day 218, and the following four months of wildlife play out differently. One thing T-418 does take away is a medic bandaging itself. One of the victims, who had the medicine labor and a single serious puncture, might have lived with it. That is T-418's decision, not a fault in it.

## p0-2 by commit

| Commit | Living at day 112 / 224 / 336 | Dwarf deaths | Days of the deaths |
|---|---|---|---|
| `ab4d40e` | 11 / 9 / 12 | 4, all bled out | 21, 22, 196, 196 |
| `1851dfa` (T-419) | 11 / 9 / 12, same journal | 4, all bled out | 21, 22, 196, 196 |
| `e803b69` (T-418) | 11 / 9 / **0** | 13, all bled out | 21, 22, 196, 196, 243, 243, 244, 245, 251, 251, 266, 266, 270 |

## What was run

`reports/data/2026-10-22-p0-2-three-years.probe.ts.txt`: the `three_years_seeds` world, script and step sizes for `three-years-p0-2` at peril 0, to day 336. At each commit `src/` and `test/scenarios/` were checked out from that commit. It journals each fortress dwarf's wounds, treatments, admissions, discharges and deaths, the raids and alert changes, every ten days the dwarves with the medicine labor and what they do, and at `e803b69` every blow to a fortress dwarf: its attacker's species, the victim's behavior and the boars' deaths. The run at `e803b69` matches the gate: 13 deaths, all bled out, 0 living. The journals are in [`2026-10-22-p0-2-three-years.json`](../data/2026-10-22-p0-2-three-years.json).

## What it means for the gate

The peril-0 assertion "grew past embark size" (`y3Pop > 7`) turns on a three-year wildlife history, which a one-day change in who cleans a wound can reroute. This run is the first measured flip of it, so p0-2 is not named as flipping on one run. The other nineteen seeds were not re-run here.
