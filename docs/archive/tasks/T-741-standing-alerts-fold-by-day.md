# T-741 — The Alerts tab at 40 dwarves is the same three alerts every day

**Closed:** 2026-11-25, in 73493202.

**Source:** playtest 2026-11-25 (mid game) ([report](../../../reports/data/2026-11-25-playtest-3.md), finding 8) · **Size:** M · **Needs:** T-725 (a log line keeps its string key) · **Status:** open

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

- [x] Tests (`describe` with the task id, `test/unit/ui/t741-standing-alerts.test.ts`): a workshop waiting for a barrel five days running is one line reading "(5 days)", at the newest place, and after a day without it a new line; the rot alert five days running is one line with the fifth day's numbers, stack and place, and with the barrel alert on the same days two lines; deaths between them are never folded (and the legend counts the folded line's days once); two animals starving ("Bramble is starving.", "Rex is starving.") are two lines, a barrel and a bag two lines; a cavern breached on two days is two lines; a save and a load keep the days and the run goes on after it; the strip flashes and pauses (auto-pause on alerts) on the first day only.
- [x] Save and load keep the fold (`logTail[].days`, above 1 only). UI only: `test/golden/world-hashes.test.ts` passes, no golden moved; no sweep.
- [x] Spec: 24 § Announcements and the log (the alert's flash, the rot alert, the standing alerts), § The legend record (a folded line's days), § State, § Tuning constants (`LOG_STANDING_ALERTS`); 12 and 13 § Registrations; `save-format.md` (`ui` row); `schemas/system-state.md` (`logTail[].days`).

Decisions taken while doing it:

- **Only the standing alerts fold, not every alert.** The work file folded any alert of one key on the next day, but many alerts are events, not conditions: a caravan from the Hillfolk and one from the Wildwood on two days, a wolf then a bear, two caverns breached, two fires. Folded by key, the second would hide the first. So the alerts that tell of a condition are listed (`LOG_STANDING_ALERTS`, 24): food about to rot, a workshop waiting for an empty container (one line per kind of container) or for magma, miasma (one line per place), a tame animal starving (one line per animal). Each key names the placeholders that tell one condition from another, read back from the line's text by its template, as the legend reads its creature; the rot alert folds by its key alone, since its stack and place are the day's news, not another condition.
- **The starving dwarves' line and the bleeding animals' line do not fold across days.** They are already one line a day for the whole fortress; folding them would mark a line naming three dwarves with the days of the first.
- **A folded line shows its days, not its count** ("… (5 days)", the legend's words, `ui.legend.folded`); a second one the same day merges into it as before, and the count is kept but not shown.
- **No flash, no pause after the first day.** The strip shows the folded line as the newest, but it neither flashes nor pauses under the auto-pause on alerts setting: the player has been told of the condition, and a daily flash or pause for it would teach them to pass over the flashes that are news. The first day of a run, and the first after a gap, flash and pause as before.
- **The folded line moves to the newest place** and takes the newest focus and subject (the rot alert's largest stack), so the go-to and `[v]` lead to today's stack.
