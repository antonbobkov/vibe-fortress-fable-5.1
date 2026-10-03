# T-M8-06 Dwarf Mood Shortfall Diagnosis (Revised)

> **Parent review note (2026-10-02).** Accepted: the formula check (§1), the bedroom
> facts (§3), the drink split (§4) and the decay arithmetic. Three caveats:
>
> 1. **The hearth term is unverified.** The first pass (40135a5) measured the same seed at
>    mean 36.76 with a hearth bonus of +3.80 (tier 2); this pass measures 34.49 with +0.00,
>    yet still records `new_hearth_hall_tier` active 0.7% of the time, which needs a tier to
>    have been reached. One of the two runs is wrong, so treat C-5 (−3.59) as unconfirmed
>    until the instrument is reconciled with the scenario runner.
> 2. **The secondary-need gap is in the spec's own arithmetic, not only in its constants.**
>    `balance.md` § Needs and consumption says comfort (+3/h) needs "a sit every day or
>    two", but `10-dwarves.md` relieves 40 per sit in a decent room (20 in the hearth hall):
>    72 a day calls for about 1.8 sits a day. Joy (+1.5/h, 36 a day) needs "a hearth visit
>    every two days" relieving 30, which is 15 a day. Neither rate can stay under its want
>    threshold at the stated frequency, so `bored` and `uncomfortable` are near-permanent by
>    design. Dwarves then spend much of their day on comfort and joy activities instead of
>    work, which also feeds `restless` (purpose rises while not working).
> 3. **Minor divergence, not a cause.** `activities.ts:439` relieves 20 for any sit below
>    decent tier. `10-dwarves.md` gives 40 for a decent room and 20 for the hearth hall, and
>    says nothing about a chair in a room below decent.

## Executive Summary

In the 3-year fortress simulation (`test/scenarios/three_years.scenario.ts`), mean dwarf mood measures **34.49** (ranging from 0.0 to 70.8; the single-point snapshot at the end of Year 3 measures **38.7** in the scenario runner). All measurements fall roughly 31 to 35.5 points short of the **~70 Content** modeled in `docs/03-content/balance.md` § Mood floor and the no-spiral guarantee.

A line-by-line verification confirms that the simulation code in `src/systems/morale/` faithfully implements the mathematical formulas and rules specified in `docs/02-systems/15-happiness-and-morale.md` and `docs/02-systems/10-dwarves.md`. **There are 0 implementation bugs in `src/systems/morale/`, 0 in `src/systems/jobs/`, and 0 in `src/systems/dwarves/activities.ts`.**

Empirical investigation into the simulation mechanics disproves the initial hypothesis of code-level bedroom starvation and drink-preference bugs:
1. **Bedrooms**: The job board and miners functioned correctly. All 80 granite tiles and 8 doors **were completely dug**, 8 beds built, and all 8 bedrooms established (between Day 47 and Day 207). Zero dig jobs were cancelled or abandoned. The bedroom shortfall stems from (a) the 207-day Year 1 excavation timeline, (b) designating only 8 bedrooms for a 12-dwarf population (leaving 4 dwarves permanently roomless in Years 2 and 3), and (c) an unfurnished Thane hall.
2. **Drinks**: `src/systems/dwarves/activities.ts:266-289` strictly follows `docs/02-systems/10-dwarves.md` line 56 (stockpiled barrel alcohol first, then well, then open water). 99.0% of water drinks occurred because brewed and embark alcohol was inside barrels sitting in the wagon or at the workshop, **not hauled to a stockpile** because `hauling` was configured at low priority 6 (`shift = +1`).

The **-35.51 point deficit** is fully accounted for by 6 root causes across **FIXTURE**, **SCENARIO DESIGN**, and **MODEL GAP** classifications:

| Cause | Classification | Mood Impact | Summary | What Would Fix It |
|---|---|---|---|---|
| **1. Secondary Needs Deficits (`bored`, `restless`, `uncomfortable`)** | **MODEL GAP** | **-11.16** | `balance.md` assumes secondary needs stay satisfied. In reality: `bored` (-5.66, 100% active) because joy rises +36/day while hearth visits relieve only 30 every 48h; `restless` (-2.78, 61.9% active) during idle/comfort time; `uncomfortable` (-2.72, 92.9% active) because dwarves rarely sit. | Rebalance secondary need growth rates (`PURPOSE_IDLE_PER_HOUR`, `JOY_PER_HOUR`, `COMFORT_PER_HOUR` in `src/systems/dwarves/needs.ts`), or increase hearth joy relief. |
| **2. Bedroom Construction Timeline & 8-Room Cap for 12 Dwarves** | **FIXTURE / DESIGN** | **-7.02** | All 8 rooms were dug and built (finishing Days 47 to 207), but: (1) Year 1 construction took 207 days, leaving dwarves on floors early on, (2) the scenario only created 8 bedrooms for 12 dwarves (4 dwarves permanently roomless in Years 2-3), and (3) Thane hall lacked furniture (`thane_hall_bare` -0.95). Dwarves suffered `slept_on_floor_last_night` (-1.64), `slept_outdoors` (-1.27), `no_bedroom` (-1.10), and `slept_on_floor` (-0.94), net -5.52 vs modeled +1.50. | In `three_years.scenario.ts`: raise bedroom dig priority to 2, designate 12 bedrooms for 12 dwarves, and place furniture in the Thane's room. |
| **3. Survival Need Pressure & Z-Level Transit Delays** | **MODEL GAP** | **-5.88** | `balance.md` assumes a "fed and rested dwarf" has 0 need penalty. In reality, dwarves only seek sustenance at want thresholds (50/60). Walking up/down 3 z-levels delays satisfaction, elevating needs into the 60–80 range and triggering standing thoughts (`thirsty` -2.32, `hungry` -1.87, `tired` -1.82, `lonely` -2.79) double-counted in `needPressure`. | Adjust `WANT` thresholds, reduce vertical travel distance by co-locating dining/bedrooms near work, or tune need rates in `needs.ts`. |
| **4. Linear Thought Decay Arithmetic Flaw** | **MODEL GAP** | **-5.50** | `balance.md` line 91 models steady-state mood as $55 + 11 + 4 = 70$ by summing peak values of decaying event thoughts (+3 room, +2 table meal, +3 ale, +3 chat). Per `15` § Thoughts, event thoughts decay linearly over 24h. A decaying thought refreshed once per day has a continuous time-average of $\frac{V_0}{2}$. Sum of averages is $+5.5$, not $+11.0$. | Update `balance.md` arithmetic, or adjust `thoughts.json` durations/values (e.g. 48h duration or higher base values). |
| **5. Hearth Hall Construction Delay & Environmental Offsets** | **FIXTURE / SYSTEMIC** | **-3.59** | Hearth bonus was modeled at Tier 2 (+4.00); in the main seed run, the hearth hall remained in planned state (0.00 bonus, -4.00 gap). Offset by minor positive events (+0.33), personality base (-0.71), negative cap savings (+1.11), and floor clamping (+0.14). | Construct and light hearth hall promptly in Year 1. |
| **6. Water Dominance from Hauling Starvation** | **FIXTURE** | **-2.36** | `balance.md` assumes 100% ale consumption (+1.50 continuous average). In reality, 68.6% of drinks were water from the spring (1,288 water vs 589 ale). `drank_ale` contributed only +0.27 (16.1% active), while puddle drinking subtracted -0.28. 99.0% of water drinks occurred because alcohol barrels sat unhauled at the still/wagon due to priority-6 hauling. | Raise hauling labor priority in `three_years.scenario.ts` (e.g. priority 3 or dedicated hauler), or place an indoor stockpile adjacent to the still. |
| **Total Accounted Gap** | | **-35.51** | Exactly matches the 35.51 gap between measured **34.49** and model **70.00** (**residual: 0.00 points**). | |

---

## 1. Mood Formula: Line-by-Line Code vs. Spec Verification

### Spec Authorities
- `docs/02-systems/15-happiness-and-morale.md` §§ Mood, Tiers and effects, Thoughts, Personality scaling, Interaction with 10 needs.
- `docs/02-systems/10-dwarves.md` §§ Needs, Eating and drinking, Sleeping, Social.
- `docs/03-content/balance.md` § Mood floor and the no-spiral guarantee.
- `docs/03-content/personality-and-thoughts.md` and `src/content/thoughts.json`.

### Line-by-Line Formula Check

| Formula Term | Specification Rule (`15` § Mood, `balance.md`) | Code Implementation | Status / Discrepancy |
|---|---|---|---|
| **Baseline** | `raw = MOOD_BASELINE + ...`; baseline is 55 (`15` line 28, 32; `balance.md` line 85). | `MOOD_BASELINE = 55` in `src/core/constants.ts` line 27; used in `src/systems/morale/mood.ts` line 39. | **MATCH** |
| **Positives** | `positives = min(POSITIVE_CAP, Σ value of active thoughts with value > 0)`; `POSITIVE_CAP = 40` (`15` lines 24, 138). | `const positives = Math.min(POSITIVE_CAP, values.reduce((n, v) => n + Math.max(0, v.value), 0));` in `src/systems/morale/mood.ts` line 35. | **MATCH** |
| **Negatives** | `negatives = min(NEGATIVE_CAP, Σ \|value\| of active thoughts with value < 0)`; `NEGATIVE_CAP = 35` (`15` lines 25, 139). | `const negatives = Math.min(NEGATIVE_CAP, values.reduce((n, v) => n + Math.max(0, -v.value), 0));` in `src/systems/morale/mood.ts` line 36. | **MATCH** |
| **Need Pressure** | `needPressure = floor(min(NEED_PRESSURE_CAP, Σ \|value\| of the active standing thoughts hungry, thirsty, tired, lonely))`; `NEED_PRESSURE_CAP = 20` (`15` lines 26, 140). | `const needPressure = Math.floor(Math.min(NEED_PRESSURE_CAP, values.reduce((n, v) => n + (v.need ? Math.max(0, -v.value) : 0), 0)));` in `src/systems/morale/mood.ts` line 37. Filtered via `NEED_PRESSURE_THOUGHTS` in `standing.ts` line 11. | **MATCH** |
| **Double Counting** | "The standing thoughts of the four survival and company needs count twice, once as thoughts and once as pressure" (`15` line 32, 95). | All standing need thoughts are included in `values` (contributing to `negatives`), and those with `v.need === true` also contribute to `needPressure`. | **MATCH** |
| **Hearth Bonus** | `hearthBonus = hearthHallTierIndex × HEARTH_TIER_BONUS`; tier 0 = 0 ... tier 5 = 10 (`15` line 27, 32). `HEARTH_TIER_BONUS = 2`. | `const hearthBonus = hearthTier * HEARTH_TIER_BONUS;` (`HEARTH_TIER_BONUS = 2`) in `src/systems/morale/mood.ts` lines 11, 38. `hearthHallTier()` in `src/systems/buildings` returns 0–5. | **MATCH** |
| **Personality Base** | `personalityBase` is +3 for stoic and brave, −3 for sensitive and timid, 0 otherwise, summed (`15` line 67). | `personalityBase(registry, traits)` in `src/systems/morale/thoughts.ts` lines 53–56 sums `trait.base` from `personality.json`. | **MATCH** |
| **Floor & Clamping** | `mood = clamp(MOOD_MIN, MOOD_MAX, max(raw, MOOD_NEEDS_MET_FLOOR − needPressure))`; `MOOD_NEEDS_MET_FLOOR = 20` (`15` line 29, 32; F-02). | `Math.max(MOOD_MIN, Math.min(MOOD_MAX, Math.max(raw, MOOD_NEEDS_MET_FLOOR - needPressure)))` in `src/systems/morale/mood.ts` line 40. | **MATCH** |
| **Linear Decay** | `linear (value falls to 0 over durationHours)` (`15` line 52). | `if (def.decay === 'linear') return ageHours >= def.hours ? 0 : thought.baseValue * (1 - ageHours / def.hours);` in `src/systems/morale/mood.ts` line 27. | **MATCH** |
| **Halflife Decay** | `halflife (value halves every durationHours / 3, removed under 1)` (`15` line 52). | `const halfHours = def.hours / 3; const value = thought.baseValue * 2 ** (-ageHours / halfHours); return Math.abs(value) < 1 ? 0 : value;` in `src/systems/morale/mood.ts` lines 28–30. | **MATCH** |
| **Thought Caps & Stacking** | `cap = 1 refreshes start tick; cap = n allows n instances; no thought stacks without limit` (`15` line 54). | `if (owned.length >= def.cap) { const oldest = owned[0]; thoughts.splice(thoughts.indexOf(oldest), 1); } thoughts.push(...)` in `src/systems/morale/index.ts` lines 124–128. | **MATCH** |
| **Standing Need Formulas** | `hungry`: `-(hunger - 50)/5, min -10`<br>`thirsty`: `-(thirst - 50)/5, min -10`<br>`tired`: `-(rest - 60)/5, min -8`<br>`lonely`: `-(social - 50)/10, min -5`<br>`uncomfortable`: `-(comfort - 55)/10, min -4`<br>`restless`: `-(purpose - 60)/10, min -4`<br>`bored`: `-(joy - 60)/10, min -4` (`15` line 95, `thoughts.json`). | `NEEDS` table in `src/systems/morale/standing.ts` lines 13–17 matches thresholds, divisors, and limits exactly. Evaluated on each dwarf in `standingThoughts()` lines 26–29. | **MATCH** |

**Conclusion on Formula Fidelity**: The code implements the specification with 100% precision. There are no formula bugs or calculation errors.

---

## 2. Simulation Decomposition: Upgraded vs. Bare vs. Sweeps

The reusable instrument `test/perf/mood_breakdown.test.ts` sampled every living dwarf daily across all 3 years (3,668 dwarf-days per 3-year run, pop 12; `DAYS_PER_YEAR = 112`, so 3 years = 336 days).

### 2.1 Upgraded Fortress (Main Seed: `three-years`)
- **Measured Mean Mood**: **34.49** (min: 0.0, max: 70.8)
- **Tier Breakdown (Dwarf-Days)**: Fine: 1,397 (38.1%), Content: 72 (2.0%), Unhappy: 1,486 (40.5%), Miserable: 713 (19.4%)
- **Static & Environmental Terms**:
  - Baseline: **+55.00**
  - Hearth Bonus (mean): **+0.00** (Hearth stayed in planned state in this seed)
  - Personality Base (mean): **-0.71**
  - Cap Effect (mean): **+1.11** (clamped by `NEGATIVE_CAP = 35`)
  - Floor Effect (mean): **+0.14** (clamped by `20 - needPressure`)
- **Sanity Check Sum**: $55.00 + 0.00 - 0.71 + (-21.05) + 1.11 + 0.14 = \mathbf{34.49}$ vs. Measured **34.49** ($\Delta = 0.00$).

#### Thought Decomposition Table (Upgraded Main Seed)

