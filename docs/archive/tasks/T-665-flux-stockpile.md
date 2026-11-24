# T-665 — A stockpile that takes flux stone

**Closed:** 2026-11-24, in 6729ec3a,4105cfb8,7ac64075,9ee4c6b6.

**Source:** [T-659's measurement](../../../reports/data/2026-11-20-t659-t660-steel-trips.md) · **Size:** S · **Needs:** — · **Status:** open

## Why

A steel job fetches a flux stone (limestone, marble, dolomite, chalk) beside its iron bar and fuel, and the three-year probes found it 6 to 18 steps from the smelter (10 to 13 on most timelines), lying where it was mined, while the bar and the fuel lay by the smelter. A player would keep a few flux stones beside the smelter, but a stockpile filters by category and material class (13 § Stockpiles), and flux stone is of the class `stone` with every other rock: a stone stockpile by the smelter draws the whole mine's stone into the workshop hall.

## What to do

Decide whether a stockpile's filter may name a material tag (`flux`) or single materials beside its classes, as the stockpile editor would show it, and if so write it into 13 and 24 and let the three-year script keep a small flux store by the smelter. Measure the steel job's flux trip and the smelter worker's hours before and after with `test/perf/t660_smith_steel_probe.test.ts`.

Spec: 13 § Stockpiles; 24 (the stockpile editor); 12 § Recipes (the flux).

## Done

- [x] The flux trip's steps and the smelter's hours before and after, and the sweep's steel ledger and verdict if the script changes: [the report](../../../reports/data/2026-11-22-t665-t668-flux-and-peril2-steel.md). A stockpile filter may name the material tag `flux` beside its classes (13, 24, the editor's checklist ends with Flux stone); the three-year script keeps six flux stones by the smelter. Probe (`p2-1` at shift 0, days 126 to 336): flux trip 11.7 → 6.9 steps, the first smelter's worker working / walking empty / carrying 6.6 / 17.6 / 11.3 → 8.7 / 17.7 / 10.5% of his day. Sweep `45410693300` on `93cfc975` (with T-668): Pooled 20 | 7 | 0 | 1072.5 | 137 | 0.5 | 0.5, **Verdict: blocked** (dwarf deaths over 132.5: two lightning wildfires whose light burns went uncleaned, a follow-up); steel at peril 2 25.4 → 34.4 alloy jobs a timeline.
- [x] Re-sweep after T-691 (a light burn is never infected): `45459412363` on `6729ec3a`, Pooled 20 | 7 | 0 | 1121.5 | 113.25 | 0 | 0, **Verdict: pass**.
