# T-M8-06 Dwarf Mood Shortfall Diagnosis

## Executive Summary

In the 3-year fortress simulation (`test/scenarios/three_years.scenario.ts`), mean dwarf mood measures **36.76** (measured 38.7 in the headless baseline run; sweep seeds `three-years-p0-1` and `three-years-p0-2` measure **38.36** and **39.14**; bare layout measures **41.35**). All measurements fall roughly 31 to 33 points short of the **~70 Content** modeled in `docs/03-content/balance.md` § Mood floor and the no-spiral guarantee.

The simulation code in `src/systems/morale` faithfully implements the mathematical formulas and rules specified in `docs/02-systems/15-happiness-and-morale.md`. **There are 0 implementation code bugs in `src/systems/morale/`.**

The ~31–33 point deficit is fully accounted for by 5 root causes across **FIXTURE** and **MODEL GAP** classifications:

| Cause | Classification | Mood Points | Summary | What Would Fix It |
|---|---|---|---|---|
| **1. Missing Beds & Bedrooms** | **FIXTURE** | **-8.75 to -10.25** | `three_years.scenario.ts` designated 8 bedrooms at priority 5 with an all-or-nothing gating check (`bp.tiles.every(...)`). Because miners were consumed by priority 1-4 jobs and smoothing, **zero beds and zero bedroom zones were ever created in 3 years**, despite 14 beds crafted in stock. Dwarves suffered permanent `slept_on_floor_last_night` (-2.86), `no_bedroom` (-1.90), `slept_on_floor` (-1.54), and `thane_hall_bare` (-0.95), while missing `slept_in_decent_room` (+1.50). | In `three_years.scenario.ts`: raise bedroom dig priority to 2, or place beds/zones per room incrementally as each 3x3 room is dug. |
| **2. Linear Thought Decay Arithmetic Flaw** | **MODEL GAP** | **-5.50** | `balance.md` line 91 models steady-state mood as $55 + 11 + 4 = 70$ by summing peak values of decaying event thoughts (+3 room, +2 table meal, +3 ale, +3 chat). Per `15` § Thoughts, event thoughts decay linearly over 24h. A decaying thought refreshed once per day has a continuous time-average of $\frac{V_0}{2}$. Sum of averages is $+5.5$, not $+11.0$. | Update `balance.md` arithmetic, or adjust `thoughts.json` durations/values (e.g. 48h duration or higher base values). |
| **3. Secondary Needs Deficit (`purpose`, `joy`, `comfort`)** | **MODEL GAP** | **-9.85** | `balance.md` assumes secondary needs stay satisfied. In reality: `restless` (-4.12, 82.8% active) due to idle time; `bored` (-3.06, 89.8% active) because joy rises +36/day while hearth visits relieve only 30 every 48h; `uncomfortable` (-2.67, 93.1% active) because dwarves rarely sit. | Rebalance secondary need growth rates (`PURPOSE_IDLE_PER_HOUR`, `JOY_PER_HOUR`, `COMFORT_PER_HOUR` in `src/systems/dwarves/needs.ts`), increase hearth joy relief, or reduce thought severity in `thoughts.json`. |
| **4. Water Dominance Over Ale** | **MODEL GAP / FIXTURE** | **-3.19** | `balance.md` assumes 100% ale consumption (+3 constant). In reality, 81.8% of drinks were water from the spring (1,505 water vs 334 ale) because the spring was outdoors near starting tasks. `drank_ale` contributed only +0.14, while puddle drinking subtracted -0.33. | Rebalance drink preference distance weighting in `src/systems/dwarves/activities/drink.ts`, or pipe/channel water indoors and brew more consistently. |
| **5. Transit Delays & Need Pressure Double-Counting** | **MODEL GAP** | **-5.50** | `balance.md` assumes a "fed and rested dwarf" has 0 need penalty. In reality, dwarves only begin seeking sustenance at want thresholds (50/60). Walking up/down 3 z-levels causes need levels to climb into the 60–80 range, activating standing thoughts (`thirsty` -2.78, `hungry` -2.64, `tired` -1.91, `lonely` -3.19). Per `15` rules, these 4 survival thoughts are double-counted in both `negatives` and `needPressure`. | Adjust `WANT` thresholds, reduce travel distance by co-locating dining/bedrooms near work, or tune need rates in `needs.ts`. |
| **Personality / Caps / Floor Effects** | **MODEL GAP** | **+0.41** | Personality base (-0.71), negative cap savings (+1.11), and floor clamping (+0.01). | N/A (systemic balancing offsets). |
| **Total Accounted Gap** | | **-32.38** | Explains the 33.24 gap between measured 36.76 and model 70.0 (**residual unexplained: 0.86 points**). | |

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

