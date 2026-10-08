# M8 balance with the economy fortress

Normal scenario and complete sweep verified 2026-10-05; mood instrument measured 2026-10-04. Owner Tasks 1–2, T-M8-06. This balance workstream changed no game rule, constant, content row or balance specification. The before column is the final-source table in [../gates/M8-gate.md](../gates/M8-gate.md). The DECISIONS append lines retain the owner-requested 2026-10-04 date label; the completion date for the full sweep is October 5. The after measurements use the same `three-years` and twenty sweep seeds at perils 0/2/4, with D-225’s generated wealth-2 maps and the shared economy script.

## Comparison with the gate

| Metric | Model | Before (gate) | After (economy) |
|---|---|---|---|
| Food per dwarf-day | 0.48 | 0.27; peril 0: 0.27–0.30 | 0.246; peril 0: 0.242–0.292 |
| Drink per dwarf-day | 0.77 | 0.44, all ale; peril 0: 0.44–0.47 | 0.407, all ale; peril 0: 0.408–0.465 |
| Wealth, year 1 | 4,000–8,000 | 3,601; peril 0: 3,517–3,871 | 10,740; peril 0: 7,556–11,546; peril 2 living: 10,431–12,284 |
| Wealth, year 2 | 15,000–25,000 | 3,794; peril 0: 3,493–3,970 | 23,687; peril 0: 10,623–16,505; peril 2 living: no living observations |
| Wealth, year 3 | 35,000–60,000 | 3,762; peril 0: 3,565–3,902 | 31,808; peril 0: 8,915–32,163; peril 2 living: no living observations |
| Guaranteed immigration, year 1 | 2 waves | 2 waves, 5 dwarves | Main: 2 waves, 5 dwarves; peril 0 total waves 2 |
| Other immigration, years 2–3 | Conditional on spirit ≥55 | 0 waves on seven peril-0 seeds; spirit 43–60 | 4 non-guaranteed Y2–3 waves on seven peril-0 seeds; main 0; yearly spirit 36.8–62.6 |
| Raids, peril 0 | Thieves from year 2 | 3 per seed, size 1 | 3–4 per seed, size 1 |
| Raids, peril 2 | Year 2: 10; year 3: 15 | Year 2: 8; year 3: 7–8 | Living fortresses, year 2: 8–9; year 3: no living observations |
| Mood | ~70 (Content); current prose: 55–60 steady | Main endpoint 49.0; peril-0 endpoints 51.0–60.3 | Main endpoint 38.0; peril-0 endpoints 36.5–59.2; instrument time mean 34.65 |
| Survival, peril 0 | 0 deaths | 7/7; 0 deaths | 7/7 alive; 12–22 dwarves left; 0 extinct; 0 deaths |
| Survival, peril 2 | No numerical guarantee | 5/7; 1–7 left; extinct days 151, 238 | 0/7 alive; 0 dwarves left; 7 extinct (days 46–134) |
| Survival, peril 4 | No numerical guarantee | 2/6; one each; extinct days 134–238 | 0/6 alive; 0 dwarves left; 6 extinct (days 32–56) |

The wealth model explicitly describes a wealth-2, **peril-2** competent player. The main scenario and peaceful seeds are useful controls; the living peril-2 figures are the direct comparison. Raw abandoned-fortress wealth is retained below, but is not evidence that a competent living fortress reaches the curve. All seven peril-2 seeds are extinct by Y3, so the direct Y3 peril-2 wealth calibration remains INCONCLUSIVE: no material-value MODEL GAP can be inferred from their abandoned inventory. The peaceful controls demonstrate substantial growth but do not replace that missing competent peril-2 observation. Year snapshots precede the dispatch of the next spring boundary. “Raid” sizes conservatively exclude arrivals on or after the recorded extinction day; ordering within that day is not reconstructed from the day-resolution lists. Unfiltered arrivals remain in the data artifact. Overall death counts cover tick zero; the detailed raid/death listeners start after the day20 bootstrap, so their lists are not evidence of an absence of earlier fatalities.

Consumption is now counted from tick zero with integrated living dwarf-time rather than the old endpoint-population approximation. That improves the denominator, so the before→after change includes a measurement correction. The mood instrument samples daily after the day-20 bootstrap and briefly uses finer command cadence for its day-100 trace; its time mean is not the main scenario endpoint.

## Map decision and real economy

`buildFlatTestMap` at 48×48 has wall materials granite 57,600, basalt 3,776 and loam 4,608; it has **zero ore, gems, flux, coal or trees**. Its wealth-2 metadata does not generate deposits. D-225 therefore uses the existing complete `generateLocal` path, a 48×48×64 temperate-forest/mixed-geology wealth-2 specification with temper 0, relief 0 and a west-to-south brook. Peril 0 retains `serene_vale`; perils 2 and 4 retain their real threat schedules. There is no seed search or resource injection. The entrance shaft is opened before its six gate walls enclose it, preventing an idle civilian from obstructing the undug stair.

The main map contains 380 hematite, 254 magnetite and 44 limonite wall tiles; 5,571 limestone and 4,305 marble; 108 quartz, 68 garnet, 48 amethyst, 21 ruby, 7 emerald and 7 sapphire; 125 bituminous coal and 115 lignite; 496 surface trees (165 oak, 87 ash, 75 maple, 85 birch, 35 yew, 49 willow). The shallow mine band z=23–26 alone contains 101 hematite, 9 limonite, 540 limestone, 9 quartz, 68 bituminous coal and 57 lignite. The complete twenty-seed audit is included in the data artifact; p0-4 and p0-6 have no gems in that shallow band, although their full maps do.

The fortress chops actual trees and clears the gate/caravan approach; digs halls at z=26, two dark dimcap farms, using the supplied embark seeds, at z=31 and an upper-rock shaft; adds a craft workshop and depot; then mines nearest real ore and gems from day 30, expands mining in years 2 and 3, and mines flux for year-3 steel. Charcoal uses logs, not coal or magma. Orders smelt iron, replace two picks, equip the three-person squad with mail/shields/swords, then make additional tools, armour and export goods. At perils 2/4 the real embark budget buys the anvil; the peaceful embark requests and buys one from Mountainhome. Jewelry, stone exports, lavish meals, 20→50→100 barrel reserves, smoothing and year-3 engraving all run through real commands/jobs.

The depot exports crafts and surplus lavish meals while keeping a fourteen-day food reserve. Each visiting caravan is offered a real, affordable purchase: a missing anvil first, then scarce logs, metal/fuel, plants/seeds, textile materials and rough gems. The main scenario asserts and completes a trade for every caravan arrival. Seed-specific missed trades and unfinished industrial chains are fixture limitations, explicitly counted below rather than hidden by conjured purchases.

## Wealth decomposition by year

These are **marks still owned at each year-end**, not cumulative gross production. Initial item IDs are tracked through ordinary item notifications, stack splits/merges and proportional depletion of mixed fungible stacks. Purchased units retain acquisition provenance; goods consumed into new manufactured output are classified as that output, not counted again as purchases. Merchant and unrecovered foreign goods are excluded. Installed/owned items and actual building values are included exactly once. Every snapshot asserts that the disjoint ledger sums to the actual `ItemsReader.wealth()` within 0.001 mark.

| Driver | Year 1 marks | Year 2 marks | Year 3 marks | balance.md narrative and observed limit |
|---|---:|---:|---:|---|
| embark goods | 1,319 | 1,244 | 1,242 | Y1 ~1,500: diminishing retained embark inventory |
| blocks | 78 | 76 | 76 | Y1 blocks: reserve plus installed goods |
| furniture | 350 | 350 | 350 | Y1 furniture: beds, tables, chairs and doors |
| crafts | 198 | 228 | 126 | Y1 first crafts; exports leave owned wealth |
| meals/drink | 6,295 | 14,530 | 16,537 | Y1 meals: lavish cooking is the largest wealth engine |
| iron goods | 0 | 2,293 | 4,950 | Y2 iron goods: tools, armour/weapons, then crafts |
| steel goods | 0 | 0 | 720 | Y3 steel: real alloy and forge jobs; incomplete scale |
| iron bars | 360 | 615 | 585 | Intermediate metal stock, separate from goods |
| steel bars | 0 | 0 | 0 | Intermediate steel stock, separate from goods |
| gems | 90 | 78 | 78 | Y2 cut gems: shallow quartz, not a full deep-gem industry |
| smoothing/engraving | 0 | 0 | 0 | Y2 smoothed / Y3 engraved: room score only, ZERO wealth |
| other building value | 169 | 184 | 184 | Actual material + type bonus, linked items already counted |
| trade purchases | 1 | 838 | 3,326 | Y2 caravan purchases: only purchased goods still retained |
| barrels | 147 | 438 | 873 | Y3 a hundred barrels: real carpenter output |
| other | 1,733 | 2,813 | 2,761 | Raw minerals/logs, clothes, crops/seeds, miscellaneous owned items |
| **Total** | **10,740** | **23,687** | **31,808** | Actual owned wealth |

Smoothing/engraving witnesses: Y1: 342 smoothed / 0 engraved tiles; Y2: 342 smoothed / 0 engraved tiles; Y3: 342 smoothed / 99 engraved tiles. Main year-3 carpenter inventory includes 102 barrels, including retained embark/purchased barrels. Cumulative recipes: `craft_stone` 121, `make_charcoal` 186, `smelt_hematite` 58, `smelt_limonite` 7, `cut_gem` 9, `forge_pick` 2, `forge_mail_shirt` 6, `forge_crafts` 24, `alloy_steel` 7, `make_barrel` 98, `cook_lavish_meal` 187.

Masterwork inventory (quality tier5, zero-based): Y1: 0 items, Y2: 0 items, Y3: 0 items. This count is already included in the driver ledger, not an extra wealth term.

### Living peril-2 driver ranges

| Driver | Y1 | Y2 | Y3 |
|---|---:|---:|---:|
| embark goods | 1,127–1,192 | no living observations | no living observations |
| blocks | 64–90 | no living observations | no living observations |
| furniture | 187–423 | no living observations | no living observations |
| crafts | 0–96 | no living observations | no living observations |
| meals/drink | 6,120–8,010 | no living observations | no living observations |
| iron goods | 180 | no living observations | no living observations |
| steel goods | 0 | no living observations | no living observations |
| iron bars | 0 | no living observations | no living observations |
| steel bars | 0 | no living observations | no living observations |
| gems | 0–45 | no living observations | no living observations |
| smoothing/engraving | 0 | no living observations | no living observations |
| other building value | 134–172 | no living observations | no living observations |
| trade purchases | 106–506 | no living observations | no living observations |
| barrels | 135–153 | no living observations | no living observations |
| other | 1,156–2,344 | no living observations | no living observations |

