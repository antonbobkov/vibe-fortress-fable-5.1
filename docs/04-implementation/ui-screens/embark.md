# Wireframe: Embark

**Owner:** `ui/screens/embark` · **Depends on:** [`../../02-systems/02-embark-and-loadout.md`](../../02-systems/02-embark-and-loadout.md), [`../../03-content/embark-catalog.md`](../../03-content/embark-catalog.md)

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ Embark at Greenhollow            [1] Dwarves   [2] Supplies   [3] Animals    [p] Presets │
├──────────────────────────────┬───────────────────────────────────────────────────────────┤
│ ▶ Ketil Ironvein       10/10 │ Ketil Ironvein                         [n] rename         │
│    Mining 5, Building 3 +1   │ Male · 34 years                        [r] reroll 25 ☼  │
│   Brynja Coldhammer     8/10 │ Str ▓▓▓▓░ 61  Agi ▓▓▓░░ 48  Tou ▓▓▓░░ 55  End ▓▓▓▓░ 63    │
│    Masonry 5, Mechanics 3    │ Wil ▓▓░░░ 40  Wit ▓▓▓░░ 52  Cha ▓▓▓░░ 47                  │
│   Orm Ashbrow          10/10 │ Stoic · Gregarious · Patient                              │
│    Farming 5, Brewing 5      │ ── Skills (points left: 0) ─────────────────── [/] find ─ │
│   Solveig Deephand     10/10 │ ▶ Animal care     [-] 0 [+]                               │
│    Cooking 5, Herbalism 3 +1 │   …                                                       │
│   Halvar Grimshield    10/10 │   Axe             [-] 2 [+]  ▓▓                           │
│    Medicine 4, Crossbow 3 +1 │   …                                                       │
│   Tova Emberheart       0/10 │   Building        [-] 3 [+]  ▓▓▓                          │
│    no skills yet             │   … (every skill offered at embark, A to Z, scrollable)   │
│ [Tab] list  [↑][↓] select  [+][-] points  [0] clear  [/] find skill                     │
├──────────────────────────────┴───────────────────────────────────────────────────────────┤
│ Fortress name [ Emberhall__________ ]        Budget 1,600 ☼   Spent 1,480   Left 120     │
│ [Enter] Embark   Unspent skill points: Tova Emberheart 10                [Esc] Back      │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

Each dwarf takes two lines in the party list: the name and points spent, then the dwarf's skills, highest first, as many as fit and a count of the rest ("Masonry 5, Mechanics 3 +1"), or "no skills yet". A party too long for two lines each takes one line each; the list scrolls.

Supplies tab:

```
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ /filter: [ __________ ]  Tools │ Food │ Drink │ Seeds │ Materials │ Furniture │ Chosen   │
│ ▶ Iron anvil              270 ☼  [-]  0 [+]                                              │
│   Iron axe                144 ☼  [-]  1 [+]  =  144                                      │
│   25 copper bolts          60 ☼  [-]  1 [+]  =   60                                      │
│   Crossbow                 36 ☼  [-]  1 [+]  =   36                                      │
│   Iron pick               108 ☼  [-]  2 [+]  =  216                                      │
│   Quiver                   22 ☼  [-]  1 [+]  =   22                                      │
│   …                                                                                      │
│ Hint: two picks and one axe are the minimum for a working start.                         │
│                                                                                          │
│ [←][→] group  [↑][↓] select  [+][-] count  [0] none  [/] find  [l] loadouts              │
```

On the supplies tab the hint turns over every `EMBARK_HINT_SECONDS` (5) of real time and on each tab change, between "Hint: two picks and one axe are the minimum for a working start." and "Hint: boars, wolves and bears come in the first season. Bring iron spears; clubs lose to boars."; it has two lines, so the longer one wraps whole at 80 columns. A selected entry's note or unavailable condition takes its place.

Attributes use up to five cells, filled with `floor(value × barCells / ATTRIBUTE_MAX)`; skill bars use one cell per level. Supply groups and animal notes come from the catalog's `category` and `note`; an entry whose temperature condition fails is dim and shows that condition.

Animals tab: rows `species · sex · price · [-] n [+]`, with a note line for species needing pasture or nest boxes. The `max` per entry disables `[+]` at the limit.

Presets menu (`p`): Balanced, Farmstead, Miner's Guild, Warband, each with its total and a one-line description, the main skill of each of its dwarves (the highest; on a tie the one the preset names first), a skill shared by several counted once ("Balanced 1,480 ☼ Mining x2·Woodcutting·Masonry·Farming·Cooking·Medicine"). The menu opens on the preset the loadout started from and is at most `EMBARK_PRESETS_WIDTH` cells wide (24 § Tuning constants). Choosing replaces skills and supplies after a confirm if anything was edited. Its last option, "Saved loadouts…" with the number saved, opens the saved loadouts panel.

## Finding things