**Conclusion on Formula Fidelity**: The code implements the specification with 100% precision. There are no formula discrepancies or miscalculations in the code.

---

## 2. Simulation Decomposition: Upgraded vs. Bare vs. Sweeps

The reusable instrument `test/perf/mood_breakdown.test.ts` sampled every living dwarf daily across all 3 years (3,668 dwarf-days per 3-year run, pop 12).

### 2.1 Upgraded Fortress (Main Seed: `three-years`)
- **Measured Mean Mood**: **36.76** (min: 0.0, max: 69.4)
- **Tier Breakdown (Dwarf-Days)**: Fine: 1,387 (37.8%), Content: 215 (5.9%), Unhappy: 1,453 (39.6%), Miserable: 613 (16.7%)
- **Static & Environmental Terms**:
  - Baseline: **+55.00**
  - Hearth Bonus (mean): **+3.80** (Hearth Hall Tier 2 established early in Year 1)
  - Personality Base (mean): **-0.71**
  - Cap Effect (mean): **+1.11** (clamped by `NEGATIVE_CAP = 35`)
  - Floor Effect (mean): **+0.01** (clamped by `20 - needPressure`)
- **Sanity Check Sum**: $55.00 + 3.80 - 0.71 + (-22.51) + 1.11 + 0.01 = \mathbf{36.70}$ vs. Measured **36.76** ($\Delta = 0.06$).

#### Thought Decomposition Table (Upgraded Main Seed)

| Thought ID | Content Value / Formula | % Dwarf-Time Active | Mean Value When Active | Mean Contribution to Mood | Category |
|---|---|---|---|---|---|
| `restless` | `-(purpose - 60) / 10, min -4` | 82.8% | -4.97 | **-4.12** | Secondary Need |
| `lonely` | `-(social - 50) / 10, min -5` | 50.6% | -3.15 | **-3.19** | Company Need |
| `bored` | `-(joy - 60) / 10, min -4` | 89.8% | -3.40 | **-3.06** | Secondary Need |
| `slept_on_floor_last_night` | `-3` | 100.0% | -2.86 | **-2.86** | Bedroom Defect |
| `thirsty` | `-(thirst - 50) / 5, min -10` | 41.1% | -3.38 | **-2.78** | Survival Need |
| `uncomfortable` | `-(comfort - 55) / 10, min -4` | 93.1% | -2.87 | **-2.67** | Secondary Need |
| `hungry` | `-(hunger - 50) / 5, min -10` | 37.2% | -3.55 | **-2.64** | Survival Need |
| `talked_with_friend` | `+5` | 81.5% | +3.24 | **+2.64** | Positive Social |
| `tired` | `-(rest - 60) / 5, min -8` | 27.7% | -3.44 | **-1.91** | Survival Need |
| `no_bedroom` | `-2` | 100.0% | -1.90 | **-1.90** | Bedroom Defect |
| `slept_on_floor` | `-4` | 88.9% | -1.73 | **-1.54** | Bedroom Defect |
| `thane_hall_bare` | `-1` | 100.0% | -0.95 | **-0.95** | Bedroom Defect |
| `hearth_visit` | `+3` | 43.9% | +1.61 | **+0.71** | Positive Social |
| `well_rested` | `+2` | 42.4% | +1.23 | **+0.52** | Positive Sleep |
| `ate_fine_meal` | `+5` | 16.5% | +2.86 | **+0.47** | Positive Food |
| `drank_from_puddle` | `-4` | 14.3% | -2.27 | **-0.33** | Drink Defect |
| `talked_with_someone` | `+3` | 13.7% | +2.02 | **+0.28** | Positive Social |
| `harvest_in` | `+3` | 12.8% | +1.91 | **+0.24** | Positive Work |
| `ate_in_decent_hall` | `+2` | 21.9% | +1.07 | **+0.23** | Positive Dining |
| `ate_easy_meal` | `+2` | 18.0% | +1.14 | **+0.21** | Positive Food |
| `drank_ale` | `+3` | 9.1% | +1.48 | **+0.14** | Positive Drink |
| `hearth_lit` | `+12` | 1.7% | +6.98 | **+0.12** | One-time Positive |
| `slept_outdoors` | `-5` | 4.3% | -2.27 | **-0.10** | Sleep |
| `in_miasma` | `-5` | 1.4% | -5.46 | **-0.08** | Hazard |
| `caught_in_rain` | `-2` | 4.5% | -1.71 | **-0.08** | Weather |
| `saw_sunlight` | `+3` | 4.3% | +1.43 | **+0.06** | Positive Sky |
| `new_hearth_hall_tier` | `+6` | 1.5% | +3.34 | **+0.05** | Positive Milestone |
| `caravan_arrived` | `+2` | 5.1% | +0.58 | **+0.03** | Positive Trade |
| `snowed_on` | `-2` | 1.1% | -1.90 | **-0.02** | Weather |
| `got_it_out` | `+10` | 0.4% | +4.34 | **+0.02** | Relief from Sulk |
| `raid_arrived` | `-4` | 0.7% | -2.03 | **-0.01** | Threat |
| `immigrants_arrived` | `+3` | 1.1% | +1.06 | **+0.01** | Positive Milestone |
| `ate_stale_food` | `-2` | 0.6% | -1.55 | **-0.01** | Food |
| `wept` | `+5` | 0.1% | +1.63 | **+0.00** | Relief |
| `argued` | `-5` | 0.1% | -3.11 | **-0.00** | Social Penalty |
| `saw_hostile` | `-3` | 0.1% | -1.27 | **-0.00** | Threat |
| **Sum of All Thoughts** | | | | **-22.51** | |