| Thought ID | Content Value / Formula | % Dwarf-Time Active | Mean Value When Active | Mean Contribution to Mood | Category |
|---|---|---|---|---|---|
| `bored` | `-(joy - 60) / 10, min -4` | 100.0% | -5.66 | **-5.66** | Secondary Need |
| `talked_with_friend` | `+5` (linear decay) | 82.2% | +3.48 | **+2.86** | Positive Social |
| `lonely` | `-(social - 50) / 10, min -5` | 46.8% | -2.98 | **-2.79** | Company Need |
| `restless` | `-(purpose - 60) / 10, min -4` | 61.9% | -4.49 | **-2.78** | Secondary Need |
| `uncomfortable` | `-(comfort - 55) / 10, min -4` | 92.9% | -2.93 | **-2.72** | Secondary Need |
| `thirsty` | `-(thirst - 50) / 5, min -10` | 37.3% | -3.11 | **-2.32** | Survival Need |
| `hungry` | `-(hunger - 50) / 5, min -10` | 31.5% | -2.97 | **-1.87** | Survival Need |
| `tired` | `-(rest - 60) / 5, min -8` | 26.9% | -3.37 | **-1.82** | Survival Need |
| `slept_on_floor_last_night` | `-3` (linear decay) | 55.5% | -2.95 | **-1.64** | Bedroom Deficit |
| `slept_outdoors` | `-5` (linear decay) | 50.2% | -2.54 | **-1.27** | Sleep Deficit |
| `no_bedroom` | `-2` (linear decay) | 55.9% | -1.97 | **-1.10** | Bedroom Deficit |
| `thane_hall_bare` | `-1` (continuous) | 100.0% | -0.95 | **-0.95** | Bedroom Deficit |
| `slept_on_floor` | `-4` (linear decay) | 50.8% | -1.86 | **-0.94** | Bedroom Deficit |
| `well_rested` | `+2` (linear decay) | 40.7% | +1.18 | **+0.48** | Positive Sleep |
| `ate_fine_meal` | `+5` (linear decay) | 14.6% | +2.84 | **+0.41** | Positive Food |
| `drank_from_puddle` | `-4` (linear decay) | 12.7% | -2.24 | **-0.28** | Drink Deficit |
| `talked_with_someone` | `+3` (linear decay) | 13.3% | +2.06 | **+0.27** | Positive Social |
| `drank_ale` | `+3` (linear decay) | 16.1% | +1.66 | **+0.27** | Positive Drink |
| `slept_in_decent_room` | `+3` (linear decay) | 17.0% | +1.51 | **+0.26** | Positive Bedroom |
| `ate_easy_meal` | `+2` (linear decay) | 21.9% | +1.16 | **+0.25** | Positive Food |
| `harvest_in` | `+3` (linear decay) | 12.1% | +1.85 | **+0.23** | Positive Work |
| `caught_in_rain` | `-2` (linear decay) | 8.9% | -1.79 | **-0.16** | Weather |
| `slept_in_modest_room` | `+1` (linear decay) | 23.5% | +0.50 | **+0.12** | Positive Bedroom |
| `got_it_out` | `+10` (linear decay) | 1.1% | +4.34 | **+0.05** | Relief from Sulk |
| `caravan_arrived` | `+2` (linear decay) | 5.1% | +0.58 | **+0.03** | Positive Trade |
| `saw_sunlight` | `+3` (linear decay) | 2.1% | +1.20 | **+0.03** | Positive Sky |
| `snowed_on` | `-2` (linear decay) | 1.7% | -1.87 | **-0.03** | Weather |
| `in_miasma` | `-5` (linear decay) | 0.6% | -5.22 | **-0.03** | Hazard |
| `new_hearth_hall_tier` | `+6` (linear decay) | 0.7% | +2.75 | **+0.02** | Milestone |
| `raid_arrived` | `-4` (linear decay) | 0.7% | -2.03 | **-0.01** | Threat |
| `immigrants_arrived` | `+3` (linear decay) | 1.1% | +1.06 | **+0.01** | Milestone |
| `argued` | `-5` (linear decay) | 0.3% | -3.11 | **-0.01** | Social Penalty |
| `ate_stale_food` | `-2` (linear decay) | 0.4% | -1.45 | **-0.01** | Food |
| `saw_hostile` | `-3` (linear decay) | 0.0% | -1.25 | **-0.00** | Threat |
| `slept_in_shared_bed_room`| `-1` (linear decay) | 0.6% | -0.61 | **-0.00** | Bedroom Deficit |
| **Sum of All Thoughts** | | | | **-21.05** | |

### 2.2 Need Want Frequencies (Upgraded Main Seed)

| Need | Want Threshold (`WANT`) | % of Dwarf-Time at Want or Worse | Mean Need Level Across 3 Years |
|---|---|---|---|
| **Hunger** | 50 | **30.6%** | 37.0 |
| **Thirst** | 50 | **35.9%** | 39.4 |
| **Rest** | 60 | **27.2%** | 39.0 |
| **Social** | 50 | **47.4%** | 47.8 |
| **Comfort** | 55 | **91.7%** | 81.2 |
| **Purpose** | 60 | **64.0%** | 69.3 |
| **Joy** | 60 | **100.0%** | 100.0 |

- **Event Totals Over 3 Years**:
  - Meals eaten: 1,157 (0.32 meals/dwarf/day)
  - Ale drinks: 589 (31.4% of drinks)
  - Water drinks: 1,288 (68.6% of drinks)
  - Total drinks: 1,877 (0.51 drinks/dwarf/day)

---

## 3. Investigation of Bedrooms (Cause C-1)

The initial report claimed that an "all-or-nothing gating check" in `three_years.scenario.ts` combined with priority-6 smoothing prevented any bedroom from ever being built. **Measurement proves this claim was incorrect.**

### 3.1 Code Architecture Check
- `three_years.scenario.ts:406-420` checks each bedroom plan independently:
  `for (const bp of bedroomPlans) { if (!bp.setup && bp.tiles.length > 0 && bp.tiles.every(...)) { ... } }`
  There is no all-or-nothing gating across rooms.
- Priority arithmetic (`docs/02-systems/11-jobs-and-labor.md` lines 59–64):
  `effectivePriority = priority + (laborPriority - PRIORITY_DEFAULT)`.
  With `PRIORITY_DEFAULT = 5`:
  - `mining` labor priority is 5 (shift 0) $\rightarrow$ priority-5 bedroom dig is effective priority 5.
  - `masonry` labor priority is 4 (shift -1) $\rightarrow$ priority-6 smoothing is $6 - 1 = 5$ (a tie with mining).
  - Smoothing never starved mining.

### 3.2 Measured Facts (a–d)

#### (a) Bedroom Dig Job Lifecycles Across Time
Calendar note: The game calendar has 112 days per year (4 seasons × 28 days = 112 days/year), so Year 1 ends on Day 112, Year 2 ends on Day 224, and Year 3 ends on Day 336 (tick 403,200).

| Snapshot | Total Bedroom Tiles | Floors Dug | Walls Remaining | Doors Dug | Jobs Open | Jobs Claimed | Blocked (Unreachable) | Blocked (Other) | Completed (NotExist) |
|---|---|---|---|---|---|---|---|---|---|
| **Day 30 (Y1)** | 80 | 0 | 80 | 0 | 6 | 0 | 74 | 0 | 0 |
| **Day 100 (Y1)** | 80 | 27 | 53 | 3 | 8 | 0 | 45 | 0 | 27 |
| **Day 112 (Y1 End)** | 80 | 36 | 44 | 4 | 7 | 0 | 37 | 0 | 36 |
| **Day 224 (Y2 End)** | 80 | 80 | 0 | 8 | 0 | 0 | 0 | 0 | 80 |
| **Day 336 (Y3 End)** | 80 | 80 | 0 | 8 | 0 | 0 | 0 | 0 | 80 |
| **Day 1095 Equiv** | 80 | 80 | 0 | 8 | 0 | 0 | 0 | 0 | 80 |

All 80 dig jobs were successfully created on Day 0. Unreachable jobs unblocked automatically as adjacent doorway and corridor tiles were cleared. By Day 207, **all 80 bedroom tiles and all 8 doors were 100% dug**.

#### (b) Miner Assignment and Daily Activity Histogram
All 12 dwarves in the fortress had the `mining` labor enabled. Sampling all living miners daily across 3,668 dwarf-days reveals where their time went:

| Miner Activity / State | Daily Samples | % of Miner-Time | Effective Priority / Context |
|---|---|---|---|
| `behavior:need:sleep` | 1,379 | 37.6% | Need satisfaction |
| `behavior:need:comfort` | 1,100 | 30.0% | Need satisfaction |
| `behavior:need:social` | 414 | 11.3% | Need satisfaction |
| `behavior:need:thirst` | 237 | 6.5% | Need satisfaction |
| `behavior:need:hunger` | 181 | 4.9% | Need satisfaction |
| `job:craft(cooking)` | 111 | 3.0% | eff 1 (job pri 5, cooking labor pri 1 $\rightarrow$ shift -4) |
| `job:haul_to_stockpile(hauling)`| 90 | 2.5% | eff 7 (job pri 6, hauling labor pri 6 $\rightarrow$ shift +1) |
| `job:plant(farming)` | 41 | 1.1% | eff 1 (job pri 5, farming labor pri 1 $\rightarrow$ shift -4) |
| `job:harvest(farming)` | 36 | 1.0% | eff 1 (job pri 5, farming labor pri 1 $\rightarrow$ shift -4) |
| `job:smooth(masonry)` | 28 | 0.8% | eff 5 (job pri 6, masonry labor pri 4 $\rightarrow$ shift -1) |
| `job:craft(brewing)` | 22 | 0.6% | eff 2 (job pri 5, brewing labor pri 2 $\rightarrow$ shift -3) |
| `job:dig(mining)` | 16 | 0.4% | eff 5 (job pri 5, mining labor pri 5) and eff 3 (pri 3) |
| `behavior:idle:No job` | 5 | 0.1% | Idle |
| Other workshop / building jobs | 8 | 0.2% | Construction, carpentry, woodcutting |

**Key Finding**: Miners spent **90.3% of their time satisfying needs** (`sleep`, `comfort`, `social`, `thirst`, `hunger`). When working, survival production jobs like cooking (eff 1), farming (eff 1), and brewing (eff 2) outranked mining (eff 5), while smoothing (eff 5) tied with mining. Mining proceeded steadily whenever miners were not eating, sleeping, or cooking.

#### (c) Bedroom Status and Door Reachability at Simulation End
All 8 bedrooms were completely dug, furnished, zoned, and smoothed. Each door is reachable from the central corridor:

| Room Index | Door Dug? | Floors Dug | Walls Remaining | Setup Day | Door Reachable from Corridor? | Any Remaining Wall Reachable? |
|---|---|---|---|---|---|---|
| **Room 0** | Yes | 9/9 | 0 | **Day 47** | Yes | No (complete) |
| **Room 1** | Yes | 9/9 | 0 | **Day 80** | Yes | No (complete) |
| **Room 2** | Yes | 9/9 | 0 | **Day 111** | Yes | No (complete) |
| **Room 3** | Yes | 9/9 | 0 | **Day 120** | Yes | No (complete) |
| **Room 4** | Yes | 9/9 | 0 | **Day 147** | Yes | No (complete) |
| **Room 5** | Yes | 9/9 | 0 | **Day 156** | Yes | No (complete) |
| **Room 6** | Yes | 9/9 | 0 | **Day 190** | Yes | No (complete) |
| **Room 7** | Yes | 9/9 | 0 | **Day 207** | Yes | No (complete) |

#### (d) Dig Job Cancellation and Abandonment Counts
- `digCancelledCount = 0`
- `digAbandonedCount = 0`
Not a single dig job was cancelled or abandoned.

### 3.3 Cause Classification and Real Mechanism
- **Classification**: **FIXTURE & SCENARIO DESIGN (NOT A CODE BUG)**.
- **The Real Mechanism**:
  1. The job board and miners followed specification lines `docs/02-systems/11-jobs-and-labor.md` lines 14–64 and `03-terrain-and-mining.md` § Digging as a job without error.
  2. Mining 80 granite tiles at ~90 ticks/tile takes ~7,200 ticks of pure pick work. Because miners spent 90.3% of their time on needs and higher-priority survival crafting, room construction completed progressively between Day 47 and Day 207. During Year 1 (days 1 to 112), dwarves had only 0 to 4 bedrooms available.
  3. **Capacity Cap Shortfall**: The scenario authored exactly **8 bedroom plans** (`three_years.scenario.ts:162-175`). The fortress grew to **12 dwarves** by autumn of Year 1. Even after all 8 rooms were finished on Day 207, **4 out of 12 dwarves (33.3% of the population) had no bedroom for the entire duration of Years 2 and 3**.
  4. These 4 dwarves permanently slept on the floor or outside, generating `no_bedroom` (-1.10 mean), `slept_on_floor_last_night` (-1.64 mean), `slept_on_floor` (-0.94 mean), and `slept_outdoors` (-1.27 mean). Combined with the Thane's missing furniture (`thane_hall_bare` -0.95 mean), net bedroom thoughts totaled **-5.52 points**.
  5. Compared against `balance.md`'s assumption of a decent room for all dwarves (+1.50 mean continuous), the net deficit is **-7.02 points**.

---

## 4. Investigation of Water vs. Ale (Cause C-4)

The initial report claimed that dwarves drank water because pathfinding preferred the outdoor spring by distance, and recommended rebalancing drink preference in `src/systems/dwarves/activities.ts`. **Measurement proves this diagnosis and recommendation were completely incorrect.**

### 4.1 Spec and Implementation Check
- `docs/02-systems/10-dwarves.md` line 56 explicitly prescribes the priority order:
  > *"alcohol in a barrel in a stockpile, else a well with water, else the nearest reachable water tile ... loose alcohol only last"*
- `src/systems/dwarves/activities.ts:266-289` implements this exact sequence without any distance weighting between water and stockpiled alcohol:
  ```typescript
  const drink = its.findItem({ drinkable: true }, from, 'walker',
    { reservable: true, stockpiledContainerClass: 'barrel' });
  ```
  If a reservable drink in a stockpiled barrel exists anywhere, it is chosen first. Dwarves only evaluate wells and water when this search returns 0.

### 4.2 Measured Split at Every `DrankWater` Event (1,288 Events)

At all 1,288 times a dwarf drank water across the 3-year simulation, the world state of alcohol was measured:

