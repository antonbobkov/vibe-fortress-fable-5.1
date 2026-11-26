# T-789 — A tomb keeps its own coffins ready, so burial is one setting, not a chore per death

**Closed:** 2026-11-26, in ef4daff2, a6f5e62a.

**Source:** playtest 7 ([report](../../../reports/data/2026-11-26-playtest-7.md), finding 5); T-773 · **Size:** M · **Needs:** — · **Status:** open

## Why

T-773 made the unburied dead say why ("! 2 dead wait for burial and no coffin is free: build coffins [b > Furniture], best in a tomb [z]."). In a fortress of 60 to 80 that loses three to eight dwarves in a raid, the line is permanent. Burying the dead took three steps for each coffin. First I ordered coffins at the mason's: the Build list said "Coffin 1 coffin (no coffin)", and the line says "build", not "order". Then I placed each finished coffin by hand in a tomb. Then I made a new tomb when the old one was full. From Spring 13 to Summer 20 of Year 4 the count went 2, 10, 7, 4, 6, 7. In Spring, Year 5, it read "! 9 dead wait for burial and no coffin is free … (82 days)". Every Mood panel carried "-5 The dead lie unburied." Placing six coffins into a 3 × 4 tomb from the far end sealed four dwarves in among them (T-784-trapped-dwarf-says-so). The three-year script does this upkeep itself (`keepTheDead`); a player has to do it by hand for every death.

## What to do

Decisions taken here:

- **A tomb zone has a "Coffins ready" setting** (0 to the tiles it can hold, default 2), as a hospital has its supplies. While fewer free coffins stand in it, 14 places coffin items from stock on its free tiles. It fills the tiles nearest the zone's border with a walkable neighbour last, and never a tile whose filling would cut another of its tiles off from the door. While stock is short, 12 keeps one standing "Coffin" order at the nearest mason's or carpenter's, marked "for Tomb #1", as a hospital's supplies ask for cloth.
- **The burial line says the next step it needs:** "build" when coffins are in stock, "order" ("no coffin in stock: [o] order coffins, or set Tomb #1's coffins ready [z]") when none are.
- A body still waits when the tomb is full. Building a second tomb stays the player's work.

Decided while doing it:

- **The coffins-ready rule was built, measured and not adopted.** The setting, the placement rule and 12's standing order (all below) ran in `ef4daff2`. The twenty-seed sweep of that commit (run 45831376281, shifts 0/50/100/150) pooled living 1147.75 and deaths 121.5 (by shift: 1141/127, 1171/104, 1181/102, 1098/153), a pass against the bounds (living ≥ 1046.63, deaths ≤ 132.5) but 11.5 deaths over master's ~110, beyond the ~8 this task allowed; the p4 seeds lost most (p4-1 30 and p4-3 34 deaths at shift 150). `defence_seeds` (run 45831381638) passed: 7.13 raids turned back and 6.13 soldier kills of 8 (rules ≥ 5, ≥ 4). The rule is taken out, so no world hash moves; the design and its figures go to a follow-up ([T-795-tomb-coffins-ready](../../work/T-795-tomb-coffins-ready.md)).
- **What stays is the burial line**, three more keys, all standing alerts: `announce.unburied.order` ("… no coffin is free or in stock: [o] order coffins, then build them in Tomb #1 [b > Furniture].", naming the first tomb), `.order_no_tomb` ("… and zone a tomb [z] for them.") and `.few_order` ("… only 2 coffins are free and none in stock: [o] order 3 more."). "In stock" is the available coffin items with no occupant. With the setting gone, the order line names the tomb to build in rather than a setting to raise.

The design that was measured (for the follow-up):

- "Ready" counted a built coffin with no body kept for anyone, and a coffin placed in the tomb and not yet built. The setting `coffins ready` (0 to the tomb's tiles), default `TOMB_COFFINS_READY` 2.
- Stock was the available coffin items with no occupant less every coffin placed and not yet built; tombs took stock in id order.
- Placement, on `DayPassed`: the way in is the walkable ring around the tomb (corners too) and its stairs; a tile is taken only when every other walkable tomb tile still joins the way in, the tomb and its way in fall into no more parts than before, and every coffin keeps a walkable side; farthest from the way in first.
- 12 kept one `once` order per short tomb (`forZoneId`), at the nearest built, unsuspended workshop with a fuel-free coffin recipe whose order could start, `remaining` following the shortfall.

## Done

- [x] The tomb's "Coffins ready" setting, the placement rule and the standing order; tests that a death is buried with no player action, and that a full tomb is never sealed. (Built and tested in `ef4daff2`; measured and taken out, see above.)
- [x] The burial line's order/build wording; a UI test.
- [x] 15's unburied line and 24's standing alerts updated; 14 § Burial and `panels.md` § Zones are unchanged, since the rule is not adopted.