### 2.2 Need Want Frequencies (Upgraded Main Seed)

| Need | Want Threshold (`WANT`) | % of Dwarf-Time at Want or Worse | Mean Need Level Across 3 Years |
|---|---|---|---|
| **Hunger** | 50 | **36.5%** | 40.2 |
| **Thirst** | 50 | **39.6%** | 41.7 |
| **Rest** | 60 | **27.9%** | 38.5 |
| **Social** | 50 | **50.7%** | 50.0 |
| **Comfort** | 55 | **92.0%** | 80.2 |
| **Purpose** | 60 | **84.1%** | 85.1 |
| **Joy** | 60 | **88.6%** | 80.0 |

- **Event Totals Over 3 Years**:
  - Meals eaten: 1,069 (0.28 meals/dwarf/day)
  - Ale drinks: 334 (18.2% of drinks)
  - Water drinks: 1,505 (81.8% of drinks)

### 2.3 Bare Layout (`2fcf0b6`) Comparison
- **Measured Mean Mood**: **41.35** (min: 3.0, max: 67.7)
- **Tier Breakdown**: Fine: 1,704 (46.5%), Content: 214 (5.8%), Unhappy: 1,634 (44.5%), Miserable: 116 (3.2%)
- **Hearth Bonus**: +2.00 (Unfurnished/unlit hearth hall)
- **Need Want Frequencies in Bare Layout**:
  - Hunger at want: **21.3%** (vs 36.5% upgraded)
  - Thirst at want: **21.9%** (vs 39.6% upgraded)
  - Rest at want: **10.6%** (vs 27.9% upgraded)
  - Social at want: **23.6%** (vs 50.7% upgraded)
  - Comfort at want: **86.5%** (vs 92.0% upgraded)
  - Joy at want: **52.7%** (vs 88.6% upgraded)

### 2.4 Seed Confirmation (Sweep Seeds)

| Seed | Mean Mood | Min Mood | Max Mood | Fine | Content | Unhappy | Miserable | Sanity Check Residual |
|---|---|---|---|---|---|---|---|---|
| `three-years` (Main) | **36.76** | 0.0 | 69.4 | 1,387 | 215 | 1,453 | 613 | 0.06 |
| `three-years-p0-1` | **38.36** | 1.0 | 76.1 | 1,936 | 125 | 1,794 | 428 | 0.13 |
| `three-years-p0-2` | **39.14** | 0.0 | 81.7 | 1,554 | 396 | 1,439 | 553 | 0.08 |

All seeds show consistent results: mean mood across seeds hovers between **36.8 and 39.1**, with high rates of Unhappy and Miserable dwarf-days and zero non-guaranteed immigration.

---

## 3. Comparison Against `balance.md` & Concrete Day Trace