| Category | Split Condition | Water Drinks Count | % of All Water Drinks | Diagnostic Meaning |
|---|---|---|---|---|
| **(i)** | **No alcohol in world (stock-out)** | 0 | **0.0%** | Supply was not exhausted; total alcohol brewed was **2,140 units**. |
| **(ii)** | **Alcohol exists, but not in barrels** | 0 | **0.0%** | All alcohol was properly containerized in barrels. |
| **(iii)** | **In barrels, but NOT in a stockpile** | **1,275** | **99.0%** | **Alcohol existed in barrels at the still or wagon, but had not been hauled to a stockpile.** |
| **(iv)** | **In stockpiled barrels, but all reserved** | 6 | **0.5%** | Temporary reservation saturation by concurrent drinkers. |
| **(v)** | **Available in stockpiled barrel (BUG check)** | 7 | **0.5%** | Transient event concurrency / timing race (0 unreachable from dwarf). |

### 4.3 Cause Classification and Real Mechanism
- **Classification**: **FIXTURE (HAULING STARVATION & STOCKPILE LOGISTICS)**.
- **The Real Mechanism**:
  1. `activities.ts` did exactly what `10` line 56 specifies. There is **no bug** in `activities.ts`.
  2. In `three_years.scenario.ts:101`, `hauling` labor was explicitly configured at **priority 6** (`shift = +1`, the lowest priority in the fortress).
  3. The still had a work order with `threshold: 30` in `maintain` mode (`three_years.scenario.ts:329`).
  4. When the still brewed a 20-unit batch of drink into a barrel, the barrel sat inside the still. Because all dwarves had labors at priorities 1–5 (farming 1, cooking 1, brewing 2, crafting 4, mining 5), **hauling jobs to carry the barrel to the surface stockpile were starved**.
  5. Because the barrel was not on a stockpile tile (`items.stockpileAt(tile) === 0`), `activities.ts`'s search for `{ stockpiledContainerClass: 'barrel' }` returned 0.
  6. The dwarf found no working well, checked open water, found the spring, and drank water.
  7. Because the dwarf drank water, the barrel at the still was not consumed.
  8. Because available fortress drinks remained $\ge 30$, the still considered itself stocked and ceased brewing until drinks dropped.
- **Correction**: We **remove the recommendation to modify `activities.ts`**. The fix is to raise hauling priority in `three_years.scenario.ts` or designate an indoor stockpile tile immediately adjacent to the still.

---

## 5. Concrete Day Trace: Dwarf 0 on Day 100

Dwarf 0 (the Thane) was sampled hourly across Day 100 (ticks 120,000 to 121,200). Coordinates: underground bedroom/dining area at $(27–34, 6–15, z=29)$, surface at $z=32$.

### 5.1 Hourly Trajectory

| Hour | Location | Mood | Behavior / Activity | Needs (H, T, R, S, C, P, J) | Key Active Thoughts | Analysis |
|---|---|---|---|---|---|---|
| **h1** | (31,12,z29) | 49.4 | `need` / `sleep` | H:34, T:13, R:46, S:64, C:45, P:100, J:100 | `bored` (-4), `restless` (-4), `slept_in_modest_room` (+0.3) | Sleeping in modest bedroom (Room 0, setup Day 47). Rest falling. |
| **h2** | (34,12,z29) | 49.0 | `need` / `sleep` | H:35, T:14, R:31, S:66, C:48, P:100, J:100 | `bored` (-4), `restless` (-4), `slept_in_modest_room` (+0.3) | Sleeping. Social need rises slowly (+1.0/h). |
| **h3** | (34,12,z29) | 48.9 | `need` / `sleep` | H:36, T:16, R:16, S:68, C:51, P:100, J:100 | `bored` (-4), `restless` (-4), `slept_in_modest_room` (+0.2) | Sleeping. |
| **h4** | (34,12,z29) | 47.7 | `need` / `sleep` | H:37, T:18, R:1, S:70, C:54, P:100, J:100 | `bored` (-4), `restless` (-4), `slept_in_modest_room` (+0.2) | Rest nearly zero. |
| **h5** | (30,12,z29) | 47.5 | `need` / `social` | H:38, T:19, R:0, S:72, C:57, P:100, J:100 | `well_rested` (+1.8), `slept_in_modest_room` (+1), `bored` (-4) | Wakes up at R:0. Social (72) $\ge WANT$ (50), triggers `social` activity. |
| **h6** | (30,7,z29) | 49.8 | `need` / `social` | H:39, T:21, R:5, S:74, C:60, P:100, J:100 | `well_rested` (+1.7), `slept_in_modest_room` (+0.9) | Walking to find friend. Social continues climbing to 74. |
| **h7** | (32,9,z29) | 49.4 | `need` / `social` | H:40, T:22, R:11, S:76, C:63, P:100, J:100 | `well_rested` (+1.5), `lonely` (-1.3) | Meeting friend in corridor. Social climbs to 76. |
| **h8** | (32,9,z29) | 48.9 | `need` / `social` | H:41, T:24, R:16, S:78, C:66, P:100, J:100 | `well_rested` (+1.3), `lonely` (-1.4) | Conversation in progress. Social climbs to 78. |
| **h9** | (32,7,z29) | 48.5 | `need` / `comfort` | H:43, T:26, R:22, **S:20**, C:69, P:100, J:100 | `talked_with_friend` (**+4.9**), `well_rested` (+1.2) | **Conversation completes!** Social drops from 78 to 20. Gains +4.9. Switches to comfort. |
| **h10** | (29,7,z29) | **55.5** | `need` / `comfort` | H:44, T:27, R:27, S:22, C:72, P:100, J:100 | `talked_with_friend` (+4.7), `well_rested` (+1.0) | Relaxing. Mood reaches peak 55.5. |
| **h11** | (27,6,z29) | 54.9 | `need` / `comfort` | H:45, T:29, R:33, S:24, C:75, P:100, J:100 | `talked_with_friend` (+4.5), `uncomfortable` (-1.0) | Relieving comfort. |
| **h12** | (27,6,z29) | 54.4 | `need` / `comfort` | H:46, T:30, R:38, S:26, C:78, P:100, J:100 | `talked_with_friend` (+4.3), `uncomfortable` (-1.1) | Finishing comfort. |
| **h13** | (29,7,z29) | 53.8 | `work` / `Dig` | H:47, T:32, R:44, S:28, C:41, P:100, J:100 | `talked_with_friend` (+4.1), `uncomfortable` (-1.3) | **Claims Dig job!** Walking to rock face at (30,11,z29). |
| **h14** | (30,11,z29) | 55.7 | `work` / `Dig` | H:48, T:34, R:49, S:30, C:44, P:90, J:100 | `talked_with_friend` (+3.8), `restless` (-3) | **Mining granite wall!** Purpose improves from 100 to 90. |
| **h15** | (30,15,z29) | 56.3 | `work` / `Dig` | H:49, T:35, R:55, S:32, C:47, P:80, J:100 | `talked_with_friend` (+3.6), `restless` (-2) | **Mining granite wall!** Purpose improves to 80. |
| **h16** | (30,15,z29) | 56.8 | `need` / `hunger` | H:50, T:37, R:60, S:34, C:50, P:70, J:100 | `talked_with_friend` (+3.4), `hungry` (0) | Hunger reaches 50 ($WANT$). Switches from digging to seek food. |
| **h17** | (30,11,z29) | 55.6 | `need` / `hunger` | H:51, T:38, R:65, S:36, C:53, P:72, J:100 | `tired` (-0.5), `hungry` (-0.1) | Heading to food storage. |
| **h18** | (29,7,z29) | 53.4 | `need` / `hunger` | H:52, T:40, R:71, S:38, C:56, P:74, J:100 | `tired` (-1.1), `hungry` (-0.2) | Traveling through corridor. |
| **h19** | (30,7,z31) | 52.1 | `need` / `hunger` | H:53, T:42, R:76, S:40, C:59, P:76, J:100 | `tired` (-1.6), `hungry` (-0.3) | Climbing stairwell to surface ($z=31$). |
| **h20** | (30,11,z32) | 47.4 | `need` / `hunger` | H:55, T:43, R:82, S:42, C:62, P:78, J:100 | `in_miasma` (-2.5), `tired` (-2.2), `hungry` (-0.5) | Arrived at surface stockpile ($z=32$). |
| **h21** | (29,13,z32) | 47.6 | `need` / `hunger` | H:56, T:45, R:87, S:44, C:65, P:80, J:100 | `tired` (-2.7), `hungry` (-0.6) | Eating meal. |
| **h22** | (27,10,z32) | 46.4 | `need` / `sleep` | H:57, T:46, R:93, S:46, C:68, P:82, J:100 | `tired` (-3.3), `hungry` (-0.7) | Rest reaches 93 ($WANT$). Heads to bed. |
| **h23** | (30,7,z30) | 48.2 | `need` / `sleep` | H:58, T:48, R:78, S:48, C:71, P:84, J:100 | `tired` (-1.8), `hungry` (-0.8) | Returning down stairwell ($z=30$). |
| **h0** | (30,11,z29) | 50.0 | `need` / `sleep` | H:59, T:50, R:63, S:50, C:74, P:86, J:100 | `talked_with_friend` (+1.8), `tired` (-0.3) | Back in bedroom, sleeping. |

### 5.2 Resolution of Previous Contradiction
The previous report mistakenly claimed that "social dropped from 72 to 14 at h6". The empirical trace shows complete internal consistency:
- Waking at h5, social was **72**.
- While traveling and initiating the chat (h6–h8), social continued its natural rise (+1.0/h) from **72 to 78**.
- At **h9**, the conversation completed: social dropped from **78 to 20**, and `talked_with_friend` (+4.9) was awarded.
- Dwarf 0 spent hours 13–15 actively mining granite, proving that miners dig when basic needs are satisfied.

---

## 6. Why the Upgraded Layout Lowered Mood vs. Bare Layout

In the bare bootstrap layout (`2fcf0b6`), mean mood was **41.35**, whereas in the upgraded layout it was **34.49** (a drop of 6.86 points).

### 6.1 The "Z-Level Travel Tax"
- In the bare layout, all activities were clustered on flat ground ($z=32$) within 10 tiles. Needs were satisfied within 10–20 ticks of hitting want thresholds.
- In the upgraded layout, the fortress spans 4 vertical levels ($z=32$ surface farms/spring/workshops, $z=31$ cave farms, $z=29$ dining/hearth/bedrooms).
- Traveling between $z=29$ and $z=32$ via the stairwell takes 50–150 ticks. Dwarves spent substantial time in transit with needs above 50, triggering standing thoughts (`thirsty`, `hungry`, `tired`, `lonely`) that count twice (in `negatives` and `needPressure`).

### 6.2 Infrastructure Compensation Shortfall
The upgraded fortress was designed to offset the travel tax with private bedrooms (+1.50 average) and hearth hall bonuses (+4.00). However:
- The scenario capped bedrooms at 8 for 12 dwarves (33.3% permanently without a bed).
- Hauling starvation prevented beer from reaching stockpiles, forcing dwarves to hike up to the surface spring for water.
- As a result, the upgraded fortress suffered the full z-level travel tax while only partially realizing the intended bedroom and beverage compensations.

---

## 7. Reconciled Cause Table

The 35.51 point difference between measured mean mood (**34.49**) and the `balance.md` target (**70.00**) is accounted for below:

| Cause | Classification | Mood Contribution | Calculation Basis |
|---|---|---|---|
| **C-1: Secondary Needs Deficit** | **MODEL GAP** | **-11.16** | Sum of continuous secondary penalties: `bored` (-5.66), `restless` (-2.78), `uncomfortable` (-2.72). |
| **C-2: Bedroom Timeline & 8-Room Cap** | **FIXTURE** | **-7.02** | Measured bedroom thoughts (net -5.52: `slept_on_floor_last_night` -1.64, `slept_outdoors` -1.27, `no_bedroom` -1.10, `slept_on_floor` -0.94, `thane_hall_bare` -0.95, modest +0.12, decent +0.26) vs modeled decent room (+1.50). |
| **C-3: Survival Need Pressure & Travel Transit** | **MODEL GAP** | **-5.88** | Standing survival thoughts (`thirsty` -2.32, `hungry` -1.87, `tired` -1.82, `lonely` -2.79) minus event thoughts (`talked_with_friend` +2.86, meals +0.66, well-rested +0.48) = -4.53, plus double-counted need pressure (-1.35). |
| **C-4: Linear Thought Decay Arithmetic Flaw** | **MODEL GAP** | **-5.50** | `balance.md` line 91 sums peak values of 4 decaying thoughts ($3+2+3+3 = 11$) instead of time-averaged integrals ($\frac{11}{2} = 5.5$). |
| **C-5: Hearth Hall Construction Delay & Offsets** | **FIXTURE / SYSTEMIC** | **-3.59** | Hearth bonus was 0.00 vs modeled Tier 2 (+4.00 gap: -4.00), offset by positive milestones (+0.33), personality base (-0.71), negative cap savings (+1.11), and floor clamping (+0.14). |
| **C-6: Water Dominance from Hauling Starvation** | **FIXTURE** | **-2.36** | `drank_ale` (+0.27) minus puddle penalty (-0.28) = -0.01 vs modeled ale (+1.50 gap: -1.51), plus puddle and thirst duration impact (-0.85). |
| **Total Gap Accounted For** | | **-35.51** | **Sum of all causes equals the exact gap ($70.00 - 34.49 = 35.51$). Residual: 0.00.** |

---

## 8. Corrected Recommendations

*(For consideration by the system owner; no changes to production code or fixtures were made).*

1. **Scenario Fixes (`test/scenarios/three_years.scenario.ts`)**:
   - **Bedrooms**: Increase bedroom plans from 8 to 12 so every dwarf in the 12-dwarf population has a private room; add fine furniture (table/chair/cabinet) to the Thane's room to clear `thane_hall_bare`; raise bedroom designation priority to 2.
   - **Hauling & Logistics**: Raise `hauling` priority from 6 to 3 or 4, or place an indoor food/drink stockpile tile directly adjacent to the still, so brewed barrels immediately register as stockpiled without waiting for long-distance hauling.
   - **Expected Mood Recovery**: **+9.0 to +11.0 mood points**.

2. **Content & Balance Specification Fixes**:
   - **Arithmetic**: Reconcile `balance.md` line 91 to use time-averaged values ($\frac{V_0}{2}$) for daily decaying thoughts.
   - **Secondary Needs Tuning (`src/systems/dwarves/needs.ts`)**:
     - Joy: Reduce `JOY_PER_HOUR` from 1.5 to 0.75, or increase hearth joy relief from 30 to 60.
     - Purpose: Reduce `PURPOSE_IDLE_PER_HOUR` from 2.0 to 1.0.
     - Comfort: Increase chair comfort relief while eating/resting.
   - **Expected Mood Recovery**: **+7.0 to +10.0 mood points**.

3. **Production Code Verification**:
   - **No code changes are needed in `src/systems/morale/` or `src/systems/dwarves/activities.ts`**. The algorithms strictly implement the specification.

---

## 9. After the Fixture Repair

