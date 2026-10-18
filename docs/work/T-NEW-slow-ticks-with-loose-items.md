# T-NEW — Two kinds of slow tick remain in the reference fortress with its 25,000 items loose

**Source:** T-383 (2026-10-18), measured on the reference fortress with its items loose, 2,000 ticks after T-383 (a busy machine; the worst tick fell from 42 s to 2 s and the average from 72 ms to 17 ms) · **Size:** M · **Needs:** — · **Status:** open

## Why

After T-383 the worst ticks of the loose-items fortress are of two kinds, found by timing each system and each event handler on the ticks over 150 ms:

1. **16 combat handles `ItemCreated` with `reequipAllSquads`** (`src/systems/combat/index.ts`, `handle`), once per tick in which any item was created: 700 to 800 ms a tick with 26,000 items, on about one tick in a hundred. Nothing about a created item needs every squad to look through all the stock again; the same pass runs every `REEQUIP_CHECK_DAYS` and when a squad's members change.
2. **13 items takes 150 to 340 ms on about one tick in thirty** in the same stretch (ticks 269,532 to 269,640 of the fixture). Not diagnosed: haul planning after T-344 and T-384 should be quiet with items that nobody hauls, so it is a pass that visits the loose items (the wants set, the `noHome` set, `StockpileFull` handling, or the container requests).

## What to do

- For 1: decide what an `ItemCreated` must trigger (a weapon or armor row for a squad's preferences, only for the squads that miss that slot) and make the handler do that, with the same equipment as before; show it by the squads' equipment hashes.
- For 2: profile the tick (wrap `Hauling.tick`'s parts), name the pass, and make it cost what its answer needs.
- Report the reference fortress's worst tick afterwards; the target is under 300 ms.

## Done

- No tick of the loose-items reference fortress takes more than 300 ms in a 2,000-tick run; gates as for a simulation change.
