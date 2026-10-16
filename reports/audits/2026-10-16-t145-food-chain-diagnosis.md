# Why the three-year fortress starves — 2026-10-16

**Task:** T-145 · **Follows:** [the re-measure](../data/2026-10-16-t145-three-years-main.txt) · **Code:** `ebc0cc3` (the fixture as T-145 left it) · **By:** Claude (Opus)

## Question

`three_years_main` (seed `three-years`) lost all 63 dwarves to starvation on days 322–326. Is the food chain at 40–60 dwarves limited by the script's choices or by a fault of the game?

## How

- A probe ([source](../data/2026-10-16-t145-food-probe.test.ts.txt), [daily journal](../data/2026-10-16-t145-food-probe.jsonl)) plays the fixture exactly as the scenario does, without the caravan save and load, and writes one line a day: stocks by type, species and container, harvests, sowings, meals and drinks made, eaten and drunk, food that rotted (a wrapper around the item core's `setRot` and `destroy` that records and then calls the original), the farm plots' tiles and crops, the kitchens' and stills' states every 300 ticks, the food jobs waiting and their ages, and what every adult is doing. It reproduces the run: 63 dwarves, all dead of starvation by day 326 (895 s).
- A second probe ([source](../data/2026-10-16-t145-bank-probe.test.ts.txt)) counts, on the generated map at tick 0, the brook's water tiles and the walkable tiles beside them.

## What the journal shows (28-day windows)

| Days | Dwarves | Plants harvested | Meal units cooked | Meals eaten | Meal units rotted | Plants rotted | Drink brewed / drunk | Meals in stock (loose) at the end | Drink at the end | Surface tiles / growing |
|---|---|---|---|---|---|---|---|---|---|---|
| 20–47 | 9 | 407 | 224 | 107 | 56 | 144 | 220 / 217 | 65 (57) | 63 | 31 / 20 |
| 48–75 | 12 | 273 | 240 | 112 | 118 | 317 | 200 / 184 | 75 (75) | 79 | 46 / 38 |
| 104–131 | 24 | 133 | 428 | 211 | 214 | 23 | 460 / 341 | 200 (170) | 268 | 88 / 21 |
| 132–159 | 34 | 367 | 808 | 315 | 364 | 18 | 480 / 511 | 329 (290) | 237 | 129 / 21 |
| 160–187 | 43 | 319 | 866 | 424 | 379 | 3 | 600 / 667 | 392 (378) | 170 | 158 / 27 |
| 188–215 | 43 | 122 | 798 | 454 | 189 | 3 | 520 / 690 | 547 (468) | 0 | 158 / 0 (winter) |
| 216–243 | 55 | 206 | 406 | 546 | 263 | 0 | 680 / 611 | 144 (67) | 69 | 168 / 42 |
| 272–299 | 63 | 359 | 644 | 643 | 8 | 0 | 840 / 921 | 50 (30) | 0 | 168 / 56 |
| 300–326 | 63 → 0 | 148 | 34 | 84 (+184 raw) | 0 | 0 | 200 / 200 | 0 | 0 | 168 / 0 |

`DrankWater` never occurs: 0 in 326 days.

## Causes

1. **The food rots because no stockpile takes it.** A meal or a plant wants a barrel, and a stockpile takes such an item only into a container of that class (13 § Stockpiles; `src/systems/items/stockpiles.ts` slot search). The script's pantry, its drink annex and its general stockpile want no barrels, so meals and plants lie where they were made and rot at full speed (meals in 14 days). From day 104 to day 243, 1,409 meal units rotted against 1,950 eaten, while 29 to 46 empty barrels stood in stock. Script.
2. **The seed bought is not the seed sown.** The strips are set to turnip and barley; the trade routine buys any seed by the 48, so the fortress held hops (56), strawberry (up to 60), pale bell (48, then 78), and turnip only from the wagon (40, gone by day 131). On day 159, 129 surface tiles had 21 crops; on day 299, 168 had 56. `PlotNeedsSeeds` was announced for turnip and barley on every strip each season. Script.
3. **Cave seed is sold and not sown.** The Mountainhome sells cave seed (`caravan-goods.md`; 48 pale bell bought on day 125); the script keeps its cave plots at the wagon's 32 tiles. Pale bell, sweetroot and dimcap grow in every season, so the winter is fed only by those 32 tiles. Script.
4. **Dwarves cannot drink from the brook.** The brook's 53 water tiles lie on z = 31 at level 7; their neighbours on that level are soil walls or water, and their banks are on the surface one level up. 10's drink search drinks "from any walkable tile 8-adjacent to it on its level" (`src/systems/dwarves/activities.ts:157-210`, stand tiles on the water's own z at lines 191-199), and generation always puts a river's water one level below its banks (`local-map-generation.md` § 2). So no generated brook is ever drunk from, and the fortress dies of thirst beside it when the stills stop (days 214–218, 229–240, 247–255, 297–326). **Game fault: [T-350](../../docs/work/T-350-dwarves-cannot-drink-from-a-generated-brook.md).**

What is not the cause: labor and workshops. From day 160 the kitchens and stills idle with `missing_input` (no plant to cook or brew) and 12 to 40 adults have no job at a sample; food jobs wait minutes, not days (the oldest kitchen job 82 to 606 ticks, harvest 39 to 339 ticks). Haul wants never exceed 8 after day 188. Exports are not the cause either: 13 lavish meals left with caravans in 326 days. The plant jobs that wait for weeks are the strips' turnip and barley jobs blocked for want of that seed (cause 2).

## What the script now does (T-145)

Every pantry and larder tile wants a barrel, and a 48-tile larder is dug beside the pantry; each plot sows the crop whose seed it has; seed is requested and bought by species, cave seed from the Mountainhome, and cave strips are dug for it; the kitchens keep 42 days of meals, the stills 21 days of drink, and 56 days of meals are kept back from the caravans; the barrel order follows the larder and the drink. The measurements after the change are in T-145's work file and the commits that follow.
