# Wireframes: Fortress Panels

**Detail level:** W4 · **Owner:** `ui/panels/*` · **Depends on:** [`fortress-screen.md`](fortress-screen.md), the owning system documents

All panels are `SIDEBAR_COLS` (36) wide; shown here at that width. Each has a title row with its hotkey, an optional filter row, content, a separator and an action row.

## Zones (z)

```
│ Zones                          [z]  │
│ [s] Stockpile   [f] Farm plot       │
│ [p] Pasture     [b] Bedroom         │
│ [d] Dining hall [h] Hearth hall     │
│ [o] Hospital    [r] Barracks        │
│ [a] Archery     [m] Meeting area    │
│ [t] Tomb        [u] Dump            │
│ [i] Fishing     [g] Gather          │
│ ─ Drag a rectangle; tiles that     │
│   qualify show green.               │
│ ── Selected: Farm plot #3 (24 t)   │
│ Spring  [dimcap      ▾]  seeds 14   │
│ Summer  [dimcap      ▾]             │
│ Autumn  [sweetroot   ▾]  seeds 0 !  │
│ Winter  [dimcap      ▾]             │
│ Crops: 18 growing, 4 ready, 2 empty │
│ [x] remove zone  [e] resize         │
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
│ [Enter] center  [p] priority        │
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
│   whole column · [a] all on/off    │
│ [Enter] labor manager: all labors  │
```

The panel is the quick view: the columns that do not fit scroll with `←` `→`, the rows scroll with the selection, and hovering a column head names the labor. `Enter`, or a click on the last row, opens the labor manager.

## Labor manager

A full-window screen over the fortress (`labor_manager`), opened with `Enter` in the labors panel or with the labors key in the units panel while dwarves are marked. The simulation keeps its speed under it.

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
- **Templates** (`[t]`, then `1`–`6`, or `↑↓` and `Enter`, or a click): Miner, Hauler only, Farmer, Crafter, Soldier, Everything off. A template turns exactly its labors on, and every other labor off, for the marked dwarves (or the cursor's dwarf); only the cells that differ are sent (`SetLabor`). The menu shows what the highlighted template turns on.
- The last row says what the last action did, or why it did nothing. A change shows at once and is confirmed by the simulation at the next command phase.
- Every key row is a row of buttons, so each action has a mouse path.

## Orders (o)

```
│ Orders                         [o]  │
│ [+] new global order                │
│ Carpenter #1                        │
│  ▶ Bed ×3 (1 done)          pri 5   │
│    Barrel  keep ≥ 10        pri 4   │
│ Still #1                            │
│    Brew dimcap ale keep ≥ 40 pri 3  │
│ Kitchen #1                          │
│    Easy meal keep ≥ 30      pri 4   │
│ ─────────────────────────────────── │
│ [Enter] edit [x] remove [↑↓] reorder│
│ ── Standing orders ──────────────── │
│ [■] auto-harvest   [■] collect      │
│ [■] auto-butcher   [■] haul refuse  │
│ [■] rearm traps    [■] melt marked  │
```

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
│ [f]orbid [d]ump [m]elt [t]o depot   │
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
│         [S-l] pick  [S-n] rename    │
│ Mode    [off] [train] [active]      │
│ Members Halvar G., Einar R., Tova E.│
│         [a] add  [r] remove         │
│ Gear    weapon [axe ▾] armor [metal▾]│
│         ranged [□]                  │
│ Station (60,28,z31) [s] set [c]lear │
│ Patrol  none [p] set                │
│ Orders  [k] kill target [f] follow  │
│ Barracks #2  [S-b] change           │
```

`[a] add` and `[r] remove` open a multi-select list in place of the squad's details; `[S-l] pick` (the leader, among the members) and `[S-b]` (the barracks zones, with "None" first) open a single-choice list:

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
- The barracks list sends `SetZoneSetting { key: squad }`: the zone the squad had lets go and the chosen one takes it; "None" clears it. Without a barracks zone the status row says to make one in Zones. The barracks row shows the assigned zone; "(default)" marks a zone the squad uses without being assigned.
- The new keys are on `Shift` because `l`, `b` and `n` are panel hotkeys.

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
│ [p] pasture [s] slaughter [t] train │
│ [a] assign [n] name  caps: [c]      │
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
│ [d] depot panel  [t] trade now      │
```

Depot panel (from a selected depot): items at the depot with values, `[m] move goods…` opens the stocks tree in selection mode, `[t] Trade` (enabled when a caravan is present).

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
│ [Enter] inspect  [s]ort by tier     │
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

Two tabs: `Keys` (the keymap table grouped by context, live from the keymap) and `Legend` (glyphs and colors by category, generated from content: terrain, fluids, creatures, items, buildings, overlays).

## Debug (F12)

Per-system timing table (avg, worst), entity counts by kind, active fluid tiles, path requests served and pending, jobs by state, seed and tick, and buttons: `dump save`, `replay season log`, `hash world`.
