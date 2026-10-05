# Wireframes: Fortress Panels

**Detail level:** W4 · **Owner:** `ui/panels/*` · **Depends on:** [`fortress-screen.md`](fortress-screen.md), the owning system documents

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

Stockpile settings replace the season rows with:

```
│ ── Selected: Stockpile #1 (30 t)   │
│ Preset [Food ▾]                    │
│ ▸ food          [■] all            │
│   ▸ meat        [■]                │
│   ▸ meal        [■]                │
│ ▸ drink         [□]                │
│ ▸ seed          [▪] partial        │
│ Materials [any ▾]  Quality 0–5     │
│ Barrels 6/8   Bags 2/4   Bins 0/0  │
│ Priority 5    Links: none [+]      │
│ Usage 22/30 tiles                  │
```

## Jobs (j)

```
│ Jobs                           [j]  │
│ 42 open · 18 claimed · 6 blocked    │
│ /filter: ____  [l]abor [s]tate      │
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
│ Min 5 Wood 5 Build 5 Carp 5 Mason 5 │
│ Farm 4 Cook 5 Brew 4 Haul 6 …       │
```

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
```

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
│ Mode    [off] [train] [active]      │
│ Members Halvar G., Einar R., Tova E.│
│         [S-a] add  [r] remove       │
│ Gear    weapon [axe ▾] armor [metal▾]│
│         ranged [□]                  │
│ Station (60,28,z31)                 │
│         [S-s] set  [S-c] clear      │
│ Patrol none [S-p] add [y] clear     │
│ Orders [S-k] kill [S-f] follow      │
│ Barracks #2 · training 2/3 present  │
```

## Animals (n)

```
│ Animals                        [n]  │
│ [1] Tame (14)  [2] Wild (23)        │
│ Species   Name    Pasture  Cond  Tr │
│ ▶ cow     —       #1       ▓▓░ 38   │
│   cow     —       #1       ▓░░ 12   │
│   dog     Bramble —        —    war │
│   cat     Sooty   —        —    pet │
│   chicken ×4      —        —        │
│ ─────────────────────────────────── │
│ [S-p] pasture  [S-s] slaughter      │
│ [S-c] cap [S-a] assign [S-n] name   │
│ ── Wild ────────────────────────── │
│ deer ×5   [■] hunt   seen NE        │
│ wolf ×3   [□] hunt   seen N         │
```

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

Depot panel (from a selected depot): items at the depot with values, `[S-m] move` opens the stocks tree in selection mode, `[S-t] trade` (enabled when a caravan is present).

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

## Help (?)

Two tabs: `Keys` (the keymap table grouped by context, live from the keymap, then the "Work orders" keys of the Orders panel) and `Legend` (glyphs and colors by category, generated from content: terrain, fluids, creatures, items, buildings, overlays).

## Debug (F12)

Per-system timing table (avg, worst), entity counts by kind, active fluid tiles, path requests served and pending, jobs by state, seed and tick, and buttons: `[S-d] dump save`, `[r] replay season log`, `[h] hash world`.