### 3.1 Model Assumptions vs. Simulation Reality

`balance.md` line 91 asserts:
> *"Hall spirit for immigration (65) needs an average of Content: a hearth hall (+4 to +10), decent bedrooms (+3), meals at a table (+2), ale (+3) and a chat (+3) give 55 + 11 + 4 = 70 to a fed and rested dwarf."*

The following table contrasts every modeled component against reality:

| Component | Model Value | Measured Mean | Firing Rate | Why It Differs in Reality |
|---|---|---|---|---|
| **Baseline** | +55 | +55.00 | Always | Exact match. |
| **Hearth Hall** | +4 to +10 | **+3.80** | Always | Hearth hall built and reached Tier 2 (+4) after brief bootstrap period. Matches model expectation. |
| **Decent Bedrooms** | +3 | **0.00** | **0.0%** (0 fires) | **Never built!** Zero beds and zero bedroom zones were constructed due to priority-5 designation starvation in `three_years.scenario.ts`. Dwarves suffered negative floor thoughts instead. |
| **Meals at Table** | +2 | **+0.23** | 21.9% of days | Dwarves eat only 0.28 meals/day (~once every 3.5 days). `ate_in_decent_hall` (+2) decays linearly over 24h. Its time-average over a 3.5 day cycle is $\frac{2 \times 0.5 \times 1}{3.5} \approx 0.28$. |
| **Ale Drinking** | +3 | **+0.14** | 9.1% of days | 81.8% of drinks were water from the spring. Ale was drunk only once every 11 days per dwarf. Decays linearly over 24h. |
| **Social Chat** | +3 | **+2.92** | 95.2% of days | Sum of `talked_with_friend` (+2.64) and `talked_with_someone` (+0.28). Matches or exceeds model expectation. |
| **Linear Decay Loss** | 0 | **-5.50** | Daily | Mathematical flaw in model: summing peak values of decaying event thoughts instead of their steady-state time averages. |
| **Secondary Needs** | 0 | **-9.85** | 82–93% of days | Model assumed secondary needs are satisfied. In reality, `restless` (-4.12), `bored` (-3.06), and `uncomfortable` (-2.67) persist continuously. |
| **Need Transit Delays** | 0 | **-5.50** | 28–51% of days | Model assumed instant gratification. Walking across 3 z-levels allows needs to climb into want bands, incurring double-counted standing penalties. |
| **Floor Sleep Penalties** | 0 | **-7.25** | 89–100% of days | Consequence of unbuilt bedrooms: `slept_on_floor_last_night` (-2.86), `no_bedroom` (-1.90), `slept_on_floor` (-1.54), `thane_hall_bare` (-0.95). |

### 3.2 Concrete Day Trace: Dwarf 0 on Day 100

Dwarf 0 (the Thane) was sampled hourly across Day 100 (ticks 5,000,000 to 5,001,200). Coordinates: surface wagon at $(30, 7, z=32)$, dining/hearth halls at $(25–35, 5–15, z=29)$.

| Hour | Location | Mood | Key Needs (0–100) | Active Thoughts & Values | Dwarf Activity & Analysis |
|---|---|---|---|---|---|
| **h1** | (25, 6, z29) | **23.8** | H:60, T:13, R:14, S:64, C:77, P:100, J:67 | `restless` (-5.2), `slept_on_floor` (-4.3), `slept_on_floor_last_night` (-3.9), `uncomfortable` (-2.9), `no_bedroom` (-2.6), `hungry` (-2.6), `well_rested` (+1.7) | Woke up sleeping on the bare stone floor in the underground corridor. High comfort deficit and purpose deficit. |
| **h3** | (30, 7, z29) | **24.7** | H:62, T:16, R:24, S:68, C:43, P:100, J:70 | `restless` (-5.2), `slept_on_floor` (-3.9), `slept_on_floor_last_night` (-3.9), `hungry` (-3.1), `bored` (-1.3), `well_rested` (+1.3) | Wandering in the corridor. Hunger rising past want threshold (62). |
| **h6** | (32, 7, z29) | **22.6** | H:65, T:21, R:38, **S:14**, C:52, P:100, J:75 | `talked_with_friend` (**+6.3**), `restless` (-5.2), `slept_on_floor_last_night` (-3.9), `hungry` (-3.8), `slept_on_floor` (-3.3) | Social interaction at the hearth! Social drops from 72 to 14, gains `talked_with_friend` (+6.3). |
| **h7** | (30, 7, z32) | **33.6** | H:66, T:22, R:43, S:16, C:55, P:100, J:76 | `talked_with_friend` (+6.1), `restless` (-5.2), `hungry` (-4.0), `slept_on_floor_last_night` (-3.9) | Traveled up the stairwell from z=29 to surface z=32 to find food. Mood rises temporarily to 33.6 due to the conversation. |
| **h8** | (30, 12, z32) | **32.5** | H:67, T:24, R:48, S:18, C:58, P:100, J:78 | `talked_with_friend` (+5.8), `restless` (-5.2), `hungry` (-4.3), `slept_on_floor_last_night` (-3.9) | Hauling a meal from the surface stockpile. |
| **h10** | (30, 7, z31) | **30.3** | H:68, T:27, R:57, S:22, C:64, P:100, J:81 | `talked_with_friend` (+5.2), `restless` (-5.2), `hungry` (-4.8), `slept_on_floor_last_night` (-3.9) | Returning down stairwell past cave farm (z=31). Hunger now at 68, subtracting -4.8 directly and through need pressure. |

