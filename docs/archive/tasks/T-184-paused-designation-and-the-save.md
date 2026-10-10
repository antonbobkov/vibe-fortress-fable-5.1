# T-184 — A save taken while paused after a designation plays like the unsaved game

Closed by `T-184: preserve paused terrain notifications across save and load`.

**Source:** T-115 and its report, [`../../../reports/audits/2026-10-09-bug-hunt-spec-reading.md`](../../../reports/audits/2026-10-09-bug-hunt-spec-reading.md) (bug 20, G18) · **Size:** M · **Needs:** — · **Status:** open

## Why

A designation applied while the game is paused, followed by a save before any tick runs, gives a save that does not play like the game it was taken from. The hashes are equal at the save. From the next tick the unsaved game has the designated tiles in 07's `pendingBare` and `bodiesStale: true` in 09, and the loaded game has neither. In a small world the two stayed different for all 600 ticks compared; in a busy one for 811 ticks, after which they were equal. No effect on play was seen. The fault is the one of T-174: `core_save_roundtrip` promises an identical hash, and after this the hash proves nothing.

Planning while paused and then saving is ordinary play.

## Reproduction

[`pausedevents.probe.ts`](../../../reports/data/2026-10-09-bug-hunt-pausedevents.probe.ts.txt): flat-test, default embark, 700 ticks; `Designate { kind: 'channel' }` on two tiles through `world.submit` and `world.commandPhase(true)`; `roundTrip`; step both and compare after every tick. `SetAlert`, `CreateZone`, `PlaceBuilding`, `SetLabor` and `CreateSquad` in the same harness stay equal on every tick, and their queued events are in the save. [`save2.probe.ts`](../../../reports/data/2026-10-09-bug-hunt-save2.probe.ts.txt), test "paused", is the busy case.

**The cause is not established.** Something the designation leaves for the end of its tick reaches 07 and 09 as changed tiles in the unsaved game and is not in the save. It is not the event queue.

## What to do

**Decision.** The save carries everything a paused command leaves behind, so the rule is in `save-format.md` and the code follows it. The alternative, flushing the pending work when saving, would make a paused save differ from the unsaved game at the save itself and is rejected for the reason `save-format.md` already gives for connectivity ("without advancing … while saving or loading").

1. Find what is not saved. Start from what makes 07 push to `pendingBare` (`src/systems/plants/index.ts:449`, `:486`) and 09 set `bodiesStale` one tick after a paused `Designate`: most likely the map's or 03's list of tiles changed since the last dispatch.
2. Write it into `save-format.md` beside the paragraph on `pendingConnectivity`, and into `system-state.md` for the system that owns it. A save without the field loads as today.
3. Implement the field in that system's `serialize` and `deserialize`.
4. Tests, `describe('T-184 …')`: for every command of the catalog that the fuzz of the first report could get accepted, apply it while paused, save, load, and compare the hash after each of the next 50 ticks. Add the paused designation to `core_save_roundtrip`.

## Done

- The tests pass. If step 4 finds other commands with the same fault, they are fixed here or get a row.
