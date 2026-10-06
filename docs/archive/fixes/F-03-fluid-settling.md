# F-03 — Fluids: an equalize budget so disturbed water settles (M)

**Needs:** — · **Resolves:** C-002 · **Spec touched:** `04-fluids.md`, `04-implementation/algorithms/fluids.md`, `05-plan/01-testing-strategy.md`, `04-implementation/acceptance-tests.md` (no row changes)

## Why

Rule 2 of `04` moves one unit to a neighbour exactly one level lower with probability `SPREAD_EQUALIZE_PERMILLE` (500‰). That move counts as movement: it goes through `setLevel`, then `touch`, which resets both tiles' idle counters and activates their six neighbours. Any body whose units do not divide evenly into its tiles therefore swaps units for ever and never leaves the active set (C-002).

- D-092 measured about 6,000 permanently active tiles on a generated cavern lake. It was avoided only by never activating generated water.
- Any player action reactivates it: tapping a lake, flooding a room, or M6's floodgates and bridges.
- `fl_spread` and the property "every tile settles" are `todo` because of it.

## What was tried (so it is not tried again)

These are prototype results against the current test suite on `743deff`:

| Rule | Result |
|---|---|
| "Quiet" equalize: no touch, counts as idle | A source-fed corridor stops at level 6 (7 7 6 6 7 6), so pressure never starts. Breaks `pressure.test.ts` and `fl_pressure`. |
| Equalize only into a neighbour that can pass the unit on | Leaves 2s in a spill. Breaks `fluids.test.ts` "7 units … 0–1" and the U-tube tests. |
| Budget 8 per tile, no equalizing into empty tiles | Budget runs out along a 5-tile source-fed corridor. Breaks `fl_pressure`. |
| **Budget 16 per tile, no equalizing into empty tiles** | Passes everything except `fl_conservation`'s extra at-rest layout check (see Decision F-03d). `fl_spread` and "every tile settles" pass. |
| Budget 32 | Same as 16. |
| Budget 64 | The settle property fails within 500 steps. |

## Decisions

1. **Decision F-03a — the rule.** Rule 2's equalizing move happens only when all of the following hold:
   - `N.level == L − 1`;
   - `N.level ≥ 1` (never into an empty tile);
   - tile `T` has made fewer than `FLUID_EQUALIZE_BUDGET` equalizing moves since its level was last written by anything else;
   - the `SPREAD_EQUALIZE_PERMILLE` draw succeeds.

   The move itself is unchanged: an ordinary move that touches both tiles and counts as `moved`. After it, `T`'s equalize count rises by 1.
2. **Decision F-03b — the reset.** A tile's equalize count returns to 0 whenever its level byte is written by any path other than an equalizing move:
   - fall, strict spread (difference ≥ 2), pressure, source refill, sink drain, evaporation, water–magma contact (steam), freeze, thaw;
   - `pour`, and the terrain API clearing the fluid.

   Receiving a unit by an equalizing move does **not** reset the receiver.
3. **Decision F-03c — the constant.** `FLUID_EQUALIZE_BUDGET = 16`. It is the smallest value tried that passes every existing fluid test (8 fails `fl_pressure`).
4. **Decision F-03d — `fl_conservation`'s at-rest check.** The acceptance row asks only "Σ levels = 700 at every sampled tick", and that stays. The scenario's own extra check ("floor full, level above empty") assumed films of level-1 water wander until they fall into holes, which is exactly what C-002 removes. It becomes:
   - `activeCount() === 0`;
   - every floor tile at level ≥ 6;
   - every tile of the level above at level ≤ 1;
   - Σ of both levels = 700.

   Measured on seeds `fl-conservation`, `-2` and `-3`: minimum floor level 6, with 15, 12 and 11 floor tiles at 6, the level above holding exactly that many units as level-1 film, and nothing active.
5. **Decision F-03e — saved state.** The counts are 04 state that decides future moves, so they are saved. `FluidsStateV1` gains `equalizeCounts?: [TileIndex, number][]` (non-zero entries, ascending tile index; a superset, `stateVersion` stays 1; absent means all zero).

## Spec amendments

`docs/02-systems/04-fluids.md` § The four movement rules, rule 2: replace the sentence "If `N.level == L − 1`, move one unit with probability `SPREAD_EQUALIZE_PERMILLE`" (and its surrounding wording, whatever its exact form) with

> If `N.level == L − 1` and `N.level ≥ 1`, and `T` has made fewer than `FLUID_EQUALIZE_BUDGET` such equalizing moves since its level was last written by any other rule (a fall, a spread of two or more, pressure, a refill, a drain, evaporation, steam, freezing, thawing or an outside write), move one unit with probability `SPREAD_EQUALIZE_PERMILLE`. Equalizing never moves water into an empty tile, so a level-1 film is at rest; and because only real flow renews the budget, a closed body with uneven levels stops swapping units within a bounded number of steps and settles (C-002).

`docs/02-systems/04-fluids.md` § State: add the bullet