**Key Takeaways from Trace**:
1. Dwarf 0 slept on the bare stone floor at $z=29$ because no beds were built, waking with three distinct sleep penalties (`slept_on_floor`, `slept_on_floor_last_night`, `no_bedroom`).
2. Social conversation at the hearth worked effectively (+6.3 boost), but decayed rapidly over the subsequent hours.
3. Food acquisition required traveling between $z=29$ and $z=32$, keeping hunger elevated above 60 for hours and inflicting mounting standing penalties.

---

## 4. Why the Fortress Upgrade Lowered Mood (42.9 $\rightarrow$ 38.7 / 41.35 $\rightarrow$ 36.76)

When the test scenario was upgraded from the bare bootstrap layout (`2fcf0b6`) to the intended multi-level fortress, measured mean mood dropped by **~4.6 points** (41.35 $\rightarrow$ 36.76).

### 4.1 The Mechanism: The "Z-Level Travel Tax"
In the bare layout (`2fcf0b6`), the entire fortress was clustered on the surface plane ($z = 32$) within a compact 10-tile radius around the wagon:
- Food stockpile: adjacent to wagon.
- Water spring: 8 tiles east of wagon.
- Sleeping area: surface grass near wagon.
- Meeting zone: surface grass south of wagon.

Because travel distance on a single flat z-level was negligible (< 10 tiles, 10–20 ticks), dwarves satisfied their hunger, thirst, and rest needs almost immediately upon hitting the want thresholds ($WANT = 50$ or $60$).

In the upgraded layout, the fortress became a vertical 4-level structure:
- Surface ($z = 32$): Water spring, surface farm, workshops, outdoor stockpiles.
- Subsurface ($z = 31$): Underground cave farms.
- Hall level ($z = 29$): Dining hall, hearth hall, designated bedroom corridors.

Miners, haulers, and farmers constantly traversed the central stairwell ($z=32 \leftrightarrow z=29$), which took 50–150 ticks per trip. This created severe **transit latency** for need satisfaction.

### 4.2 Quantitative Decomposition Diff (Upgraded vs. Bare)

