# F-05 — Dwarf need activities: social partners, reachable targets, water search (M)

**Needs:** — · **Spec touched:** `10-dwarves.md` (tuning table, § Eating and drinking, § Social), `schemas/system-state.md` (`DwarvesState`)

## Why

Three defects in `src/systems/dwarves/activities.ts` (Codex era) only show on real maps, because the tests use flat fixtures with everyone adjacent.

1. **Social picks a partner up front.** `start('social')` chooses one partner (a friend first, else the nearest dwarf *anywhere on the map*, lines 198–205), walks to the hearth hall or meeting area, and waits up to `SOCIAL_WAIT_TICKS` for **that** dwarf to come within 2 tiles (line 234). Nothing tells the partner. Other dwarves standing there are ignored. W4 says the opposite: "walk to hearth hall / meeting area; wait up to 200 ticks for **another dwarf** within 2; if found: both TALK_TICKS". The only test (`activities.test.ts:80`) spawns both dwarves already adjacent on the meeting area.
2. **Targets ignore reachability.** Beds, seats, hall tiles, wells and water are chosen by straight-line distance (`distance`, `nearest`). When `walkTo` answers `unreachable`, the plan is cancelled (line 231), `tickDwarf` reselects, `select` (`brain.ts:65`) ranks the same need first, and `start` picks the same target again: a loop. Want-level needs come before work, so the loop also stops the dwarf working.
3. **Water only on the dwarf's own level, within 32 tiles** (`water()`). A dwarf underground never finds the surface river. `balance.md` makes water "the fallback" for drink, and the Balanced embark carries about 3.5 days of drink for seven dwarves (see F-08), so this matters from day 4.

## Decisions

1. **Decision F-05a — social.**
   - `start('social')` chooses the target only: the nearest tile, by `distance` with ties by lower tile index, among hearth-hall tiles and meeting-area tiles that are passable and `reachable(from, tile, 'walker')`. With none, `start` returns `false`.
   - On arrival the dwarf waits (`until = tick + SOCIAL_WAIT_TICKS`). Each tick it looks for a partner: a living dwarf other than itself, on the same z within Chebyshev distance 2, who is not asleep (not in the `use` phase of a `rest` plan). Friends (`Relationships.friends`) come first, then ascending id.
   - Found: `plan.partner` is set and the talk (`use` phase) lasts `TALK_TICKS`. Not found by `until`: the plan ends with no relief.
   - The partner's own activity is not interrupted. When the talk ends, both get the relief (−40, or −60 for friends), the relationship count and `Talked`, whatever the partner is doing by then.
2. **Decision F-05b — reachability.** Every tile a need activity may walk to is kept only if it is passable and `ctx.readers.pathing.reachable(from, tile, 'walker')`. This applies to own bed, free beds, the hall-floor fallback, well stand tiles, water stand tiles, dining and comfort seats, social tiles, and hearth-hall tiles for joy and comfort. Item targets already use the walker search and are unchanged.
3. **Decision F-05c — retry block.** When a need plan ends because `walkTo` answered `unreachable`, that dwarf starts no plan for **that need** for `NEED_RETRY_TICKS` = 50 (one hour; new constant in `10`). During the block, `start` returns `false` for that need, so selection moves on to the next need or to work.
   - Saved as `DwarvesState.needRetryUntil?: [EntityId, string, Tick][]` (a superset, ascending by id then need).
