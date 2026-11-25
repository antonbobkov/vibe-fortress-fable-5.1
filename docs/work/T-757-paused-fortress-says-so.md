# T-757 — A new fortress starts paused and nothing on screen says so

**Source:** playtest 2026-11-25 (newcomer) ([report](../../reports/data/2026-11-25-playtest-5.md), finding 3) · **Size:** S · **Needs:** — · **Status:** open

## Why

Embarked with the defaults (world `deep-5589-1`, "Bitterbrae", Balanced), the fortress opens paused, as the README says. The game itself says so only with one glyph, `║`, between "z 30" and "[Esc] menu" on status row 1 (`27-arrival.png`). The only hint on screen is "Designate a place to dig with [d]". A newcomer who designates a dig, places a carpenter's workshop and orders a bed sees nothing happen: the box blinks and the workshop stays a plan. The order line then says "Ordered: x1 Bed. No carpenter's workshop is built yet: [b] Build > Workshops." That is about the workshop just placed, and it sends the player to place a second one. Hovering the `║` shows nothing on the hover line. A click on it does resume, at the last speed (4× here), but nothing says it can. The tutorial explains time only in its 10th step (finding 1). A player who declines the tutorial is never told at all.

## What to do

Decisions:

- **Status row 1 names the pause**: while paused the speed field reads `║ paused` in the key colour when the row has room, and `║` alone when it does not (the `[Esc] menu` field gives way first, as it does now). Hovering the speed field puts "Paused: [Space] or a click runs the fortress; a right click changes the speed." on the hover line. While running it puts "Running at 2×: [Space] or a click pauses; a right click changes the speed."
- **A new hint, `hint_paused`**: "Time is paused, so nothing happens yet. [Space] runs the fortress, [+] and [-] change the speed." Its trigger is the first designation, zone, building or work order made while the fortress has not run since it was entered (embarked or loaded). It does not show while the tutorial runs, because the tutorial's own step teaches it.
- **An order for a workshop that is placed but not built** says so: `ui.orders.added_planned` "Ordered: {qty} {recipe}. The {workshop} is placed and will be built once time runs." while paused, and "… is placed and waits for a builder." while running. The `[b] Build > Workshops` line stays for no workshop at all.

Spec: `ui-screens/fortress-screen.md` § Sidebar closed (status row 1: the speed field and its hover), 24 § Hints and `03-content/ui-keymap-and-screens.md` § Hints (the new row), the orders strings in `03-content/ui-keymap-and-screens.md`.

## Done

- [ ] Tests (`describe` with the task id): a paused fortress at 80 columns shows `║ paused`, and the hover line over it gives the paused text; a running one gives the running text. The first dig designated before the fortress has run shows `hint_paused` once; after `Space` and a tick, a dig does not. With the tutorial running the hint does not show. An order for a recipe whose only workshop is a plan shows the planned line.
- [ ] UI only: no world hash moves and no sweep is needed.