### Every annual wealth gap above 30%

Distance is measured from the nearest bound of the year’s model range. Only snapshots with living dwarves are compared; abandoned inventories remain in the complete seed table. Each row includes the production witnesses relevant to its cause. These are fixture limits or inventory overshoots, not grounds for tuning a material value.

| Seed / year | Wealth | Nearest bound / gap | Classification and evidence |
|---|---:|---|---|
| three-years / Y1 | 10,740 | 8,000 / +34.2% | FIXTURE: inventory overshoot; largest driver meals/drink 6,295 marks. The stock includes retained production, not cumulative exports. |
| three-years-p0-4 / Y1 | 11,546 | 8,000 / +44.3% | FIXTURE: inventory overshoot; largest driver meals/drink 6,615 marks. The stock includes retained production, not cumulative exports. |
| three-years-p0-4 / Y3 | 12,691 | 35,000 / -63.7% | FIXTURE, with the unfixed bugs below: iron goods 0, steel goods 0, steel bars 1,160; cumulative pick jobs 0, metal-craft jobs 0, alloy jobs 30, cut-gem jobs 0. Craft/metalcraft skill maxima 1/0; masterwork threshold is skill13. |
| three-years-p0-5 / Y1 | 11,010 | 8,000 / +37.6% | FIXTURE: inventory overshoot; largest driver meals/drink 6,325 marks. The stock includes retained production, not cumulative exports. |
| three-years-p0-5 / Y3 | 21,590 | 35,000 / -38.3% | FIXTURE, with the unfixed bugs below: iron goods 5,889, steel goods 960, steel bars 0; cumulative pick jobs 2, metal-craft jobs 42, alloy jobs 5, cut-gem jobs 12. Craft/metalcraft skill maxima 1/0; masterwork threshold is skill13. |
| three-years-p0-7 / Y3 | 8,915 | 35,000 / -74.5% | FIXTURE, with the unfixed bugs below: iron goods 0, steel goods 0, steel bars 160; cumulative pick jobs 0, metal-craft jobs 0, alloy jobs 4, cut-gem jobs 30. Craft/metalcraft skill maxima 1/0; masterwork threshold is skill13. |
| three-years-p2-3 / Y1 | 12,284 | 8,000 / +53.5% | FIXTURE: inventory overshoot; largest driver meals/drink 8,010 marks. The stock includes retained production, not cumulative exports. |
| three-years-p2-4 / Y1 | 10,431 | 8,000 / +30.4% | FIXTURE: inventory overshoot; largest driver meals/drink 6,120 marks. The stock includes retained production, not cumulative exports. |
| three-years-p2-6 / Y1 | 11,478 | 8,000 / +43.5% | FIXTURE: inventory overshoot; largest driver meals/drink 7,510 marks. The stock includes retained production, not cumulative exports. |

Owned meal stock fluctuates with cooking, eating and exports. Per-seed production and caravan outcomes below distinguish retained inventory from cumulative production; missing trades are never counted as purchases.


## Renown, raid size and immigration arithmetic

`18-threats-monsters-and-raids.md:22` gives `R = W/2000 + population×0.2`; `threatSchedules` peril-2 raid row gives `min(16, round(6 + 0.3R))`. The implementation currently counts all living fortress creatures, including tame animals (`src/systems/threats/index.ts:228–239`). The table uses each snapshot’s measured creature count for its population term. Renown is updated on the system/event cadence; year-end current inventory is not necessarily the inventory used at its last update.

| Year | Owned wealth | Dwarves / fortress creatures | Renown reader | Current-snapshot formula | Inferred wealth equivalent of reader | Illustrative peril-2 raid at this renown |
|---|---:|---:|---:|---:|---:|---:|
| 1 | 10,740 | 12 / 25 | 10.3025 | 10.3700 | 10,605 | 9 |
| 2 | 23,687 | 12 / 25 | 16.9625 | 16.8435 | 23,925 | 11 |
| 3 | 31,808 | 12 / 25 | 20.9050 | 20.9040 | 31,810 | 12 |

### Living peril-2 annual arithmetic

| Seed / year | Wealth / fortress creatures | Measured renown | W/2000 + 0.2C at snapshot | Raid size at measured renown |
|---|---|---:|---:|---:|
| three-years-p2-3 / Y1 | 12,284 / 3 | 6.8495 | 6.7420 | 8 |
| three-years-p2-4 / Y1 | 10,431 / 17 | 8.5195 | 8.6155 | 9 |
| three-years-p2-6 / Y1 | 11,478 / 15 | 8.7405 | 8.7390 | 9 |

### Every living renown gap above 30%

The narrative 5/15/30 values are representative rather than guarantees. These rows compare all living snapshots with them, and show the wealth that the unchanged implemented formula would need at that same creature count. These are FIXTURE inventory/population limits, with the animal-count specification ambiguity noted below; no independent renown-constant MODEL GAP is established. A negative required wealth means the narrative renown is already below the population term, so that target cannot be reached with nonnegative wealth.

| Seed / year | Measured / narrative renown | Gap | Current wealth / creatures | Wealth for narrative R at same C | Classification |
|---|---|---:|---|---:|---|
| three-years / Y1 | 10.3025 / 5 | +106.0% | 10,740 / 25 | 0 | FIXTURE: retained production and current creature composition; all fortress animals enter C. The reader can lag current inventory. |
| three-years / Y3 | 20.9050 / 30 | -30.3% | 31,808 / 25 | 50,000 | FIXTURE: retained production and current creature composition; all fortress animals enter C. The reader can lag current inventory. |
| three-years-p0-1 / Y1 | 9.7605 / 5 | +95.2% | 9,931 / 24 | 400 | FIXTURE: retained production and current creature composition; all fortress animals enter C. The reader can lag current inventory. |
| three-years-p0-1 / Y3 | 18.6585 / 30 | -37.8% | 26,749 / 27 | 49,200 | FIXTURE: retained production and current creature composition; all fortress animals enter C. The reader can lag current inventory. |
| three-years-p0-2 / Y1 | 9.8635 / 5 | +97.3% | 9,292 / 26 | -400 | FIXTURE: retained production and current creature composition; all fortress animals enter C. The reader can lag current inventory. |
| three-years-p0-3 / Y1 | 9.6175 / 5 | +92.3% | 10,348 / 22 | 1,200 | FIXTURE: retained production and current creature composition; all fortress animals enter C. The reader can lag current inventory. |
| three-years-p0-3 / Y3 | 18.7335 / 30 | -37.6% | 26,521 / 27 | 49,200 | FIXTURE: retained production and current creature composition; all fortress animals enter C. The reader can lag current inventory. |
| three-years-p0-4 / Y1 | 10.7585 / 5 | +115.2% | 11,546 / 25 | 0 | FIXTURE: retained production and current creature composition; all fortress animals enter C. The reader can lag current inventory. |
| three-years-p0-4 / Y3 | 12.9510 / 30 | -56.8% | 12,691 / 33 | 46,800 | FIXTURE: retained production and current creature composition; all fortress animals enter C. The reader can lag current inventory. |
| three-years-p0-5 / Y1 | 10.5955 / 5 | +111.9% | 11,010 / 25 | 0 | FIXTURE: retained production and current creature composition; all fortress animals enter C. The reader can lag current inventory. |
| three-years-p0-5 / Y3 | 15.9950 / 30 | -46.7% | 21,590 / 26 | 49,600 | FIXTURE: retained production and current creature composition; all fortress animals enter C. The reader can lag current inventory. |
| three-years-p0-6 / Y1 | 8.4340 / 5 | +68.7% | 7,556 / 23 | 800 | FIXTURE: retained production and current creature composition; all fortress animals enter C. The reader can lag current inventory. |
| three-years-p0-6 / Y3 | 18.0870 / 30 | -39.7% | 26,012 / 25 | 50,000 | FIXTURE: retained production and current creature composition; all fortress animals enter C. The reader can lag current inventory. |
| three-years-p0-7 / Y1 | 9.0970 / 5 | +81.9% | 8,572 / 24 | 400 | FIXTURE: retained production and current creature composition; all fortress animals enter C. The reader can lag current inventory. |
| three-years-p0-7 / Y3 | 11.4365 / 30 | -61.9% | 8,915 / 35 | 46,000 | FIXTURE: retained production and current creature composition; all fortress animals enter C. The reader can lag current inventory. |
| three-years-p2-3 / Y1 | 6.8495 / 5 | +37.0% | 12,284 / 3 | 8,800 | FIXTURE: retained production and current creature composition; all fortress animals enter C. The reader can lag current inventory. |
| three-years-p2-4 / Y1 | 8.5195 / 5 | +70.4% | 10,431 / 17 | 3,200 | FIXTURE: retained production and current creature composition; all fortress animals enter C. The reader can lag current inventory. |
| three-years-p2-6 / Y1 | 8.7405 / 5 | +74.8% | 11,478 / 15 | 4,000 | FIXTURE: retained production and current creature composition; all fortress animals enter C. The reader can lag current inventory. |

For the main Y3 creature count25, narrative R30 needs W=2,000×(30−0.2×25)=50,000 marks, versus 31,808 owned marks. At Y1 the same C25 already contributes R5 before any wealth; the narrative R5 therefore cannot coexist with positive wealth at that creature count. Counting its twelve dwarves alone would instead require W=2,000×(5−0.2×12)=5,200 marks, within the narrative Y1 range. This illustrates the population-definition ambiguity, not grounds to tune a negative population weight.

The equivalent wealth column is algebraically `(reader R − snapshot creatures×0.2)×2000`, **not a sampled historical wealth value**. These main-seed raid sizes are illustrative: its actual serene-valley parties are size-1 thieves. The living peril-2 arrival range is in the comparison table. A warned raid fixes its size before arrival, so substituting later year-end renown cannot reconstruct its exact warning-day size. The gate and after tables both use `RaidArrived.size`: the composition adds a captain on top of this raid size (`threat-schedules.md:75–80`, `src/systems/threats/parties.ts:78–86,278–283`).

