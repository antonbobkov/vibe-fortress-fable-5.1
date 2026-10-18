# T-NEW — The hauling pass over a returned `noHome` set costs a quarter of a second with 25,000 loose items

**Source:** T-390 (2026-10-18), measured on the reference fortress with its 25,000 items loose, on a quiet machine, after the re-equip pass of 16 stopped scanning every item per slot: the worst tick of a 2,000-tick run fell from 0.72 to 0.79 s to 0.23 to 0.26 s, and what is left is one tick in system 13 (tick 269,632 of the fixture; 86 ms at tick 269,502) · **Size:** S · **Needs:** — · **Status:** open

## Why

`Hauling.tick` (`src/systems/items/hauling.ts`) walks the `wants` set once per tick. When a stockpile gains a slot or changes, `noHome` returns to `wants` (`slotsGained`, `stockpileChanged`, the `StockpileFull` handling), and with 25,000 items that find no home the pass visits each of them: `wantsHauling`, `bestFor` (`store.accepts` per stockpile) and then, for an item with no home, `leaveWants(id)` plus `sortedInsert(this.noHome, id)`. Both of those are `splice` calls on a sorted array of up to 25,000 ids, so the pass costs about two memmoves of half the set per item: timing the parts of the tick gave `leaveWants` about 85 ms, `store.accepts` about 90 ms and `slotFor` about 35 ms of the 230 to 330 ms (the wrapper adds some). The answer the pass needs is cheap: the items stay in a set, in the same order.

## What to do

- Make the pass cost what its answer needs: no `splice` per item (apply the removals from `wants` and the insertions into `noHome` once per pass, or keep the sets in a structure with the same ascending iteration order), and `accepts` read once per kind of item and stockpile where nothing it reads has changed. The behaviour must not change: the same haul jobs on the same ticks, so the instrument hashes (the annual instrument, the reference fortress's world hash after 2,000 ticks) are identical.
- Mind what reads `wants` and `noHome` during the pass (`wantsDecanting`, `examine`, `onChange` through the job creation): a deferred insertion must still be seen by them.
- Report the reference fortress's worst tick afterwards.

## Done

- The worst tick of the loose-items reference fortress in a 2,000-tick run is under 100 ms on a quiet machine; the hashes are identical; gates as for a simulation change.
