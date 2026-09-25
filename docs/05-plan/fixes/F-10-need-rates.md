# F-10 — Need rates: make consumption match the documented season (M)

**Needs:** — · **Blocks:** F-02, F-04, F-09, T-M6-01 · **Spec touched:** `10-dwarves.md`, `balance.md`

## Why

`embark-catalog.md` § Rules of thumb states:

> A season of food and drink for seven dwarves is about 100 food units and 150 drink units; the presets carry roughly half and expect farming and hunting to cover the rest by autumn.

The need rates contradict it. A dwarf acts at its want threshold (50) and a meal or drink clears the need to 0, so the interval between meals is `50 / rate` hours and the events per dwarf per day are `24 × rate / 50 = 0.48 × rate`. At the current rates (hunger 3/h, thirst 5/h) seven dwarves consume, over a 28-day season:

- food: `0.48 × 3 × 7 × 28` = **282 units**, against the documented 100
- drink: `0.48 × 5 × 7 × 28` = **470 units**, against the documented 150

So the prose is low by roughly 3×, and the embark presets were sized against the prose rather than the rates. That is why the Balanced preset feeds seven dwarves about 6 days and waters them about 3.5 (the finding recorded in [F-08 § Owner question](F-08-m6-m7-spec-arithmetic.md)), and why a first fortress on a map without surface water is in trouble before its first harvest (dimcap ~day 16).

**Owner decision (2026-09-25):** the documented season is right and the rates are wrong. Lower the rates so that "about 100 food units and 150 drink units per season for seven dwarves" is true. The owner also wants the secondary effect: fewer need interruptions, so a dwarf can finish a longer task. The alternative of raising the presets' food and drink was rejected because bridging to the first harvest needed about +700 embark points against an `EMBARK_BUDGET_BASE` of 1500, i.e. a ~45% budget rise, with every preset recomposed.

## Decisions

1. **Decision F-10a — the new rates.** `hunger` becomes **1 per hour** and `thirst` becomes **1.6 per hour**. Derivation, to be reproduced in the tests:
   - food: `0.48 × 1.0 × 7 × 28` = **94 units** per season ("about 100")
   - drink: `0.48 × 1.6 × 7 × 28` = **150.5 units** per season ("about 150")
   A dwarf now eats about every 50 hours and drinks about every 31 hours.
