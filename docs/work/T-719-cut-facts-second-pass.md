# T-719 — Facts still cut with "»" after T-703: room lines, the log, orders, the status bar

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

Decided while doing it:

- **The priority row drops "set"**, `Priority 5 · 1 2 3 4 5 6 7 8 9` (30 cells), rather than `[1]-[9] set`: it keeps every digit a button, as the spec's "a click on a digit" promises, and the help line under the panel says what the digits do.
- **Every filtered title puts its count first** (`Units · 3 of 80 · filter: xxx`, Jobs, Log, Civilizations), one string for all: when a title is still too long, what it cuts is the typed filter, which the `/filter` field under it shows whole.
- **A log entry the panel cannot hold whole is not drawn**; the scrollbar shows there is more. Only an entry taller than the whole list is shown from its top, cut.
- **Mood**: the name and tier on one row, the three thoughts under it, one to a row, each wrapped under itself; the "Top thoughts" column head is gone.
- **Order rows wrap** in Orders (its list is now the wrapping list Add order and the Workshop recipes use), in Jobs' "Orders waiting" (three orders, each over as many rows as it needs) and in the Workshop panel's three order rows (an order that the rows left cannot hold is not shown; `[o]` lists them all). A count in brackets stays with its word (`plant (0)`).
- **The Jobs table**: the columns are 4, 16 and the rest (13 cells, 12 beside the scrollbar), so `open 41 days` fits; the table widget now lays its rows out in the cells the list leaves beside its scrollbar (the cause of `open 2 day»`: a row built one cell too wide). A job too long for its column shows its kind (`Plant`, `Haul to depot`) and a reason too long its first word (`waiting`), each with the whole text as the cell's tooltip; the selected job's line under the list gives the reason in full as before. A dwarf's name may still end in `»`.
- **The status bar**: a message too long for row 2 wraps onto row 3, the hover line's, while it shows; one longer than two rows still ends with `…` and its tooltip. The newest hint in the log strip takes as many of the strip's rows as the newer lines leave it, so of two hints the older is the one cut.
- **The scan** (`test/unit/ui/t703-sidebar-fit.test.ts`) now also reads the three status rows, and lets a dwarf's name end in `»` (the rule); the Mood thoughts are no longer on its list of allowed marks.

## Done

- [x] T-703's test (or its successor) draws each state above at 36 columns and finds no fact after a "»": `T-719 the second pass` in `test/unit/ui/t703-sidebar-fit.test.ts` scans a dining hall not enclosed, a planned still, the log (All, Alerts with the missed trade at the foot, filtered), Mood with long thoughts, Orders and Jobs with a brewing order waiting for plants, a dwarf hauling to the depot at priority 3, and the status rows; one test per case besides (room, priority, log, Mood, orders, Jobs' kind and scrollbar column, the log strip's hint, activity).
- [x] A status-bar test: a 120-character message shows whole over two rows.
- [x] UI only: world hashes unchanged; no render golden moved (none draws these states).
- [x] Spec: `panels.md` § Zones (room lines), § Jobs (columns, waiting orders), § Orders, § Workshop, § Building, § Mood, § Log and the filtered titles; `fortress-screen.md` § Sidebar closed (status row 2, the log strip), § Inspection panel (activity); 24 § Rules (status row text).
