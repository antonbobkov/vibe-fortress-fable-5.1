# T-665 and T-668: a flux store by the smelter, and where peril-2 steel went

**Tasks:** T-665, T-668 · **Date:** 2026-11-22 · **Code:** branch `t665-flux-steel` on master `6a4e3860` · **Source:** [the T-665 work file](../../docs/work/T-665-flux-stockpile.md), [the T-668 work file](../../docs/work/T-668-peril2-steel-after-farm.md), [T-659 and T-660's report](2026-11-20-t659-t660-steel-trips.md), [T-664's report](2026-11-20-t664-small-fortress-starves.md)

## T-665: a stockpile that takes flux stone

**Decided: a filter may name a material tag beside its classes.** A stockpile's filter keeps its categories and material classes and may also name material tags (`materialTags`, 13 § Stockpiles): a material passes when its class is allowed or it carries a named tag. The one tag a filter may name is `flux` (`STOCKPILE_MATERIAL_TAGS`; any other is `bad_category`), so `stone/raw` with no class and the tag `flux` takes limestone, marble, dolomite and chalk and no other rock. A class beside the tag adds its own materials; a preset sets no tag; an old save's filter has none. The stockpile editor's materials checklist (`[v]`) ends with a Flux stone row after the classes, which toggles the tag and leaves the classes as they are, and the settings' `Materials` line names it (`Materials [Flux stone]`; 24, `ui-screens/panels.md`). On the way the checklist's Glass row, which showed its string key, got its name. `test/unit/items/t665-flux-stockpile.test.ts`, `test/unit/ui/u07-zones.test.ts`.

**The script keeps six flux stones by the smelter** (`keepFluxStore`): once the ore store stands, the next six free tiles of the workshop hall's lanes nearest the smelter are a stockpile of `stone/raw`, no class, tag `flux`.

**The probe** (`test/perf/t660_smith_steel_probe.test.ts`, `three-years-p2-1` at shift 0, days 126 to 336; before is master's script, after is both tasks' script):

| | Before | After |
|---|---|---|
| Steel jobs, first smelter / second smelter | 23 / none built | 25 / 20 |
| Flux trip, steps from the smelter | 11.7 | **6.9** (second smelter 5.7) |
| Claims / interruptions a steel job (first smelter) | 2.5 / 1.5 | 1.5 / 0.5 |
| The first smelter's worker: working / walking empty / carrying (% of his day) | 6.6 / 17.6 / 11.3 | 8.7 / 17.7 / 10.5 |
| Coal smelts / iron smelts (first smelter) | 72 / 25 | 114 / 25 |

The flux trip fell from 11.7 steps to 6.9, and a steel job is shorter (three claims in five fewer, a third of the interruptions: the fetch fits more often between two rests). The worker was at the bench 8.7% of his day against 6.6. The timelines part soon after (on this one the second smelter went up with the after script, not before), so the jobs done are the sweep's to judge.

## T-668: where the peril-2 steel went

Read from the sweeps' seed logs (`[three_years_economy]` and the weekly `[three_years_steel]` lines), the 28 peril-2 timelines of each:

| Sweep | Alloy jobs | Timelines under 5 | Mean of the rest | Strong squad's day (steel from) | Alloy jobs per 100 days after it |
|---|---|---|---|---|---|
| T-661 master `44830514124` | 35.8 | 2 | 38.3 | 146.1 | 18.9 |
| T-664 final `44851035279` | 30.7 | 1 | 31.8 | 155.1 | 16.1 |
| T-683 `45027251322` | 25.3 | 7 | 33.6 | 154.2 | 16.4 |
| T-684 `45031734775` | 31.4 | 2 | 33.7 | 156.0 | 18.9 |

**The timelines whose steel fell most:**

- `p2-5` at shift 100 (49 → 0): a different fortress. A raid on days 58 to 63 killed three dwarves and the fortress stayed at eleven adults until about day 150 (twenty-four on master's timeline by day 114), so the strong squad, and the steel with it, came on day 198 against 114. From then the smelter's alloy waited `missing_input` every week: no iron ore in stock all year 3 and no iron bar (the 46 iron smelts had gone to the iron goods), and four to eight flux stones. Not the farm's hands: the raid's timeline.
- `p2-4` at shift 0 (42 → 14): the steel began on day 170 on both, and on T-664's from day 238 to 336 the smelter waited on flux with 21 to 38 iron bars stacked, flux 0 or 1 (the last stone `out_of_reach`), 40 flux faces designated. Master's timeline ran dry the same way from day 273 with 43 bars idle. **This is what the script played badly**: the flux was opened 20 faces with the second mine, 30 at the deep shaft's foot and 30 with each new alloy order, but a dug stone tile drops a stone three times in ten (03, `MINING_STONE_DROP_PERMILLE` 300), so 30 faces gave about nine stones for a batch of thirty bars, and the next batch's faces came only when the batch was done, which it never was without flux. Where the halls stand in flux rock (`p2-1`: 76 limestone in year 1) the hall's own stone hid it.

**Across the sweeps:** the weeks a peril-2 smelter had no free flux with five iron bars or more waiting were 37 (T-661), 43 (T-664), 32 (T-683) and 46 (T-684) of 700 to 766; the weeks without an iron bar while ten iron ore stood free fell from 251 to 186, 147 and 167 (T-664's farm did not take the iron's hands). The fall from T-661 is a later start (nine days later on average, the twenty-four adults reached later on timelines raided early) and the timelines that never start, both of which move by the shift's raids; the rate once started is noise between sweeps of nearly the same script (16.1 on T-664's, 18.9 on T-684's, whose 31.4 alloy jobs stand within a seventh of T-661's while T-683's 25.3 a few hours earlier did not). Famine days were 2.6 to 2.9 a peril-2 timeline on every sweep since T-664: the famine is not where the steel went.

**The answer** (`keepFlux`): while the smelter makes steel, when fewer than four flux stones are free and fewer than ten flux faces stand designated undug, fifteen more are designated, in the upper band or else below it. With the flux store, the smelter's flux is mined as it is used and lies beside it.

## The sweep

SWEEP_PLACEHOLDER

## Follow-ups

FOLLOWUPS_PLACEHOLDER
