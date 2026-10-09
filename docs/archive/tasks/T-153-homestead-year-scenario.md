# T-153 — A homestead year: livestock, leather, cloth, hunting, fishing, gathering

**Source:** T-114 and its report, [`../../../reports/audits/2026-10-08-playthrough-coverage.md`](../../../reports/audits/2026-10-08-playthrough-coverage.md) (gap 4) · **Size:** M · **Needs:** — · **Status:** open

## Why

No long playthrough uses systems 08 and 09 or the workshops that depend on them. Measured: no slaughter, butchery, milking, shearing, egg collection, taming, training, hunt, fishing or gathering job completes in a long run; no butcher, tannery, leatherworks, kennel, nest box, farmer's workshop, loom, clothier or bowyer is built; 31 of the 34 plant rows are never planted. The only animal command the three-year fixture sends, `AssignPasture`, is rejected.

## Decisions

- **A new long scenario, `homestead_year`**, in `test/scenarios/homestead_year.scenario.ts`, with its script in `test/scenarios/homestead_year_fortress.ts`. It does not change `three_years_fortress.ts`.
- **World:** a generated 48 × 48 map from a region spec: temperate grassland, peril 0, temper 0, wealth 1, a river of class `stream`. Seed `homestead-year`. One year.
- **Embark:** a custom `EmbarkSession`: the Balanced party with a hunter and a fisher, plus sheep, a cow, hens and a dog from the embark catalogue. This also exercises `SetSkill` and `SetSupply`.
- **Commands only.** No spawned item and no `build` helper.
- **What it plays:**
  - a pasture with the grazers assigned, a nest box, a kennel; `TrainAnimal` on the dog and `AssignAnimal` to a dwarf; `SetBreedingCap`; `MarkSlaughter` on one animal and `UnmarkSlaughter` on another; `NameAnimal`;
  - a butcher, a tannery, a leatherworks, a farmer's workshop, a loom, a clothier, a bowyer, with orders for cheese, thread, cloth, a tunic, leather boots, a quiver, a bow and bone bolts;
  - flax and hops beside the food crops, `brew_hopped`, `mill_flour`, `process_flax`;
  - a fishing zone on the river, a gather zone on the shrubs, `DesignateHarvest`, `SetHuntable` for one species;
  - a dump zone and `DumpItem` for the rotten remains, and `SetStandingOrder` for one standing order.
- **Assertions:**
  - each of these job types completes at least once: `slaughter`, `butcher`, `milk_animal`, `shear_animal`, `collect_egg`, `train_animal`, `hunt`, `fish`, `gather`, `haul_to_dump`;
  - each ordered recipe is crafted at least once;
  - `AnimalBorn`, `AnimalTrained`, `HuntKill`, `FishCaught` and `ButcheryDone` occur;
  - no tame animal starves while the pasture has grass;
  - no command of the script is rejected, except those the script lists as expected;
  - no dwarf dies.
- **It runs in `npm test`** with `milestone: 8` and its own `timeoutMs`.

## What to do

1. Write the script and the scenario.
2. Add the scenario to `04-implementation/acceptance-tests.md` and to `testing-strategy.md` § The long scenarios.
3. A step that a player's commands cannot do is a bug: file a row and leave the step out with a comment naming the row.

## Done

- `homestead_year` passes in `npm test`.
- The verification commands of [`../../process/agent-workflow.md`](../../process/agent-workflow.md) are green.
