# Wireframe: Embark

**Owner:** `ui/screens/embark` · **Depends on:** [`../../02-systems/02-embark-and-loadout.md`](../../02-systems/02-embark-and-loadout.md), [`../../03-content/embark-catalog.md`](../../03-content/embark-catalog.md)

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ Embark at Greenhollow            [1] Dwarves   [2] Supplies   [3] Animals    [p] Presets │
├──────────────────────────────┬───────────────────────────────────────────────────────────┤
│ ▶ Ketil Ironvein     10/10   │ Ketil Ironvein                         [n] rename         │
│   Brynja Coldhammer   8/10   │ Male · 34 years                        [r] reroll 25 ☼  │
│   Orm Ashbrow        10/10   │ Str ▓▓▓▓░ 61  Agi ▓▓▓░░ 48  Tou ▓▓▓░░ 55  End ▓▓▓▓░ 63    │
│   Solveig Deephand   10/10   │ Wil ▓▓░░░ 40  Wit ▓▓▓░░ 52  Cha ▓▓▓░░ 47                  │
│   Halvar Grimshield  10/10   │ Stoic · Gregarious · Patient                              │
│   Tova Emberheart     4/10   │ ── Skills (points left: 0) ────────────────────────────── │
│   Einar Ravensong    10/10   │ ▶ Mining          [-] 5 [+]  ▓▓▓▓▓                        │
│                              │   Building        [-] 3 [+]  ▓▓▓                          │
│                              │   Axe             [-] 2 [+]  ▓▓                           │
│                              │   Carpentry       [-] 0 [+]                               │
│                              │   Masonry         [-] 0 [+]                               │
│                              │   … (all civilian and combat skills, scrollable)          │
├──────────────────────────────┴───────────────────────────────────────────────────────────┤
│ Fortress name [ Emberhall__________ ]        Budget 1,600 ☼   Spent 1,480   Left 120     │
│ [Enter] Embark                                                          [Esc] Back      │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

Supplies tab:

```
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ /filter: ______        Tools │ Food │ Drink │ Seeds │ Materials │ Furniture              │
│ ▶ Iron pick               108 ☼   [-] 2 [+]   = 216                                      │
│   Copper pick              72 ☼   [-] 0 [+]                                              │
│   Iron axe                144 ☼   [-] 1 [+]   = 144                                      │
│   Crossbow                 36 ☼   [-] 1 [+]   =  36                                      │
│   25 copper bolts          60 ☼   [-] 1 [+]   =  60                                      │
│   Quiver                   22 ☼   [-] 1 [+]   =  22                                      │
│   Iron anvil              270 ☼   [-] 0 [+]                                              │
│   …                                                                                      │
│ Hint: two picks and one axe are the minimum for a working start.                        │
```

On the supplies tab the hint line turns over every `EMBARK_HINT_SECONDS` (5) of real time and on each tab change, between "Hint: two picks and one axe are the minimum for a working start." and "Hint: boars, wolves and bears come in the first season. Bring iron spears; clubs lose to boars."

Attributes use up to five cells, filled with `floor(value × barCells / ATTRIBUTE_MAX)`; skill bars use one cell per level. Supply groups and animal notes come from the catalog's `category` and `note`; an entry whose temperature condition fails is dim and shows that condition.

Animals tab: rows `species · sex · price · [-] n [+]`, with a note line for species needing pasture or nest boxes. The `max` per entry disables `[+]` at the limit.

Presets menu (`p`): Balanced, Miner's Guild, Farmstead, Warband, each with its one-line description and total; choosing replaces skills and supplies after a confirm if anything was edited. Its last option, "Saved loadouts…" with the number saved, opens the saved loadouts panel.

## Saved loadouts

`l`, or the presets menu's last option, opens the saved loadouts panel over the body (`02` § Loadouts). It is modal: while it is open it takes every key, and a click outside it closes it.

```
│  Saved loadouts                                                                         │
│  ▶ Deep start                          1,620 ☼  over budget                             │
│    Farm start                          1,210 ☼                                          │
│                                                                                         │
│  Loaded Deep start. It costs 1,620 ☼, 120 ☼ over the budget here: trim it to embark.   │
│  [s] Save current  [Enter] Load  [n] Rename  [x] Delete  [Esc] Close                   │
```

- Rows are the saved loadouts by name, each with what it costs at today's prices; one that costs more than this site's budget says "over budget". `↑` `↓` select, a click selects and a click on the selected row loads it. With none saved the list reads "No saved loadouts yet: [s] saves the current one."
- `s` asks for a name in the `text_input` dialog, "Loadout 1" (the first number not taken) by default; a taken name asks `c_overwrite_loadout`. `Enter` loads the selected loadout (after `c_load_loadout` when anything was edited), `n` renames it (a taken name is refused and the panel says so), `x` deletes it after `c_delete_loadout`, `Esc` closes the panel.
- The line above the captions says what the last action did. After a load it lists what was left out or lowered ("No longer in the game, left out: …", "Not offered here, left out: …", "Lowered to the limit: …", "Skills for 2 more dwarves than the party were left out.") and, when the loadout is over this site's budget, "It costs 1,620 ☼, 120 ☼ over the budget here: trim it to embark." The footer's budget line and the Embark reason show the same overspend until it is trimmed.

Validation display: the Embark button is dim with a reason line when over budget ("Over budget by 44 ☼"), when a dwarf has more than 10 points, or when the name is empty. Embarking with no pick, no axe, no food item or no drink item asks first, one question for each, in that order ("Embark without a pick?", "Embark without an axe?", "Embark with no food?", "Embark with no drink?"; confirmations `c_embark_no_pick`, `c_embark_no_axe`, `c_embark_no_food`, `c_embark_no_drink`, default No).

At 80 columns the header reduces tab and preset spacing so every caption and its mouse target fits. The reroll caption is `[r] reroll 25 ☼`. Budget, Spent and Left align against the right edge; their digits are never clipped. Attribute bars use up to five cells, reducing their width when necessary to preserve the complete attribute numbers and spacing.