- **The keys line.** The body's last line names each tab's keys: `[Tab] list  [↑][↓] select  [+][-] points  [0] clear  [/] find skill` on Dwarves, `[←][→] group  [↑][↓] select  [+][-] count  [0] none  [/] find  [l] loadouts` on Supplies, `[↑][↓] select  [+][-] count  [0] none  [/] find` on Animals. A key that did nothing says why on that line until the next key or click: "No skill points left for {name}: lower another skill first.", "{skill} is at most 5 at embark.", "At most {max} of {entry} at embark."
- **Finding a supply or an animal.** `/` (on Supplies or Animals) starts a new find in the `/filter:` field on Supplies; each typed word must appear in an entry's name or its group's name, in any order and case ("thread", "war dog", "seeds"). A find lists matches from every group, animals too, group by group, each line naming its group after its cost; no group is marked in the bar while a find is in use. `Enter`, `Tab`, `↑` or `↓` hand the keys back to the list with the find kept; `Esc` in the field, or on the list while a find is in use, empties it; choosing a group ends it. With no match the list reads "Nothing matches "{text}".".
- **Finding a skill.** On Dwarves, `/` starts a find over the skill list, in a field at the right end of the skills rule (a `[/] find` caption until it is in use); it works as the supplies find over skill names. On the Items tab of testing mode, `/` is the same find over the selected field's choices (§ Testing mode). So `/` finds on every tab, and `Esc` empties a find before it leaves the screen.
- **The chosen lines.** The supplies bar ends with Chosen, every line with a count, supplies and animals, group by group, each naming its group, to review and trim the whole loadout in one place; "Nothing chosen yet." when empty. `←` `→` cycle the groups and Chosen, wrapping.
- **Quantities.** `+` `-` (and `=`) step the selected skill or line by one; `0` sets it to none. A click on `[-]` or `[+]` does the same; a control at its bound is dim.
- **Scrolling.** The mouse wheel scrolls the list under the pointer by `EMBARK_WHEEL_ROWS` (3) rows a notch, keeping the selection in view, so every skill is within reach of the mouse at 80 × 50 cells. `PageUp` `PageDown` move the selection a page.
- **Leaving.** `Esc` (or the Back button) after any edit asks "Go back to the world map? The skills and supplies you have set here are lost." (`c_leave_embark`, default No); with no edits it goes back at once.

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

- Rows are the saved loadouts by name, each with what it costs at today's prices; one that costs more than this site's budget says "over budget", and a testing loadout (02 § Testing mode) says "testing". `↑` `↓` select, a click selects and a click on the selected row loads it. With none saved the list reads "No saved loadouts yet: [s] saves the current one."
- `s` asks for a name in the `text_input` dialog, "Loadout 1" (the first number not taken) by default; a taken name asks `c_overwrite_loadout`. `Enter` loads the selected loadout (after `c_load_loadout` when anything was edited), `n` renames it (a taken name is refused and the panel says so), `x` deletes it after `c_delete_loadout`, `Esc` closes the panel.
- The line above the captions says what the last action did. After a load it lists what was left out or lowered ("No longer in the game, left out: …", "Not offered here, left out: …", "Lowered to the limit: …", "Skills for 2 more dwarves than the party were left out.") and, when the loadout is over this site's budget, "It costs 1,620 ☼, 120 ☼ over the budget here: trim it to embark." The footer's budget line and the Embark reason show the same overspend until it is trimmed.

Validation display: the Embark button is dim with a reason line when over budget ("Over budget by 44 ☼"), when a dwarf has more than 10 points, or when the name is empty. With no reason, the line names the dwarves with points left, which are lost at embark ("Unspent skill points: Tova Emberheart 10, Orm Ashbrow 2"). Over budget, the budget line reads "Budget 1,500 ☼   Spent 1,544   Over 44" in red. Embarking with no pick, no axe, no food item or no drink item asks first, one question for each, in that order ("Embark without a pick?", "Embark without an axe?", "Embark with no food?", "Embark with no drink?"; confirmations `c_embark_no_pick`, `c_embark_no_axe`, `c_embark_no_food`, `c_embark_no_drink`, default No).

At 80 columns the header reduces tab and preset spacing so every caption and its mouse target fits. The reroll caption is `[r] reroll 25 ☼`. Budget, Spent and Left (or Over) align against the right edge, never over the name field; when they would not fit, the gaps between them close to one space, so their digits are never clipped. The supplies bar's separators close to `│` when the spaced bar would not fit. The party list's skills line, the keys lines and the presets menu fit 80 columns whole. Attribute bars use up to five cells, reducing their width when necessary to preserve the complete attribute numbers and spacing.

## Testing mode

The bottom line is the switch: `[t] Testing mode: off` with "For trying features: no budget, any dwarves and items." in dim; on, `[t] Testing mode: ON` with "No budget or limits. The fortress is marked as testing." in the bad colour; both fit 80 columns whole, and the title reads "Embark at Greenhollow (testing)" in the same colour. The presets menu lists "Testing fortress" after the four normal presets, with "testing" for its total (02 § Testing mode).

In testing mode the footer reads "Budget unlimited (testing)   Spent 1,480" and names no unspent points; the Dwarves list shows each dwarf's points with no limit, scrolls, and keeps its last row above the keys line for `[a] add dwarf  [x] remove`; the skill list holds every skill, to 20, under "Skills (testing: up to 20)", and its keys line reads `[Tab] list  [+][-] level  [0] clear  [*] to every dwarf  [/] find skill`, where `*` gives every dwarf the selected dwarf's level of the selected skill. Supplies and Animals ignore `max` and temperature conditions; `+` and `-` step by 1 to 10, by 10 to 100 and by 100 beyond, to 999.

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

`↑` `↓` (or the wheel) move through the form's rows and then the lines; `←` `→` (or `+` `-`, or a click on `◄` `►`) change the selected row: the item (every `items` row, by name), the material (those that suit the item first, then the rest, marked "(unusual)"), the quality (poor to masterwork), the stone of a wand or a staff ("garnet · Emberbolt") or the enchantment of a weapon, armor piece or ammunition ("of blaze · ruby"), labelled Stone or Enchant by the item, and the count. `/` starts the same find as on the other tabs, here over the selected row's choices: typing narrows them to those whose name holds the text and moves the row to the first of them; `Esc` empties it; moving to another row clears it. `[a]` adds the line (a line of the same kind grows instead); on a line, `+` `-` change its count and `[x]`, `x` or `0` removes it.