Renown does **not** directly enter immigration. `21-immigration.md:20–35` checks living dwarves, no active raid/siege (otherwise daily defer), cap 80, spirit ≥55, wealth ≥2,000×prior waves, and winter only closed at temper ≥2. All these maps have temper 0, so winter is eligible and wave size is halved. A non-guaranteed eligible season draws `0..999 < 700 + 2×Mountainhome reputation`.

After the two guaranteed waves the next wealth floor is 4,000 marks. Every actual seasonal population, wealth, spirit, eligibility predicate and real roll is listed below. Higher renown cannot override a failed spirit predicate. At wealth39,000 a Content hall with reputation0 computes `2+floor(39,000/3,000)+(3-2)*2=17`, clamped to12 before the specification’s winter adjustment. Year-end spirit is not the seasonal eligibility sample.

Main + seven peaceful seeds: 72 living, non-guaranteed seasonal checks; failed predicates spirit 67, wealth 0, cap 0, winter 0, raid 0 (reasons can overlap); 5 eligible, 4 successful waves and 1 failed luck roll. Exact input values, overlapping reasons and daily deferrals follow in the seasonal/data sections.


### Measured eligible immigration arithmetic

Eligibility begins at spirit55, but Content tier3 begins at65 (`src/systems/morale/mood.ts:15–17`); a hall at55–64 is Fine tier2 and receives no size bonus. Reputation is recovered exactly from the observed probability `(permille−700)/2`. The table substitutes each eligible non-guaranteed check into the implemented size formula; on a failed luck roll the size is hypothetical, while successful planned sizes are verified against the observation.

| Seed / evaluation | Wealth / spirit / reputation | Size substitution | Winter / cap result | Roll test | Observed |
|---|---|---|---:|---|---|
| three-years-p0-4 / Y2 spring, day113 | 11,546 / 59.30 / 0 | 2+3+0+0=5 | 5 (open slots 68) | 659 < 700 | wave (5) |
| three-years-p0-4 / Y2 winter, day197 | 10,415 / 55.98 / 0 | 2+3+0+0=5 | 3 (open slots 63) | 423 < 700 | wave (3) |
| three-years-p0-4 / Y3 spring, day225 | 10,623 / 62.56 / 0 | 2+3+0+0=5 | 5 (open slots 60) | 767 < 700 | luck |
| three-years-p0-7 / Y2 winter, day197 | 10,019 / 59.78 / 1 | 2+3+0+0=5 | 3 (open slots 66) | 371 < 702 | wave (3) |
| three-years-p0-7 / Y3 spring, day225 | 11,302 / 59.25 / 1 | 2+3+0+0=5 | 5 (open slots 63) | 30 < 702 | wave (5) |

## Mood instrument

| Seed/layout | Sampled dwarf-days | Time mean | Hunger want % | Thirst want % | Social want % | Comfort want % | Joy want % | Baseline for frozen mean 55 / 70 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| three-years / economy | 3,668 | 34.65 | 46.5 | 45.7 | 92.8 | 98.4 | 98.8 | 75.343 / 90.519 |
| three-years / historical bare control | 554 | 23.12 | 81.6 | 13.2 | 15.9 | 99.1 | 99.1 | 87.345 / 102.415 |
| three-years-p0-1 / economy | 4,284 | 43.64 | 45.1 | 43.0 | 76.3 | 90.2 | 91.6 | 66.441 / 81.498 |
| three-years-p0-2 / economy | 3,948 | 36.90 | 47.6 | 45.4 | 90.7 | 98.0 | 98.6 | 73.107 / 88.223 |

The main decomposition includes baseline 55.00, hearth +6.00, personality -0.71, cap effect +1.48 and floor effect +0.000. The largest thought contributions follow; survival/company thoughts include both the negative-thought term and the capped need-pressure attribution used by the existing instrument.

| Thought | Dwarf-time active % | Mean contribution |
|---|---:|---:|
| `lonely` | 92.7 | -10.501 |
| `bored` | 98.9 | -5.397 |
| `thirsty` | 47.2 | -4.488 |
| `hungry` | 47.3 | -4.437 |
| `uncomfortable` | 98.3 | -3.798 |
| `tired` | 38.6 | -2.753 |
| `ate_lavish_meal` | 30.6 | +1.724 |
| `slept_in_decent_room` | 50.1 | +0.656 |
| `drank_ale` | 31.6 | +0.543 |
| `talked_with_friend` | 11.3 | +0.413 |
| `slept_on_floor_last_night` | 13.5 | -0.397 |
| `drank_fine_drink` | 13.5 | +0.395 |
| `harvest_in` | 16.1 | +0.311 |
| `talked_with_someone` | 12.9 | +0.291 |

Beds and hearth exist: {"bedsTotal": 14, "bedsBuilt": 14, "bedsPlanned": 0, "bedroomZones": 14, "bedroomsOwned": 12, "bedroomsRequirementsMet": 14, "bedroomTiers": {"0": 1, "1": 2, "2": 11}, "tablesTotal": 3, "tablesBuilt": 3, "chairsTotal": 9, "chairsBuilt": 9, "hearthState": "built", "hearthTier": 3, "bedItemsInStock": 22, "logItemsInStock": 375, "barrelItemsInStock": 102, "preparedMealsInStock": 28, "rawPlantsInStock": 0, "alcoholInStock": 7}. The main mean is therefore not explained by a wholly missing hall. Urgent production/mining and travel defer company, sitting and hearth visits. Existing `NEED_DEFER_PRIORITY=2` (`src/systems/dwarves/constants.ts:25`) compares the **effective** job priority (job + labor −5), so e.g. craft 3 + labor 3 −5 =1 and forge 3 + smithing 2 −5 =0 keep workers busy past WANT. Critical food/drink needs still interrupt at 85. All original floors/caps/no-peaceful-death assertions remain.

## Gaps above 30% and causes

Classification is about what these observations establish. A FIXTURE limit is not proof that the rules cannot reach the model. A BUG below is left unfixed. A MODEL GAP names a rule/content lever and an explicitly bounded closing calculation; no tuning is applied.

- **Wealth Y3: FIXTURE plus BUG/spec conflict.** Main 31,808 is 9.1% below the 35,000 lower bound. The gap is 3,192 marks. The mining budget is only three shallow phases, year-3 alloy is a finite 30-job order, workers are not assigned as dedicated high-skill craft specialists, and peaceful seeds can miss industrial startup/trade windows, with their unfinished forging counted below. Main maximum crafting/metalcrafting skills are 1/0; the main retained inventory contains no masterwork. `12-workshops-and-professions.md:83–94` needs skill ≥13 (`5×13+40=105`). At the real skill formula, level 13 requires 5,980 cumulative XP (100×13+30×13×12), versus recipe `craft_stone` XP8 per job before attributes. The script orders only thirty steel-alloy jobs once in year 3 and maintains sixty export crafts, while the generated upper mine is deliberately above the cavern bands. Those are finite player production orders, not economic rule caps. Adding a staffed long-term craft industry or deeper gem access is a fixture change, not justification for changing the iron=15/steel=40 material values. Living peril-2 ranges above identify which sites also miss the lower bound by >30%; extinct sites are survival limitations rather than wealth-model counterexamples.
- **Smoothing/engraving: BUG, contradictory specifications.** `balance.md:70–72` names these as wealth drivers; `13-items-and-storage.md:51–53` explicitly excludes engravings from v1 value; `14-buildings-and-rooms.md:94–96,118` gives tile improvements room score, while building wealth is material plus bonus. The script actually smooths/engraves, but the wealth ledger has zero tile term. The implementation follows the detailed valuation rule and contradicts the balance narrative. There is no existing engraving-wealth constant to name or responsibly tune. The owner must resolve that conflict before attributing invented marks to halls.
- **Consumption: FIXTURE / cross-system model assumption.** Main food 0.246065 is 48.7% low; drink 0.407308 is 47.1% low. The model’s 50-hour meal/31-hour drink assumes action at WANT=50. Urgent jobs defer to CRITICAL=85: even before travel/attributes that gives 24/85=0.282 meals and 24×1.6/85=0.452 drinks, much closer to observations. Main end-of-year Endurance averages are 53.42, 54.58, 55.75; hunger uses (150−Endurance)/100. Observed intervals are 97.54h / 58.92h including travel. Rates 1/1.6 match `10` and F-10; no need-rate bug is established.
- **Mood vs gate’s ~70: FIXTURE, with a conditional MODEL GAP if this workload is the intended competent baseline.** Main instrument 34.65 is 50.5% below 70. Persistent social/comfort/joy deficits are measured above, despite beds and a tier-3 hearth. `balance.md:91–96` describes 70 as a fed/rested peak and 55–60 as a steady mean; treating 70 as the required continuous mean also misreads the revised prose. If the owner wants this same observed economy workload to average 55 or 70, the named lever `MOOD_BASELINE` is currently 55 (`src/core/constants.ts:121`). Solving the existing mood formula against the frozen samples, including MOOD_MIN=0, MOOD_MAX=100 and the needs-met floor 20 minus pressure (NEED_PRESSURE_CAP=20), gives 75.343274 for 55 and 90.518795 for 70. The calculation solves F(B)=mean(max(0,min(100,max(B+rawOffset,20−needPressure)))) for each target over all daily dwarf samples. These close the static observed mean, not a validated future simulation: productivity, immigration and need behavior would feed back. A workload/specialization repair should precede accepting that baseline increase.
- **Non-guaranteed immigration: FIXTURE, primarily spirit with seed-specific wealth/defer failures recorded.** Count every actual eligible season/roll below before comparing to a three-wave year. Wealth can now support larger waves, but most seasonal spirit checks still fail. `IMMIGRATION_PERMILLE=700` cannot repair a failed predicate. Lowering `IMMIGRATION_SPIRIT_MIN=55` would admit neglected social/comfort/joy states and change the owner’s F-14 reward rule; the data does not establish that as a MODEL GAP. The conditional baseline calculation above is the only quantified mood-model lever, not an immigration recommendation.
- **Raid size: FIXTURE, downstream wealth/population and timing.** The measured living-raid ranges above must be compared to 10/15; any Y3 size≤10 is >30% short. For size15, `round(6+0.3R)=15` needs R≥28.333… (and <31.667 before rounding to16); exact narrative R30 means W=2,000×(30−0.2C). With C25, W50,000 yields R30 and size15. Current wealth, and raid timing before late-year production, explain smaller parties. Changing `RENOWN_WEALTH_DIVISOR=2000` or the `raid/peril2` content row’s `perRenown=300` merely compensates for an incomplete fixture; no independent raid-formula MODEL GAP is established.
- **Peril survival: FIXTURE, with a reproduced entrance/food-production dependency cycle.** The first two peril-2 seeds starve beginning day33 before the later bandit/ambush encounters; they complete only carpenter recipes and no cooking or brewing. A read-only 34-day reproduction on p2-1 shows that the planned still at (29,8,32) occupies the entrance stair (31,8,32) as a workshop corner. `test/scenarios/three_years_economy.ts:84–98` (`placeEconomyBuilding`) marks planned workshop corners as forbidden traffic; the top stair cannot be worked, the lower shaft jobs stay unreachable, both cave farms remain id0, and the still itself waits for missing inputs. At day30 the two original miners carry the two actual embark picks, yet all seven stair tiles retain their original floor/wall kinds. The gate-wall deferral does not prevent this separate workshop overlap. This planning failure blocks the economy before military equipment can be made; it must not be blamed on combat constants or treated as a competent peril-2 wealth result. The diagnostic snapshots are preserved in the data artifact. A future fixture repair should reserve the entrance and mine shafts, plus their access tiles, from every workshop footprint and temporary forbidden corner. No fixture was changed or sweep rerun during this measurement. Seed p2-3 does start brewing, cooking and crafts, but records fourteen bled-out deaths and one killed death (first on day60, last on day121). Its cumulative forge output is only two picks and one helm, with no completed mail/shield/sword and no smelting recipe; it has three dwarves at the Y1 snapshot and none thereafter. This is a demonstrated failure to get the ordered military metal chain staffed and supplied before combat, not a test of the armored-squad worked example. Where a seed does reach combat, the three-person squad/airlock still lacks the full hospital/traps/bridges/crossbow defense in the combat narrative; the recorded death causes distinguish those cases. Perils2/4 have no numerical survival guarantee, and no assertion was relaxed.

