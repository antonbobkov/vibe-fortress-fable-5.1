# T-NEW — A tomb keeps its own coffins ready, so burial is one setting, not a chore per death

**Source:** playtest 7 ([report](../../reports/data/2026-11-26-playtest-7.md), finding 5); T-773 · **Size:** M · **Needs:** — · **Status:** open

## Why

T-773 made the unburied dead say why ("! 2 dead wait for burial and no coffin is free: build coffins [b > Furniture], best in a tomb [z]."). In a fortress of 60 to 80 that loses three to eight dwarves in a raid, the line is permanent. Burying the dead took three steps for each coffin. First I ordered coffins at the mason's: the Build list said "Coffin 1 coffin (no coffin)", and the line says "build", not "order". Then I placed each finished coffin by hand in a tomb. Then I made a new tomb when the old one was full. From Spring 13 to Summer 20 of Year 4 the count went 2, 10, 7, 4, 6, 7. In Spring, Year 5, it read "! 9 dead wait for burial and no coffin is free … (82 days)". Every Mood panel carried "-5 The dead lie unburied." Placing six coffins into a 3 × 4 tomb from the far end sealed four dwarves in among them (T-NEW-trapped-dwarf-says-so). The three-year script does this upkeep itself (`keepTheDead`); a player has to do it by hand for every death.

## What to do

Decisions taken here:

- **A tomb zone has a "Coffins ready" setting** (0 to the tiles it can hold, default 2), as a hospital has its supplies. While fewer free coffins stand in it, 14 places coffin items from stock on its free tiles. It fills the tiles nearest the zone's border with a walkable neighbour last, and never a tile whose filling would cut another of its tiles off from the door. While stock is short, 12 keeps one standing "Coffin" order at the nearest mason's or carpenter's, marked "for Tomb #1", as a hospital's supplies ask for cloth.
- **The burial line says the next step it needs:** "build" when coffins are in stock, "order" ("no coffin in stock: [o] order coffins, or set Tomb #1's coffins ready [z]") when none are.
- A body still waits when the tomb is full. Building a second tomb stays the player's work.

## Done

- [ ] The tomb's "Coffins ready" setting, the placement rule and the standing order; tests that a death is buried with no player action, and that a full tomb is never sealed.
- [ ] The burial line's order/build wording; a UI test.
- [ ] 14 § Burial, `panels.md` § Zones (tomb inspector) and 24's announcement table updated.