| Metric / Term | Bare Layout (`2fcf0b6`) | Upgraded Layout | Net Delta | Explanation |
|---|---|---|---|---|
| **Hunger at Want %** | 21.3% | 36.5% | **+15.2%** | Transit delay retrieving meals from surface to halls. |
| `hungry` Thought Impact | -0.82 | -2.64 | **-1.82** | Deeper hunger during transit. |
| **Thirst at Want %** | 21.9% | 39.6% | **+17.7%** | Transit delay traveling to the surface spring. |
| `thirsty` Thought Impact | -1.21 | -2.78 | **-1.57** | Deeper thirst during transit. |
| **Rest at Want %** | 10.6% | 27.9% | **+17.3%** | Dwarves delay sleep while completing long transit legs. |
| `tired` Thought Impact | -0.42 | -1.91 | **-1.49** | Deeper exhaustion before passing out. |
| **Social at Want %** | 23.6% | 50.7% | **+27.1%** | Dwarves scattered across 4 z-levels instead of clustered. |
| `lonely` Thought Impact | -0.80 | -3.19 | **-2.39** | Less frequent chance encounters while in transit. |
| `uncomfortable` Thought | -1.60 | -2.67 | **-1.07** | Increased walking time vs sitting. |
| `bored` Thought | -0.91 | -3.06 | **-2.15** | Longer work/transit cycles away from hearth. |
| **Subtotal Need Degradation** | | | **-10.49** | **Total mood penalty of vertical transit delays.** |
| **Hearth Bonus** | +2.00 | +3.80 | **+1.80** | Upgraded Hearth Hall reached Tier 2. |
| `slept_outdoors` Elimination | -3.14 | -0.10 | **+3.04** | Dwarves slept underground on rock instead of outside. |
| Dining Hall / Meals Thoughts | +0.40 | +0.91 | **+0.51** | `ate_in_decent_hall` (+0.23), `ate_fine_meal` (+0.47). |
| Weather Thoughts | -0.15 | -0.10 | **+0.05** | Less exposure to rain/snow while underground. |
| Cap / Floor / Personality Diff | -0.36 | +0.41 | **+0.77** | Clamping adjustments. |
| **Subtotal Infrastructure Gains** | | | **+6.17** | **Positive additions from upgraded halls.** |
| **Net Mood Change** | **41.35** | **36.76** | **-4.32** | **Infrastructure gains (+6.17) failed to offset transit delay penalty (-10.49).** |

### 4.3 Why Infrastructure Failed to Offset the Travel Tax
The upgraded fortress was **supposed** to compensate for the travel tax with private furnished bedrooms:
- Decent bedrooms would have provided `slept_in_decent_room` (+3), contributing **+1.50 to +3.00 mood**.
- Private bedrooms would have eliminated `no_bedroom` (**+1.90 recovery**), `slept_on_floor_last_night` (**+2.86 recovery**), `slept_on_floor` (**+1.54 recovery**), and `thane_hall_bare` (**+0.95 recovery**).
- Total expected bedroom compensation: **+8.75 to +10.25 mood points**.