### Additional unfixed bugs / ambiguities

1. **Craft quality is lost in exported item definitions (BUG).** `scripts/export-tables.mjs:78–86` marks quality-bearing outputs by exact item id. Recipe outputs use symbolic `craft`; concrete figurine/ring/amulet IDs therefore remain `quality:false`. `src/systems/items/api.ts:342` consequently ignores their rolled quality. This violates the Q-marked stone/metal craft rows (`docs/03-content/workshops-and-recipes.md:96,171`), `12-workshops-and-professions.md:68,83–94`, and `items.md:5,114–116`. The trade example also values a fine stone craft at 9. Applying the existing quality table to the **same current owned crafts**, purely diagnostically, changes main wealth by Y1: -86, Y2: -74, Y3: -860 marks. Current poor/common crafts mean a fix would lower this inventory’s value, not close the observed Y3 gap; future masterworks would finally receive their premium.

2. **Interrupted workshop inputs can be consumed elsewhere, yet the original job still outputs (BUG).** During fixture authoring, on unchanged game source and seed `three-years-p0-2`, observational item notifications reproduce craft job1005 using sandstone item16777639/material145. After its interrupted reservation expires at tick53251, job1470 reserves the same input at54500. Craft1005 resumes at55401 with its stale delivered ID; the stone is destroyed at56720, and craft1005 completes at57039 with three material-0 amulets (value0). `src/systems/jobs/board.ts:510–514,753–758` releases reservations but retains delivered IDs and subtracts delivered counts without ownership revalidation. `src/systems/workshops/operate.ts:407–410,443–475` resolves a missing material to0 and produces output even when required consumption was zero. This violates the claim/fetch/consume contract in `11-jobs-and-labor.md:61,77–85` and `12-workshops-and-professions.md:68`. The twelve-event trace is preserved in the data artifact. This establishes a real bug; it does not quantify a fortress-wide counterfactual loss.

3. **Renown’s population includes animals (BUG candidate / spec ambiguity).** `src/systems/threats/index.ts:228–239` counts every living fortress creature. `18-threats-monsters-and-raids.md:22` says population, while `10-dwarves.md:118,123,132` and `21` use dwarf population. Each tame animal adds 0.2 renown under this implementation. Because `18` does not explicitly forbid animals, this needs an owner clarification rather than claiming a definitive formula bug. The arithmetic above uses the actual implementation.

4. **Winter wave clamp order (BUG / specification ordering conflict).** `docs/02-systems/21-immigration.md:31–35` clamps the computed size and then says the winter wave is halved. `src/systems/immigration/waves.ts:8–11` halves before applying the cap; `test/unit/immigration/waves.test.ts:10–14` explicitly names that implementation order, but its examples do not distinguish the two. At wealth39,000, Content, reputation0 and 68 open slots (12 dwarves), raw size is `2+13+2=17`: the implementation gives `min(12,ceil(17/2))=9`; the written sequence gives `ceil(min(12,17)/2)=6`. This is not a cause of skipped immigration, and it is left for the owner to resolve.

5. **Steel fuel accounting clarification (no established BUG).** `docs/03-content/minerals-and-metals.md:115,135` requires one iron bar, one flux and one carbon fuel, plus the ordinary smelter-job fuel. `src/content/generate.ts:243–250` and `src/systems/workshops/operate.ts:445–458` implement both fuels. `balance.md:62`’s one extra fuel can consistently mean the carbon input above the ordinary job fuel. An alloy job therefore consumes two charcoal bars, and forging consumes another job fuel. The fixture burns real logs for both; there is no demonstrated fuel-duplication bug or justified tuning here.

## Every seed: annual wealth, population, renown and outcomes

| Seed | Peril | Wealth Y1 / Y2 / Y3 | Population Y1 / Y2 / Y3 | Renown Y1 / Y2 / Y3 | Dwarf deaths | Extinct day | Other waves | Trades / arrivals | Food / drink per dwarf-day | Final mood |
|---|---:|---|---|---|---:|---|---:|---|---|---|
| three-years-p0-1 | 0 | 9,931 / 15,865 / 26,749 | 14 / 14 / 14 | 9.76 / 13.35 / 18.66 | 0 | — | 0 | 6/8 | 0.263 / 0.426 | 48.9 |
| three-years-p0-2 | 0 | 9,292 / 14,336 / 32,163 | 13 / 13 / 13 | 9.86 / 12.35 / 21.29 | 0 | — | 0 | 8/8 | 0.250 / 0.408 | 40.2 |
| three-years-p0-3 | 0 | 10,348 / 16,505 / 26,521 | 14 / 14 / 14 | 9.62 / 13.65 / 18.73 | 0 | — | 0 | 8/8 | 0.242 / 0.417 | 49.4 |
| three-years-p0-4 | 0 | 11,546 / 10,623 / 12,691 | 12 / 20 / 20 | 10.76 / 11.90 / 12.95 | 0 | — | 2 | 5/8 | 0.292 / 0.443 | 59.2 |
| three-years-p0-5 | 0 | 11,010 / 14,763 / 21,590 | 13 / 13 / 13 | 10.60 / 12.56 / 16.00 | 0 | — | 0 | 8/8 | 0.243 / 0.410 | 49.1 |
| three-years-p0-6 | 0 | 7,556 / 14,247 / 26,012 | 12 / 12 / 12 | 8.43 / 12.19 / 18.09 | 0 | — | 0 | 8/8 | 0.264 / 0.418 | 53.2 |
| three-years-p0-7 | 0 | 8,572 / 11,302 / 8,915 | 14 / 17 / 22 | 9.10 / 11.67 / 11.44 | 0 | — | 2 | 6/8 | 0.268 / 0.465 | 36.5 |
| three-years-p2-1 | 2 | 3,149 / 3,047 / 2,993 | 0 / 0 / 0 | 1.57 / 1.52 / 1.50 | 10 | 46 | 0 | 0/8 | 0.269 / 0.215 | extinct |
| three-years-p2-2 | 2 | 3,525 / 3,457 / 3,240 | 0 / 0 / 0 | 1.76 / 1.73 / 1.62 | 9 | 46 | 0 | 0/8 | 0.301 / 0.232 | extinct |
| three-years-p2-3 | 2 | 12,284 / 4,015 / 3,961 | 3 / 0 / 0 | 6.85 / 2.01 / 1.98 | 15 | 121 | 0 | 2/8 | 0.244 / 0.370 | extinct |
| three-years-p2-4 | 2 | 10,431 / 4,115 / 3,996 | 7 / 0 / 0 | 8.52 / 2.06 / 2.00 | 13 | 123 | 0 | 2/8 | 0.278 / 0.464 | extinct |
| three-years-p2-5 | 2 | 3,409 / 3,406 / 3,294 | 0 / 0 / 0 | 1.70 / 1.70 / 1.65 | 11 | 46 | 0 | 0/8 | 0.295 / 0.201 | extinct |
| three-years-p2-6 | 2 | 11,478 / 4,635 / 4,179 | 4 / 0 / 0 | 8.74 / 2.32 / 2.09 | 13 | 134 | 0 | 3/8 | 0.262 / 0.400 | extinct |
| three-years-p2-7 | 2 | 3,490 / 3,409 / 3,331 | 0 / 0 / 0 | 1.75 / 1.70 / 1.67 | 10 | 46 | 0 | 0/8 | 0.301 / 0.213 | extinct |
| three-years-p4-1 | 4 | 2,874 / 4,277 / 3,675 | 0 / 0 / 0 | 1.44 / 3.75 / 3.44 | 11 | 52 | 0 | 0/8 | 0.208 / 0.345 | extinct |
| three-years-p4-2 | 4 | 3,739 / 3,409 / 3,289 | 0 / 0 / 0 | 1.87 / 1.70 / 1.64 | 11 | 56 | 0 | 0/8 | 0.239 / 0.387 | extinct |
| three-years-p4-3 | 4 | 3,112 / 2,972 / 2,863 | 0 / 0 / 0 | 1.56 / 1.49 / 1.43 | 9 | 32 | 0 | 0/8 | 0.239 / 0.419 | extinct |
| three-years-p4-4 | 4 | 3,153 / 3,032 / 2,897 | 0 / 0 / 0 | 1.58 / 1.52 / 1.45 | 11 | 35 | 0 | 0/8 | 0.241 / 0.378 | extinct |
| three-years-p4-5 | 4 | 2,548 / 2,182 / 1,866 | 0 / 0 / 0 | 1.27 / 1.09 / 0.93 | 9 | 45 | 0 | 1/8 | 0.255 / 0.412 | extinct |
| three-years-p4-6 | 4 | 2,759 / 2,663 / 2,557 | 0 / 0 / 0 | 1.39 / 1.33 / 1.28 | 10 | 43 | 0 | 1/8 | 0.247 / 0.409 | extinct |

