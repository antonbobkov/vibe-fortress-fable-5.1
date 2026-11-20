# T-657 — An order skipped as out of reach says so outside the Workshop panel

**Source:** [T-648](../archive/tasks/T-648-workshop-order-runnable-out-of-reach.md) · **Size:** S · **Needs:** — · **Status:** open

## Why

Since T-648 a workshop skips an order whose inputs exist but none within reach of its work tile (12 § Operation 2), and looks at it again every `OUT_OF_REACH_RETRY_TICKS`. Only the Workshop panel, the Orders panel's row ("charcoal out of reach") and Add order's `○` note say so. `WorkshopBlocked { out_of_reach }` is emitted only when the workshop has nothing else to run, and no announcement is registered for it; while the workshop works its next order, nothing is emitted at all. A player whose smelter skips its steel all season behind a locked gate learns of it only by opening a panel. The memory is also keyed by recipe, so two orders of one recipe with different material filters (steel and iron axes) are skipped together while the remembered one is out of reach.

## What to do

Decide whether a skipped order earns a log note (once per workshop and recipe until it runs, as `WorkshopBlocked { missing_input }` is once per reason), and whether the Jobs panel's "Orders waiting" lists it with its reason. Decide whether to key the memory by recipe and material filter.

Spec: 12 § Operation, § Registrations; `ui-screens/panels.md` § Jobs.

## Done

A test that a workshop skipping its first order for its second writes one note naming the input, and none while it stays skipped.

- [x] **The note** (12 § Operation 2, § Registrations): the first time a workshop remembers an order as out of reach it emits `WorkOrderSkipped { workshopId, recipeId, input }`, a note: "Smelter #1 skips its make steel order: no charcoal within reach." The search that renews the memory after `OUT_OF_REACH_RETRY_TICKS` or a door's change does not emit it; the memory outlives its time until an order of its kind starts a job (a later skip is told again) or no order of its kind is left. `WorkshopBlocked { out_of_reach }` keeps no line of its own. The Jobs panel's "Orders waiting" already lists a skipped order with its reason ("x1 Make steel · charcoal out of reach"); panels.md says so.
- [x] **The key**: `Workshop.outOfReach` entries carry the order's material filter and target type (`material?`, `target?`), content indices saved as ids like the order's own, and an order is skipped only by an entry of its own kind. The reader's `isRunnable` takes the order, so the Orders row and the workshop panel's idle line read each order's own memory. The reach search itself is unchanged.
- [x] **Test** `test/unit/workshops/t657-order-skipped-note.test.ts`: the smelter skipping its steel for its lignite writes one note naming the charcoal, none after three retries and another door's change, and drops the memory once the steel is made; oak and pine chair orders are skipped apart.
