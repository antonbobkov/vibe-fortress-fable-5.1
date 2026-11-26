# T-789 — A tomb keeps its own coffins ready, so burial is one setting, not a chore per death

**Source:** playtest 7 ([report](../../reports/data/2026-11-26-playtest-7.md), finding 5); T-773 · **Size:** M · **Needs:** — · **Status:** open

## Why

T-773 made the unburied dead say why ("! 2 dead wait for burial and no coffin is free: build coffins [b > Furniture], best in a tomb [z]."). In a fortress of 60 to 80 that loses three to eight dwarves in a raid, the line is permanent. Burying the dead took three steps for each coffin. First I ordered coffins at the mason's: the Build list said "Coffin 1 coffin (no coffin)", and the line says "build", not "order". Then I placed each finished coffin by hand in a tomb. Then I made a new tomb when the old one was full. From Spring 13 to Summer 20 of Year 4 the count went 2, 10, 7, 4, 6, 7. In Spring, Year 5, it read "! 9 dead wait for burial and no coffin is free … (82 days)". Every Mood panel carried "-5 The dead lie unburied." Placing six coffins into a 3 × 4 tomb from the far end sealed four dwarves in among them (T-784-trapped-dwarf-says-so). The three-year script does this upkeep itself (`keepTheDead`); a player has to do it by hand for every death.

## What to do

Decisions taken here:

- **A tomb zone has a "Coffins ready" setting** (0 to the tiles it can hold, default 2), as a hospital has its supplies. While fewer free coffins stand in it, 14 places coffin items from stock on its free tiles. It fills the tiles nearest the zone's border with a walkable neighbour last, and never a tile whose filling would cut another of its tiles off from the door. While stock is short, 12 keeps one standing "Coffin" order at the nearest mason's or carpenter's, marked "for Tomb #1", as a hospital's supplies ask for cloth.
- **The burial line says the next step it needs:** "build" when coffins are in stock, "order" ("no coffin in stock: [o] order coffins, or set Tomb #1's coffins ready [z]") when none are.
- A body still waits when the tomb is full. Building a second tomb stays the player's work.

Decided while doing it:

- **"Ready" counts** a built coffin with no body and kept for anyone (`ownerId` 0), and a coffin placed in the tomb and not yet built, so a coffin on its way is not placed twice. The setting's key is `coffins ready` (stored `coffins_ready`), validated 0 to the tomb's tile count; `TOMB_COFFINS_READY` is 2 (*unmeasured*), a 14 constant.
- **Stock** is the available coffin items with no occupant less every coffin placed anywhere and not yet built (conservative: a coffin whose job reserved its item is counted twice, so a tomb places one fewer for a day). Tombs take stock in id order; what they lack after stock is `buildings.tombShortfalls()`.
- **The placement rule**, as `keepTheDead`'s `tombSite`, made general: the way in is the walkable ring around the tomb (its corners too: without them a tomb on open ground split its ring into eight parts and refused its second coffin) and the tomb's stairs; a tile is taken only when every other walkable tomb tile still joins the way in, the tomb and its way in fall into no more parts than before (so a tomb across a corridor never cuts it), and every coffin that had a walkable side keeps one; farthest from the way in first. It runs on `DayPassed`, after the rooms. A coffin the player places is the player's: "Sealed in with the dead" stays.
- **The standing order** is 12's, on `DayPassed`: one `once` order per short tomb, `forZoneId` on the `WorkOrder`, `remaining` following the shortfall each day, removed when the tomb is short of none. It goes to a recipe that makes the coffin item and burns no fuel (so never the forge's metal coffin), at the nearest built, unsuspended workshop whose order could start now, else the one whose recipe stock comes nearest to filling. An edited order stays the tomb's; a removed one comes back the next day while the tomb is short; `coffins ready` 0 ends it.
- **The burial line** gains three keys: `announce.unburied.order` ("… no coffin is free or in stock: [o] order coffins, or set Tomb #1's coffins ready [z].", naming the first tomb), `.order_no_tomb` ("… and zone a tomb [z] to keep them ready.") and `.few_order` ("… only 2 coffins are free and none in stock: [o] order 3 more."); all standing alerts. "In stock" is the available coffin items with no occupant.
- **The tomb inspector** shows "Coffins ready: 1 of 2" with `[-][+]` (and the `-`/`+` keys), the order kept for it ("2 coffins on order at Mason's workshop #1") and what the setting does; the Orders row reads "×2 Coffin for Tomb #1 · …".

## Done

- [x] The tomb's "Coffins ready" setting, the placement rule and the standing order; tests that a death is buried with no player action, and that a full tomb is never sealed.
- [x] The burial line's order/build wording; a UI test.
- [x] 14 § Burial, `panels.md` § Zones (tomb inspector) and 24's announcement table updated.