2. **Decision F-10b — nothing else changes.** `rest` stays 5 awake / −15 asleep; `social`, `comfort`, `purpose` and `joy` keep their rates; every want and critical threshold, `NEED_MAX`, the Endurance factor and `weather.thirstModifier()` are unchanged. Sleep is already a realistic 7 hours a night and is not part of this finding.
3. **Decision F-10c — fractional rates need no representation change.** Needs already accumulate fractionally: `advanceNeeds` multiplies by a fractional Endurance factor and `JOY_PER_HOUR` is already 1.5. `THIRST_PER_HOUR = 1.6` therefore introduces nothing new. Do not change how needs are stored, saved or displayed.
4. **Decision F-10d — the embark presets are not touched.** Under the new rates the existing presets carry 60 food against 94 and 60 drink against 150 for the first season, which is the "roughly half" the prose already claims. `EMBARK_BUDGET_BASE` and every preset line stay exactly as they are.
5. **Decision F-10e — re-measure the two timing contradictions.** C-004 (`tr_dig_room`: nine granite tiles within 2,000 ticks, measured 2,274) and C-005 (`search.test.ts` D-076: twelve tiles within 1,500 ticks, measured 2,828) were both blamed on need interruptions. Fewer interruptions may bring them inside their limits. After the rate change, re-run both **with their original setups untouched**. If a case now passes its documented limit, mark its contradiction resolved per [README § Decision log](README.md#decision-log) and remove its `it.todo`. If it still fails, leave the contradiction and its marker exactly as they are and report the new measured number. Do not adjust either setup to reach the limit.

## Spec amendments

### `docs/02-systems/10-dwarves.md` § Needs, the rates table

Old:

```
| hunger | 3 | eating: meal −100, raw food −70 | 50 | 85 |
| thirst | 5 (× `weather.thirstModifier()`) | drink: alcohol −100, water −80 | 50 | 85 |
```

New:

```
| hunger | 1 | eating: meal −100, raw food −70 | 50 | 85 |
| thirst | 1.6 (× `weather.thirstModifier()`) | drink: alcohol −100, water −80 | 50 | 85 |
```

### `docs/03-content/balance.md` § Needs and consumption, the rate rows

Old:

```
| hunger | 3 | 50 | a meal about every 17 hours: 1.4 food units per dwarf per day |
| thirst | 5 | 50 | a drink about every 10 hours: 2.4 drinks per dwarf per day |
```

New:

```
| hunger | 1 | 50 | a meal about every 50 hours: 0.48 food units per dwarf per day |
| thirst | 1.6 | 50 | a drink about every 31 hours: 0.77 drinks per dwarf per day |
```

### `docs/03-content/balance.md` § Needs and consumption, the totals line

Old:

```
Per dwarf per day: 1.4 food units + 2.4 drink units. Twenty dwarves: 28 food, 48 drink.
```

New:

```
Per dwarf per day: 0.48 food units + 0.77 drink units. Twenty dwarves: 9.6 food, 15.4 drink. Seven dwarves over a 28-day season: 94 food, 150 drink, which is the season `embark-catalog.md` § Rules of thumb describes.
```

### `docs/03-content/balance.md` — the quantities derived from consumption

The food-supply paragraph ("Twenty dwarves eat 14 raw units a day: a 60-tile cave plot …") and the drink paragraph ("Twenty dwarves need 48 drinks a day = 9.6 plants a day = a 40-tile dimcap plot …, and 2.4 brewing jobs a day …") derive their plot sizes, job rates and barrel counts from the old consumption. **Recompute each of those quantities from the new per-dwarf figures, keeping each row's own stated method and yield numbers** (a farm tile is still 0.25 plants per day, `brew` is still 4 plants → 20 drinks, and so on), and show the new arithmetic in the same style. Do not introduce a new method, and do not change a yield.

Note while doing this that the food paragraph's "14 raw units a day" for twenty dwarves does not follow from the old "28 food" in the totals line either. **Do not try to resolve that**: leave the ratio between the two figures as the document implies it and record the discrepancy as a balance finding in `DECISIONS.md` for T-M8-06, naming both lines.

## Code

- `src/systems/dwarves/needs.ts`: `HUNGER_PER_HOUR` 3 → 1, `THIRST_PER_HOUR` 5 → 1.6. These are the module's own constants sourced from `10`'s table; nothing else moves.
- Check for any other place that assumes the old rates (a comment, a test helper, a hint threshold) and update it to cite the new numbers.

## Tests

- Unit, `F-10`: the season arithmetic. Seven dwarves, no interruptions, 28 days of `advanceNeeds` at Endurance 50 and `thirstModifier` 100: food events × 7 × 28 is within ±5% of 100 and drink events within ±5% of 150. Assert the per-dwarf intervals too (about 50 hours and about 31 hours).
- Unit, `F-10`: rest, social, comfort, purpose and joy rates are unchanged (guards F-10b).
- Re-run and report, per F-10e: `tr_dig_room`, and the D-076 case in `test/unit/items/search.test.ts`.
- The existing needs tests (`test/unit/dwarves/needs.test.ts`) encode the old rates in places; update only the arithmetic they assert, never a threshold or a rule, and say in the commit body which assertions changed and why.

## Golden files

Simulation timing changes, so `test/golden/world-hashes.json` will change, and render goldens may. Regenerate with `npm run golden:update -- <name>` in the same commit, with a `golden:` paragraph saying "world hashes: F-10 changes how often dwarves eat and drink".

## Ordering

F-10 must land **before F-02 and F-04**. F-02's mood work and F-04's year-one bootstrap both measure bounds that depend on how fast needs rise, and measuring them against rates that are about to change would bake in numbers that are wrong. Suggested position: immediately after F-01.

## Done

- The two rates changed, the four spec amendments applied verbatim, the derived balance quantities recomputed.
- The tests above exist, are tagged `F-10`, and pass.
- C-004 and C-005 re-measured, and each either resolved with its `it.todo` removed or left untouched with its new number reported.
- `npm run lint`, `npm run typecheck`, `npm run content:check` and `npm test` green; `npm run test:e2e` green if `src/render`, `src/ui` or `src/app` were touched.
- `PROGRESS.md` ticked, `DECISIONS.md` rows added (including the balance finding above), goldens regenerated in the same commit.
