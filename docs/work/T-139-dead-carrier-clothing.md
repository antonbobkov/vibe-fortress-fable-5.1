# T-139 — Clothing keeps a dead carrier in the three-year scenario

**Source:** T-216 full-run verification, 2026-10-11 · **Size:** S · **Needs:** — · **Status:** open

## Reproduction

Run `npm exec -- vitest run -c vitest.perf.config.ts test/perf/three_years_main.test.ts` after the wall-clearance fix. At tick 37200, `item.carrier-dead` reports tunic 16777302, trousers 16777303 and boots 16777304 with `carriedBy=16777293`, no Position and flags 0. Carrier 16777293 is not alive. The death path already attempts to release equipment; determine the event and component state that escape it before choosing a fix.

## Resolution

Trace that carrier's death or removal and the three items' ownership, Equipment membership and carrier changes. Turn the exact missed release into a small failing regression. Release carried clothing on every supported creature-removal path, using the existing item API so spatial indices and availability agree; do not change the scenario, clothing counts or death rules. Fold any missing cleanup rule into 17 Health and 13 Items in the same commit.

## Done

The regression and invariant pass. Record the full scenario's next result, six static checks, `npm test`, and the whole browser suite, including before and after full-year end-state lines.
