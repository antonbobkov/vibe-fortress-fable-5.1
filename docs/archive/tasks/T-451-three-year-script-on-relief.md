# T-451 — The three-year script does not yet play on relief

**Closed:** 2026-10-31, in 07f36b9.

**Source:** T-448, [the sweep on relief 1](../../../reports/audits/2026-10-30-instrument-relief.md) · **Size:** M · **Needs:** the drowning row · **Status:** open

## Why

The script now reads its levels from the map, but at relief 1 only 12 of 20 seeds pass.

- It fells only trees at the fortress's level. With the wagon on a small plateau (p0-1, p0-4), most buildings wait on inputs and the fortress stalls; logs are the likely shortage, not yet confirmed.
- A zone moved off its designed rectangle may lie across the brook. T-176 stops p2-4, p2-6, p4-2 and p4-4 on a job blocked as unreachable; these are not yet separated into fixture and game.
- p2-7 completes no trade and p4-3 is extinct in year 1. Neither is journalled.

## What to do

Fell trees on every surface level the dwarves reach and keep moved zones on the wagon's walker label. Then re-run and name what is left. Set `THREE_YEARS_RELIEF` to 1 when the whole file passes, and report it against the relief-0 row (158 deaths, 867 living).

## Done

- The twenty-seed file plays at relief 1, with its rows in a dated report.

## As done

The script's faults are fixed ([report](../../../reports/audits/2026-10-31-three-year-script-on-relief.md)). `THREE_YEARS_RELIEF` is 1, and the reference row is 226 deaths and 531 living, against 158 and 867 on level maps. `three-years-p4-3` still dies out on day 78: by the owner's decision the named exemptions are replaced by one rule over the set (testing-strategy.md § What may be a gate), and p4-3 spends its allowance.