4. **Decision F-05d — water search.**
   - A drinkable tile `W` is water (not magma), level ≥ 1 and not frozen.
   - A dwarf drinks standing on a walkable tile `S` that is 8-adjacent to `W` on `W`'s level (the spec's "adjacent water tile"). This is unchanged, and it is why a water tile walled on its four cardinal sides stays drinkable from its diagonals.
   - The search covers every level from `z − 8` to `z + 8` and `|dx|, |dy| ≤ 32` around the dwarf.
   - Each candidate `S` must be reachable. The one minimising `max(|dx|, |dy|) + |dz| × Z_DISTANCE_WEIGHT` wins, ties by lower tile index.
   - Search level by level outward (dz = 0, −1, +1, −2, +2, …) and stop once `|dz| × Z_DISTANCE_WEIGHT` exceeds the best distance found.
   - The preference order of `10` (stocked barrel, then well, then water, then D-120's loose alcohol) is unchanged.

## Spec amendments

`docs/02-systems/10-dwarves.md` § Social, comfort, joy, replace the "Social:" bullet with

> - Social: go to the nearest reachable hearth-hall or meeting-area tile and wait up to `SOCIAL_WAIT_TICKS`; the first dwarf within 2 tiles on the same level who is not asleep (friends first, then by id) is the partner; both get `Talked { a, b }` after `TALK_TICKS`; relationships increment; friends after `FRIEND_TALKS` talks. Talking to a friend relieves 60 instead of 40. The partner is not interrupted.

`docs/02-systems/10-dwarves.md` § Eating and drinking, replace "else an adjacent water tile of level ≥ 1." with

> else the nearest reachable water tile of level ≥ 1 (not frozen) within 32 tiles horizontally and 8 levels up or down, drunk from any walkable tile 8-adjacent to it on its level.

`docs/02-systems/10-dwarves.md` § Behavior selection, add after the list:

> Every target a need activity walks to must be reachable (connectivity labels). If the walk still fails, the dwarf does not retry that need for `NEED_RETRY_TICKS`.

`docs/02-systems/10-dwarves.md` § Tuning constants: add `| `NEED_RETRY_TICKS` | 50 | After an unreachable need target |`.

`docs/04-implementation/schemas/system-state.md` `DwarvesState`: add `needRetryUntil?: [EntityId, NeedName, Tick][]`.

## Code

| File | Change |
|---|---|
| `src/systems/dwarves/constants.ts` | `export const NEED_RETRY_TICKS = 50;` |
| `src/systems/dwarves/activities.ts` | A helper `reachable(ctx, from, tile)` (passable and `ctx.readers.pathing.reachable(from, tile, 'walker')`); every candidate list goes through it (`hallTile`, `socialTile`, `seat`, `bed`, the wells, `water`, `standBeside`'s result). `socialTile` and the `social` branch of `start` implement F-05a: no partner at start; the partner is chosen in `step` while waiting. `water()` implements F-05d. `step`: on `walkTo === 'unreachable'`, record `retryUntil(id, need) = tick + NEED_RETRY_TICKS` before cancelling. `start`: return `false` while the need is blocked. |
| `src/systems/dwarves/state.ts`, `index.ts` | Keep `needRetryUntil` in the system and save and restore it. |

Do not change `brain.ts`'s selection order.

## Tests

`test/unit/dwarves/activities.test.ts` (describe `F-05 need activities`):

1. **"any dwarf present in the meeting area is a partner"**:
   - `flat-test`, `embark: 'none'`, a 3×3 `meeting_area` at (20, 20, 32).
   - Dwarf B at (21, 21): all needs 0, idle (with no arrival an idle dwarf stays put, D-057).
   - Dwarf A at (30, 21) with social 55; dwarf C at (60, 60, 32), all needs 0. Make C A's friend (`Relationships.friends`).
   - Run up to 400 ticks, re-zeroing the other needs each hour.
   - Assert a `Talked` event with `{a: A, b: B}` (or `{a: B, b: A}`). With the old code A waited for C and never talked.
2. **"an unreachable bed is not chosen and does not loop"**:
   - Bed 1 at distance 3 inside a room walled on every side (no door); bed 2 reachable at distance 12.
   - Dwarf rest 95, outside the sleep window.
   - Assert: within 600 ticks a `Slept` event with `onFloor: false`, and the dwarf's tile at that moment is bed 2's origin.
3. **"a need whose only target is unreachable is retried at most once an hour"**:
   - The only water is a tile inside a sealed room; no drink items.
   - Thirst 55, a dig designation reachable, a pick on the ground.
   - Over 600 ticks, count the ticks on which `activities.plans.get(id)?.need` changes to `'thirst'`: at most `ceil(600 / NEED_RETRY_TICKS) + 1`.
   - The dig job completes (the dwarf still works).
4. **"a dwarf underground drinks from surface water"**:
   - `stairShaft` (from `test/scenarios/m1-helpers.ts`) from z 32 to 29, with the dwarf at z 29 in a dug 3×3 room.
   - A water source at level 7 on a surface floor tile (x, y, 32) whose four cardinal neighbours are set to `Wall` granite; its diagonal (x+1, y+1, 32) stays floor.
   - Thirst 55, no drink items.
   - Assert `DrankWater { id }` within 800 ticks.
5. The existing test "talks five times to make a friend and relieves both dwarves" must still pass.

## Done

- Suite green; `dw_needs`, `dw_sleep` and `mo_hall_spirit` unchanged.
- Goldens regenerated if they change (commit body says so).
- One `DECISIONS.md` row for F-05a–d, pinning tests 1–4.
- Spec amendments applied verbatim.
