# Wireframes: Fortress Panels

**Owner:** `ui/panels/*` · **Depends on:** [`fortress-screen.md`](fortress-screen.md), the owning system documents

All panels are `SIDEBAR_COLS` (36) wide; shown here at that width. Each has a title row with its hotkey, an optional filter row, content, a separator and an action row.

A panel letter ([`ui-keymap-and-screens.md`](../../03-content/ui-keymap-and-screens.md) § Fortress panels) always opens or closes its panel, whatever panel is open. An accelerator on one of those letters is therefore `Shift`+letter, written `[S-m]`; an accelerator on a free letter is written `[w]`. Every action row is clickable.

## Zones (z)

```
│ Zones                          [z]  │
│ [S-s] Stockpile [S-f] Farm plot     │
│ [S-p] Pasture   [S-b] Bedroom       │
│ [S-d] Dining h… [h] Hearth hall     │
│ [S-o] Hospital  [r] Barracks        │
│ [S-a] Archery   [S-m] Meeting area  │
│ [S-t] Tomb      [S-u] Dump          │
│ [i] Fishing     [g] Gather          │
│ ─ Drag a rectangle; tiles that     │
│   qualify show green.               │
│ ── Selected: Farm plot #3 (24 t)   │
│ Spring  [dimcap      ▾]  seeds 14   │
│ Summer  [dimcap      ▾]             │
│ Autumn  [sweetroot   ▾]  seeds 0 !  │
│ Winter  [dimcap      ▾]             │
│ Crops: 18 growing, 4 ready, 2 empty │
│ [x] remove zone  [S-e] resize       │
```

Selecting a stockpile or room replaces the type list with its inspector; `[y] zone types` returns to the list. With no zone tool active, `Enter` selects the zone at the map cursor or centre; a click on its map tiles does the same.

```
│ [y] zone types                    │
│ ── Selected: Stockpile #1 (30 t)   │
│ [S-p] Preset [Food ▾]              │
│ [g] tree  [q] settings             │
│ [v] materials                     │
│ ▸ Food          [■]               │
│ ▸ Drink         [□]               │
│ ▸ Seed          [▪]               │
│ Barrels wanted [-]   8 [+]         │
│ Bags wanted    [-]   4 [+]         │
│ Bins wanted    [-]   0 [+]         │
│ Priority       [-]   5 [+]         │
│ Min quality    [-]   0 [+]         │
│ Max quality    [-]   5 [+]         │
│ Materials [any]  Quality 0–5       │
│ Priority 5    Links: none          │
│ Usage 22/30 tiles                 │
│ ↑↓ select ←→ expand Space toggle  │
│ [x] remove zone  [S-e] resize      │
```

The preset header opens a dropdown rather than cycling with the thirteen presets. Arrows highlight and Enter chooses; letters jump to the next matching preset without accelerator captions; the help line says "letters jump". A click chooses the same option. Esc closes without applying.

In the category tree, arrows select and expand/collapse (Left on a collapsed child selects its parent), and Space toggles the tri-state checkbox. In numeric settings, arrows or Tab/Shift+Tab choose a field; Left/Right or +/- adjust it, just like the mouse buttons. The fields submit `SetStockpileContainers`, `SetStockpilePriority` and `SetStockpileFilter`, preserving unrelated settings. Counts stay non-negative, priority stays 1–9, and quality stays 0–5 with minimum no greater than maximum; a refused adjustment explains why in the status row.

The materials checklist replaces the settings until Esc: arrows select, Space or Enter toggles, and a click does the same. Any toggles between all material classes and none. Panel hotkeys retain their panel action in every state. Help lists every action, and hovering a truncated value shows its full text.

A room inspector shows current tier and score parts, named missing requirements, and its enclosure count:

```
│ [y] zone types                    │
│ ── Selected: Bedroom #2 (9 t)      │
│ Modest room (score 24)             │
│ Tiles 9 Walls 2 Furniture 4 Size 9 │
│ Not enclosed: 3 open border tiles │
│ Needs a bed                       │
│ Owner: nobody                     │
│ [S-o] owner…                      │
│ [x] remove zone  [S-e] resize      │
```