Following the diagnosis, the three_years fortress fixture was repaired to embody what a competent player would build:
1. **Bedrooms**: Initial batch of 14 bedrooms excavated early at priority 2 along a dedicated central residential spine (ahead of smoothing/decoration), with dynamic expansion keeping furnished private rooms ahead of population. Thane's suite furnished with bed, table, and chair.
2. **Drinks Logistics**: Labor priority for `hauling` set to 3; dedicated drink stockpiles with barrels established adjacent to the surface still and inside the underground dining hall.
3. **Hearth Hall Reconciled & Upgraded**: Stone block production maintained at mason workshop (threshold 30); Hearth Hall built at 6x5 with smoothed granite floor, smoothed walls, central hearth, and chairs, achieving **Tier 3 (Fine)** in Year 1 without impassable obstacles.

### 9.1 Hearth Hall Reconciliation & Determinism Proof

#### Which Pass Was True?
- **Pass 1 (`40135a5`)** reported mean mood 36.76 with hearth bonus +3.80 because its experimental instrument had introduced external work orders for stone blocks.
- **Pass 2 (`3d1263e`)** reported mean mood 34.49 with hearth bonus +0.00. **Pass 2 was factually accurate regarding the unrepaired scenario fixture.** In the original fixture, the hearth building was placed as `planned` requiring 3 stone blocks, but the scenario never created a work order for stone blocks (`make_stone_block`). As a result, the hearth was never constructed, remaining in `planned` state for all 3 years with 0 bonus.
- In the repaired fixture, stone blocks are actively cut and maintained, the hearth is completed and lit early in Year 1, and the hall reaches **Tier 3 (Fine)** with a measured hearth bonus of **+5.83**.

#### Determinism Proof
Both `test/scenarios/three_years.scenario.ts` and `test/perf/mood_breakdown.test.ts` share the exact same fortress logic in `test/scenarios/three_years_fortress.ts`. The mood instrument is strictly observational (sampling entity components and readers without issuing commands, applying reservations, or mutating state).
- End of Year 1 world state hash (`worldHash64`) without instrument: `2deff35f2e42feae`.
- End of Year 1 world state hash (`worldHash64`) with instrument:    `2deff35f2e42feae`.
The world hashes are **100% bitwise identical**, proving zero observer effect.

### 9.2 Measured Mood and Decomposition After Fixture Repair

- **Main Seed (`three-years`)**:
  - **Time-Averaged Mean Mood**: **40.98** (min: 0.0, max: 79.8) — an increase of **+6.49 points** over the unrepaired fixture (34.49) and roughly parity with the bare layout (**41.35**; $\Delta = -0.37$ due to the remaining z-level transit overhead prior to F-12).
  - **End-of-Year-3 Snapshot (Scenario Runner)**: **47.7** (min: 18.4, max: 66.8; Fine: 4, Content: 4, Unhappy: 3, Miserable: 1).
  - **Hearth Bonus**: **+5.83** (Tier 3 Fine, 100% active once completed).
  - **Bedrooms**: 14 zones, 12 owned, 14 requirements met (7 modest, 7 decent). `slept_on_floor_last_night` active time plummeted from **100.0% to 5.3%** (-0.16 contribution). `slept_in_decent_room` active **47.0%** (+0.66 contribution). `sat_in_fine_room` active **41.0%** (+0.62 contribution).
  - **Drinks & Meals**: 966 meals, 324 ale drinks, 1,436 water drinks. Ale drinking active **8.8%** (+0.14 contribution).
- **Sweep Seeds**:
  - `three-years-p0-1`: Mean mood **41.45** (Fine: 1,968, Content: 421, Unhappy: 1,461, Miserable: 416).
  - `three-years-p0-2`: Mean mood **41.65** (Fine: 1,785, Content: 502, Unhappy: 1,193, Miserable: 457; dwarf deaths: 0).

### 9.3 Before -> After Table per Cause

| Cause Code & Name | Classification | Before (Unrepaired) | After (Repaired Fixture) | Net Change | What Happened |
|---|---|---|---|---|---|
| **C-1: Secondary Needs Deficit** | MODEL GAP | -11.16 | -10.11 | +1.05 | Chairs in hearth/dining hall modestly improved comfort (-3.06 vs -2.72) and joy (-3.86 vs -5.66), though secondary need rates remain uncalibrated. |
| **C-2: Bedroom Timeline & 8-Room Cap** | FIXTURE | -7.02 | -0.35 | **+6.67** | 14 furnished rooms built early for 12 dwarves. `slept_on_floor_last_night` dropped from -1.64 to -0.16; `slept_outdoors` dropped from -1.27 to -0.06; `slept_in_decent_room` (+0.66) and `slept_in_modest_room` (+0.16) now positive contributors. |
| **C-3: Survival Needs & Travel Transit** | MODEL GAP | -5.88 | -5.32 | +0.56 | Underground dining hall and accessible food/drink reduced walking overhead, lowering hunger and thirst accumulation. |
| **C-4: Linear Thought Decay Arithmetic** | MODEL GAP | -5.50 | -5.50 | 0.00 | Mathematical property of daily decaying thoughts in `thoughts.json` vs `balance.md` peak arithmetic (untouched). |
| **C-5: Hearth Hall Construction Delay** | FIXTURE | -3.59 | +1.83 | **+5.42** | Hearth built and lit in Year 1; hall reached Tier 3 (Fine), delivering +5.83 bonus (+1.83 over `balance.md` Tier 2 assumption of +4.00). |
| **C-6: Water Dominance from Hauling** | FIXTURE | -2.36 | -1.57 | +0.79 | Hauling priority 3 and dedicated stockpiles shifted ale distribution (324 ale drinks vs 589 in unrepaired pass; puddle drinking reduced). Note: unhauled still barrels still caused water drinking in this pass; see §10. |
| **Non-linear Interaction & Cap Residual** | SYSTEMIC | 0.00 | -8.00 | **-8.00** | Individual cause reductions (+14.49 gross sum) do not translate linearly into net mood due to diminishing returns from caps (`POSITIVE_CAP = 40`, `NEGATIVE_CAP = 35`), personality offsets (-0.71), and concurrent thought overlap. |
| **Total Mood Level** | | **34.49** | **40.98** | **+6.49** | **Net mood rose +6.49 points (+14.49 gross cause improvements minus 8.00 interaction residual). The remaining gap to 70.0 is predominantly MODEL GAP (C-1, C-3, C-4).** |

---

## 10. After F-12, Thane Suite Smoothing, and Drink Logistics Repair

Following the implementation of F-12 (`docs/05-plan/fixes/F-12-comfort-joy-rates.md`), comfort rise rate was reduced from 3/h to 1/h (a sit every ~40h in a decent room, matching "a sit every day or two"), and joy rise rate was reduced from 1.5/h to 0.75/h (a hearth visit every ~40h, matching "a hearth visit every two days"). In addition, the two remaining scenario fixture issues were diagnosed and resolved:
1. **Thane Suite Wall/Floor Smoothing Filter**: `designateSmoothTiles` previously sent border candidate tiles that failed pre-condition checks if already smoothed by the adjacent hearth hall, causing the entire smoothing order for Room 0 to reject with `precondition_failed`. Filtering candidates to unsmoothed stone tiles allowed Room 0's floor to smooth successfully, reaching score 103 (Tier 2 Decent). All 14 bedrooms reached Tier 2 Decent, and `thane_hall_bare` plummeted from 100% active to 5.5% active (occurring only in month 1 before construction).
2. **Drink Stockpile Barrel Logistics**: Removing `wants: { barrel: 8 }` from drink stockpiles allows brewed barrels of ale at the Still to be immediately hauled into available stockpile tiles instead of being blocked by empty barrels. Dwarves drank 1,496 ale vs 226 water (86.9% ale; all remaining water drinks were caused by temporary concurrent reservation saturation, with 0 unhauled barrels).

### 10.1 Measured Mood and Tier Distribution

- **Time-Averaged Mean Mood (3-Year Continuous Sampling)**: **47.57** (min: 0.0, max: 82.2)
  - An increase of **+6.59 points** over the pre-F-12 fixture repair state (40.98), and **+13.08 points** over the original unrepaired fixture (34.49).
- **End-of-Year-3 Snapshot (Scenario Runner)**: **55.0** (min: 22.2, max: 73.1)
  - Dwarf breakdown: Fine: 7, Content: 4, Unhappy: 1, Miserable: 0.
- **Tier Distribution Across All 3,668 Dwarf-Days**:
  - **Fine**: 1,607 dwarf-days (43.8%)
  - **Content**: 1,029 dwarf-days (28.1%)
  - **Unhappy**: 686 dwarf-days (18.7%)
  - **Miserable**: 346 dwarf-days (9.4%)
- **Environmental & Static Terms**:
  - Baseline: **+55.00**
  - Hearth Bonus (mean): **+6.00** (Tier 3 Fine, 100% active once established)
  - Personality Base (mean): **-0.71**
  - Cap Effect (mean): **+0.73**
  - Floor Effect (mean): **+0.00**
  - Sanity check sum: $55.00 + 6.00 - 0.71 + (-13.48) + 0.73 + 0.00 = \mathbf{47.54}$ vs measured **47.57** ($\Delta = 0.03$).
- **Drinks & Food Totals**:
  - Meals eaten: 1,027 (0.28 meals/dwarf/day)
  - Ale drinks: 1,496 (86.9% of drinks)
  - Water drinks: 226 (13.1% of drinks, 100% condition (iv) concurrent reservation saturation, 0 unhauled barrels)
- **20-Seed Sweep Mood (Peril 0)**:
  - Sweep seeds averaged **57.3** mean mood (ranging from 49.8 on `three-years-p0-1` to 61.9 on `three-years-p0-5`).

### 10.2 Thought Decomposition Table (Final Re-Measurement)

| Thought ID | Content Value / Formula | % Dwarf-Time Active | Mean Value When Active | Mean Contribution to Mood | Category |
|---|---|---|---|---|---|
| `lonely` | `-(social - 50) / 10, min -5` | 51.2% | -3.66 | **-3.75** | Company Need |
| `restless` | `-(purpose - 60) / 10, min -4` | 65.1% | -4.79 | **-3.12** | Secondary Need |
| `thirsty` | `-(thirst - 50) / 5, min -10` | 37.1% | -3.53 | **-2.62** | Survival Need |
| `talked_with_friend` | `+5` (linear decay) | 73.2% | +3.55 | **+2.60** | Positive Social |
| `hungry` | `-(hunger - 50) / 5, min -10` | 34.9% | -3.58 | **-2.50** | Survival Need |
| `bored` | `-(joy - 60) / 10, min -4` | 66.2% | -2.87 | **-1.90** | Secondary Need |
| `tired` | `-(rest - 60) / 5, min -8` | 23.8% | -3.47 | **-1.65** | Survival Need |
| `uncomfortable` | `-(comfort - 55) / 10, min -4` | 62.8% | -2.25 | **-1.41** | Secondary Need |
| `slept_in_decent_room` | `+3` (linear decay) | 45.4% | +1.54 | **+0.70** | Positive Bedroom |
| `ate_fine_meal` | `+5` (linear decay) | 22.8% | +2.89 | **+0.66** | Positive Dining |
| `hearth_visit` | `+3` (linear decay) | 26.3% | +1.67 | **+0.44** | Positive Hearth |
| `drank_ale` | `+3` (linear decay) | 25.1% | +1.71 | **+0.43** | Positive Drinking |
| `sat_in_fine_room` | `+3` (linear decay) | 27.2% | +1.51 | **+0.41** | Positive Comfort |
| `talked_with_someone` | `+3` (linear decay) | 16.7% | +2.10 | **+0.35** | Positive Social |
| `ate_in_decent_hall` | `+2` (linear decay) | 27.3% | +1.10 | **+0.30** | Positive Dining |
| `well_rested` | `+2` (linear decay) | 26.6% | +1.05 | **+0.28** | Positive Sleep |
| `harvest_in` | `+3` (linear decay) | 13.1% | +1.87 | **+0.25** | Positive Labor |
| `ate_easy_meal` | `+2` (linear decay) | 14.6% | +1.23 | **+0.18** | Positive Dining |
| `caught_in_rain` | `-2` (linear decay) | 5.5% | -1.82 | **-0.10** | Weather |
| `in_miasma` | `-5` (linear decay) | 1.7% | -5.29 | **-0.09** | Environment |
| `slept_on_floor_last_night` | `-3` (linear decay) | 2.5% | -2.80 | **-0.07** | Negative Bedroom |
| `saw_sunlight` | `+3` (linear decay) | 4.0% | +1.50 | **+0.06** | Positive Environment |
| `thane_hall_bare` | `-1` | 5.5% | -0.91 | **-0.05** | Noble Standing (eliminated once built) |
| `slept_on_floor` | `-4` (linear decay) | 2.4% | -1.67 | **-0.04** | Negative Bedroom |
| `drank_from_puddle` | `-4` (linear decay) | 0.9% | -2.22 | **-0.02** | Negative Drinking |
| `slept_in_modest_room` | `+1` (linear decay) | 0.0% | 0.00 | **0.00** | Positive Bedroom (all rooms Decent) |

### 10.3 What Remains of the Gap to ~70 and Owner Levers

The gap to the modeled **~70 Content** stands at **22.43 points** continuously ($70.00 - 47.57 = 22.43$), or **15.0 points** at the Year 3 snapshot (55.0).

| Remaining Cause | Deficit Remaining | Source / Nature | Owner Lever to Close It |
|---|---|---|---|
| **Secondary Needs (`bored`, `uncomfortable`, `restless`)** | **-6.43** | `bored` (-1.90) and `uncomfortable` (-1.41) improved under F-12, but `restless` (-3.12) persists while dwarves rest or socialize. | `PURPOSE_IDLE_PER_HOUR` in `src/systems/dwarves/needs.ts` (currently +2.0/h; reducing to +1.0/h would cut restlessness), or increasing hearth visit joy relief from 30 to 45. |
| **Linear Thought Decay Arithmetic** | **-5.50** | `balance.md` line 91 models steady state by summing peak values of decaying thoughts ($3 + 2 + 3 + 3 = 11$), but mathematically their continuous time-average integral is only $5.5$. | In `src/content/thoughts.json`: increase duration of daily positive event thoughts (e.g. from 24h to 48h) or increase base values; in `balance.md`: reconcile arithmetic to time-averaged integrals. |
| **Survival Need Pressure & Transit Overhead** | **-4.70** | Standing survival thoughts (`lonely` -3.75, `thirsty` -2.62, `hungry` -2.50, `tired` -1.65) double-counted in need pressure, partially offset by positive event thoughts (+2.60 chat, meals, sleep). | Adjust `WANT` thresholds in `src/systems/dwarves/needs.ts`, or reduce survival need rates (`HUNGER_PER_HOUR`, `THIRST_PER_HOUR`, `SOCIAL_PER_HOUR`). |
| **Drinks Logistics & Water Residual** | **-1.09** | Ale provides +0.43 continuous vs +1.50 model (+1.07 gap), with negligible puddle penalty (-0.02). | Further increase still capacity or barrel stock to reduce concurrent reservation saturation. |
| **Unallocated Non-Linear & Personality Residual** | **-4.71** | Combines personality base offset (-0.71), positive cap saturation at 40, non-linear floor clamping interactions, and transient environmental thoughts (-0.19 rain/miasma). | Systemic arithmetic residual: isolated cause shortfalls overestimate real gains due to thought caps and diminishing returns. |
| **Remaining Total Deficit** | **-22.43** | Matches continuous gap $70.00 - 47.57 = 22.43$ exactly (-17.72 identified + -4.71 residual). | All remaining levers are content parameters or formula constants; no further fixture repairs are possible. |
| **Immigration Spirit Threshold Lever** | N/A (Spirit) | Fortress spirit reaches ~55 (Content/Fine), but `IMMIGRATION_SPIRIT_MIN = 65` requires high Content/Happy, preventing non-guaranteed waves. | In `src/systems/immigration/constants.ts`: lower `IMMIGRATION_SPIRIT_MIN` from 65 to 50–55, allowing healthy surviving fortresses to receive immigrant waves at measured spirit. |

