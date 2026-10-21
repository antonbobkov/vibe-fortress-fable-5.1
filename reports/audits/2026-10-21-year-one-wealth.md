# Measurement: year-1 wealth against the model

**Task:** T-380 · **Date:** 2026-10-21 · **Commit examined:** master `a5cd51c` · **Kind:** measurement and a restated band; no constant, formula or content value was changed · **Source:** B-008 as re-filed by [the peril-0 sweep](2026-10-17-t145-peril-0-sweep.md)

## The answer

- **The fixture exceeds exactly one of the model's terms: its first meals.** At the end of year 1 the economy fixture's wealth, by source (the economy instrument's own accounting), is 24,204 marks on the main seed, of which **19,110** are meals and drink; 24,882 on `three-years-p0-3` (**19,260**); 9,183 on `three-years-p0-2` (4,860). Everything else (embark goods about 1,350, blocks and furniture 300 to 500, crafts up to 400, bars and gems up to 600, buildings and barrels, other goods 2,000 to 2,600) comes to **4,300 to 5,600**, inside the model's 4,000–8,000.
- **The peril-2 seeds say the same.** The seven peril-2 fortresses of [the raid sweep](2026-10-21-raid-sizes-and-renown.md) (same fixture, same commit) hold 11,076 to 21,069 at day 112, of which 5,490 to 15,760 are meals and drink; the rest is **4,600 to 6,700**, the squad's iron kit included (270 to 2,400).
- **The meals are a stock of lavish meals.** The main seed holds 277 meals at day 112, nearly all lavish, and 110 drinks: 49 days of food for its 15 dwarves at the measured 0.38 a dwarf-day. `three-years-p0-3` holds 337 meals (49 days for 18), `p0-2` 95 (19 days for 13). A lavish meal is worth 60 marks (× material and quality) and one `cook_lavish_meal` job of 250 ticks turns four ingredients worth a few marks into eight of them, 480 marks; the main seed's cook did it 102 times in the year.
- **The model is wrong, not the fixture.** The model's year-1 band reckons "first meals" as a small term beside embark goods, blocks, furniture and crafts. Its own food chain says a cook is the first wealth engine, and a fortress that keeps a season's food in stock as lavish meals, as a careful player does and as the fixture's script does, holds 5,000 to 19,000 marks of it by the end of year 1. Lowering the lavish meal's value would break the trade arithmetic of [`balance.md` § Trade](../../docs/03-content/balance.md#trade), which pays for the year-2 caravan with 42 lavish meals; renown, which the wealth drives, already gives raids of the model's size ([raid sizes and renown](2026-10-21-raid-sizes-and-renown.md)). The year-1 band is restated in `balance.md` § Wealth curve from this measurement: **8,000 to 25,000 marks**, of which 4,000 to 7,000 is the old band's drivers and the rest the food stock.
- **Years 2 and 3 are carried by the same stock.** On the six living peril-2 fortresses, wealth less meals and drink is 7,400 to 10,400 at the end of year 2 (model 15,000–25,000 in all) and 11,000 to 16,400 at the end of year 3 (model 35,000–60,000), while meals and drink are 25,000 to 52,000 and 29,000 to 59,000. The fixture makes no steel goods and few gems or masterworks, the model's drivers of those years; its totals reach the model's bands through the kitchen. `balance.md` says so beside the table; no number changes.
- **No constant should change on this evidence**, and no work file follows.

## What was run

`reports/data/2026-10-21-year-one.probe.ts.txt` (a vitest file under `test/perf`, not committed as a test), at `a5cd51c`, alone on the machine: the three-year fixture at peril 0 (`threeYearsWorld`, `setupThreeYearsFortress`, `playThreeYears` with its four checks every 300 ticks), seeds `three-years`, `three-years-p0-2` and `three-years-p0-3` (the lowest and highest year-1 wealth of the peril-0 sweep with the main seed), 112 days each, with the economy instrument's snapshot at day 112: wealth by source, item counts, recipes, qualities. The same probe journals every sleep errand for T-369. `…-year-one.json` holds the summary made by `…-year-one-summary.mjs.txt`. The peril-2 figures are the year snapshots of `…-raid-sizes.json`.

| Fortress at day 112 | Wealth | Meals and drink | Everything else | Meals / drinks in stock | Dwarves |
|---|---:|---:|---:|---|---:|
| `three-years` | 24,204 | 19,110 | 5,094 | 277 / 110 | 15 |
| `three-years-p0-3` | 24,882 | 19,260 | 5,622 | 337 / 285 | 18 |
| `three-years-p0-2` | 9,183 | 4,860 | 4,323 | 95 / 221 | 13 |
| Peril 2, seven seeds | 11,076–21,069 | 5,490–15,760 | 4,641–6,742 | | 10–18 |
| **Model** | **4,000–8,000** | first meals | embark, blocks, furniture, crafts | | 13 |

The everything-else column of the main seed: embark goods 1,339, blocks 87, furniture 397, crafts 382, iron bars 450, gems 120, building value 192, barrels 90, other goods 2,037 (clothing, tools, logs, ore, hospital supplies).

## What this does not measure

- A player's fortress, which may keep less food or sell more of it; the fixture's script decides how much it cooks.
- Year 5.
- Whether the lavish meal's value is right for trade; only that it is what puts the fixture above the old band.
