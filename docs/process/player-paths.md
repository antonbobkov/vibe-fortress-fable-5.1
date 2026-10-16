# Player-path scenarios

Each production chain of the game has one scenario that plays it from player commands alone ([testing-strategy.md](testing-strategy.md) § Player-path scenarios). This list says which chains are covered.

| Chain | From the player's commands to | Scenario |
|---|---|---|
| Food | a farm plot planted, harvested, cooked and the meal eaten | [`pp_food`](../../test/scenarios/pp_food.scenario.ts): a cave plot of cavewheat, a kitchen cooking it; a dwarf eats a cavewheat meal on day 22 |
| Drink | plants brewed in a still into barrels and drunk | [`pp_drink`](../../test/scenarios/pp_drink.scenario.ts): the wagon's drink forbidden, a carpenter making barrels, a still brewing the wagon's dimcaps; a dwarf drinks the brew on day 2 |
| Crafts and forge | ore mined, smelted, forged, and the goods stored | none yet |
| Hospital | a wounded dwarf diagnosed and treated with supplies hauled into the hospital chest | none yet |
| Trade | goods hauled to the depot, a broker trading with a caravan | none yet |
| Defence | a squad equipped from the stockpile, answering an alert and killing a hostile animal | none yet |
| Pasture | tame grazers fed on a pasture zone through a season | none yet |

A chain is covered when its scenario exists, passes, and stages nothing that the chain produces or delivers. A chain that cannot be played from commands yet is marked "fails" with the task that records the fault; its scenario carries that task id as its `todo` and is reported as todo until the task closes.

The scenarios share `test/scenarios/player-path.ts`. Each plays a compact 48 × 48 region generated from a region spec, as the three-year fortress does: a temperate forest Serene Vale at peril 0, with a brook, wealth 2 and mixed geology. A Serene Vale has the biome's wild animals but no wolves, bears or snow leopards; wolves kill dwarves of a seven-dwarf start in its second week, which is the defence chain's question and not the others'. Every scenario runs in `npm test` (the normal tier) and ends with the invariant checker.
