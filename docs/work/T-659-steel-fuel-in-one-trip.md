# T-659 — The steel's two fuels come in two trips

**Source:** [T-655's measurement](../../reports/data/2026-11-20-t655-furnace-jobs-fetch.md) · **Size:** S · **Needs:** — · **Status:** open

## Why

An `alloy_steel` job has four inputs, an iron bar, a flux stone, the fuel taken into the steel and the fuel the job burns, and its worker fetches each in a trip of its own (11 § Job steps): four trips for 200 ticks of work, more than any other furnace recipe. The two fuels are two inputs of one unit each, so the worker walks twice to the same bin of coal or charcoal for what one stack of two would bring in one trip. The flux stone came from 8 to 15 steps away, where the stone was mined or stockpiled, while the iron and the fuel lay by the smelter.

## What to do

Decide whether a recipe whose fuel input and burned fuel take the same item (12 § Fuel; a half fuel is never steel's carbon) fetches them as one input of two units, one stack in one trip, and if so write it into 12 and 11. Measure the alloy job's trips and the smelter's hours before and after on the three-year seeds T-655 probed (`test/perf/t655_furnace_fetch_probe.test.ts`). Look too at whether the three-year script, as a player, keeps flux stone by the smelter (the ore store takes ore only).

Spec: 12 § Fuel and § Operation, 11 § Assignment step 4.

## Done

The alloy job's trips and the smelter's hours before and after, and the sweep's steel ledger and verdict if the rule changes.

- [x] **Decided: one input of two** ([report](../../reports/data/2026-11-20-t659-t660-steel-trips.md), `test/perf/t660_smith_steel_probe.test.ts`): a recipe that takes fuel into its product asks for the bar its job burns with it, one input of two bars (12 § Fuel, 11 § Assignment step 4); a half fuel stays apart. With it alone the fewest-stacks rule sent the worker across the hall for a stack of two (fuel trips 3 → 11 steps in `p4-6`), so a unit input now takes the nearest stacks, more trips, when they walk less in all (`algorithms/jobs-and-hauling.md`; T-655's far-stack-of-four case reversed). `test/unit/workshops/t659-steel-fuel-one-trip.test.ts`, `t655-nearest-stack.test.ts`.
- [x] **Trips and hours** (days 126–336, master → both tasks): steel trips walked a job 4.8 → 4.0 (`p4-6` at shift 50) and 5.2 → 3.5 (`p2-1` at shift 0), reservations 6.9 → 5.6 and 7.8 → 5.0; the first smelter's worker at work 5.5 → 6.7% and 5.4 → 7.6% of his day. Flux stone cannot be kept by the smelter by stockpile filters (class `stone`): a follow-up.
- [x] **Sweep**: measure.yml run 44811760127 on `4e99d2c1` (master `d0c00542` merged): Pooled 19.5 | 7 | 0 | 1095 | 126.75 | 1.25 | 13.25; **Verdict: pass**, all 80 seed jobs green (master 44780191075: 1081.25 / 123.75; T-656 44796007697: 1099 / 110.75). Steel ledger, master → this: steel smelted 25.3 → 28.0 a timeline, five kits 12 → 12, coal smelts 50.5 → 58.6, under five iron bars 24 → 38. The peril-2 rise is two timelines: a fire with no drink left (`p2-1` at 100) and a farm that did not grow with 48 dwarves (`p2-4` at 0, T-664's ground).
