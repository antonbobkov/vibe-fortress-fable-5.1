# T-621 — The starting food rots unseen and the fortress starves in its first summer

**Source:** [T-618's first-year audit](../../reports/audits/2026-11-18-t618-first-year-ux.md), findings 1–3 · **Size:** M · **Needs:** — · **Status:** open

## Why

Both fortresses of the audit starved in their first summer. The Balanced loadout's food is easy meals (`rotDays` 14), turnips and dimcaps (20) and raw meat (6); the testing preset's is 220 raw turnips and dimcaps. All of it lay in an ordinary food stockpile with no barrels, went stale and rotted between Spring 14 and Spring 28, and turned into 214 units of `refuse/rotten` that the indoor stockpile then made into miasma ("! Miasma spreads. ×9"). The Balanced fortress's last edible unit was gone by Spring 14; ten dwarves were "starving" by Summer 11 and three had died by Summer 21. The testing fortress fell on Summer 23 with every dwarf starved.

Nothing on screen said the food was going. The stocks panel shows no rot stage or days; the Look item line has none; the only warning was the food hint once the food was already short, and it does not name rot. A new player cannot know that raw food and meals keep for two or three weeks, that a barrel in a food stockpile slows rot (13 § Rot), or that cooking, smoking and salting make food that keeps. T-618 adds a first hint when food first goes stale; this task does the rest.

## What to do

1. **Show rot where the food is.** The stocks panel's stack rows and Look's item lines say the stage of a perishable stack and the days it has left at the speed it rots now ("turnip ×20 · stale, rots in 4 days"); the food category row counts what rots within three days.
2. **Warn before it rots.** An alert (once a day at most) when perishable food that would feed the fortress for a day or more will rot within three days, naming the largest stack and its place; its focus is that stack's tile.
3. **The rot line names its cause.** "Miasma spreads." names the rotting thing and the place ("Miasma spreads from 20 rotten turnips in Stockpile #2.") and says once that a refuse stockpile outdoors or a dump takes it.
4. **Group the starving lines.** One alert a day "3 dwarves are starving: Asa, Njal, Liv." in place of one line per dwarf per day, which filled the Alerts tab (finding 3).
5. **The Balanced food** is a balance question for the owner, recorded in `decisions.md`: food that keeps (cured meat, more seeds) or a Help line on the first meal order.

Spec: 13 § Rot (the reader numbers the panels read), 24 § Panels (stocks and Look lines), `ui-keymap-and-screens.md` (strings and the alert), 15 or 10 for the starving line.

## Done

The stocks panel and Look show rot; the alert fires in a scenario where the Balanced loadout's food would rot unattended; tests pin the lines; the e2e `full-year` still passes.
