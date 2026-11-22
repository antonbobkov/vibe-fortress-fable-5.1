# T-667 — The three-year farm stops growing at its strips' cap

**Source:** [T-664's report](../../reports/data/2026-11-20-t664-small-fortress-starves.md) · **Size:** S · **Needs:** — · **Status:** done

## Why

The three-year script's farm grows by strips of four by four (`checkFarm`, `three_years_economy.ts`), up to sixteen strips or 32 tries, since a strip's place on a slope may hold no soil. T-664 stopped a failed search for ground by the gate from counting as a try; in `three-years-p2-4` at shift 0 the farm then grew to 17 plots of 174 tiles, but the tries at the strips' places west of the first field still reached 32 by day 228 with fourteen strips sown, and a fortress of 68 ended year 3 with no plant or meal in stock (the cap the script sets itself is 4 tiles a dwarf, 300 here). The places run in rows south of the first field and leave the 48 by 48 map after a few rows, so most late tries find nothing.

## What to do

Trace where the strips' tries fail on `p2-4` at shift 0 (`test/perf/t664_farm_probe.test.ts` writes the strips each day). Let a strip whose place has no ground take the nearest free sunlit soil on the wagon's side instead (as `nearGateStrip` does by the gate), so the cap is on the land the fortress farms and not on its tries, and measure the food and the sweep.

## Done

The farm's tiles against the dwarves on the traced timeline before and after, and the sweep's verdict.

- [x] **The script** (`checkFarm`, `test/scenarios/three_years_economy.ts`): a strip whose place west of the first field has too little ground takes the nearest free four by four of sunlit soil on the wagon's side (`nearGateStrip`; where the gate's strip was already sought there is none), and the tries stop at twice the strips' cap only when they fail in a row, counted from the last strip sown, not over the farm's life. The cap stays on the land: the strips' tiles and four tiles a dwarf. Written into `docs/process/testing-strategy.md` § The long scenarios.
- [x] **The traced timeline.** `three-years-p2-4` at shift 0 no longer reaches the cap on master: it now dies out at day 136 (13 dwarf deaths, the same on master's sweep), before and after alike, with 5 plots of 66 tiles. Traced instead on the sweep's largest fortress, `three-years-p2-1` at shift 100 (T-664's probe to tick 336,000), before and after identical: day 60 13 dwarves 121 tiles; day 120 28 / 181; day 180 50 / 259; day 240 65 / 314 (19 strips, no failed try); day 281 76 dwarves, 1,058 plants and 540 meals. That farm stops at four tiles a dwarf, not at its tries, so the change does not show there.
- [x] CI `45035598102` green on `a204f04d`; sweep `45037122991` (shifts 0 to 150) on `c69de682` (master `a513d903` merged): Pooled 20 / 7 / 0 / 1097 living / 122.75 deaths / 0.5 extinct / 0.5 need deaths, **Verdict: pass**, worth tracing by seed: none (master's T-683 sweep `45027251322`: 1097.25 / 122.5).
