# T-806 — The Thane wishes for more than deepfire and fine meals

**Source:** playtest 9 ([report](../../reports/data/2026-11-26-playtest-9.md), finding 5); playtest 7's event log · **Size:** M · **Needs:** — · **Status:** open

## Why

The Thane's whim is the game's only noble demand. Nobles and mandates are left out on purpose (`vision.md`, `scope.md`). A whim is drawn only from rows the fortress could make from what it has (10 § The Thane's whim). Of the eight rows (`whims.json`), an ordinary fortress can make two:

- **Playtest 7**, 23 seasons judged: "something strong" (deepfire) 17 times, "fine meals for everyone" 6 times, no other. 15 of 23 missed.
- **Playtest 9, fortress A**, 11 seasons: the same two. The Thane's log reads like a joke repeated ([10-log-thane.png](../../reports/data/2026-11-26-playtest-9/10-log-thane.png)).
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

Decided while doing it:

- **Two new kinds, `tier` and `engraved`.** A `tier` whim saves the tier wished for with the whim (`whim.target`), so the judgement and the Thane's line read the same tier the draw chose. An `engraved` whim counts the Thane's bedroom's floors and the walls on its border (14's `roomDiagnostics`, which now also counts engraved tiles): met when none is smoothed and unengraved and at least one is engraved. It is possible only while a smoothed tile is still unengraved, so a bedroom already engraved is never a free wish.
- **A `tier` whim needs the hearth built**, since the hall's tier is 0 without one and the wish would be for a hall that cannot exist.
- **The fine table and chair are one row** with a second type (`also: chair`), met by one of each, each of fine or better quality (the building's item). Fine is quality 2, possible from level 3; superior is 3, from level 7. A room row of a quality now checks the building's item quality.
- **The kept drink:** the drink search's barrels pass the whim's material by while its available units are no more than the whim's `count`. The units stay available stock (13's counts are unchanged), so the judgement counts them. The last resort of the search (alcohol in no barrel, when no barrel, well or water is reachable) still drinks it: thirst before the wish. It applies to any `stock` whim of a drink of a named material, so mead too.
- **The units panel says "kept for the Thane"** only while some of the drink is in stock.
- **No repeat:** the whim just judged is dropped from the possible rows when another is possible, before the one draw, so the stream draws the same number of values.
- "The Thane's deepfire is drunk" in `fun-features.md` is replaced by its trade-off, "The Thane's barrel" (kept, removable).

## Done

- [x] The five rows in `personality-and-thoughts.md` § Whims and `whims.json`; the `tier` kind in 10 § The Thane's whim; tests for each row's possibility and judgement (`test/unit/t806-thane-wishes-for-the-hall.test.ts`).
- [x] The drink kept for a standing whim; 10 § Eating and drinking and 13's availability rule updated; a test.
- [x] No repeat while another row is possible; a test on the draw.
- [x] Measured over the three-year sweep (§ Measured).