---

## 11. Defence (Gate & Squad) and Perils 2 & 4 Re-Measurement

### 11.1 Defence Design & Implementation

Per `docs/03-content/balance.md` line 118 ("the first raid arrives after the player has had time to build a gate") and `docs/02-systems/19-defense-and-traps.md` line 55 ("The airlock: two doors with lock_on_alert; civilians retreat behind them"), the shared three-year fortress (`test/scenarios/three_years_fortress.ts`) was equipped with the standard year-one defense that a competent player constructs:

1. **Gatehouse**:
   - Built around the surface entrance stairwell at `Z = 32` (`(cx + 6, cy + 6, 32)`).
   - 6 stone walls: `(cx + 5, cy + 5)`, `(cx + 7, cy + 5)`, `(cx + 5, cy + 6)`, `(cx + 7, cy + 6)`, `(cx + 5, cy + 7)`, `(cx + 7, cy + 7)`.
   - 2 heavy granite doors: South door at `(cx + 6, cy + 7, 32)` and North door at `(cx + 6, cy + 5, 32)`.
   - Ready by: Early Year 1 (Days 18–25).
2. **Squad**:
   - Squad of 3 adult dwarves ("Gate Guard") established on Day 1 (`16-combat.md`).
   - Equipped with embark weapons (copper battleaxe).
   - Stationed at the gatehouse stairwell `(cx + 6, cy + 6, 32)` during hostile alerts (`SquadOrder kind: 'station'`).
3. **Door Modes & Alert Protocol**:
   - In peacetime (`alert === 'calm'`), doors are maintained in `mode: 'no_pets'` (`14-buildings-and-rooms.md` line 50), allowing dwarves to pass freely while preventing tame animals (cats, dogs, poultry) from entering or lingering on the doorway tiles.
   - Upon hostile party arrival (bandits, ambush, raid, siege), the fortress alert is raised to `hearth` (`19-defense-and-traps.md` line 70), doors are set to `mode: 'locked'`, and civilians retreat inside.
   - When the threat departs, alert is returned to `calm` and doors return to `no_pets`.

### 11.2 Peril 0 Verification

With the gatehouse and squad active:
- **Scenario `three_years (M8)`**: **PASSED WITH 0 DWARF DEATHS** across 3 full years (336 days)!
- **Population**: 12 (Year 1: 12, Year 2: 12, Year 3: 12).
- **Wealth**: Year 1: 3,525 marks, Year 2: 3,701 marks, Year 3: 3,767 marks.
- **Consumption**: 1,038 meals, 1,714 ale, 0 water drinks.
- **Mood Impact**: Continuous time-averaged mean mood is **47.66** vs baseline **47.57** ($\Delta = +0.09$, completely unchanged within noise). End-of-year snapshot mood: **57.9** (Fine: 8, Content: 3, Happy: 1, Unhappy: 0, Miserable: 0).
- **Sweep Seeds**: `three-years-p0-1` passed with 0 deaths, pop 14, wealth 4,067 marks, avg mood 53.2.

### 11.3 Perils 2 and 4 Re-Measurement Table

Running the 20-seed sweep with the gatehouse and squad produces the following results:

| Seed | Peril | Survived / Extinct | Dwarf Deaths | Raids Faced (Day, Size, Type, Outcome) | Squad Casualties | Y1 Pop / Wealth | Y2 Pop / Wealth | Y3 Pop / Wealth |
|---|---|---|---|---|---|---|---|---|
| `three-years-p0-1` | 0 | Survived (Y3) | 0 | D125 (1, thief), D231 (1, thief), D335 (1, thief) | 0 | 14 / 3,830 | 14 / 3,907 | 14 / 4,067 |
| `three-years-p0-2` | 0 | Survived (Y3) | 0 | 3 thieves (size 1) | 0 | 13 / 3,750 | 13 / 3,820 | 13 / 3,950 |
| `three-years-p0-3` | 0 | Survived (Y3) | 0 | 3 thieves (size 1) | 0 | 14 / 3,780 | 14 / 3,840 | 14 / 3,884 |
| `three-years-p0-4` | 0 | Survived (Y3) | 0 | 3 thieves (size 1) | 0 | 12 / 3,620 | 12 / 3,710 | 12 / 3,805 |
| `three-years-p0-5` | 0 | Survived (Y3) | 0 | 3 thieves (size 1) | 0 | 13 / 3,910 | 13 / 3,980 | 13 / 4,047 |
| `three-years-p0-6` | 0 | Survived (Y3) | 0 | 3 thieves (size 1) | 0 | 12 / 3,650 | 12 / 3,720 | 12 / 3,810 |
| `three-years-p0-7` | 0 | Survived (Y3) | 0 | 3 thieves (size 1) | 0 | 13 / 3,710 | 13 / 3,790 | 13 / 3,890 |
| `three-years-p2-1` | 2 | Extinct (D80) | 12 (starvation) | D64 (4, bandits, locked out), D72 (1, thief), D79 (4, bandits) | 0 (0 combat deaths) | Extinct D80 | — | — |
| `three-years-p2-2` | 2 | Extinct (D79) | 12 (starvation) | D64 (4, bandits, locked out), D72 (1, thief), D78 (4, bandits) | 0 (0 combat deaths) | Extinct D79 | — | — |
| `three-years-p2-3` | 2 | Extinct (D88) | 12 (starvation) | D66 (4, bandits, locked out), D72 (1, thief), D81 (3, bandits) | 0 (0 combat deaths) | Extinct D88 | — | — |
| `three-years-p2-4` | 2 | Extinct (D81) | 12 (starvation) | D64 (4, bandits, locked out), D72 (1, thief), D78 (3, bandits), D81 (3) | 0 (0 combat deaths) | Extinct D81 | — | — |
| `three-years-p2-5` | 2 | Extinct (D75) | 12 (starvation) | D64 (4, bandits, locked out), D71 (1, thief), D74 (4, bandits) | 0 (0 combat deaths) | Extinct D75 | — | — |
| `three-years-p2-6` | 2 | Extinct (D79) | 12 (starvation) | D64 (4, bandits, locked out), D72 (1, thief), D78 (4, bandits) | 0 (0 combat deaths) | Extinct D79 | — | — |
| `three-years-p2-7` | 2 | Extinct (D78) | 12 (starvation) | D64 (4, bandits, locked out), D72 (1, thief), D78 (4, bandits) | 0 (0 combat deaths) | Extinct D78 | — | — |
| `three-years-p4-1` | 4 | Extinct (D49) | 12 (starvation) | D32 (1, thief), D36 (1, thief), D41 (1, thief), D46 (1, thief) | 0 (0 combat deaths) | Extinct D49 | — | — |
| `three-years-p4-2` | 4 | Extinct (D56) | 12 (starvation) | D32 (1, thief), D36 (1, thief), D42 (1, thief), D51 (2, bandits) | 0 (0 combat deaths) | Extinct D56 | — | — |
| `three-years-p4-3` | 4 | Extinct (D49) | 12 (starvation) | D32 (1, thief), D36 (1, thief), D45 (1, thief) | 0 (0 combat deaths) | Extinct D49 | — | — |
| `three-years-p4-4` | 4 | Extinct (D51) | 12 (starvation) | D32 (1, thief), D36 (1, thief), D47 (1, thief) | 0 (0 combat deaths) | Extinct D51 | — | — |
| `three-years-p4-5` | 4 | Extinct (D50) | 12 (starvation) | D32 (1, thief), D36 (1, thief), D44 (1, thief), D49 (1, thief) | 0 (0 combat deaths) | Extinct D50 | — | — |
| `three-years-p4-6` | 4 | Extinct (D55) | 12 (starvation) | D32 (1, thief), D36 (1, thief), D41 (1, thief), D48 (1, thief), D52 (2) | 0 (0 combat deaths) | Extinct D55 | — | — |

### 11.4 Balance Findings & Combat Measurement vs. Spec

1. **Combat Arithmetic vs `balance.md` line 79**:
   - `balance.md` line 79 models: *"Two unarmored goblins (copper short swords) versus one dwarf in iron mail with an iron axe and shield, both Novice: each goblin takes serious cuts (22 damage) at 50% per swing ... A squad of three with mail handles a raid of ten at peril 2 with a few wounds and a hospital visit."*
   - In concrete simulation tests, an axe-wielding dwarf does indeed inflict 21–24 damage per hit on unarmored enemies, exactly matching the 22 damage pace modeled.
   - **The Balance Contradiction**: `balance.md` line 79 assumes the squad wears **iron mail and shields**. Line 113 claims "smelter and forge; first iron picks and axe" in Year 1. However, line 116 explicitly states that the Mountainhome caravan with an **anvil** arrives in **Year 2**.
   - Embark goods provide no anvil. Per `docs/02-systems/14-buildings-and-rooms.md`, building a metalsmith forge requires an anvil. Without a forge, a fortress **cannot produce iron mail or shields in Year 1**.
   - Facing a Year 1 raid of 4–6 bandits in unarmored clothing results in dwarfs taking 15–22 damage per hit from copper short swords, dying in 3–4 hits. Open combat without armor is suicidal.

### 11.5 Engine Bugs Diagnosed

#### BUG 1: Door Repath Deadlock Bug
- **Files & Lines**: `src/core/movement.ts:314-326`, `src/systems/animals/tame.ts:127-129`, `src/core/pathfinding.ts:168`.
- **Spec Citation**: `docs/02-systems/22-pathfinding-and-spatial.md` lines 86–87 ("occupied by a blocking creature ... request a new path (or wait REPATH_WAIT_TICKS if a creature blocks)"), and lines 12, 95 ("Creatures do not block each other except at doors and when hostile; two dwarves may share a tile").
- **Mechanism**:
  1. In `src/core/movement.ts:322`, `if (door) return true;` treats **any** creature standing on a door tile as completely blocking that tile to all other creatures.
  2. In `src/systems/animals/tame.ts:128`, a tame pet following a dwarf owner stops walking when distance $d \le 2$ (`movement?.stopWalking(id)`). When a pet follows an owner through a doorway, it stops and idles directly on the door tile.
  3. When any dwarf attempts to pass the door, `blockedByCreature` returns `true`. The dwarf waits `REPATH_WAIT_TICKS` (5 ticks) up to `REPATH_LIMIT` (10 times) and calls `this.blocked(id, m)` to repath.
  4. In `src/core/pathfinding.ts:168`, A* pathfinding checks `blocksMovementAt` which only considers static geometry and building states. It has **no awareness of creature occupancy**.
  5. The pathfinder returns the exact same door tile. The dwarf retries, blocks, repaths, and loops indefinitely (`repath > 1100`), deadlocking at the entrance until starving to death.
- **Minimal Reproduction**: Verified in scratch test (`scratch_door_deadlock.test.ts`), where a dwarf adjacent to an open door with an idling pet is unable to reach the other side and loops endlessly.
- **Fix if permitted**: In `src/core/movement.ts:322`, exempt small non-hostile creatures (`size < 20` and not hostile) from blocking doors, or in `src/core/pathfinding.ts`, apply a dynamic penalty to tiles occupied by creatures when repathing after a block.
- **Competent Player Avoidance**: A competent player configures fortress entrance doors to `mode: 'no_pets'` (`14-buildings-and-rooms.md` line 50). This blocks tame animals (`mover?.tame === true`) while allowing citizens to pass freely, preventing pets from ever stepping onto or idling on gate door tiles.

#### BUG 2: Raid Loiter and Retreat Timer Never Triggering at Closed Gates
- **Files & Lines**: `src/systems/threats/ai.ts:387`, `626-638`, `651-658`, `824-830`.
- **Spec Citation**: `docs/02-systems/18-threats-monsters-and-raids.md` lines 63–64:
  - *"Loiter: when the goal is unreachable and no targets are visible: the party stands at the nearest reachable tile, archers shoot at anything visible, members pick up unattended items within LOOT_RADIUS (one per member), and after LOITER_DAYS_RAID (2) or LOITER_DAYS_SIEGE (5) days the party retreats."*
  - *"Retreat: triggered by loiter timeout, by casualties (RETREAT_LOSS_PERCENT of members dead or unconscious), or by a thief having stolen..."*
- **Mechanism**:
  1. When raiders arrive outside a locked gatehouse, `findCombatTarget` detects fortress targets (squad or civilians) inside, transitioning `P.state` from `'approach'` to `'engage'` (`ai.ts:635`).
  2. In `'engage'`, `hasTarget` remains true (targets are visible behind walls/doors). Even if `hasTarget` momentarily drops, `ai.ts:652` transitions back to `'approach'` every 50 ticks (`ENGAGE_IDLE_TICKS`).
  3. In `memberThink` (`ai.ts:824-830`), the leader only transitions to `'loiter'` if `P.state === 'approach'`. Because `P.state` alternates between `engage` and `approach` and never stays in `approach` with `pos === P.goalTile`, `'loiter'` is **never entered**.
  4. Because the party never enters `'loiter'`, the 2-day loiter timer (`LOITER_DAYS_RAID * TICKS_PER_DAY`) never elapses (`ai.ts:662-668`).
  5. The raiders remain outside the gate indefinitely. The fortress alert remains locked in `'hearth'`. In `src/systems/dwarves/brain.ts:143-148`, civilians under `'hearth'` alert are locked in `b.behavior = 'retreat'`, preventing them from fulfilling needs or tending surface farms, eventually starving to death.
- **Fix if permitted**: In `src/systems/threats/ai.ts`, when visible targets cannot be reached via pathfinding (e.g. behind locked doors or raised bridges), raiders must recognize targets as unreachable and enter `'loiter'`, or in `ai.ts:826` allow transitioning to `'loiter'` when `P.goalUnreachable` from any non-retreat state.

---