### Consumption and mood gaps above 30%

| Seed / metric | Observed | Model / gap | Classification and fact |
|---|---:|---|---|
| three-years / food | 0.246 | 0.48 / -48.7% | FIXTURE / model assumption: urgency defers action from WANT50 to CRITICAL85; integrated denominator 3807.93 living dwarf-days. |
| three-years / drink | 0.407 | 0.77 / -47.1% | FIXTURE / model assumption: urgency defers action from WANT50 to CRITICAL85; integrated denominator 3807.93 living dwarf-days. |
| three-years / final mood (gate peak) | 38.0 | 70 / -45.7% | FIXTURE: urgent work, needs and travel; snapshot spirit 37.96. Daily need attribution and the bounded baseline MODEL GAP sensitivity are measured on the four instrument layouts above. |
| three-years / final mood (current steady lower bound) | 38.0 | 55 / -30.9% | FIXTURE: urgent work, needs and travel; snapshot spirit 37.96. Daily need attribution and the bounded baseline MODEL GAP sensitivity are measured on the four instrument layouts above. |
| three-years-p0-1 / food | 0.263 | 0.48 / -45.1% | FIXTURE / model assumption: urgency defers action from WANT50 to CRITICAL85; integrated denominator 4423.85 living dwarf-days. |
| three-years-p0-1 / drink | 0.426 | 0.77 / -44.6% | FIXTURE / model assumption: urgency defers action from WANT50 to CRITICAL85; integrated denominator 4423.85 living dwarf-days. |
| three-years-p0-1 / final mood (gate peak) | 48.9 | 70 / -30.1% | FIXTURE: urgent work, needs and travel; snapshot spirit 49.28. Daily need attribution and the bounded baseline MODEL GAP sensitivity are measured on the four instrument layouts above. |
| three-years-p0-2 / food | 0.250 | 0.48 / -48.0% | FIXTURE / model assumption: urgency defers action from WANT50 to CRITICAL85; integrated denominator 4087.88 living dwarf-days. |
| three-years-p0-2 / drink | 0.408 | 0.77 / -47.0% | FIXTURE / model assumption: urgency defers action from WANT50 to CRITICAL85; integrated denominator 4087.88 living dwarf-days. |
| three-years-p0-2 / final mood (gate peak) | 40.2 | 70 / -42.6% | FIXTURE: urgent work, needs and travel; snapshot spirit 40.18. Daily need attribution and the bounded baseline MODEL GAP sensitivity are measured on the four instrument layouts above. |
| three-years-p0-3 / food | 0.242 | 0.48 / -49.7% | FIXTURE / model assumption: urgency defers action from WANT50 to CRITICAL85; integrated denominator 4423.85 living dwarf-days. |
| three-years-p0-3 / drink | 0.417 | 0.77 / -45.9% | FIXTURE / model assumption: urgency defers action from WANT50 to CRITICAL85; integrated denominator 4423.85 living dwarf-days. |
| three-years-p0-4 / food | 0.292 | 0.48 / -39.2% | FIXTURE / model assumption: urgency defers action from WANT50 to CRITICAL85; integrated denominator 5347.71 living dwarf-days. |
| three-years-p0-4 / drink | 0.443 | 0.77 / -42.4% | FIXTURE / model assumption: urgency defers action from WANT50 to CRITICAL85; integrated denominator 5347.71 living dwarf-days. |
| three-years-p0-5 / food | 0.243 | 0.48 / -49.4% | FIXTURE / model assumption: urgency defers action from WANT50 to CRITICAL85; integrated denominator 4115.90 living dwarf-days. |
| three-years-p0-5 / drink | 0.410 | 0.77 / -46.8% | FIXTURE / model assumption: urgency defers action from WANT50 to CRITICAL85; integrated denominator 4115.90 living dwarf-days. |
| three-years-p0-6 / food | 0.264 | 0.48 / -44.9% | FIXTURE / model assumption: urgency defers action from WANT50 to CRITICAL85; integrated denominator 3807.93 living dwarf-days. |
| three-years-p0-6 / drink | 0.418 | 0.77 / -45.8% | FIXTURE / model assumption: urgency defers action from WANT50 to CRITICAL85; integrated denominator 3807.93 living dwarf-days. |
| three-years-p0-7 / food | 0.268 | 0.48 / -44.3% | FIXTURE / model assumption: urgency defers action from WANT50 to CRITICAL85; integrated denominator 5375.63 living dwarf-days. |
| three-years-p0-7 / drink | 0.465 | 0.77 / -39.6% | FIXTURE / model assumption: urgency defers action from WANT50 to CRITICAL85; integrated denominator 5375.63 living dwarf-days. |
| three-years-p0-7 / final mood (gate peak) | 36.5 | 70 / -47.9% | FIXTURE: urgent work, needs and travel; snapshot spirit 36.77. Daily need attribution and the bounded baseline MODEL GAP sensitivity are measured on the four instrument layouts above. |
| three-years-p0-7 / final mood (current steady lower bound) | 36.5 | 55 / -33.6% | FIXTURE: urgent work, needs and travel; snapshot spirit 36.77. Daily need attribution and the bounded baseline MODEL GAP sensitivity are measured on the four instrument layouts above. |
| three-years-p2-1 / food | 0.269 | 0.48 / -44.0% | FIXTURE survival limits: 10 dwarf fatalities; recorded causes {'starvation': 10}; supply access and interrupted production confound the steady-consumption model; integrated denominator 278.97 living dwarf-days. |
| three-years-p2-1 / drink | 0.215 | 0.77 / -72.1% | FIXTURE survival limits: 10 dwarf fatalities; recorded causes {'starvation': 10}; supply access and interrupted production confound the steady-consumption model; integrated denominator 278.97 living dwarf-days. |
| three-years-p2-2 / food | 0.301 | 0.48 / -37.3% | FIXTURE survival limits: 9 dwarf fatalities; recorded causes {'starvation': 9}; supply access and interrupted production confound the steady-consumption model; integrated denominator 259.00 living dwarf-days. |
| three-years-p2-2 / drink | 0.232 | 0.77 / -69.9% | FIXTURE survival limits: 9 dwarf fatalities; recorded causes {'starvation': 9}; supply access and interrupted production confound the steady-consumption model; integrated denominator 259.00 living dwarf-days. |
| three-years-p2-3 / food | 0.244 | 0.48 / -49.1% | FIXTURE survival limits: 15 dwarf fatalities; recorded causes {'bled_out': 14, 'killed': 1}; supply access and interrupted production confound the steady-consumption model; integrated denominator 880.28 living dwarf-days. |
| three-years-p2-3 / drink | 0.370 | 0.77 / -51.9% | FIXTURE survival limits: 15 dwarf fatalities; recorded causes {'bled_out': 14, 'killed': 1}; supply access and interrupted production confound the steady-consumption model; integrated denominator 880.28 living dwarf-days. |
| three-years-p2-4 / food | 0.278 | 0.48 / -42.2% | FIXTURE survival limits: 13 dwarf fatalities; recorded causes {'bled_out': 13}; supply access and interrupted production confound the steady-consumption model; integrated denominator 976.05 living dwarf-days. |
| three-years-p2-4 / drink | 0.464 | 0.77 / -39.7% | FIXTURE survival limits: 13 dwarf fatalities; recorded causes {'bled_out': 13}; supply access and interrupted production confound the steady-consumption model; integrated denominator 976.05 living dwarf-days. |
| three-years-p2-5 / food | 0.295 | 0.48 / -38.5% | FIXTURE survival limits: 11 dwarf fatalities; recorded causes {'starvation': 11}; supply access and interrupted production confound the steady-consumption model; integrated denominator 297.92 living dwarf-days. |
| three-years-p2-5 / drink | 0.201 | 0.77 / -73.8% | FIXTURE survival limits: 11 dwarf fatalities; recorded causes {'starvation': 11}; supply access and interrupted production confound the steady-consumption model; integrated denominator 297.92 living dwarf-days. |
| three-years-p2-6 / food | 0.262 | 0.48 / -45.5% | FIXTURE survival limits: 13 dwarf fatalities; recorded causes {'bled_out': 12, 'killed': 1}; supply access and interrupted production confound the steady-consumption model; integrated denominator 832.84 living dwarf-days. |
| three-years-p2-6 / drink | 0.400 | 0.77 / -48.1% | FIXTURE survival limits: 13 dwarf fatalities; recorded causes {'bled_out': 12, 'killed': 1}; supply access and interrupted production confound the steady-consumption model; integrated denominator 832.84 living dwarf-days. |
| three-years-p2-7 / food | 0.301 | 0.48 / -37.2% | FIXTURE survival limits: 10 dwarf fatalities; recorded causes {'starvation': 10}; supply access and interrupted production confound the steady-consumption model; integrated denominator 281.97 living dwarf-days. |
| three-years-p2-7 / drink | 0.213 | 0.77 / -72.4% | FIXTURE survival limits: 10 dwarf fatalities; recorded causes {'starvation': 10}; supply access and interrupted production confound the steady-consumption model; integrated denominator 281.97 living dwarf-days. |
| three-years-p4-1 / food | 0.208 | 0.48 / -56.6% | FIXTURE survival limits: 11 dwarf fatalities; recorded causes {'bled_out': 5, 'killed': 3, 'starvation': 3}; supply access and interrupted production confound the steady-consumption model; integrated denominator 235.06 living dwarf-days. |
| three-years-p4-1 / drink | 0.345 | 0.77 / -55.2% | FIXTURE survival limits: 11 dwarf fatalities; recorded causes {'bled_out': 5, 'killed': 3, 'starvation': 3}; supply access and interrupted production confound the steady-consumption model; integrated denominator 235.06 living dwarf-days. |
| three-years-p4-2 / food | 0.239 | 0.48 / -50.3% | FIXTURE survival limits: 11 dwarf fatalities; recorded causes {'bled_out': 7, 'killed': 3, 'starvation': 1}; supply access and interrupted production confound the steady-consumption model; integrated denominator 330.89 living dwarf-days. |
| three-years-p4-2 / drink | 0.387 | 0.77 / -49.8% | FIXTURE survival limits: 11 dwarf fatalities; recorded causes {'bled_out': 7, 'killed': 3, 'starvation': 1}; supply access and interrupted production confound the steady-consumption model; integrated denominator 330.89 living dwarf-days. |
| three-years-p4-3 / food | 0.239 | 0.48 / -50.3% | FIXTURE survival limits: 9 dwarf fatalities; recorded causes {'bled_out': 8, 'killed': 1}; supply access and interrupted production confound the steady-consumption model; integrated denominator 222.12 living dwarf-days. |
| three-years-p4-3 / drink | 0.419 | 0.77 / -45.6% | FIXTURE survival limits: 9 dwarf fatalities; recorded causes {'bled_out': 8, 'killed': 1}; supply access and interrupted production confound the steady-consumption model; integrated denominator 222.12 living dwarf-days. |
| three-years-p4-4 / food | 0.241 | 0.48 / -49.7% | FIXTURE survival limits: 11 dwarf fatalities; recorded causes {'bled_out': 9, 'killed': 2}; supply access and interrupted production confound the steady-consumption model; integrated denominator 256.94 living dwarf-days. |
| three-years-p4-4 / drink | 0.378 | 0.77 / -51.0% | FIXTURE survival limits: 11 dwarf fatalities; recorded causes {'bled_out': 9, 'killed': 2}; supply access and interrupted production confound the steady-consumption model; integrated denominator 256.94 living dwarf-days. |
| three-years-p4-5 / food | 0.255 | 0.48 / -46.9% | FIXTURE survival limits: 9 dwarf fatalities; recorded causes {'bled_out': 4, 'killed': 5}; supply access and interrupted production confound the steady-consumption model; integrated denominator 255.01 living dwarf-days. |
| three-years-p4-5 / drink | 0.412 | 0.77 / -46.5% | FIXTURE survival limits: 9 dwarf fatalities; recorded causes {'bled_out': 4, 'killed': 5}; supply access and interrupted production confound the steady-consumption model; integrated denominator 255.01 living dwarf-days. |
| three-years-p4-6 / food | 0.247 | 0.48 / -48.4% | FIXTURE survival limits: 10 dwarf fatalities; recorded causes {'bled_out': 7, 'killed': 3}; supply access and interrupted production confound the steady-consumption model; integrated denominator 290.94 living dwarf-days. |
| three-years-p4-6 / drink | 0.409 | 0.77 / -46.9% | FIXTURE survival limits: 10 dwarf fatalities; recorded causes {'bled_out': 7, 'killed': 3}; supply access and interrupted production confound the steady-consumption model; integrated denominator 290.94 living dwarf-days. |