> - `equalizeCounts`: equalizing moves made by each tile since its level was last written by another rule (non-zero entries only).

`docs/02-systems/04-fluids.md` § Tuning constants: add `| `FLUID_EQUALIZE_BUDGET` | 16 | Equalizing moves a tile may make between two real flows |` after `SPREAD_EQUALIZE_PERMILLE`.

`docs/04-implementation/algorithms/fluids.md`: in the rule-2 pseudo-code, change the equalize condition to `N.level == L - 1 and N.level >= 1 and eq[T] < FLUID_EQUALIZE_BUDGET and rng.chance(SPREAD_EQUALIZE_PERMILLE)`, followed by `eq[T] += 1`. Add one line under `setLevel`: `eq[i] = 0 unless the write is an equalizing move`.

`docs/05-plan/01-testing-strategy.md` § Property tests, "fluid conservation": replace "every tile settles" with

> every tile settles: after 500 steps the only active tiles are isolated level-1 water tiles waiting to evaporate (D-090)

## Code

| File | Change |
|---|---|
| `src/systems/fluids/constants.ts` | `export const FLUID_EQUALIZE_BUDGET = 16;` with the table's meaning as its comment. |
| `src/systems/fluids/step.ts` | `readonly eqCount: Uint8Array` beside `idle` (allocated with it). A private `equalizing` flag. `setLevel`: `if (!this.equalizing) this.eqCount[i] = 0;` right after the byte is written. `contact`: reset `eqCount[y]` for the magma tile it clears. `spread`: the equalize branch becomes `ln === l - 1 && ln >= 1 && eqCount[t] < FLUID_EQUALIZE_BUDGET && chance(...)`; set `equalizing = true`, `move(t, n, 1, magma)`, `equalizing = false`, `eqCount[t] += 1`. |
| `src/systems/fluids/freeze.ts` | Where it writes `map.fluid[t]` directly (clearing a dug ice tile, setting and clearing the frozen bit), also set `sim.eqCount[t] = 0`. |
| `src/systems/fluids/state.ts`, `index.ts` | Serialize `equalizeCounts` (non-zero entries, ascending) and restore it (clear first; absent → all zero). |

## Tests

- `test/scenarios/fl_spread.scenario.ts`: remove `todo: 'C-002'` and update the header comment. It passes unchanged with the prototype.
- `test/unit/fluids/fluids.test.ts`: the test titled "… (C-002: they keep wandering)" asserts Σ plus evaporated units. Tighten it to `Σ === 7` exactly and `destroyedUnits === 0` (nothing is isolated any more), and rename it without the C-002 note.
- `test/property/fluid-conservation.test.ts`: replace `it.todo('C-002 …')` with a property over the same `basinArb`, `numRuns: 25`, `seed: 3301`: after 500 steps, every active tile is water at level 1 whose six neighbours hold no water. It passed with the prototype.
- New unit tests in `test/unit/fluids/fluids.test.ts` (describe `F-03 equalize budget`):
  1. **"a closed 1×10 channel with 25 units settles"**: sealed floor channel, levels `[7,6,5,4,3,0,0,0,0,0]`, 500 steps. Assert `activeCount() === 0` and Σ = 25.
  2. **"equalizing never moves into an empty tile"**: two cardinally adjacent tiles at level 1 in the middle of an otherwise empty sealed 5×5 floor. After 200 steps both are still at level 1 and every other tile is empty. Neither is isolated, so neither evaporates.
  3. **"the budget resets on real flow"**: set `sim.eqCount[t] = FLUID_EQUALIZE_BUDGET` on a level-3 tile under an open tile, then `pour` water into the tile above so it falls into `t`. After the step, `sim.eqCount[t] === 0`.
  4. **"equalize counts survive save and load"**: disturb a pool, save mid-way (`serialize`/`deserialize`), and continue both copies 100 steps. The fluid bytes are identical.
- `test/scenarios/fl_conservation.scenario.ts`: replace the `expect` block with Decision F-03d. Keep `run` as is.
- **New perf-tier test** `test/perf/fl_settle.test.ts` (run by `npm run test:perf`, not `npm test`):
  - world `local`, spec `generatedSpec('perf-1')`, `embark: 'none'`;
  - `sim.touch(i)` for every non-source, non-magma tile with water;
  - step until `activeCount() === 0`, asserting it happens within **4,200 ticks**. The prototype measured 2,803; 4,200 is 1.5×. With today's rule, more than 2,000 tiles are still active after 3,000 ticks.
  - If the bound fails, record the measured tick in the gate report and investigate before changing the bound.

## Done

- Suite green. Goldens regenerated where they change: world hashes, and possibly `render/m3-fluids` (the render golden did not change in the prototype run).
- `DECISIONS.md`:
  - one row for F-03a–e;
  - under C-002: `Resolved by F-03 (<date>): equalizing needs a filled neighbour and spends a per-tile budget of 16 that only real flow renews.`
- Spec amendments applied verbatim.
