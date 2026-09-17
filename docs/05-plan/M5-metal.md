# M5 — Metal

**Goal:** the full production tree: smelting, alloys, steel, forge items, magma workshops, mechanisms, gems, melting, professions complete. **Gate:** `ws_*`, `it_value`, `it_wealth` (rerun with crafted goods).

Spec: [`12`](../02-systems/12-workshops-and-professions.md), [`workshops-and-recipes.md`](../03-content/workshops-and-recipes.md), [`minerals-and-metals.md`](../03-content/minerals-and-metals.md), [`weapons-and-armor.md`](../03-content/weapons-and-armor.md) (item creation only; combat use is M6).

## T-M5-01 Wood furnace and smelter: charcoal, ore smelting, coal (M)

Needs: M4. Produces: fuel handling in `craft` jobs (fuel input added when the workshop burns fuel and is not magma-powered; coal recipes `fuel: false`), generated `smelt_*` recipes verified, `galena` and `tetrahedrite` silver chance, `BARS_PER_ORE` default.
Spec: `12` § Fuel and charcoal; `minerals-and-metals.md` § Ores (yields), § Fuel.
Tests: scenario `ws_fuel`; unit: every ore's yields table-driven over 1,000 smelts for permille yields; coal from coal ores without fuel.

## T-M5-02 Alloys and steel (S)

Needs: 01. Produces: `alloy_*` recipes with bar/stone/fuel inputs; steel needs flux-tagged stone and a fuel input in addition to the workshop's fuel.
Tests: scenario `ws_steel`; unit: bronze 1+1→2, brass, electrum, bismuth bronze, and that steel consumes two fuel at a non-magma smelter and one at a magma smelter.

## T-M5-03 Forge: weapons, ammunition, armor, tools, metal furniture, crafts (M)

Needs: 01. Produces: every `forge_*` recipe verified; `bars` per item from `weapons-and-armor.md`; `anvil` required to build a forge; material-filtered orders ("steel axes").
Tests: unit: table-driven execution of all 40 forge recipes; `materialFilter` restricts inputs; quality applies to weapons and armor items.

## T-M5-04 Magma workshops (M)

Needs: 03, M3-02. Produces: `magma_smelter`, `magma_forge`, `magma_kiln` (hidden), placement rule (magma ≥ `MAGMA_POWER_LEVEL` below a footprint tile), magma-safe input enforcement, `no_magma` blocking and unblocking on `FluidsChanged`, hint `hint_magma`.
Spec: `12` § Workshops (magma variants), `14` § Placement step 3.
Tests: scenario `ws_magma` (channel a pool, build, smelt, drain, blocked); unit: pine blocks rejected for a magma smelter.

## T-M5-05 Mechanic's workshop and mechanisms as items; jeweler (S)

Needs: 03. Produces: `make_mechanism` (quality affects jam chance later), `make_mechanism_metal`, `cut_gem`, `make_glowstone_lamp` (a statue that lights 3×3: the `lit` flag for comfort only).
Tests: unit: recipes execute; glowstone lamp sets `Lit` on its 3×3 through the terrain API and clears on removal.

## T-M5-06 Melting marked items (S)

Needs: 01. Produces: `MeltItem` flag → smelter `melt_metal_item` recipe with `MELT_RETURN_PERCENT`; `masterwork_lost` on melting a masterwork; `autoMeltMarked` standing order.
Tests: unit: an iron axe (2 bars) melts to 1 bar; masterwork melt emits the crafter thought.

## T-M5-07 Masterworks and the `saw_masterwork` memory; statues admired (S)

Needs: M4-13. Produces: `SawMasterwork` per-object memory on room entry; `admired_statue` per statue per season; `MasterworkCreated` announcements.
Tests: scenario `ws_masterwork`; unit: a dwarf entering a room with two masterworks gets two thoughts (cap 3), none on re-entry.

## T-M5-08 Stocks panel complete; orders panel global orders; workshop panel material filter (S)

Needs: 03–06, M4-17. Produces: melt/forbid/dump on types and items, "to depot" button disabled until M7, global orders creation, material filter dropdown.
Tests: unit golden buffers; e2e extension of `farm-plot-and-orders` (add a mason order for blocks through the global orders panel; assert blocks appear).

## T-M5-09 Gate M5 (S)

Needs: all. `reports/M5-gate.md`; `current-milestone: 6`; property generator extended with `MeltItem`, `EditWorkOrder`, `SetWorkshopWorker`, `SuspendWorkshop`.