Open border tiles on the viewed level are highlighted using the room's existing same-z eight-neighbour enclosure rule; the inspector only reads and never recomputes stored room state. Missing requirements say Needs a bed / a table with a chair / the hearth inside / a chest / a coffin, as appropriate. A bedroom's owner button or Shift+O opens the same Nobody/dwarf picker as the building panel; arrows and Enter or a click submit `AssignRoom`, Esc cancels. A missing built bed or pending room registration is explained in the status row.

## Jobs (j)

```
│ Jobs                           [j]  │
│ 42 open · 18 claimed · 6 blocked    │
│ /filter: ____                      │
│ Pri Job              Who / reason   │
│  1  Dig (52,31,z30)  Ketil Ironvein │
│  3  Build bed        Orm Ashbrow    │
│  5  Haul turnip      —              │
│  5  Build bed        waiting: 1 bed │
│  5  Dig (60,40,z29)  no path        │
│  6  Haul stone ×12   —              │
│ ─────────────────────────────────── │
│ [Enter] center  [S-p] priority      │
│ [x] cancel  [o] standing orders     │
│ ── Labor priorities (1–9) ───────── │
│ Mining 2 · Hauling 7                  │
```

Jobs names a building target by its type (Build bed, Build carpenter's workshop) and an item target by its item name (Haul log). Only bare-tile jobs show coordinates. Click the job name or press Enter to centre its target. With no rows, the first table body row says "No jobs. Designate [d], build [b] or order [o]."

The filter controls wrap onto three rows at sidebar width: `/filter`, `[S-l] labor: all`, `[S-s] state: all`. `/` or clicking the field focuses text matching the job name or worker, ignoring case. Enter or Esc finishes typing without closing the panel. Shift-L or clicking the labor row cycles all and the labors with jobs in registry order; Shift-S or clicking the state row cycles all, open, claimed, blocked. Claimed includes fetching, travelling, working and completing. Filters combine; changing one resets selection. The summary counts all current jobs. Labor priorities show only non-default priorities, using full names separated by dots. With all defaults, the line reads "All labors at priority 5: change them in the labor manager ([l], Enter)."

## Labors (l)

```
│ Labors                         [l]  │
│            Mi Wo Co Ca Ma Cr Fa He… │
│ Ketil I.   ■  ■  ■  □  ■  □  □  □  │
│ Brynja C.  □  □  ■  □  □  □  ■  ■  │
│ Orm A.     □  ■  ■  ■  □  ■  □  □  │
│ …                                   │
│ ─ click to toggle · shift-click:   │
│   whole column · [S-a] all on/off  │
│ [Enter] labor manager: all labors  │
```

The quick view's whole-row action turns every labor of the selected dwarf on unless all are on, then turns every labor off. Shift-click on a column applies the same rule across its dwarves. The panel is the quick view: the columns that do not fit scroll with `←` `→`, the rows scroll with the selection, and hovering a column head names the labor. `Enter`, or a click on the last row, opens the labor manager.

## Labor manager

A full-window screen over the fortress (`labor_manager`), opened with `Enter` in the labors panel or with `Shift+L` in the units panel while dwarves are marked. The simulation keeps its speed under it.

```
 Labor manager                                                      [Esc] close
 Ranulf Ashwall, Miner · Animal training: on · priority 5
 2 of 40 marked          A A B B C C C C C F F G H H H L M M M M S S T T W
                         n n r u a l o o r a i e a e u e a e e i m m e r o
                         i i e t r e n o a r s m u r n a s c d n e i x a o
                         m m w c p a s k f m h   l b t t o h i i l t t d d
                         a a i h e n t i t i i c i a i h n a c n t h i i c
                         l l n e n i r n s n n u n l n e r n i g i i l n u
                             g r t n u g   g g t g i g r y i n   n n e g t
                         c t   y r g c         t   s       c e   g g s   t
   Dwarf                 a r     y   t         i   m       s             i
   Priority 1–9          5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 5
 • Embla Ashhold         ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■     █
 • Ranulf Ashwall        ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■     │
   Orm Ironward          ■ ∙ ∙ ∙ ■ ∙ ∙ ∙ ∙ ∙ ∙ ∙ ■ ∙ ∙ ∙ ∙ ∙ ∙ ■ ∙ ∙ ∙ ∙ ∙     │
   Vigdis Bearroot       ∙ ∙ ∙ ∙ ∙ ∙ ∙ ∙ ∙ ∙ ∙ ∙ ■ ∙ ∙ ∙ ∙ ∙ ∙ ∙ ∙ ∙ ∙ ∙ ∙     │
   …
 ──────────────────────────────────────────────────────────────────────────────
 [Space] mark  [*] mark all  [Enter] toggle  [a] whole row  [c] whole column
 [-] priority down  [+] priority up  [t] templates
 Miner: 12 labors changed for 2 dwarves.
```

- **Rows**: every dwarf, scrolling with the cursor, `PageUp`/`PageDown`, `Home`/`End` and the wheel; a scrollbar column on the right. A child's row is dim: children take no labors, an action skips them and the status line says how many.
- **Columns**: every labor under its name written downward (cut to `LABOR_HEADER_ROWS`, 9, within which every name is unique). A column is 2 to 4 cells wide by the room there is; when the labors do not all fit, the columns scroll with the cursor (`«` `»` mark more). Row 2 names the dwarf and the labor at the cursor, or under the mouse, in full, with the cell's state and the labor's priority; hovering a head shows the labor's name.
- **Cells**: `■` on, `∙` off. `Enter` or a click toggles the cell; `[a]` the cursor's whole row; `[c]`, or a shift-click on a head, the whole column for the marked dwarves, or for everyone when none is marked.
- **Marks**: `Space` or a click left of a name marks a row (`•`), a shift-click on a name marks the range from the last mark, `Shift`+`↑`/`↓` mark the rows they pass, `*` marks all or none. An action on a marked row applies to every marked dwarf.
- **Priority row**: the labor priorities 1–9. `+`/`-` or a digit set the cursor labor's priority; a click on a number adds one, a shift-click takes one (`SetLaborPriority`). At a limit nothing is sent and the status line says the range.
- **Templates** (`[t]`, then `1`–`6`, or `↑↓` and `Enter`, or a click): Miner, Hauler only, Farmer, Crafter, Soldier, Everything off. A template turns exactly its labors on, and every other labor off, for the marked dwarves (or the cursor's dwarf); only the cells that differ are sent (`SetLabor`). The menu shows what the highlighted template turns on; the exact labor sets are in 11's Player-facing behavior.
- The last row says what the last action did, or why it did nothing. A change shows at once and is confirmed by the simulation at the next command phase; a pending value is removed when its reader agrees or a tick has passed.
- Every key row is a row of buttons, so each action has a mouse path.

## Orders (o)

```
│ Orders                         [o]  │
│ [S-n] new order  all workshops      │
│ ── Carpenter's workshop #1 ──────── │
│ ▶×3 Bed · in progress               │
│  ≥10 Barrel · stocked (12)          │
│  ×5 Door · waiting for log (0)      │
│ ── Any workshop ─────────────────── │
│  ≥40 Brew drink · no still          │
│ ── Finished ─────────────────────── │
│  ×2 Chair · done                    │
│ ─────────────────────────────────── │
│ In progress: a dwarf is at work on  │
│ it.                                 │
│ Count [-] 3 [+] [+/-] Shift ±10     │
│ [S-m] once  [S-p] priority 5        │
│ [S-f] any material ▼                │
│ [x] remove [r] repeat [S-↑↓] move   │
│ ── Standing orders ──────────────── │
│ [■] Harvest                         │
│ [■] Collect Products                │
│ [■] Butcher                         │
│ [■] Haul Refuse                     │
│ [■] Rearm Traps                     │
│ [■] Melt Marked                     │
```

- Opened with `o` the list shows every order in the fortress under its workshop's name ("Any workshop" for the global orders); opened from a workshop (`[S-o] its orders`) it shows that workshop's orders only.
- Status comes from the workshop's current job and `isRunnable` per candidate workshop. A keep threshold compares `stockOf` of the output type, without its material filter.
- A row is the count (`×N` for `once`, `≥N` for `keep ≥ N`), the recipe and the order's status: `in progress`, `queued`, `waiting for <input> (<available>)`, `waiting for fuel`, `no <workshop type>`, `suspended`, `stocked (<in stock>)`, `done`. The selected order's status is written in full on the two lines under the rule, with where to get a missing input.
- `+`/`-` (and `=`) change the selected order's count by 1, with `Shift` by 10, within 1–999: `remaining` of a `once` order, the threshold of a `keep ≥ N` order. While an order is selected they are not the game-speed keys. `[S-m]` toggles `once` / `keep in stock`, `[S-p]` steps the priority, `[S-f]` opens the material list, `Shift+↑↓` reorder within the workshop's queue.
- `[S-n]` opens "Add order" (below). `[r]` adds the selected order again with the count it was placed with; on a `done` row it orders the finished order again. `[x]` removes the order after `c_remove_order`; on a `done` row it clears the row.
- The last `ORDER_FINISHED_MAX` (3) finished `once` orders stay as `done` rows, and the last `ORDER_RECENT_MAX` (5) ordered recipes lead the picker. Both are presentation state: not saved.
- With no orders: "No work orders. [S-n] adds one, or click a workshop on the map."

### Add order

```
│ Orders                         [o]  │
│ Add order                           │
│ Find [ doo____________________ ]    │
│ ── Recent ───────────────────────── │
│ ● Bed                               │
│ ── Furniture ────────────────────── │
│ ▶● Door · carpenter's workshop      │
│  ○ Door · forge                     │
│  ○ Door · mason's workshop          │
│ ─────────────────────────────────── │
│   Quantity [-]   5 [+]              │
│   Mode     once: make 5             │
│   Material any material             │
│ ▶ Where    any carpenter's workshop │
│ [Enter] add [Tab] next [Esc] back   │
```

- Letters type into `Find` (a filter on the recipe names; `Backspace` deletes). `↑↓` and `PageUp`/`PageDown` move in the list. Recipes are grouped by the top category of what they make, "Recent" first; `●` marks a recipe some workshop can run now, `○` one it cannot. Two recipes of the same name say which workshop type makes them.
- Digits type the quantity; `+`/`-` step it by 1 and with `Shift` by 10 (1–999).
- `Tab` / `Shift+Tab` move the `▶` between the fields; `←→` change the focused one: the quantity, the mode (`once: make N` / `keep ≥ N in stock`), the material (any, a class, or one material the recipe takes) and, for a global order, the workshop (any of the recipe's type, or one of them). A click on a field changes it.
- Opened from a workshop the picker lists that workshop's recipes and `Where` is fixed to it.
- `Enter` (or a second click on the selected recipe) submits `AddWorkOrder` and closes the picker; the status row confirms ("Ordered: ×5 Door · Carpenter's workshop #1"). `Esc` closes it without ordering.

## Workshop

Opened by a click on a finished workshop.

```
│ Workshop                            │
│ Carpenter's workshop #1             │
│ Worker: any                         │
│ Suspended · magma powered           │
│ ── Recipes ──────────────────────── │
│ ● Barrel                            │
│ ● Bed                               │
│ ○ Door                              │
│ …                                   │
│ ── Orders (2) ───────────────────── │
│ ×3 Bed · in progress                │
│ ≥10 Barrel · stocked (12)           │
│                                     │
│ [S-n] new order  [S-o] its orders   │
│ [S-f] material  [w] worker          │
│ [S-s] suspend  [x] take apart       │
│ Needs fuel — order at a wood        │
│ furnace                             │
```

- `[S-n]`, or a click on a recipe, opens "Add order" for this workshop (on the clicked recipe). `[S-o]` opens the Orders panel on this workshop's orders; `[S-f]` opens the material list of its first order.
- `[S-s]` suspends after `c_suspend_workshop` and resumes without asking; `[x]` takes the workshop apart after `c_deconstruct_workshop` (it has orders) or `c_deconstruct_building`.
- The last two lines say why the workshop is idle (`12` § Operation 3).

## Building

Opened by a click on any building that is not a finished workshop or the depot (those keep their panels), or by `Enter` in Look on its tile. Right click on a building still opens Look.

```
│ Building                            │
│ Door #3                             │
│ Oak · built                         │
│ Open now: it locks when the alert   │
│ is Hearth.                          │
│ ── Mode                             │
│ ○ Open                              │
│ ○ Locked                            │
│ ○ No pets                           │
│ ● Lock on alert                     │
│ Look at the tile                    │
│ [x] take apart                      │
│                                     │
│ Open until the alert is Hearth,     │
│ then locked once the civilians are  │
│ in.                                 │
```

The panel is a list: `↑` `↓` move the cursor over the lines that act, `Enter` or a click activates one, and the last three rows explain the cursor's line. The first two lines are the name with its ordinal and the material and state (`built`, `planned`, `being built`, `to be taken apart`). What follows depends on the building:

- **Planned or being built**: why it waits, in the words of the Jobs panel (`Waiting: 1 door — order at a carpenter's workshop`); `Priority 5 · set 1 2 3 4 5 6 7 8 9` (`1`–`9` or a click on a digit, planned only: `SetBuildingPriority`); `[x] cancel the plan` (`CancelBuilding`). Nothing else is offered until it is built.
- **Door, hatch**: the modes as a list with the current one marked `●` (`SetDoorMode`: Open, Locked, No pets, Lock on alert; `SetHatchMode`: Open, Locked). A door set to lock on alert says whether it is locked now.
- **Trap**: `Trap: armed` (or spent, jammed) and the modes Enemies only / Everyone (`SetTrapMode`).
- **Lever**: `Lever: off`, `[y] pull` (`PullLever`), then the links.
- **Pressure plate**: `Plate: not pressed`, the trigger as a list (Enemies and wild creatures / Any creature, dwarves too / Water / Magma) and `← → smallest size 0 (a dwarf is 60)` or `← → depth 1 of 7 or more`; `←` `→` or a click on an arrow change the number (`SetPlateTrigger`). Then the links.
- **Links** (lever, plate): `── Linked to (2)`, a line per target with its state (`→ Drawbridge #1: lowered`; `Enter` centres the map on it), a dim line per link a mechanic has still to make (`… Door #2: waiting: 1 mechanism`), `[i] link to…` and `[r] unlink` (the target under the cursor, or the only one: `UnlinkMechanism`). A linked target's own panel lists what works it (`← Lever #1`).
- **Cage**: `Holds a wolf` or `Empty`; `[r] release` (`ReleaseCage`, after `c_release_cage`) and `[g] tame` (`TameCaged`).
- **Bed**: `Owner: Urist (Bedroom #2)`, and `[w] owner…`, which assigns the bedroom zone the bed stands in (`AssignRoom`). A bed in no bedroom says so and how to make one.
- **Coffin**: `Kept for anyone` / `Kept for Urist` / `Holds a body`, and `[w] keep for…` (`AssignCoffin`).
- Every built building: `Look at the tile` and `[x] take apart` (after `c_deconstruct_building`).

`[i] link to…` replaces the list with the buildings that can be linked, and the status bar reads `Link Lever #1: click a door, hatch, floodgate, drawbridge, spike trap or cage · [Esc] cancel`:

```
│ Link Lever #1 to:                   │
│ Drawbridge #1: lowered              │
│ Door #3: locks on alert             │
│                                     │
│ Click the target on the map, or     │
│ Enter here. Esc cancels.            │
```

A left click on the map picks the building there; `↑` `↓` move the cursor (the map centres on each candidate) and `Enter` picks it; `Esc` or a right click goes back. A wrong pick says why (nothing there, not a kind that links, not finished, linked already, the lever itself) and the choice stays open. A link is made by a mechanic with one mechanism; with none in stock the message says where to order one.

`[w]` replaces the list with `Nobody` and the dwarves, the current owner marked `●`; `Enter` or a click chooses, `Esc` goes back.

Every action that cannot be done says why on the status row (an empty cage, a coffin that holds a body, a mode that is set already, a building not finished).

## Stocks (s)

```
│ Stocks                         [s]  │
│ /filter: ____                       │
│ ▸ food        412   1,880 ☼         │
│   ▸ meal       96   2,400 ☼         │
│   ▸ plant/raw 210     240 ☼         │
│ ▸ drink       184     420 ☼         │
│ ▸ stone       340     560 ☼         │
│ ▸ bar          38     870 ☼         │
│   ▸ metal  iron 30 · copper 8       │
│ ▸ weapon        9   1,120 ☼         │
│ …                                   │
│ Wealth 18,450 ☼   (buildings 3,200) │
│ [S-f] forbid  [S-d] dump            │
│ [S-m] melt  [S-t] to depot          │
```

`/` or clicking the filter field focuses a case-insensitive search of category paths, item names and material labels. Enter or Esc finishes typing. Matching descendants keep their ancestors visible and expand while the filter is set; clearing the filter restores the saved tree expansion. Filtering changes visible rows, while category actions keep applying to their selected category.

Stocks actions apply to the selected category, type or individual stack. Forbid and dump toggle all applicable items; turn on when any selected item lacks the mark, otherwise clear all. Melt considers only eligible metal items and uses the same consistent toggle. A mixed-material type sends individual metal-item commands, while an all-metal type sends one type command. Nonmetal stacks cannot be marked for melt. Marking for dump or melt goes through the default-No confirmation; clearing marks and forbidding do not ask. Every action has a key caption and a clickable row.

## Military (m)

```
│ Military                       [m]  │
│ Alert: (•) Calm ( ) Watchful ( ) Hearth │
│ Squads                              │
│ ▶ The Hearthguard  3/6  train       │
│   The Cold Bolts   2/6  active      │
│ [+] new squad  [x] disband          │
│ ── The Hearthguard ─────────────── │
│ Leader  Halvar Grimshield (Warden)  │
│         [S-l] pick  [S-n] rename    │
│ Mode    [off] [train] [active]      │
│ Members Halvar G., Einar R., Tova E.│
│         [S-a] add  [r] remove       │
│ Gear    weapon [axe ▾] armor [metal▾]│
│         ranged [□]                  │
│ Station (60,28,z31)                 │
│         [S-s] set  [S-c] clear      │
│ Patrol none [S-p] add [y] clear     │
│ Orders [S-k] kill [S-f] follow      │
│ Barracks #2  [S-b] change           │
```

`[S-a] add` and `[r] remove` open a multi-select list in place of the squad's details; `[S-l] pick` (the leader, among the members) and `[S-b]` (the barracks zones, with "None" first) open a single-choice list:

```
│ ─── Add: 2 marked, 4 free ───────── │
│ • Ketil Ironvein                    │
│ • Brynja Coldhammer                 │
│   Orm Ashbrow                       │
│ [Space] mark  [*] all               │
│ [Enter] choose  [Esc] cancel        │
```

- `Space` or a click marks a row (`•`), `*` marks all (as many as the squad has room for) or none, and `Enter` adds or removes every marked dwarf in one `SetSquadMembers`; with none marked, `Enter` takes the cursor's row. An add list takes no more marks than the squad has free places, and a full squad, an empty squad or no free adult says so on the status row instead of opening an empty list.
- The leader list sends `SetSquadLeader`; `[S-n]` opens the text input and sends `RenameSquad`.
- The barracks list sends `SetZoneSetting { key: squad }`: the zone the squad had lets go and the chosen one takes it; "None" clears it. Without a barracks zone the status row says to make one in Zones. Changing the assignment moves training to that barracks, including for a squad that has already trained. The barracks row shows the assigned zone; "(default)" marks a zone the squad uses without being assigned.
- The new keys are on `Shift` because `l`, `b` and `n` are panel hotkeys.

## Animals (n)

```
│ Animals                                       [n]  │
│ [1] Tame (14)  [2] Wild (23)                       │
│ Species   Name    Pasture  Cond  Tr                │
│ ▶ cow     —       #1       ▓▓░ 38                  │
│   cow     —       #1       ▓░░ 12                  │
│   dog     Bramble —        —    war                │
│   cat     Sooty   —        —                       │
│   chicken ×4      —        —                       │
│ ────────────────────────────────────────────────── │
│ [S-p] pasture  [S-s] slaughter                    │
│ [S-c] cap [S-a] assign [S-n] name                  │
│ [S-t] train                                        │
│ ── Wild ────────────────────────────────────────── │
│ deer ×5   [■] hunt   seen NE                       │
│ wolf ×3   [□] hunt   seen N                        │
```

The Tame tab offers a clickable `[S-t] train` row below the existing actions, visible at the normal sidebar width. It opens War/Hunting; arrows select and Enter submits, or click a choice. Esc or its Cancel button returns to the list. The Tr status shows training while a job exists, including retraining an animal that already has a role, otherwise war, hunting or blank. With no selected tame animal, or a non-trainable species, the normal message path explains the refusal. All panel letters keep their usual behavior inside both choice rows; Help lists this action and its controls.

## Threats (t)

```
│ Threats                        [t]  │
│ Peril 2 · Renown 14.6               │
│ Active: none                        │
│ Raids possible from Spring, Year 2  │
│ Ambushes possible from Autumn, Yr 1 │
│ Thieves: frequent                   │
│ ── Caverns ─────────────────────── │
│ 1: breached · crawlers 4 · spiders 1│
│ 2: sealed                           │
│ ── The Deep ────────────────────── │
│ Pressure ▓▓▓░░░░░░░ 30 / 50 (lvl 0) │
│ "Something below has not yet       │
│  noticed."                          │
```

## Civilizations (c)

```
│ Civilizations                  [c]  │
│ Mountainhome  rep +12  spring       │
│ Hillfolk      rep  +4  summer  here!│
│ Wildwood      rep  −6  autumn       │
│ Gloam         (raiders)             │
│ ── Hillfolk ────────────────────── │
│ Last brought: cheese, wool cloth,   │
│  seeds, 2 sheep                     │
│ Requests [+]                        │
│  1. iron bars  ★★★                  │
│  2. wool cloth ★★                   │
│ Reputation log                      │
│  +3 trade (Summer 1) · −2 wood…     │
│ [S-d] depot  [S-t] trade now        │
```

Depot panel (from a selected depot): items at the depot with values, `[S-m] move` opens the stocks tree in selection mode, `[S-t] trade` (enabled when a caravan is present). In selection mode `Space` or `Enter` marks the eligible stacks under the tree row, `[S-t]` submits one `MoveToDepot` command for everything marked, and `Esc` discards the selection. The requests editor lists the item ids of the content registry in registry order (the UI never invents an id) and submits only on `Enter`.

## Population (p)

```
│ Population                     [p]  │
│ 23 dwarves (2 children)             │
│ Cap [-] 80 [+]                      │
│ Hall spirit: Content (71)           │
│ Next evaluation: Autumn             │
│ Eligible: yes                       │
│ Last wave: 6 in Summer, Year 2      │
│ Waves so far: 3                     │
```

## Mood (e)

```
│ Mood                           [e]  │
│ Hall spirit ♥ Content (71)          │
│ Name             Tier   Top thoughts│
│ ▶Ketil I.        Fine   +5 meal,    │
│                         −4 enemy    │
│  Brynja C.       Content +8 room,   │
│                         +5 friend   │
│  Halvar G.       Unhappy −15 friend │
│                         died, −4 …  │
│ [Enter] inspect  [S-s] sort tier    │
```

## Log (a)

```
│ Log                            [a]  │
│ [1] All [2] Alerts [3] Combat       │
│ /filter: ____                       │
│ 12 Su Y2 !  Gloam scouts seen (E)   │
│ 12 Su Y2    Ketil found hematite    │
│ 11 Su Y2 !  The cow is starving     │
│ 11 Su Y2    Hillfolk caravan arrived│
│ 10 Su Y2    ×3 Stockpile #2 is full │
│ …                                   │
│ [Enter] center on it                │
```

## Overlays (f)

```
│ Overlays                       [f]  │
│ [■] designations  [□] priority digits│
│ [■] zones         [□] fluid levels  │
│ [□] temperature   [□] jobs          │
│ [■] squad stations                  │
│ [□] stockpile usage                 │
│ Debug: [□] connectivity [□] paths   │
│        [□] chunks                   │
```

The panel lists the overlays the compositor draws, in the order of 23 § Compositor step 8, with the debug overlays under the `Debug:` label. `↑` and `↓` move the selection and `Enter` toggles the selected overlay; a click toggles too.

## Help (?)

Two tabs: `Keys` (the keymap table grouped by context, live from the keymap, then the "Work orders" keys of the Orders panel) and `Legend` (glyphs and colors by category, generated from content: terrain, fluids, creatures, items, buildings, overlays).

## Debug (F12)

A sidebar panel. Entity counts use `EntityReader.countOfKind`; path request counts use `requestsServed` and `requestsPending`. These are O(1) presentation counters and are not saved.

Per-system timing table (avg, worst), entity counts by kind, active fluid tiles, path requests served and pending, jobs by state, seed and tick, and buttons: `[S-d] dump save`, `[r] replay season log`, `[h] hash world`.
