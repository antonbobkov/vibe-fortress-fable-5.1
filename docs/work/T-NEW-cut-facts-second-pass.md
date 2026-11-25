# T-NEW — Facts still cut with "»" after T-703: room lines, the log, orders, the status bar

**Source:** playtest 2026-11-24 (second) ([report](../../reports/data/2026-11-24-playtest-2.md), finding 6), after [T-703](../archive/tasks/T-703-sidebar-cut-off-facts.md) · **Size:** M · **Needs:** — · **Status:** open

## Why

T-703 made the rule that a sidebar line giving a fact wraps or puts the fact first, and that only names may end in "»", with a test that draws every panel. A year of play at 1280 × 800 (the 36-column sidebar) still met these cuts, each in a state that test does not reach:

| Where | What the player saw | Screenshot |
|---|---|---|
| Zone panel, any room (dining hall, barracks, hospital) | "Not enclosed: 13 open border til»" | `39-dining.png`, `40-hospital-zone.png` |
| Building panel, a planned building | "Priority 5 · set 1 2 3 4 5 6 7 8»" (the 9 is gone) | `29-still-waiting.png` |
| Log title with a filter | "Log · filter: ambush (1 of 43»" | `47-raid-log.png` |
| Log, Alerts tab | "The Hillfolk caravan is leaving without trading. »" (its reason is the fact) | `42-alerts-borin.png` |
| Mood panel, per dwarf | "-5 Nothing lifts my spirits. -»" (the second thought and its value) | `38-mood.png` |
| Orders, a waiting order | "x1 Brew drink · waiting for plan»" | `35-jobs-trade.png` |
| Jobs table, reason column | "open 2 day»", "Haul to depot l»" | `35-jobs-trade.png` |
| Creature view, Activity | "Activity: Haul to depot (priorit»" | |
| Status bar under the map | "Mason's workshop placed · 0 stone or block in stock: 1 will wait · build a for»"; the first hint line "… Dwarves dig into rock faces from the sid»" when a second hint is shown | |

The status bar is outside T-703's scope (it is not the sidebar) but cuts the same kind of fact: the advice at its end is what the line is for.

## What to do

Decisions:

- **Each row above follows T-703's rule**: the room line wraps ("Not enclosed: 13 open / border tiles"); the priority row becomes "Priority 5 · [1]-[9] set"; the log title puts the count first ("1 of 43 · filter: ambush"); a log line wraps to as many rows as it needs (the log never cuts an entry); the Mood panel shows a dwarf's thoughts one per row (three rows, as 15's panel says "its three strongest current thoughts"); an order row wraps its reason to a second row; the Activity line wraps.
- **The Jobs table keeps its columns** and cuts names only: the job column shows the job's kind ("Haul to depot") and the reason column the reason's short form, with the full line on the selected row (as now) — so "open 2 days" is the short form and fits.
- **The status bar wraps to its second row** for a long message (the row below it is the hover line, which gives way while the message shows), and a second hint never pushes the first hint's last words off: the older hint is the one cut.
- **T-703's panel test gains these states**: a room zone not enclosed, a planned building, a filtered log, a missed-trade alert, the Mood panel with long thoughts, a waiting order, a creature hauling to the depot; and a status-bar test with a 120-character message.

Spec: `ui-screens/panels.md` (Zones room line, Building, Log, Mood, Orders, Jobs), `ui-screens/fortress-screen.md` § Status bar.

## Done

- [ ] T-703's test (or its successor) draws each state above at 36 columns and finds no fact after a "»".
- [ ] A status-bar test: a 120-character message shows whole over two rows.
- [ ] UI only: world hashes unchanged; render goldens of the affected panels updated with a `golden:` paragraph.