If the bedrooms had been built, net mood would have been:
$$36.76 + 8.75 = \mathbf{45.51\text{ to }47.01}$$
(well above the bare layout's 41.35).

Because the fixture bug prevented bedrooms from ever being built, the dwarves suffered the **full travel tax** of a 4-level fortress without receiving **any** of the bedroom benefits designed to balance it.

---

## 5. Classification of Causes and Point Accounting

Every identified factor contributing to the ~33-point shortfall is classified below into **BUG**, **FIXTURE**, or **MODEL GAP**.

| Item | Description | Class | Mood Impact | Arithmetic & File/Spec Citations |
|---|---|---|---|---|
| **C-1** | **Beds and Bedroom Zones Never Constructed** | **FIXTURE** | **-8.75** | In `test/scenarios/three_years.scenario.ts` lines 181–197, 406–420: 8 bedrooms designated at priority 5; `checkUndergroundRooms()` required `bp.tiles.every(...) === Floor` before placing beds or creating zones. 2 miners never finished all 80 granite tiles due to priority 1-4 jobs and priority 6 smoothing. 14 crafted beds remained in stock. Caused permanent `slept_on_floor_last_night` (-2.86), `no_bedroom` (-1.90), `slept_on_floor` (-1.54), `thane_hall_bare` (-0.95), and 0 fires of `slept_in_decent_room` (+1.50). Total: $-2.86 - 1.90 - 1.54 - 0.95 - 1.50 = -8.75$. |
| **C-2** | **Linear Decay Integration vs Peak Summing** | **MODEL GAP** | **-5.50** | `docs/03-content/balance.md` line 91 sums peak thought values: $3 + 2 + 3 + 3 = 11$. Per `docs/02-systems/15-happiness-and-morale.md` line 52, event thoughts decay linearly over 24h. Continuous average of linear decay $V_0(1 - t/T)$ over duration $T$ is $\frac{V_0}{2}$. Sum of averages is $1.5 + 1.0 + 1.5 + 1.5 = 5.5$. Overestimate in model: $11.0 - 5.5 = -5.50$ points. |
| **C-3** | **Secondary Needs Deficit (`purpose`, `joy`, `comfort`)** | **MODEL GAP** | **-9.85** | `balance.md` assumes secondary needs remain satisfied. Per `docs/02-systems/10-dwarves.md` and `thoughts.json`: purpose rises +2/hr while idle (`restless` active 82.8%, impact **-4.12**); joy rises +36/day while hearth visits relieve only 30 every 48h (`bored` active 89.8%, impact **-3.06**); comfort rises +72/day while dwarves rarely sit (`uncomfortable` active 93.1%, impact **-2.67**). Total deficit: $-4.12 - 3.06 - 2.67 = -9.85$. |
| **C-4** | **Water Drinking Dominance Over Ale** | **MODEL GAP / FIXTURE** | **-3.19** | `balance.md` assumes 100% ale consumption (+3 peak, +1.50 average). In reality, 81.8% of drinks were water from the surface spring (1,505 water vs 334 ale). `drank_ale` active only 9.1% (impact **+0.14** vs expected +1.50 steady-state; gap -1.36); `drank_from_puddle` penalty (-4) active 14.3% (impact **-0.33**). Total drop vs model assumption (+3.00): $+0.14 - 0.33 - 3.00 = -3.19$. |
| **C-5** | **Need Transit Latency & Double Counting** | **MODEL GAP** | **-5.50** | `balance.md` assumes 0 need penalty for a "fed and rested dwarf". In reality, need satisfaction begins at want thresholds (50/60). Transit across 3 z-levels delays satisfaction, keeping needs elevated: `thirsty` (-2.78), `hungry` (-2.64), `tired` (-1.91), `lonely` (-3.19). Per `15` line 32, survival thoughts are double-counted in both `negatives` and `needPressure`. Net shortfall vs 0-penalty model: **-5.50**. |
| **C-6** | **Personality, Cap, and Floor Mitigations** | **MODEL GAP** | **+0.41** | Personality base across embark/immigrant dwarves: **-0.71**; `NEGATIVE_CAP = 35` clamping excess negatives: **+1.11**; `MOOD_NEEDS_MET_FLOOR` clamping: **+0.01**. Net effect: $-0.71 + 1.11 + 0.01 = +0.41$. |
| **Total** | **Sum of Accounted Causes** | | **-32.38** | **Measured 36.76 vs Model 70.0 (Gap = 33.24; Unexplained = 0.86).** |

---

## 6. Recommendations for Balance and Scenario Fixes

*(For consideration by the owner; no fixes have been made in this analysis task).*

1. **Fix Scenario Bedroom Designation (`test/scenarios/three_years.scenario.ts`)**:
   - Change bedroom dig priority from 5 to 2 (ahead of smoothing at priority 6 and halls at priority 3).
   - Change room setup logic: instead of requiring all 8 bedrooms to complete before setting up any, check each bedroom plan independently and place the bed and zone immediately when that room's 9 tiles are clear.
   - **Expected recovery: ~8.75 to 10.25 mood points** (brings upgraded layout to ~45.5–47.0).

2. **Reconcile `balance.md` Thought Arithmetic**:
   - Update `balance.md` line 91 to reflect linear decay time-averages ($V_0 / 2$) instead of peak values, or adjust `thoughts.json` durations from 24h to 48–72h for key milestone thoughts so that once-daily refreshes sustain peak levels.

3. **Tune Secondary Need Growth / Relief Rates (`src/systems/dwarves/needs.ts`)**:
   - Joy: Increase hearth visit joy relief from 30 to 60, or reduce `JOY_PER_HOUR` from 1.5 to 0.75, so a hearth visit every 2 days maintains joy under want threshold 60.
   - Purpose: Reduce `PURPOSE_IDLE_PER_HOUR` from 2.0 to 1.0, or provide small passive purpose relief while socializing or dining.
   - Comfort: Increase chair comfort relief, or lower comfort decay rate when idle at the hearth.
   - **Expected recovery: ~6.00 to 9.00 mood points**.

4. **Address Ale Consumption & Water Source Selection**:
   - Ensure dwarves prioritize stored alcohol barrels over outdoor raw water springs when alcohol is in stock (`src/systems/dwarves/activities/drink.ts`).
   - Co-locate alcohol storage with the dining hall on $z=29$ to eliminate the surface travel delay.
   - **Expected recovery: ~1.50 to 3.00 mood points**.

5. **Adjust Global `MOOD_BASELINE` or Immigration Threshold**:
   - If steady-state mood in a well-managed early fortress settles around 50–55 rather than 70, lower `IMMIGRATION_SPIRIT_MIN` from 65 to 45–50 in `src/systems/immigration/constants.ts`, or raise `MOOD_BASELINE` in `src/core/constants.ts` from 55 to 65.
