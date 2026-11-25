# T-741 — The Alerts tab at 40 dwarves is the same three alerts every day

**Source:** playtest 2026-11-25 (mid game) ([report](../../reports/data/2026-11-25-playtest-3.md), finding 8) · **Size:** M · **Needs:** T-725 (a log line keeps its string key) · **Status:** open

## Why

From Summer, Year 2 to the end of the run (34 to 52 dwarves) the Alerts tab was, day after day, "! 113 food will rot within 3 days; the largest stack is 8 cavewheat glory in Stockpile #2 (Food).", "! A workshop is waiting for an empty barrel: every one holds something." and "! Miasma spreads from 5 rotten dimcap in Farm plot #14.", each once a day or more (`15-d153-alerts.png`, `25-d161-alerts.png`, `28-d198-log.png`). In the eleven days from Summer 14 the All tab had 135 entries, of them 11 "is full" and 12 "rot within"; at Winter 2 the Alerts tab's first screen was eight such lines over five days. The caravan's arrival and a fire were single lines among them, and a player who reads the tab after a raid has to page past a week of them.

Each line is right by its own rule: the rot alert comes "at most once a day, while the food lasts" (24 § Announcements and the log), the barrel alert each time a workshop blocks for a container (12 § Registrations), the stockpile line each time it fills. Same-text merging only folds lines of one day (`LOG_DEDUP_TICKS` or the same day), and the rot line's numbers change daily. This fortress overcooked (its script keeps 686 lavish meals in three kitchens, `27-orders-bottom.png`), but any fortress short of barrels meets the barrel line daily, and the rot line follows any surplus.

## What to do

Decisions:

- **An alert that comes again on the next day, from the same string key (and the same subject, for a line about one creature or one place), replaces its line of the day before**: the newest text, at the newest time, at the top, marked with the days in a row it has come: "! 113 food will rot within 3 days; the largest stack is … (6 days)". This is the legend's last-words fold (24 § The legend record) applied to the live log for the alert severity, read by the line's `key` (T-725). A day without the alert ends the run; the next one starts a new line.
- Applies to alerts only. Danger lines and deaths never fold; notes keep the same-day merge.
- The strip under the map shows the line as it comes, as now.

Spec: 24 § Announcements and the log (the merge rules), § The legend record if the two folds share their words.

## Done

- [ ] Tests (`describe` with the task id): the rot alert on five days in a row is one line marked "(5 days)" with the fifth day's numbers; a day without it starts a new line; the barrel alert and the rot alert alternate on the same days and stay two lines; a death between them is never folded; "Torfi is starving." and "Kari is starving." are two lines.
- [ ] Save and load keep the fold (the line's day count is saved with it). UI only: no world hash moves.
