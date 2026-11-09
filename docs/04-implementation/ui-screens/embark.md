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

Presets menu (`p`): Balanced, Miner's Guild, Farmstead, Warband, each with its one-line description and total; choosing replaces skills and supplies after a confirm if anything was edited.

Validation display: the Embark button is dim with a reason line when over budget ("Over budget by 44 ☼"), when a dwarf has more than 10 points, or when the name is empty. Embarking with no pick, no axe, no food item or no drink item asks first, one question for each, in that order ("Embark without a pick?", "Embark without an axe?", "Embark with no food?", "Embark with no drink?"; confirmations `c_embark_no_pick`, `c_embark_no_axe`, `c_embark_no_food`, `c_embark_no_drink`, default No).

At 80 columns the header reduces tab and preset spacing so every caption and its mouse target fits. The reroll caption is `[r] reroll 25 ☼`. Budget, Spent and Left align against the right edge; their digits are never clipped. Attribute bars use up to five cells, reducing their width when necessary to preserve the complete attribute numbers and spacing.

## Testing mode

The bottom line is the switch: `[t] Testing mode: off` with "For trying features: no budget, any dwarves, skills, items." in dim; on, `[t] Testing mode: ON` with "No budget; any dwarves, skills and items. Marked as testing." in the bad colour, and the title reads "Embark at Greenhollow (testing)" in the same colour. The presets menu lists "Testing fortress" after the four normal presets, with "testing" for its total (02 § Testing mode).

In testing mode the footer reads "Budget unlimited (testing)   Spent 1,480"; the Dwarves list shows each dwarf's points with no limit, scrolls, and keeps its last row for `[a] add dwarf  [x] remove`; the skill list holds every skill, to 20, under "Skills (testing: up to 20; [*] every dwarf)", where `*` gives every dwarf the selected dwarf's level of the selected skill. Supplies and Animals ignore `max` and temperature conditions; `+` and `-` step by 1 to 10, by 10 to 100 and by 100 beyond, to 999.

Items tab (`4`, testing mode only):

```
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ /filter: [ __________Any item in any material. ←→ change, [a] add, [x] remove.          │
│ ─── New item ─────────────────────────────────────────────────────────────────────────── │
│   Item       ◄ staff ►                                                                   │
│   Material   ◄ steel ►                                                                   │
│   Quality    ◄ superior ►                                                                │
│   Stone      ◄ garnet · Emberbolt ►                                                      │
│ ▶ Count      [-]   3 [+]   [a] add                                                       │
│ ─── Items to bring (1 lines) ─────────────────────────────────────────────────────────── │
│   3 x superior steel staff · garnet (Emberbolt)              [-]   3 [+] [x]             │
```

`↑` `↓` move through the form's rows and then the lines; `←` `→` (or `+` `-`, or a click on `◄` `►`) change the selected row: the item (every `items` row, by name), the material (those that suit the item first, then the rest, marked "(unusual)"), the quality (poor to masterwork), the stone of a wand or a staff ("garnet · Emberbolt") or the enchantment of a weapon, armor piece or ammunition ("of blaze · ruby"), labelled Stone or Enchant by the item, and the count. `/` starts an empty filter for the selected row: typing narrows its choices to those whose name holds the text and moves the row to the first of them; moving to another row clears it. `[a]` adds the line (a line of the same kind grows instead); on a line, `+` `-` change its count and `[x]` or `x` removes it.
