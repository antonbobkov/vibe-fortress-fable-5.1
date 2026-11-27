# T-806 — The Thane wishes for more than deepfire and fine meals

**Closed:** 2026-11-27, in fe3fb889.

**Source:** playtest 9 ([report](../../../reports/data/2026-11-26-playtest-9.md), finding 5); playtest 7's event log · **Size:** M · **Needs:** — · **Status:** done: built and measured, not adopted

## Why

The Thane's whim is the game's only noble demand. Nobles and mandates are left out on purpose (`vision.md`, `scope.md`). A whim is drawn only from rows the fortress could make from what it has (10 § The Thane's whim). Of the eight rows (`whims.json`), an ordinary fortress can make two:

- **Playtest 7**, 23 seasons judged: "something strong" (deepfire) 17 times, "fine meals for everyone" 6 times, no other. 15 of 23 missed.
- **Playtest 9, fortress A**, 11 seasons: the same two. The Thane's log reads like a joke repeated ([10-log-thane.png](../../../reports/data/2026-11-26-playtest-9/10-log-thane.png)).
- The other six need what most maps never give: honey (mead), milk (cheese), ivory, feathers, glass or sand with a kiln (lantern), and a level-13 crafter (masterwork; see T-803-stone-for-the-crafters).
- **The deepfire is drunk.** A `stock` whim counts available units, and dwarves drink deepfire like any drink. In the browser game I ordered a distillation on Summer 19, Year 3. On Autumn 1 the Thane "wished for something strong, and did not get it", and the next wish read "4 of 10 deepfire in stock". In fortress A's census at Year 4, 10 dwarves held "Sang at the hearth. Everyone heard." (`drank_strong_drink`) while the whim read 0 of 10.

For a builder the Thane never asks for a room, a statue or an engraved hall, the things the builder is making.

## What to do

Decisions taken here:

- **Five builder's rows,** each possible by the same rule as the others:
  - `whim_statue_hall`: a statue of any material in the hearth hall (room, 1).
  - `whim_hall_tier`: the hearth hall one tier above its tier at the draw. This is a new kind, `tier`; met when the hall's tier at the judgement is at least that. It is possible when the hall is below Royal.
  - `whim_engraved_room`: the Thane's bedroom engraved: every smoothed tile in it engraved (kind `tier` on engraving, or a new kind `engraved`). It is possible when the Thane has a bedroom with smoothed tiles.
  - `whim_fine_furniture`: a table and chair of fine or better quality in the dining hall (room, 1 each).
  - `whim_superior`: any item of superior or better quality (stock, 1). It is possible with a dwarf whose top roll reaches 75 (level 7).
- **A whim's deepfire is the Thane's.** While a `stock` whim of drink stands, the units it counts (up to its `count`) are not drunk. They count as available for the judgement, and the units panel says "kept for the Thane". This is a small trade-off kept on purpose: the fortress goes without a barrel for a season.
- **The same row is not drawn twice in a row** while another is possible.

Decided while building it (the code is on branch `t806-t807-wip`, commit `934c7013`):

- **Two new kinds, `tier` and `engraved`.** A `tier` whim saves the tier wished for with the whim (`whim.target`), so the judgement and the Thane's line read the same tier the draw chose. An `engraved` whim counts the Thane's bedroom's floors and the walls on its border (14's `roomDiagnostics`, which now also counts engraved tiles): met when none is smoothed and unengraved and at least one is engraved. It is possible only while a smoothed tile is still unengraved, so a bedroom already engraved is never a free wish.
- **A `tier` whim needs the hearth built**, since the hall's tier is 0 without one and the wish would be for a hall that cannot exist.
- **The fine table and chair are one row** with a second type (`also: chair`), met by one of each, each of fine or better quality (the building's item). Fine is quality 2, possible from level 3; superior is 3, from level 7. A room row of a quality now checks the building's item quality.
- **The kept drink:** the drink search's barrels pass the whim's material by while its available units are no more than the whim's `count`. The units stay available stock (13's counts are unchanged), so the judgement counts them. The last resort of the search (alcohol in no barrel, when no barrel, well or water is reachable) still drinks it: thirst before the wish. It applies to any `stock` whim of a drink of a named material, so mead too.
- **The units panel says "kept for the Thane"** only while some of the drink is in stock.
- **No repeat:** the whim just judged is dropped from the possible rows when another is possible, before the one draw, so the stream draws the same number of values.
- "The Thane's deepfire is drunk" in `fun-features.md` would have become its trade-off, "The Thane's barrel".

## Measured

The three-year sweep (twenty seeds at shifts 0, 50, 100 and 150). The sweep's seed files count the whims drawn and judged (`test/perf/three_years_seeds.test.ts`, committed with T-807). The paired base is master `9a13599a`, the code under this branch (T-805 changes no simulation).

| Code | Run | Living at year 3 | Dwarf deaths | Need deaths | Whim rows drawn | Seasons met |
|---|---|---|---|---|---|---|
| master `9a13599a` (the base) | 45911220303 | 1139.75 | 108.5 | 0.25 | 2 (playtest 7) | about 35% (playtest 7: 8 of 23) |
| all of it: the rows, the kept drink, no repeat | 45929412665 | 1113.5 | 125.25 | 0.75 | 8 | 23.9% (167 of 698) |
| all of it, with T-807's sulk rule | 45929962747 | 1120 | 122.75 | 0.5 | 8 | |
| the rows and no repeat, without the kept drink | 45957870405 | 1115.5 | 121.75 | 1.25 | 8 | 23.9% |

The rows were drawn evenly (statue in the hall 134, deepfire 135, fine meals 125, fine table and chair 116, a grander hall 102, an engraved bedroom 91, superior work 57, featherbed 1, in the first sweep). Every variant is 13 to 17 deaths over the base, more than the 8 the rule allows, and the extra deaths are fighting deaths (killed and bled out), not thirst. The defence seeds passed (run 45929415331: 7.00 of 8 raids turned back, 3.19 dwarf deaths a seed).

## Outcome

**Not adopted.** Nothing of it is in the game: the rows, the kinds, the kept drink and the no-repeat rule all stay out, and so do their units-panel lines, which only these rules would show. What is kept is the count: the sweep's seed files now record the whims drawn, met and missed (with T-807's commit). Why a whim should cost lives is not known. Nothing reads a whim but `thane_pleased` (+3 to everyone for 72 hours) and `thane_grumbled`; the builder's rows are met less often than deepfire was (24% against about 35%), so the fortress is pleased less often, which may be enough to tip its fights, or the difference may be the timeline's noise three times over. The follow-up `T-813-builder-whims-without-deaths` takes it from here. "The Thane's deepfire is drunk" stays in `fun-features.md`, its call changed from fix to keep.

## Done

- [x] The five rows, the `tier` kind, the kept drink and the no-repeat rule built and tested (branch `t806-t807-wip`).
- [x] Measured over the three-year sweep (§ Measured): not adopted (§ Outcome), so no spec edit.
