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
```

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
│ Mode    [off] [train] [active]      │
│ Members Halvar G., Einar R., Tova E.│
│         [a] add  [r] remove         │
│ Gear    weapon [axe ▾] armor [metal▾]│
│         ranged [□]                  │
│ Station (60,28,z31) [s] set [c]lear │
│ Patrol  none [p] set                │
│ Orders  [k] kill target [f] follow  │
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