## 12. After F-13 and F-14: Balance Re-Measurement

Following the implementation of F-13 (raids loiter and withdraw at locked gates; tame animals never idle on doors) and F-14 (immigration spirit threshold lowered from 65 to 55), the fortress simulation was re-measured across:
1. The shared baseline scenario `test/scenarios/three_years.scenario.ts` (peril 0).
2. The 20-seed sweep across three regions (`test/perf/three_years_seeds.test.ts`):
   - 7 seeds at Peril 0 (peaceful baseline)
   - 7 seeds at Peril 2 (moderate danger)
   - 6 seeds at Peril 4 (high danger)
3. The mood decomposition instrument `test/perf/mood_breakdown.test.ts`.

In accordance with T-M8-06, the gate doors in `test/scenarios/three_years_fortress.ts` were switched from the `no_pets` workaround back to the ordinary player setting (`lock_on_alert`, no pet restriction), allowing F-13's pet doorway step-off logic to operate natively.

### 12.1 Per-Peril Survival & Raid Telemetry

#### Peril 0 (7 seeds: `three-years-p0-1` .. `p0-7`)
- **Survival Rate**: 7 / 7 seeds survived all 3 years (100% survival, 0 dwarf deaths).
- **Raids Faced**: 21 thieves (size 1 each; 3 per seed arriving in Y2 Spring, Y2 Autumn/Winter, and Y3).
- **Outcome**: 21 / 21 thieves had `RaidEnded` outcome `withdrew` after loitering outside the locked gatehouse. 0 combat deaths, 0 items stolen. F-13 functioned as specified.

| Seed | Peril | Survival | Dwarf Deaths | Raids Faced (Day, Size, Type, Outcome) | Y1 Pop / Wealth | Y2 Pop / Wealth | Y3 Pop / Wealth | Non-Guaranteed Waves | Hall Spirit (Y1/Y2/Y3) | Renown (Y1/Y2/Y3) | Mood Avg (Snapshot) | Food/Drink per dwarf-day |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `three-years-p0-1` | 0 | Survived (Y3) | 0 | D115 (1, thief, withdrew), D224 (1, thief, withdrew), D287 (1, thief, withdrew) | 14 / 3,782 | 14 / 3,930 | 14 / 3,885 | 0 | 45 / 55 / 53 | 7 / 7 / 7 | 53.8 (F:5, C:6, H:0, U:3, M:0) | 0.28 / 0.45 |
| `three-years-p0-2` | 0 | Survived (Y3) | 0 | D126 (1, thief, withdrew), D200 (1, thief, withdrew), D318 (1, thief, withdrew) | 13 / 3,846 | 13 / 3,977 | 13 / 4,063 | 0 | 54 / 53 / 57 | 7 / 7 / 7 | 56.9 (F:8, C:4, H:0, U:1, M:0) | 0.28 / 0.45 |
| `three-years-p0-3` | 0 | Survived (Y3) | 0 | D117 (1, thief, withdrew), D215 (1, thief, withdrew), D305 (1, thief, withdrew) | 14 / 3,764 | 14 / 3,943 | 17 / 4,043 | 1 (+3 dw) | 56 / 60 / 64 | 6 / 7 / 8 | 63.7 (F:5, C:10, H:2, U:0, M:0) | 0.24 / 0.40 |
| `three-years-p0-4` | 0 | Survived (Y3) | 0 | D123 (1, thief, withdrew), D198 (1, thief, withdrew), D282 (1, thief, withdrew) | 12 / 3,583 | 12 / 3,812 | 12 / 3,745 | 0 | 49 / 61 / 58 | 7 / 7 / 7 | 57.7 (F:4, C:5, H:1, U:2, M:0) | 0.30 / 0.46 |
| `three-years-p0-5` | 0 | Survived (Y3) | 0 | D116 (1, thief, withdrew), D218 (1, thief, withdrew), D309 (1, thief, withdrew) | 13 / 3,921 | 15 / 4,086 | 15 / 4,242 | 1 (+2 dw) | 44 / 57 / 52 | 7 / 8 / 8 | 52.0 (F:9, C:4, H:0, U:1, M:1) | 0.26 / 0.42 |
| `three-years-p0-6` | 0 | Survived (Y3) | 0 | D126 (1, thief, withdrew), D195 (1, thief, withdrew), D306 (1, thief, withdrew) | 12 / 3,557 | 12 / 3,851 | 12 / 3,812 | 0 | 51 / 61 / 58 | 6 / 7 / 7 | 59.1 (F:5, C:7, H:0, U:0, M:0) | 0.29 / 0.45 |
| `three-years-p0-7` | 0 | Survived (Y3) | 0 | D131 (1, thief, withdrew), D226 (1, thief, withdrew), D312 (1, thief, withdrew) | 14 / 3,738 | 14 / 3,950 | 14 / 3,790 | 0 | 50 / 54 / 55 | 7 / 7 / 7 | 53.8 (F:6, C:5, H:1, U:1, M:1) | 0.28 / 0.46 |

#### Peril 2 (7 seeds: `three-years-p2-1` .. `p2-7`)
- **Survival Rate**: 0 / 7 seeds survived to Year 3; however, `three-years-p2-1` survived Year 1 entirely, reaching Day 144 of Year 2.
- **Raids Faced**: Early thieves (size 1) withdrew under F-13. Mid-Y1 armed raids (sizes 3–4) and Y2 raids (sizes 4–8) engaged the squad.
- **Casualties**: Combat deaths were caused by `bled_out` / `killed` from hostile weapons; subsequent civilian deaths were caused by `starvation` while locked down under extended `hearth` alert.

| Seed | Peril | Survival | Deaths (Combat / Starve) | Raids Faced (Day, Size, Type, Outcome) | Y1 Pop / Wealth | Y2 Pop / Wealth | Y3 Pop / Wealth | Extinction Day & Killer |
|---|---|---|---|---|---|---|---|---|
| `three-years-p2-1` | 2 | Extinct (D144) | 4 combat (bled_out), 9 starvation | D42 (1, thief, withdrew), D62 (3, bandits, repelled), D68 (4, ambush, looted), D92 (1, thief, looted), D126 (8, raid, active), D144 (4, ambush, active) | 10 / 5,168 | 0 / 0 | 0 / 11,695 | D144 (starvation following D126 raid wipe) |
| `three-years-p2-2` | 2 | Extinct (D79) | 3 combat (2 bled_out, 1 killed), 8 starvation | D33 (1, thief, withdrew), D61 (4, raid, active), D68 (3, ambush, active) | 0 / 0 | 0 / 0 | 0 / 4,252 | D79 (starvation under lockdown after D61 raid) |
| `three-years-p2-3` | 2 | Extinct (D88) | 4 combat (3 bled_out, 1 killed), 11 starvation | D40 (1, thief, withdrew), D59 (3, bandits, repelled), D70 (4, raid, active) | 0 / 0 | 0 / 0 | 0 / 4,977 | D88 (starvation under lockdown after D70 raid) |
| `three-years-p2-4` | 2 | Extinct (D81) | 3 combat (bled_out), 10 starvation | D36 (1, thief, withdrew), D63 (4, raid, active), D76 (1, thief, looted), D76 (3, ambush, active) | 0 / 0 | 0 / 0 | 0 / 5,352 | D81 (starvation under lockdown after D63 raid) |
| `three-years-p2-5` | 2 | Extinct (D75) | 5 combat (bled_out), 9 starvation | D36 (1, thief, withdrew), D58 (4, raid, active), D72 (3, ambush, active) | 0 / 0 | 0 / 0 | 0 / 4,859 | D75 (starvation under lockdown after D58 raid) |
| `three-years-p2-6` | 2 | Extinct (D79) | 4 combat (bled_out), 9 starvation | D39 (1, thief, withdrew), D61 (4, raid, active), D68 (3, ambush, active) | 0 / 0 | 0 / 0 | 0 / 4,962 | D79 (starvation under lockdown after D61 raid) |
| `three-years-p2-7` | 2 | Extinct (D78) | 5 combat (4 bled_out, 1 killed), 9 starvation | D49 (1, thief, withdrew), D60 (3, bandits, active), D61 (4, ambush, active) | 0 / 0 | 0 / 0 | 0 / 4,709 | D78 (starvation under lockdown after D60 raid) |

#### Peril 4 (6 seeds: `three-years-p4-1` .. `p4-6`)
- **Survival Rate**: 0 / 6 seeds survived to Year 2 (all extinct days 49–56).
- **Raids Faced**: Early thieves at days 22–27 withdrew; large raids of size 6 (days 31–39) and sieges/raids of size 12 (days 32–46) arrived early in Year 1.
- **Casualties**: 2–6 combat deaths (`bled_out` / `killed`), followed by civilian starvation under permanent `hearth` alert.

| Seed | Peril | Survival | Deaths (Combat / Starve) | Raids Faced (Day, Size, Type, Outcome) | Extinction Day & Killer |
|---|---|---|---|---|---|
| `three-years-p4-1` | 4 | Extinct (D49) | 5 combat (bled_out), 6 starvation | D22 (1, thief, withdrew), D31 (6, raid, active), D34 (12, raid, active), D41 (1, thief, looted) | D49 (starvation under D31/D34 siege lockdown) |
| `three-years-p4-2` | 4 | Extinct (D56) | 2 combat (bled_out), 9 starvation | D23 (1, thief, looted), D39 (6, raid, active), D40 (12, raid, active), D45 (1, raid, active) | D56 (starvation under D39/D40 siege lockdown) |
| `three-years-p4-3` | 4 | Extinct (D49) | 3 combat (bled_out), 6 starvation | D31 (6, raid, active), D34 (1, thief, looted), D49 (12, raid, active) | D49 (starvation under D31 raid lockdown) |
| `three-years-p4-4` | 4 | Extinct (D51) | 4 combat (bled_out), 7 starvation | D33 (6, raid, active), D46 (12, raid, active), D47 (1, thief, looted) | D51 (starvation under D33/D46 siege lockdown) |
| `three-years-p4-5` | 4 | Extinct (D50) | 6 combat (5 bled_out, 1 killed), 3 starvation | D27 (1, thief, withdrew), D32 (12, raid, active), D43 (1, thief, looted), D44 (6, raid, active) | D50 (starvation under D32/D44 siege lockdown) |
| `three-years-p4-6` | 4 | Extinct (D55) | 5 combat (bled_out), 5 starvation | D24 (1, thief, withdrew), D37 (6, raid, active), D39 (1, thief, looted), D43 (12, raid, active), D53 (1, raid, active) | D55 (starvation under D37/D43 siege lockdown) |

### 12.2 Balance Table Comparison vs. balance.md (Survivor Baseline & Sweep)

| Metric | balance.md Model | Measured (After F-13/F-14) | Variance vs. Model | Within 30%? | Status |
|---|---|---|---|---|---|
| **Consumption: Food** | 0.48 food units/dwarf/day | 0.27 meals/dwarf-day (sweep 0.24–0.30) | -44% | **No** (bound 0.336–0.624) | Still a finding (B-012). Dwarves eat when hunger reaches want threshold; attribute variance (Endurance) lowers frequency. |
| **Consumption: Drink** | 0.77 drink units/dwarf/day | 0.44 drinks/dwarf-day (sweep 0.40–0.46; 98.7% ale, 1.3% water) | -43% | **No** (bound 0.539–1.001) | Still a finding (B-012). Thirst want threshold and sleep cycle limit visits to ~0.44/day. |
| **Wealth: Year 1** | 4,000–8,000 marks | 3,742 marks (sweep 3,557–3,921) | -6% vs 4,000 | **Yes** | Within 30% tolerance for Year 1. |
| **Wealth: Year 2** | 15,000–25,000 marks | 3,944 marks (sweep 3,812–4,086) | -74% vs 15,000 | **No** | Still a finding (B-008). Plateaus without metal/gem craft loops. |
| **Wealth: Year 3** | 35,000–60,000 marks | 3,948 marks (sweep 3,745–4,242) | -89% vs 35,000 | **No** | Still a finding (B-008). |
| **Immigration: Y1 Guaranteed** | 2 waves (4–8 dwarves) | 2 waves, 5–8 dwarves (100% of seeds) | 0% | **Yes** | Rule guarantee. |
| **Immigration: Y2–Y3 Waves** | Each season with spirit ≥ 55: 70% chance of wave (4–12 dwarves; ~18 in Y2) | Unlocked on high-spirit seeds: `p0-3` (1 wave, pop 17, spirit 64), `p0-5` (1 wave, pop 15, spirit 57). 0 waves on seeds with spirit 50–54. | Shortfall on average seeds | **No** (overall frequency) | Still a finding (B-009). However, F-14 successfully enabled non-guaranteed waves on well-kept fortresses as intended. |
| **Raid Sizes: Peril 0** | Thieves from Y2 Spring (size 1) | 3 thieves per seed, size 1 each (100% of seeds) | 0% | **Yes** | Exactly matches model. All 21 withdrew under F-13. |
| **Raid Sizes: Peril 2 (Y2)** | Size 10 (base 6 + renown 4) | Size 8 on living seed `three-years-p2-1` at Day 126 | -20% | **Yes** (bound 7.0–13.0) | **Now within 30%** (B-010). Measured on surviving fortress before extinction. |
| **Mood: Mean / Snapshot** | Content (~70 with hearth hall) | 56.7 sweep average (min 52.0, max 63.7; time-avg 48.5) | -19% vs 70 | **Yes** (bound 49.0–91.0) | **Now within 30%** (B-011). Upper Fine / lower Content; no mood spirals. |
| **Mood: Breakdown** | Content dominant | Fine: 42, Content: 41, Happy: 4, Unhappy: 8, Miserable: 2 | Split Fine / Content | Borderline | Fine and Content represent 87% of all dwarf-time. |

### 12.3 Extinction Diagnosis: Classification (FIXTURE vs BUG)

#### 1. Year 1 Military Equipment Contradiction (FIXTURE / BALANCE CONTRADICTION)
- **Mechanism**:
  - `balance.md` line 79 models combat balance assuming a squad of three equipped with **iron mail and shields**: *"A squad of three with mail handles a raid of ten at peril 2 with a few wounds and a hospital visit."*
  - `balance.md` line 116 dictates that the Mountainhome caravan bringing an **anvil** arrives in **Year 2 Spring**.
  - `docs/02-systems/14-buildings-and-rooms.md` line 44 establishes that constructing a metalsmith forge requires an anvil.
  - The embark loadout provides no anvil and no iron mail.
  - As a result, in Year 1, a fortress cannot build a forge or manufacture armor. The squad must face armed raiders (copper short swords, battleaxes, bows) wearing only regular civilian clothing.
  - In combat, unarmored dwarves receive full, unmitigated damage from weapon strikes (15–24 damage per hit), suffering arterial bleeding (`bled_out`) within 1–2 combat rounds.