### Every living peril-2 raid gap above 30%

| Seed / arrival | Size | Model / gap | Classification and arithmetic |
|---|---:|---|---|

## Every seasonal immigration evaluation

All 11 season changes per seed are listed, including post-extinction no-ops. `G` means a guaranteed wave actually drew its size (no 700-permille roll); a raid-deferred guaranteed check has no draw and shows —; `—` means **no probability RNG draw was consumed**, because a predicate failed or evaluation was deferred. The observer clones the live immigration RNG state without advancing it, then forwards the real system handler unchanged. Reasons include spirit, wealth, cap, winter, active raid and no population; temper-0 winter never closes the pass. “Wave” includes the actual planned/arrived size. Daily deferred retries are also retained in the JSON artifact, and summarized after the seasonal rows.

| Seed | Season | Day | Population | Wealth | Spirit | Prior waves | Eligible / reasons | Roll / permille | Outcome |
|---|---|---:|---:|---:|---:|---:|---|---|---|
| three-years | Y1 summer | 29 | 7 | 3,078 | 26.62 | 0 | yes | G / 700 | wave (2) |
| three-years | Y1 autumn | 57 | 9 | 3,564 | 41.28 | 1 | yes | G / 700 | wave (3) |
| three-years | Y1 winter | 85 | 12 | 6,097 | 44.41 | 2 | no: spirit | — / 700 | spirit |
| three-years | Y2 spring | 113 | 12 | 10,740 | 43.62 | 2 | no: spirit | — / 700 | spirit |
| three-years | Y2 summer | 141 | 12 | 7,776 | 27.51 | 2 | no: spirit | — / 702 | spirit |
| three-years | Y2 autumn | 169 | 12 | 8,689 | 35.27 | 2 | no: spirit | — / 702 | spirit |
| three-years | Y2 winter | 197 | 12 | 12,335 | 40.55 | 2 | no: spirit | — / 702 | spirit |
| three-years | Y3 spring | 225 | 12 | 23,687 | 46.98 | 2 | no: spirit | — / 702 | spirit |
| three-years | Y3 summer | 253 | 12 | 14,070 | 31.38 | 2 | no: spirit | — / 706 | spirit |
| three-years | Y3 autumn | 281 | 12 | 13,746 | 30.90 | 2 | no: spirit | — / 706 | spirit |
| three-years | Y3 winter | 309 | 12 | 19,436 | 31.81 | 2 | no: spirit | — / 706 | spirit |
| three-years-p0-1 | Y1 summer | 29 | 7 | 3,293 | 32.82 | 0 | yes | G / 700 | wave (4) |
| three-years-p0-1 | Y1 autumn | 57 | 11 | 3,595 | 29.56 | 1 | yes | G / 700 | wave (3) |
| three-years-p0-1 | Y1 winter | 85 | 14 | 5,227 | 35.44 | 2 | no: spirit | — / 700 | spirit |
| three-years-p0-1 | Y2 spring | 113 | 14 | 9,931 | 48.54 | 2 | no: spirit | — / 700 | spirit |
| three-years-p0-1 | Y2 summer | 141 | 14 | 9,226 | 36.39 | 2 | no: spirit | — / 702 | spirit |
| three-years-p0-1 | Y2 autumn | 169 | 14 | 9,541 | 41.47 | 2 | no: spirit | — / 702 | spirit |
| three-years-p0-1 | Y2 winter | 197 | 14 | 12,386 | 48.69 | 2 | no: spirit | — / 702 | spirit |
| three-years-p0-1 | Y3 spring | 225 | 14 | 15,865 | 45.12 | 2 | no: spirit | — / 702 | spirit |
| three-years-p0-1 | Y3 summer | 253 | 14 | 14,541 | 45.77 | 2 | no: spirit | — / 702 | spirit |
| three-years-p0-1 | Y3 autumn | 281 | 14 | 14,793 | 44.45 | 2 | no: spirit | — / 702 | spirit |
| three-years-p0-1 | Y3 winter | 309 | 14 | 17,911 | 47.79 | 2 | no: spirit | — / 702 | spirit |
| three-years-p0-2 | Y1 summer | 29 | 7 | 2,931 | 26.33 | 0 | yes | G / 700 | wave (2) |
| three-years-p0-2 | Y1 autumn | 57 | 9 | 3,442 | 30.94 | 1 | yes | G / 700 | wave (4) |
| three-years-p0-2 | Y1 winter | 85 | 13 | 5,684 | 37.59 | 2 | no: spirit | — / 700 | spirit |
| three-years-p0-2 | Y2 spring | 113 | 13 | 9,292 | 41.02 | 2 | no: spirit | — / 700 | spirit |
| three-years-p0-2 | Y2 summer | 141 | 13 | 7,742 | 36.42 | 2 | no: spirit | — / 702 | spirit |
| three-years-p0-2 | Y2 autumn | 169 | 13 | 9,882 | 32.02 | 2 | no: spirit | — / 702 | spirit |
| three-years-p0-2 | Y2 winter | 197 | 13 | 9,822 | 38.90 | 2 | no: spirit | — / 702 | spirit |
| three-years-p0-2 | Y3 spring | 225 | 13 | 14,336 | 42.33 | 2 | no: spirit | — / 702 | spirit |
| three-years-p0-2 | Y3 summer | 253 | 13 | 13,590 | 30.87 | 2 | no: spirit | — / 702 | spirit |
| three-years-p0-2 | Y3 autumn | 281 | 13 | 17,508 | 30.53 | 2 | no: spirit | — / 702 | spirit |
| three-years-p0-2 | Y3 winter | 309 | 13 | 21,505 | 41.21 | 2 | no: spirit | — / 702 | spirit |
| three-years-p0-3 | Y1 summer | 29 | 7 | 3,314 | 36.41 | 0 | yes | G / 700 | wave (4) |
| three-years-p0-3 | Y1 autumn | 57 | 11 | 3,943 | 45.99 | 1 | yes | G / 700 | wave (3) |
| three-years-p0-3 | Y1 winter | 85 | 14 | 8,133 | 53.16 | 2 | no: spirit | — / 700 | spirit |
| three-years-p0-3 | Y2 spring | 113 | 14 | 10,348 | 52.15 | 2 | no: spirit | — / 700 | spirit |
| three-years-p0-3 | Y2 summer | 141 | 14 | 8,425 | 40.65 | 2 | no: spirit | — / 702 | spirit |
| three-years-p0-3 | Y2 autumn | 169 | 14 | 9,444 | 49.46 | 2 | no: spirit | — / 702 | spirit |
| three-years-p0-3 | Y2 winter | 197 | 14 | 12,439 | 40.33 | 2 | no: spirit | — / 702 | spirit |
| three-years-p0-3 | Y3 spring | 225 | 14 | 16,505 | 50.78 | 2 | no: spirit | — / 702 | spirit |
| three-years-p0-3 | Y3 summer | 253 | 14 | 13,819 | 51.70 | 2 | no: spirit | — / 702 | spirit |
| three-years-p0-3 | Y3 autumn | 281 | 14 | 15,614 | 53.80 | 2 | no: spirit | — / 702 | spirit |
| three-years-p0-3 | Y3 winter | 309 | 14 | 19,465 | 51.23 | 2 | no: spirit | — / 702 | spirit |
| three-years-p0-4 | Y1 summer | 29 | 7 | 3,298 | 31.24 | 0 | yes | G / 700 | wave (2) |
| three-years-p0-4 | Y1 autumn | 57 | 9 | 3,336 | 32.02 | 1 | yes | G / 700 | wave (3) |
| three-years-p0-4 | Y1 winter | 85 | 12 | 8,414 | 39.58 | 2 | no: spirit | — / 700 | spirit |
| three-years-p0-4 | Y2 spring | 113 | 12 | 11,546 | 59.30 | 2 | yes | 659 / 700 | wave (5) |
| three-years-p0-4 | Y2 summer | 141 | 17 | 7,565 | 49.39 | 3 | no: spirit | — / 700 | spirit |
| three-years-p0-4 | Y2 autumn | 169 | 17 | 8,000 | 51.16 | 3 | no: spirit | — / 700 | spirit |
| three-years-p0-4 | Y2 winter | 197 | 17 | 10,415 | 55.98 | 3 | yes | 423 / 700 | wave (3) |
| three-years-p0-4 | Y3 spring | 225 | 20 | 10,623 | 62.56 | 4 | yes | 767 / 700 | luck |
| three-years-p0-4 | Y3 summer | 253 | 20 | 8,122 | 52.48 | 4 | no: spirit | — / 700 | spirit |
| three-years-p0-4 | Y3 autumn | 281 | 20 | 12,387 | 45.44 | 4 | no: spirit | — / 700 | spirit |
| three-years-p0-4 | Y3 winter | 309 | 20 | 11,333 | 47.43 | 4 | no: spirit | — / 700 | spirit |
| three-years-p0-5 | Y1 summer | 29 | 7 | 3,073 | 31.70 | 0 | yes | G / 700 | wave (3) |
| three-years-p0-5 | Y1 autumn | 57 | 10 | 3,558 | 37.17 | 1 | yes | G / 700 | wave (3) |
| three-years-p0-5 | Y1 winter | 85 | 13 | 6,053 | 42.37 | 2 | no: spirit | — / 700 | spirit |
| three-years-p0-5 | Y2 spring | 113 | 13 | 11,010 | 44.68 | 2 | no: spirit | — / 700 | spirit |
| three-years-p0-5 | Y2 summer | 141 | 13 | 7,278 | 36.31 | 2 | no: spirit | — / 702 | spirit |
| three-years-p0-5 | Y2 autumn | 169 | 13 | 8,511 | 40.86 | 2 | no: spirit | — / 702 | spirit |
| three-years-p0-5 | Y2 winter | 197 | 13 | 9,724 | 39.58 | 2 | no: spirit | — / 702 | spirit |
| three-years-p0-5 | Y3 spring | 225 | 13 | 14,763 | 49.33 | 2 | no: spirit | — / 702 | spirit |
| three-years-p0-5 | Y3 summer | 253 | 13 | 11,917 | 31.20 | 2 | no: spirit | — / 702 | spirit |
| three-years-p0-5 | Y3 autumn | 281 | 13 | 12,408 | 41.58 | 2 | no: spirit | — / 702 | spirit |
| three-years-p0-5 | Y3 winter | 309 | 13 | 14,826 | 40.02 | 2 | no: spirit | — / 702 | spirit |
| three-years-p0-6 | Y1 summer | 29 | 7 | 2,921 | 33.79 | 0 | yes | G / 700 | wave (2) |
| three-years-p0-6 | Y1 autumn | 57 | 9 | 3,587 | 34.64 | 1 | yes | G / 700 | wave (3) |
| three-years-p0-6 | Y1 winter | 85 | 12 | 4,600 | 47.65 | 2 | no: spirit | — / 700 | spirit |
| three-years-p0-6 | Y2 spring | 113 | 12 | 7,556 | 52.39 | 2 | no: spirit | — / 700 | spirit |
| three-years-p0-6 | Y2 summer | 141 | 12 | 8,232 | 52.29 | 2 | no: spirit | — / 702 | spirit |
| three-years-p0-6 | Y2 autumn | 169 | 12 | 8,898 | 52.22 | 2 | no: spirit | — / 702 | spirit |
| three-years-p0-6 | Y2 winter | 197 | 12 | 8,058 | 44.89 | 2 | no: spirit | — / 702 | spirit |
| three-years-p0-6 | Y3 spring | 225 | 12 | 14,247 | 50.43 | 2 | no: spirit | — / 702 | spirit |
| three-years-p0-6 | Y3 summer | 253 | 12 | 12,414 | 49.73 | 2 | no: spirit | — / 704 | spirit |
| three-years-p0-6 | Y3 autumn | 281 | 12 | 12,993 | 41.32 | 2 | no: spirit | — / 704 | spirit |
| three-years-p0-6 | Y3 winter | 309 | 12 | 16,560 | 42.46 | 2 | no: spirit | — / 704 | spirit |
| three-years-p0-7 | Y1 summer | 29 | 7 | 2,965 | 15.95 | 0 | yes | G / 700 | wave (3) |
| three-years-p0-7 | Y1 autumn | 57 | 10 | 4,158 | 34.89 | 1 | yes | G / 700 | wave (4) |
| three-years-p0-7 | Y1 winter | 85 | 14 | 6,684 | 40.04 | 2 | no: spirit | — / 700 | spirit |
| three-years-p0-7 | Y2 spring | 113 | 14 | 8,572 | 48.68 | 2 | no: spirit | — / 700 | spirit |
| three-years-p0-7 | Y2 summer | 141 | 14 | 8,969 | 37.80 | 2 | no: spirit | — / 702 | spirit |
| three-years-p0-7 | Y2 autumn | 169 | 14 | 9,529 | 42.32 | 2 | no: spirit | — / 702 | spirit |
| three-years-p0-7 | Y2 winter | 197 | 14 | 10,019 | 59.78 | 2 | yes | 371 / 702 | wave (3) |
| three-years-p0-7 | Y3 spring | 225 | 17 | 11,302 | 59.25 | 3 | yes | 30 / 702 | wave (5) |
| three-years-p0-7 | Y3 summer | 253 | 22 | 8,899 | 51.50 | 4 | no: spirit | — / 702 | spirit |
| three-years-p0-7 | Y3 autumn | 281 | 22 | 9,890 | 48.56 | 4 | no: spirit | — / 702 | spirit |
| three-years-p0-7 | Y3 winter | 309 | 22 | 9,226 | 38.85 | 4 | no: spirit | — / 702 | spirit |
| three-years-p2-1 | Y1 summer | 29 | 7 | 3,040 | 11.39 | 0 | yes | G / 700 | wave (3) |
| three-years-p2-1 | Y1 autumn | 57 | 0 | 3,470 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p2-1 | Y1 winter | 85 | 0 | 3,229 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p2-1 | Y2 spring | 113 | 0 | 3,149 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p2-1 | Y2 summer | 141 | 0 | 3,150 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p2-1 | Y2 autumn | 169 | 0 | 3,126 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p2-1 | Y2 winter | 197 | 0 | 3,071 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p2-1 | Y3 spring | 225 | 0 | 3,047 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p2-1 | Y3 summer | 253 | 0 | 3,023 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p2-1 | Y3 autumn | 281 | 0 | 3,023 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p2-1 | Y3 winter | 309 | 0 | 2,993 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p2-2 | Y1 summer | 29 | 7 | 3,258 | 11.68 | 0 | yes | G / 700 | wave (2) |
| three-years-p2-2 | Y1 autumn | 57 | 0 | 3,556 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p2-2 | Y1 winter | 85 | 0 | 3,525 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p2-2 | Y2 spring | 113 | 0 | 3,525 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p2-2 | Y2 summer | 141 | 0 | 3,525 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p2-2 | Y2 autumn | 169 | 0 | 3,525 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p2-2 | Y2 winter | 197 | 0 | 3,515 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p2-2 | Y3 spring | 225 | 0 | 3,457 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p2-2 | Y3 summer | 253 | 0 | 3,432 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p2-2 | Y3 autumn | 281 | 0 | 3,432 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p2-2 | Y3 winter | 309 | 0 | 3,264 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p2-3 | Y1 summer | 29 | 7 | 3,208 | 32.69 | 0 | yes | G / 700 | wave (4) |
| three-years-p2-3 | Y1 autumn | 57 | 11 | 3,684 | 39.62 | 1 | yes | G / 700 | wave (4) |
| three-years-p2-3 | Y1 winter | 85 | 3 | 7,426 | 37.75 | 2 | no: spirit | — / 700 | spirit |
| three-years-p2-3 | Y2 spring | 113 | 3 | 12,284 | 46.41 | 2 | no: spirit | — / 700 | spirit |
| three-years-p2-3 | Y2 summer | 141 | 0 | 4,207 | 55.00 | 2 | no: no_population | — / 700 | no_population |
| three-years-p2-3 | Y2 autumn | 169 | 0 | 4,082 | 55.00 | 2 | no: no_population | — / 700 | no_population |
| three-years-p2-3 | Y2 winter | 197 | 0 | 4,060 | 55.00 | 2 | no: no_population | — / 700 | no_population |
| three-years-p2-3 | Y3 spring | 225 | 0 | 4,015 | 55.00 | 2 | no: no_population | — / 700 | no_population |
| three-years-p2-3 | Y3 summer | 253 | 0 | 3,985 | 55.00 | 2 | no: no_population | — / 700 | no_population |
| three-years-p2-3 | Y3 autumn | 281 | 0 | 3,985 | 55.00 | 2 | no: no_population | — / 700 | no_population |
| three-years-p2-3 | Y3 winter | 309 | 0 | 3,961 | 55.00 | 2 | no: no_population | — / 700 | no_population |
| three-years-p2-4 | Y1 summer | 29 | 7 | 3,500 | 19.87 | 0 | yes | G / 700 | wave (3) |
| three-years-p2-4 | Y1 autumn | 57 | 10 | 4,126 | 51.66 | 1 | yes | G / 700 | wave (3) |
| three-years-p2-4 | Y1 winter | 85 | 7 | 10,046 | 40.40 | 2 | no: spirit | — / 700 | spirit |
| three-years-p2-4 | Y2 spring | 113 | 7 | 10,431 | 54.69 | 2 | no: spirit | — / 700 | spirit |
| three-years-p2-4 | Y2 summer | 141 | 0 | 4,822 | 55.00 | 2 | no: no_population | — / 700 | no_population |
| three-years-p2-4 | Y2 autumn | 169 | 0 | 4,115 | 55.00 | 2 | no: no_population | — / 700 | no_population |
| three-years-p2-4 | Y2 winter | 197 | 0 | 4,115 | 55.00 | 2 | no: no_population | — / 700 | no_population |
| three-years-p2-4 | Y3 spring | 225 | 0 | 4,115 | 55.00 | 2 | no: no_population | — / 700 | no_population |
| three-years-p2-4 | Y3 summer | 253 | 0 | 4,115 | 55.00 | 2 | no: no_population | — / 700 | no_population |
| three-years-p2-4 | Y3 autumn | 281 | 0 | 4,007 | 55.00 | 2 | no: no_population | — / 700 | no_population |
| three-years-p2-4 | Y3 winter | 309 | 0 | 3,996 | 55.00 | 2 | no: no_population | — / 700 | no_population |
| three-years-p2-5 | Y1 summer | 29 | 7 | 2,990 | 10.62 | 0 | yes | G / 700 | wave (4) |
| three-years-p2-5 | Y1 autumn | 57 | 0 | 3,465 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p2-5 | Y1 winter | 85 | 0 | 3,409 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p2-5 | Y2 spring | 113 | 0 | 3,409 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p2-5 | Y2 summer | 141 | 0 | 3,409 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p2-5 | Y2 autumn | 169 | 0 | 3,409 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p2-5 | Y2 winter | 197 | 0 | 3,406 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p2-5 | Y3 spring | 225 | 0 | 3,406 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p2-5 | Y3 summer | 253 | 0 | 3,342 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p2-5 | Y3 autumn | 281 | 0 | 3,318 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p2-5 | Y3 winter | 309 | 0 | 3,318 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p2-6 | Y1 summer | 29 | 7 | 3,493 | 31.95 | 0 | yes | G / 700 | wave (3) |
| three-years-p2-6 | Y1 autumn | 57 | 10 | 3,625 | 38.44 | 1 | yes | G / 700 | wave (3) |
| three-years-p2-6 | Y1 winter | 85 | 4 | 6,770 | 26.93 | 2 | no: spirit | — / 700 | spirit |
| three-years-p2-6 | Y2 spring | 113 | 4 | 11,478 | 36.15 | 2 | no: spirit | — / 700 | spirit |
| three-years-p2-6 | Y2 summer | 141 | 0 | 5,307 | 55.00 | 2 | no: no_population | — / 702 | no_population |
| three-years-p2-6 | Y2 autumn | 169 | 0 | 4,860 | 55.00 | 2 | no: no_population | — / 702 | no_population |
| three-years-p2-6 | Y2 winter | 197 | 0 | 4,635 | 55.00 | 2 | no: no_population | — / 702 | no_population |
| three-years-p2-6 | Y3 spring | 225 | 0 | 4,635 | 55.00 | 2 | no: no_population | — / 702 | no_population |
| three-years-p2-6 | Y3 summer | 253 | 0 | 4,410 | 55.00 | 2 | no: no_population | — / 700 | no_population |
| three-years-p2-6 | Y3 autumn | 281 | 0 | 4,410 | 55.00 | 2 | no: no_population | — / 700 | no_population |
| three-years-p2-6 | Y3 winter | 309 | 0 | 4,179 | 55.00 | 2 | no: no_population | — / 700 | no_population |
| three-years-p2-7 | Y1 summer | 29 | 7 | 3,310 | 5.57 | 0 | yes | G / 700 | wave (3) |
| three-years-p2-7 | Y1 autumn | 57 | 0 | 3,840 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p2-7 | Y1 winter | 85 | 0 | 3,570 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p2-7 | Y2 spring | 113 | 0 | 3,490 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p2-7 | Y2 summer | 141 | 0 | 3,490 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p2-7 | Y2 autumn | 169 | 0 | 3,466 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p2-7 | Y2 winter | 197 | 0 | 3,433 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p2-7 | Y3 spring | 225 | 0 | 3,409 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p2-7 | Y3 summer | 253 | 0 | 3,409 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p2-7 | Y3 autumn | 281 | 0 | 3,355 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p2-7 | Y3 winter | 309 | 0 | 3,331 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-1 | Y1 summer | 29 | 5 | 3,166 | 26.88 | 0 | yes | G / 700 | wave (4) |
| three-years-p4-1 | Y1 autumn | 57 | 0 | 3,258 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-1 | Y1 winter | 85 | 0 | 2,922 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-1 | Y2 spring | 113 | 0 | 2,874 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-1 | Y2 summer | 141 | 0 | 2,840 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-1 | Y2 autumn | 169 | 0 | 2,815 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-1 | Y2 winter | 197 | 0 | 4,323 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-1 | Y3 spring | 225 | 0 | 4,277 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-1 | Y3 summer | 253 | 0 | 3,675 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-1 | Y3 autumn | 281 | 0 | 3,675 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-1 | Y3 winter | 309 | 0 | 3,675 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-2 | Y1 summer | 29 | 7 | 4,017 | 42.39 | 0 | yes | G / 700 | wave (4) |
| three-years-p4-2 | Y1 autumn | 57 | 0 | 3,845 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-2 | Y1 winter | 85 | 0 | 3,739 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-2 | Y2 spring | 113 | 0 | 3,739 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-2 | Y2 summer | 141 | 0 | 3,643 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-2 | Y2 autumn | 169 | 0 | 3,553 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-2 | Y2 winter | 197 | 0 | 3,463 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-2 | Y3 spring | 225 | 0 | 3,409 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-2 | Y3 summer | 253 | 0 | 3,385 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-2 | Y3 autumn | 281 | 0 | 3,361 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-2 | Y3 winter | 309 | 0 | 3,313 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-3 | Y1 summer | 29 | 7 | 4,008 | 30.04 | 0 | yes | G / 700 | wave (2) |
| three-years-p4-3 | Y1 autumn | 57 | 0 | 3,933 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-3 | Y1 winter | 85 | 0 | 3,136 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-3 | Y2 spring | 113 | 0 | 3,112 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-3 | Y2 summer | 141 | 0 | 3,034 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-3 | Y2 autumn | 169 | 0 | 3,004 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-3 | Y2 winter | 197 | 0 | 2,988 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-3 | Y3 spring | 225 | 0 | 2,972 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-3 | Y3 summer | 253 | 0 | 2,940 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-3 | Y3 autumn | 281 | 0 | 2,924 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-3 | Y3 winter | 309 | 0 | 2,879 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-4 | Y1 summer | 29 | 7 | 3,506 | 42.13 | 0 | yes | G / 700 | wave (4) |
| three-years-p4-4 | Y1 autumn | 57 | 0 | 3,284 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-4 | Y1 winter | 85 | 0 | 3,177 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-4 | Y2 spring | 113 | 0 | 3,153 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-4 | Y2 summer | 141 | 0 | 3,153 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-4 | Y2 autumn | 169 | 0 | 3,080 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-4 | Y2 winter | 197 | 0 | 3,056 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-4 | Y3 spring | 225 | 0 | 3,032 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-4 | Y3 summer | 253 | 0 | 2,993 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-4 | Y3 autumn | 281 | 0 | 2,961 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-4 | Y3 winter | 309 | 0 | 2,929 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-5 | Y1 summer | 29 | 7 | 3,558 | 29.78 | 0 | yes | G / 700 | wave (2) |
| three-years-p4-5 | Y1 autumn | 57 | 0 | 2,981 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-5 | Y1 winter | 85 | 0 | 2,739 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-5 | Y2 spring | 113 | 0 | 2,548 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-5 | Y2 summer | 141 | 0 | 2,544 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-5 | Y2 autumn | 169 | 0 | 2,496 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-5 | Y2 winter | 197 | 0 | 2,206 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-5 | Y3 spring | 225 | 0 | 2,182 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-5 | Y3 summer | 253 | 0 | 2,009 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-5 | Y3 autumn | 281 | 0 | 1,978 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-5 | Y3 winter | 309 | 0 | 1,930 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-6 | Y1 summer | 29 | 7 | 3,125 | 25.87 | 0 | yes | G / 700 | wave (3) |
| three-years-p4-6 | Y1 autumn | 57 | 0 | 2,980 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-6 | Y1 winter | 85 | 0 | 2,807 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-6 | Y2 spring | 113 | 0 | 2,759 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-6 | Y2 summer | 141 | 0 | 2,735 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-6 | Y2 autumn | 169 | 0 | 2,711 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-6 | Y2 winter | 197 | 0 | 2,687 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-6 | Y3 spring | 225 | 0 | 2,663 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-6 | Y3 summer | 253 | 0 | 2,639 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-6 | Y3 autumn | 281 | 0 | 2,597 | 55.00 | 1 | no: no_population | — / 700 | no_population |
| three-years-p4-6 | Y3 winter | 309 | 0 | 2,577 | 55.00 | 1 | no: no_population | — / 700 | no_population |

