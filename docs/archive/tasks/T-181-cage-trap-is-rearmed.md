# T-181 — A sprung cage trap is re-armed

Closed by `T-181: a sprung cage trap is re-armed with an unoccupied cage`.

**Source:** T-115 and its report, [`../../reports/audits/2026-10-09-bug-hunt-spec-reading.md`](../../../reports/audits/2026-10-09-bug-hunt-spec-reading.md) (bug 17, G14) · **Size:** S · **Needs:** — · **Status:** open

## Why

After its first catch a cage trap stays `spent` for ever. The `rearm_trap` job asks for `{ types: [cage], emptyContainer: 'cage' }`. `emptyContainer` needs a `Container` component of that class, and a cage has none: its occupant is kept in `Item.occupantId`. So no cage ever matches, with spare cages lying beside the trap.

## Reproduction

[`cagetrap.probe.ts`](../../../reports/data/2026-10-09-bug-hunt-cagetrap.probe.ts.txt): a cage trap and a stone-fall trap are sprung by a trollkin each; a spare cage, a spare stone and two mechanics are added. The stone-fall trap is re-armed within a day. The cage trap's job is `blocked: missing_input` after ten days. `countAvailable({ emptyContainer: 'cage' })` is 0; `countAvailable({ type: cage })` is 2, one of them the occupied cage.

Read: `src/systems/defense/index.ts:175`; `src/systems/items/search.ts:95–98`; the `cage` row of `src/content/items.json` (no `containerClass`).

## What to do

**Decision.** A cage is not an item container, and 13 § Concepts is wrong to list it as one: a container holds items, and `Container.contents` is a list of item ids. Keep the occupant in `Item.occupantId` and give the search a way to ask for an unoccupied cage.

1. **13 § Concepts:** take `cage` out of the container classes and say in one sentence that a cage holds one creature, named by the cage item's `occupantId`. **13 § Searching:** add the filter field `unoccupied` (the item has no occupant).
2. **Every search that may take a cage as material asks for an unoccupied one:** the `rearm_trap` input, the build inputs of `cage_trap` and of the `cage` building, a `MoveToDepot` of a cage only by the player's explicit choice (20 already values the creature). An occupied cage is also not `available` in the stock counts (13 § Stock counts; this is G8's cage half).
3. Implement: `ItemFilter.unoccupied` in `src/systems/items/search.ts` (`matches`), `src/systems/defense/index.ts:175`, the build input filter of 14 for a cage, and `isAvailable` for a cage with an occupant.
4. Tests, `describe('T-181 …')`: the probe's scenario ends with `TrapRearmed` for the cage trap and the spare cage installed; with only the occupied cage on the map the job stays `missing_input` and the occupied cage is not touched. Extend scenario `df_cage` with the re-arm.

## Done

- The tests pass; `TrapRearmed` for a cage trap is exercised (an item of T-157).