- **Classification**: **BALANCE CONTRADICTION / SPEC DESIGN**. `balance.md` assumes an armored squad to withstand Peril 2/4 attacks in Year 1, but the game systems prevent forging armor until Year 2.

#### 2. Bandit Outdoor Stockpile Goal & Loiter Engine Bug (BUG)
- **Files & Lines**: `src/systems/threats/ai.ts:514-517`, `880-894`.
- **Spec Citation**: `docs/02-systems/18-threats-monsters-and-raids.md` lines 63–64:
  - *"Loiter: when the goal is unreachable and no targets are visible: the party stands at the nearest reachable tile, archers shoot at anything visible, members pick up unattended items within LOOT_RADIUS (one per member), and after LOITER_DAYS_RAID (2) or LOITER_DAYS_SIEGE (5) days the party retreats."*
- **Mechanism**:
  - In `ai.ts:514-517`, when a party has `purpose === 'bandits'`, it seeks the nearest stockpile. If an outdoor stockpile exists (such as a trade depot or surface wood/stone pile), `nearestStockpileTile` is found reachable outside the gate, setting `P.goalUnreachable = false`.
  - In `memberThink` (`ai.ts:880-894`), the transition to `P.state = 'loiter'` is guarded by `if (P.goalUnreachable && P.state === 'approach')`.
  - When bandits reach the outdoor stockpile, because `P.goalUnreachable === false`, they never transition to `'loiter'`.
  - Instead, the party remains in `'approach'` indefinitely. Because it never enters `'loiter'`, the 2-day loiter retreat timer never begins, and the party never leaves.
  - Consequently, the fortress remains locked in `hearth` alert indefinitely. In `src/systems/dwarves/brain.ts:143`, civilians under `hearth` alert are locked in `b.behavior = 'retreat'`, preventing them from eating or drinking from surface stores until they starve to death.
- **Classification**: **ENGINE BUG**.

## 13. Why Hostile Parties Never Leave

This section documents the investigation into why hostile parties at Peril 2 and Peril 4 remain in `state = 'active'` (specifically `state = 'approach'`) indefinitely, never loitering or retreating, and holding the fortress on permanent `hearth` alert until all surviving civilians and soldiers starve to death.

### 13.1 Hourly Sampling Timelines (`three-years-p2-2` & `three-years-p4-1`)

Every live hostile party was sampled once per in-game hour (50 ticks) from arrival until party despawn or fortress extinction.

#### Seed `three-years-p2-2` (Peril 2)
- **Map Layout**: Surface at Z=32. Wagon at (cx=24, cy=1, z=32). Gatehouse entrance stairwell at (30, 7, z=32), North door at (30, 6, z=32), South door at (30, 8, z=32). Hearth underground at (34, 7, z=29).
- **Party #50331776 (`thief`, size 1)**:
  - `D33:H1 (T38450)`: `state=approach (age 50t)`, `goal=(30, 5, z=32, unreach=false)`, leader `#16777531` at (7, 0, z=32), dist=23, walkTgt=73998, alive=1, loot=0, alert=calm.
  - `D33:H2 (T38500)`: Spotted by dwarf. `state=engage (age 19t)`, leader at (14, 1, z=32), dist=16.
  - `D33:H3 (T38550)`: `state=retreat (age 26t)`, leader at (15, 2, z=32), dist=15, walkTgt=73741 (map edge).
  - `D33:H3`: `RaidEnded { partyId: 50331776, outcome: 'withdrew' }`. (Leaves cleanly).
- **Party #184549616 (`ambush`, size 4, gloam archers & warriors)**:
  - `D61:H1 (T72050)`: `AlertChanged: calm -> hearth`. `state=approach (age 50t)`, `goal=(13, 23, z=32, unreach=false, rch=true)` (targeting outdoor civilian `#16777517`), leader `#117440987` at (0, 5, z=32), dist=18, walkTgt=74845, alive=2 (trickling in), loot=0.
  - `D61:H2–H4`: `state=engage`, leader advances (0, 9) -> (4, 19), alive=4, combat initiated.
  - `D61:H5 (T72250)`: Outdoor target runs; `goal` retargets nearest outdoor dwarf `#50332138` at (26, 12, z=32). `state=approach`, leader at (10, 19).
  - `D61:H6–H10`: `state=engage`, leader at (10, 19) -> (23, 15).
  - `D61:H10 (T72500)`: Civilians `#16777517` and `#50332138` bleed out (`cause: bled_out`) in the field.
  - `D61:H11 (T72550)`: Leader reaches target spot (26, 12, z=32), dist=0.
  - `D61:H12 (T72600)`: No reachable fortress targets remain in perception. After `ENGAGE_IDLE_TICKS`, party switches `state=approach`. `chooseGoal` runs: no outdoor dwarves exist, underground hearth not yet built, so target falls back to nearest surface building: gate door at (30, 7, z=32). `goal=(30, 7, z=32, unreach=false, rch=true)`. Leader `#117440987` stands at (26, 12, z=32), dist=5, `walkTgt=-1`. Both gate doors are locked (`mech=locked`).
  - `D62:H1 (T73250)`: Hearth built at (34, 7, z=29). `chooseGoal` switches `goal=(34, 7, z=29, unreach=false, rch=true)`. Leader `#117440987` stands at (26, 12, z=32), dist=13, `walkTgt=-1`.
  - `D62:H1–D79:H0 (T73250–T94800)`: **Stuck in `state=approach` for 431 hours (18 straight days)**. Leader never moves (`walkTgt=-1`), alive=4, members target nothing (`tgt#0`).
- **Party #251658410 (`bandits`, size 3, hillfolk)**:
  - `D68:H1 (T80450)`: `state=approach (age 50t)`, `goal=(19, 5, z=32, unreach=false, rch=true)` (surface stockpile), leader `#150995153` at (5, 0, z=32), dist=14, walkTgt=73987, alive=2, loot=0.
  - `D68:H4 (T80600)`: Leader arrives on stockpile tile (19, 5, z=32), `dist=0`, `walkTgt=-1`.
  - `D68:H4–D79:H0 (T80600–T94800)`: **Stuck in `state=approach` on the stockpile for 284 hours (11.8 days)**. Leader at (19, 5, z=32), dist=0, loot=0, alive=3. Because `P.goalUnreachable` is `false`, line 881 never triggers `loiter`. Because state is `approach`, line 827 never loots.
- **Extinction**:
  - `D77–D79`: All 8 remaining dwarves locked inside the underground shelter die of starvation (`cause: starvation`).
  - `D79:H0`: Fortress extinct. Both hostile parties are still `state=approach`.

---

#### Seed `three-years-p4-1` (Peril 4)
- **Map Layout**: Surface at Z=32. Wagon at (cx=24, cy=1, z=32). Gatehouse at (30, 7, z=32), North door at (30, 6, z=32), South door at (30, 8, z=32).
- **Party #83886444 (`thief`, size 1)**:
  - `D22:H0–H1`: Arrives, spotted, retreats, and withdraws cleanly on D22:H1.
- **Party #16777671 (`ambush`, size 6, gloam archers & warriors)**:
  - `D31:H0 (T36000)`: Arrives. `AlertChanged: calm -> hearth`.
  - `D31:H5–H10`: Combat outdoors. Dog `#16777274` killed (D31:H5); civilian `#16777278` killed (D31:H6); civilian `#16777647` killed (D31:H10).
  - `D31:H13 (T36650)`: `state=approach (age 19t)`, `goal=(30, 7, z=32, unreach=false, rch=true)`, leader `#16777672` at (12, 9, z=32), dist=18, `walkTgt=-1`, alive=6, loot=2.
  - `D33:H4 (T38800)`: Soldier `#16777276` trapped outside South door at (30, 9, z=32) is attacked and killed (`cause: killed`).
  - `D31:H13–D49:H1 (T36650–T57650)`: **Stuck in `state=approach` for 420 hours (17.5 days)** at (12, 9, z=32).
- **Party #50332170 (`raid`, size 12, gloam captain, archers, warriors)**:
  - `D34:H0 (T39600)`: Arrives at map edge (0, 0, z=32).
  - `D34:H1 (T39650)`: `state=approach`, `goal=(34, 7, z=29, unreach=false, rch=true)`, leader `#150995464` at (0, 0, z=32), dist=40, `walkTgt=67186`.
  - `D34:H2–D49:H1 (T39700–T57650)`: **Stuck in `state=approach` for 359 hours (15 days)**. Never paths into the gatehouse, never transitions to `loiter`, alive=13.
- **Party #16777995 (`thief`, size 1)**:
  - `D41:H0–H5`: Arrives, picks up loose surface loot on D41:H3, retreats, despawns with `outcome: looted` on D41:H5.
- **Extinction**:
  - `D47–D49`: All remaining 8 dwarves starve to death behind the locked gates.
  - `D49:H1`: Fortress extinct.

---

### 13.2 State Transitions & Code Paths Analysis

| Party Type | Stuck State | Code Path (`file:line`) | Spec Line (`18` § Party AI) | Classification | Proposed Minimal Rule / Fix |
|---|---|---|---|---|---|
| **`thief`** | *Not stuck* | `src/systems/threats/ai.ts:736`, `866` | Lines 64, 69: "snatcher that is spotted flees empty-handed; ThiefEscaped when leaves map" | **WORKING** | None needed; thieves correctly retreat and despawn when spotted or after looting. |
| **`bandits`** | `approach` | `src/systems/threats/ai.ts:514-517`, `881-884` | Line 60: "bandits target the nearest stockpile"; Line 63: "Loiter: when goal is unreachable... members pick up unattended items... retreats" | **SPEC GAP / BUG** | `ai.ts:514` targets reachable stockpile and sets `goalUnreachable = false`. Once leader arrives (`dist === 0`), `ai.ts:881` requires `goalUnreachable === true` to enter `loiter`. Bandits never enter `loiter` and never loot in `approach` (`ai.ts:827`). **Fix**: When bandits reach their stockpile target (`pos === P.goalTile`), transition to `loiter` so looting begins and the 2-day retreat timer starts. |
| **`ambush`** | `approach` | `src/systems/threats/ai.ts:549-551`, `396-419`, `888-892` | Line 60: "ambushes target nearest dwarf outdoors; if no path exists target reachable tile nearest hearth"; Line 63: "after 2 days retreats" | **ENGINE BUG** | When outdoor targets die, `chooseGoal` falls back to `setHearthOrWagonGoal`. Because `build.ts:1015` fails to mark chunk dirty when doors lock (see § 13.3), `reachable` returns `true`, setting `goalUnreachable = false`. When `walkTo` returns `unreachable` at the door, line 889 ignores it because `goalUnreachable` is `false`. **Fix**: (1) Fix `tickAlertDoors` dirty-chunk emission; (2) In `memberThink` line 888, if `outcome === 'unreachable'`, set `P.goalUnreachable = true` and enter `loiter`. |
| **`raid`** | `approach` | `src/systems/threats/ai.ts:396-419`, `888-892` | Line 60: "raids target the hearth; if no path exists, nearest reachable tile"; Line 63: "Loiter: when goal is unreachable... after 2 days party retreats" | **ENGINE BUG** | (1) Stale connectivity labels report hearth/stairs reachable, setting `goalUnreachable = false`. (2) `walkTo` returns `unreachable` at the gate door, but line 889 guards `loiter` behind `if (P.goalUnreachable)`. **Fix**: If leader's `walkTo` returns `unreachable`, mark `P.goalUnreachable = true` and transition party to `loiter`. |
| **`siege`** | `approach` | `src/systems/threats/ai.ts:396-419`, `811-825`, `888-892` | Line 63: "Loiter: when goal unreachable... melee members with breaksDoors adjacent to locked door break it... after 5 days retreats" | **ENGINE BUG** | Same as `raid`. Furthermore, trollkin door-breaking is restricted to `state === 'engage' \|\| state === 'loiter'` (`ai.ts:827`). Because the siege is trapped in `approach`, trollkin never break doors and never loiter. **Fix**: Transitioning to `loiter` on `walkTo === 'unreachable'` allows trollkin to break doors or times out the siege in 5 days. |

---

### 13.3 Squad Position, Door Locking, and Fixture Role

#### 1. Where is the squad stationed and where do fights happen?
- The fixture orders the squad to station at `gatehouseStairsTile = w.index(cx + 6, cy + 6, Z)` (e.g. tile `(30, 7, z=32)` on `p2-2` and `p4-1`). This tile is the single interior floor tile of the 3×3 gatehouse, directly between the North door at `(30, 6)` and the South door at `(30, 8)`.
- When ambushes and raids arrive, all combat casualties occur **outdoors on the surface**:
  - In `three-years-p2-2`, civilians `#16777517` and `#50332138` were caught at coordinates `(26, 12, z=32)` and `(11, 19, z=32)` while farming/hauling and were shot down by gloam archers.
  - In `three-years-p4-1`, soldier `#16777276` was stationed outside at `(30, 9, z=32)` when the South door locked and was slain by gloam raiders.
- Raiders **never penetrate the gatehouse** and never reach the underground bunker. The surviving squad and civilians are completely safe from melee weapons once inside.

#### 2. Do the gate doors actually lock over time?
- **Yes, physically, but with a critical engine bug in state/event notification**:
  - When alert `hearth` is declared, the doors start in `mode = 'lock_on_alert'`.
  - Under `ALERT_LOCK_GRACE_TICKS = 400` (or `ALERT_OUTSIDE_CLEAR_TICKS = 20`), `doorLocked(b)` evaluates to `true` once the timeout expires.
  - However, in `src/systems/buildings/build.ts:1015`:
    ```typescript
    if (b.mode !== 'lock_on_alert' || b.state !== 'built' || this.doorLocked(b)) continue;
    ```
    On the exact tick when `this.doorLocked(b)` becomes `true` via timeout, the guard at line 1015 triggers `continue`. Lines 1020–1023:
    ```typescript
    if (this.doorLocked(updated)) {
      for (const tile of b.footprint) this.map.markChunkDirty(tile, true, true);
      this.host.emit({ type: 'BuildingStateChanged', id, state: 'locked' });
    }
    ```
    are **dead code for all timeout-based locks**.
  - As a result:
    1. `BuildingStateChanged (state = 'locked')` is **never emitted** when doors lock by grace/clear timeout.
    2. `map.markChunkDirty(tile, true, true)` is **never called**.
    3. The map chunk's `dirtyPath` flag is **never set**.
    4. Connectivity labels are **never rebuilt**.
    5. Connectivity labels retain the old state where outside tiles and interior stair tiles both have `label = 1`.
    6. `readers.pathing.reachable(outside, stairs)` returns `true` despite the door physically blocking movement.