### Deferred daily checks

No daily retry was triggered on these measured runs. Every seasonal check remains recorded, including post-extinction no-ops.

## Verification and reproducibility

Task 1 verification: lint, typecheck and content:check (50 tables / 1,585 rows) passed; **177 files / 1,636 tests** passed in 518.68s, with the three-year scenario in 269.03s. After the parent merged U-01/U-08/U-06 (report verification on 02eb6d9, leaving core/systems/headless unchanged and producing identical main economy telemetry), foreground report-commit verification also passed lint, typecheck and content:check (**50 tables / 1,612 rows**). Merged standard suite **184 files / 1700 tests**, all passed, 498.87s total, 272.22s three-year scenario. Targeted perf sweep: 1 file; 20 passed (20); 14929.27s. Per the owner’s reset instruction, the twenty-seed sweep file was run once; the whole perf tier was not rerun. The three-test mood instrument had already passed on this fixture on October 4 and its four observations are reused. No test was newly skipped, removed or loosened. No runtime dependency was added.

Reproduce with `npm test` and `npm run test:perf -- test/perf/three_years_seeds.test.ts --disableConsoleIntercept`; the separate mood instrument is `npm run test:perf -- test/perf/mood_breakdown.test.ts --disableConsoleIntercept`. Logs include `three_years economy`, `[three_years_economy]`, `[three_years_seeds_detail]` and `[three_years_mood]` JSON. [../M8-balance-economy-data.json](../data/M8-balance-economy-data.json) preserves every yearly driver/count/quality/skill snapshot, production count, caravan outcome, raid/death list, seasonal/daily evaluation, mood decomposition, resource audit and input-lifecycle bug trace. The telemetry neither advances live RNG streams nor mutates simulation state.