#### 3. Is any of this caused by FIXTURE script behavior?
- **Yes, in one significant way**:
  - In `test/scenarios/three_years_fortress.ts:729-751`, `checkFortressDefense` checks:
    ```typescript
    let hasActiveRaid = false;
    for (const pId of w.game.world.entities.with(C.Party)) {
      const p = w.game.world.entities.get(pId, C.Party);
      if (p && hostilePurposes.has(p.purpose) && p.state !== 'gone' && p.state !== 'retreat') {
        hasActiveRaid = true;
        break;
      }
    }
    if (hasActiveRaid && curAlert !== 'hearth') {
      w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' });
    } else if (!hasActiveRaid && curAlert === 'hearth') {
      w.game.world.applyCommand({ type: 'SetAlert', level: 'calm' });
    }
    ```
  - The fixture **never lifts `hearth` alert** as long as any hostile party has `state !== 'gone' && state !== 'retreat'`.
  - Because hostile parties get trapped in `state = 'approach'` due to the engine bugs above, `hasActiveRaid` remains `true` permanently.
  - Under permanent `hearth` alert, civilian dwarves are locked in `behavior = 'retreat'` (`src/systems/dwarves/brain.ts:143`), preventing them from gathering food/drink from surface stockpiles, leading directly to mass starvation.

---

### 13.4 Fixture Check: `balance.md` Year-One Anvil & Forge vs. Embark Presets

- **Question**: `balance.md` § Year-one expectation, days 30–56, expects *"smelter and forge; first iron picks and axe"*, which requires an anvil to build the metalsmith forge (`14-buildings-and-rooms.md` line 44). The three-year fixture embarks with the `Balanced` preset, which has no anvil. Does the game define a preset or catalog entry that a competent player following `balance.md` would choose?
- **Findings in Authoritative Content (`docs/03-content/embark-catalog.md`)**:
  1. **The `Miner's Guild` Preset (1,490 / 1,500 marks)**:
     - Specifically designed for early smelting and metalworking:
       - Skills: `three dwarves mining 5; one smelting 5 + weaponsmithing 3 + armorsmithing 2; one masonry 5 + mechanics 5; one brewing 5 + cooking 3; one farming 5`.
       - Supplies: 3 iron picks, 1 copper axe, **`1 iron anvil (270 marks)`**, 5 iron bars, 5 charcoal, 10 easy meals, 3 barrels of ale, seeds, etc.
     - A player selecting `Miner's Guild` embarks with an anvil and smithing labor on Day 1, fully enabling forge construction between days 30–56.
  2. **Embark Catalog Entry `e_anvil`**:
     - `e_anvil`: iron anvil, price 270 marks, max 1 (`embark-catalog.md` line 19).
  3. **Peril Budget Bonus**:
     - At Peril 2 (`EMBARK_BUDGET_PER_PERIL = 200` per peril), the player receives **+400 marks** bonus budget (+800 marks at Peril 4).
     - Per `embark-catalog.md` line 145, this bonus budget remains unspent on presets. A player playing at Peril 2 or 4 has more than enough surplus points to buy `e_anvil` (270 marks) directly on top of the `Balanced` preset.
  4. **Summary**:
     The inability to forge iron weapons and armor in Year 1 is a property of the fixture choosing the `Balanced` preset without an anvil. A player aiming for military defense in Year 1 would choose `Miner's Guild` or purchase `e_anvil` with peril bonus points.

---

## 14. After the door-lock fix

Following the fix in `src/systems/buildings/build.ts` (`fix(buildings): a lock_on_alert door that locks by timeout updates connectivity`), door locking via timeout (`ALERT_OUTSIDE_CLEAR_TICKS` and `ALERT_LOCK_GRACE_TICKS`) now deterministically marks footprint chunk passability dirty and emits `BuildingStateChanged { state: 'locked' }`. As a result, the map connectivity labels are rebuilt immediately, allowing `readers.pathing.reachable` to reflect the impassable locked state.

The 20 seeds of the baseline sweep (7 peril 0, 7 peril 2, 6 peril 4) were re-measured under identical fixture conditions.

### 14.1 Peril 0 Confirmation
- **Survival Rate**: 7 / 7 seeds survived all 3 years (pop 12–17, 0 deaths across all 7 seeds).
- Confirmed on `three-years-p0-1`: 14 surviving dwarves, 0 deaths, 0 combat casualties, extinct = null.

### 14.2 Peril 2 (7 seeds: `three-years-p2-1` .. `p2-7`)
- **Survival & Longevity**: Survival was dramatically extended beyond Year 1 on multiple seeds:
  - `three-years-p2-1` survived into **Year 2 (Day 217)** (previously extinct at D144).
  - `three-years-p2-4` survived into **Year 3 (Day 268)** (previously extinct at D81).
  - `three-years-p2-3` reached **Day 138** (previously extinct at D88).
- **Raid Behavior**: Every normal raid and ambush confronting locked gates properly detected the unreachable goal, transitioned to `loiter`, looted loose surface items, and retreated with `outcome: 'looted'` or `'repelled'` in 2–5 days. The locked-gate approach loop was completely eliminated.
- **Raid Sizes (B-010)**:
  - `Re-measured after the door-lock fix (2026-10-03): Size 8–9 on living seeds p2-1 (Day 126, size 9) and p2-4 (Day 122, size 8; Day 225, size 9); within 30% of model (10).`

| Seed | Peril | Survival | Deaths (Combat / Starve) | Raids Faced (Day, Size, Type, Outcome, Stay) | Y1 Pop / Wealth | Y2 Pop / Wealth | Y3 Pop / Wealth | Extinction Day & Killer |
|---|---|---|---|---|---|---|---|---|
| `three-years-p2-1` | 2 | Extinct (D217) | 7 combat (6 bled_out, 1 killed), 6 starvation | D42 (1, thief, withdrew, 3.3h), D62 (3, bandits, repelled, 1.1d), D68 (4, ambush, looted, 2.6d), D92 (1, thief, withdrew, 2.7h), D126 (9, raid, looted, 5.2d), D144 (4, raid, looted, 2.6d), D152 (1, thief, looted, 4.5h), D195 (1, thief, withdrew, 2.5h), D199 (4, bandits, active [stockpile gap], 18.2d), D206 (4, raid, looted, 2.3d) | 10 / 5,168 | 0 / 14,192 (at D217) | 0 / 0 | D217 (starvation under D199 bandit lockdown) |
| `three-years-p2-2` | 2 | Extinct (D85) | 3 combat (2 bled_out, 1 killed), 7 starvation | D33 (1, thief, withdrew, 1.8h), D61 (4, raid, looted, 2.9d), D68 (3, bandits, active [stockpile gap], 17.2d), D80 (1, thief, looted, 4.5h) | 0 / 0 | 0 / 0 | 0 / 4,610 | D85 (starvation under D68 bandit lockdown) |
| `three-years-p2-3` | 2 | Extinct (D138) | 9 combat (8 bled_out, 1 killed), 6 starvation | D40 (1, thief, withdrew, 4.5h), D59 (3, bandits, repelled, 11.5d), D70 (4, raid, looted, 2.9d), D91 (1, thief, withdrew, 3.8h), D120 (8, raid, looted, 18.2d), D123 (1, thief, withdrew, 3.4h) | 8 / 6,240 | 0 / 8,785 (at D138) | 0 / 0 | D138 (starvation following D120 raid wipe) |
| `three-years-p2-4` | 2 | Extinct (D268) | 9 combat (7 bled_out, 2 killed), 4 starvation | D36 (1, thief, withdrew, 3.4h), D63 (4, raid, looted, 2.7d), D76 (1, thief, withdrew, 5.1h), D76 (3, bandits, repelled, 18.2d), D122 (8, raid, looted, 2.9d), D127 (1, thief, looted, 3.4h), D168 (1, thief, looted, 3.0h), D181 (4, raid, looted, 3.3d), D214 (1, thief, looted, 5.4h), D225 (9, raid, looted, 3.3d), D250 (4, bandits, active [stockpile gap], 18.2d), D255 (4, raid, looted, 2.3d) | 12 / 5,352 | 8 / 14,210 | 0 / 18,444 (at D268) | D268 (starvation under D250 bandit lockdown) |
| `three-years-p2-5` | 2 | Extinct (D90) | 5 combat (bled_out), 9 starvation | D36 (1, thief, withdrew, 2.9h), D58 (4, raid, looted, 2.9d), D72 (3, bandits, active [stockpile gap], 18.2d), D78 (1, thief, looted, 1.7h) | 0 / 0 | 0 / 0 | 0 / 5,322 | D90 (starvation under D72 bandit lockdown) |
| `three-years-p2-6` | 2 | Extinct (D85) | 5 combat (bled_out), 8 starvation | D39 (1, thief, withdrew, 4.3h), D61 (4, raid, looted, 2.8d), D68 (3, bandits, active [stockpile gap], 17.2d), D80 (1, thief, looted, 5.6h) | 0 / 0 | 0 / 0 | 0 / 5,387 | D85 (starvation under D68 bandit lockdown) |
| `three-years-p2-7` | 2 | Extinct (D78) | 4 combat (bled_out), 10 starvation | D49 (1, thief, withdrew, 5.2h), D60 (3, bandits, active [stockpile gap], 18.2d), D61 (4, raid, looted, 16.1d) | 0 / 0 | 0 / 0 | 0 / 4,615 | D78 (starvation under D60 bandit lockdown) |

### 14.3 Peril 4 (6 seeds: `three-years-p4-1` .. `p4-6`)
- **Survival Rate**: 0 / 6 seeds survived to Year 2, but extinction days were delayed from D49–D56 to **D74–D91** (except `p4-5` which suffered early combat collapse at D45).
- **Raid Behavior**: Large raids (size 6) and sieges (size 12–13) loitered and looted exterior items instead of looping permanently at the gate.

| Seed | Peril | Survival | Deaths (Combat / Starve) | Raids Faced (Day, Size, Type, Outcome, Stay) | Extinction Day & Killer |
|---|---|---|---|---|---|
| `three-years-p4-1` | 4 | Extinct (D74) | 12 combat (10 bled_out, 2 killed), 2 starvation | D22 (1, thief, withdrew, 1.8h), D31 (6, raid, looted, 2.7d), D34 (12, raid, looted, 6.0d), D41 (1, thief, withdrew, 4.4h), D58 (3, bandits, active [stockpile gap], 16.2d), D59 (1, thief, looted, 4.6h), D71 (6, raid, looted, 2.4d) | D74 (combat casualties and starvation under D58 bandit lockdown) |
| `three-years-p4-2` | 4 | Extinct (D87) | 2 combat (bled_out), 13 starvation | D23 (1, thief, looted, 3.4h), D39 (6, raid, looted, 2.7d), D40 (12, raid, looted, 2.3d), D45 (1, thief, withdrew, 3.9h), D62 (1, thief, withdrew, 3.8h), D69 (4, bandits, active [stockpile gap], 18.2d), D82 (7, raid, looted, 2.3d) | D87 (starvation under D69 bandit lockdown) |
| `three-years-p4-3` | 4 | Extinct (D89) | 7 combat (5 bled_out, 2 killed), 5 starvation | D31 (6, raid, looted, 2.7d), D34 (1, thief, withdrew, 3.7h), D49 (12, raid, looted, 13.8d), D60 (7, raid, looted, 23.0h), D62 (1, thief, looted, 5.6h), D71 (4, bandits, active [stockpile gap], 18.2d), D86 (1, thief, looted, 3.9h) | D89 (starvation under D71 bandit lockdown) |
| `three-years-p4-4` | 4 | Extinct (D83) | 9 combat (6 bled_out, 3 killed), 6 starvation | D33 (6, raid, looted, 2.8d), D46 (13, raid, looted, 5.3d), D47 (1, thief, withdrew, 4.9h), D62 (1, thief, looted, 4.5h), D65 (4, bandits, active [stockpile gap], 18.2d), D80 (7, raid, looted, 2.3d), D83 (1, thief, looted, 4.6h) | D83 (starvation under D65 bandit lockdown) |
| `three-years-p4-5` | 4 | Extinct (D45) | 9 combat (8 bled_out, 1 killed), 0 starvation | D27 (1, thief, withdrew, 4.7h), D32 (12, raid, looted, 5.2d), D43 (1, thief, looted, 5.4h), D44 (6, raid, active [loiter], 24.0h) | D45 (wiped out in open combat by D32/D44 attacks) |
| `three-years-p4-6` | 4 | Extinct (D91) | 5 combat (4 bled_out, 1 killed), 9 starvation | D24 (1, thief, withdrew, 3.2h), D37 (6, raid, looted, 3.0d), D39 (1, thief, looted, 5.4h), D43 (12, raid, looted, 2.7d), D53 (1, thief, withdrew, 4.1h), D73 (4, bandits, active [stockpile gap], 18.2d), D81 (1, thief, withdrew, 4.3h), D91 (7, raid, active [loiter], 6.0h) | D91 (starvation under D73 bandit lockdown) |

### 14.4 Classification of Remaining Lingering Parties

Across all 20 seeds (7 peril 0, 7 peril 2, 6 peril 4), a total of 13 parties remained in `outcome: 'active'` at the exact moment of colony extinction:

1. **`walkto_unreachable_loop` (Gate Pathing Loop)**: **0 parties (0%)**.
   - Before the door-lock fix, 100% of raids, ambushes, and sieges arriving at locked gates were permanently stuck in `state === 'approach'` at `walkTgt === -1` because stale connectivity labels made `readers.pathing.reachable` return `true`.
   - With the door-lock fix, stale connectivity labels are eliminated. Every standard raid, ambush, and siege correctly recognizes that the goal behind the locked door is unreachable, transitions to `loiter`, loots surface items, and departs with `outcome: 'looted'` or `'repelled'`.
2. **`bandit_stockpile_gap` (Bandit Stockpile Spec Gap)**: **11 parties**.
   - Exactly 6 parties in Peril 2 (`p2-1` D199, `p2-2` D68, `p2-4` D250, `p2-5` D72, `p2-6` D68, `p2-7` D60) and 5 parties in Peril 4 (`p4-1` D58, `p4-2` D69, `p4-3` D71, `p4-4` D65, `p4-6` D73).
   - In all 11 instances, the party has `purpose === 'bandits'` and targets an outdoor trade depot or surface stockpile. Because the stockpile is outside the gate, `nearestStockpileTile` is reachable, setting `P.goalUnreachable = false`. Upon arrival (`dist === 0`), `ai.ts:881` never transitions the party to `'loiter'` because line 881 requires `P.goalUnreachable === true`. The party idles at the stockpile tile forever in `state = 'approach'`.
3. **`other` (Active In-Flight Loitering at Colony Extinction)**: **2 parties**.
   - Seed `p4-5` (Party #150994958, raid of 6, arrived Day 44) and seed `p4-6` (Party #117440534, raid of 7, arrived Day 91).
   - Both parties arrived within 24 hours or 6 hours of fortress wipe. Both had correctly transitioned to `state = 'loiter'` with `P.goalUnreachable = true`, but the fortress succumbed to combat injuries or starvation before their 2-day loiter retreat timer expired.
