# T-NEW — The long fixtures play only on level ground

**Source:** T-436 (surface visual variety) · **Size:** L · **Needs:** — · **Status:** open

## Why

T-436 gave every generated region relief 1 or more: swells, ridges, outcrops, slopes (ramps) and, on mountains, crags. Relief 0 is now level ground, which a real region has only when every neighbour shares its elevation. The long balance fixtures all use `regionSpec` regions, which are relief 0: the three-year fortress (`test/scenarios/three_years_fortress.ts`, the twenty-seed sweep) builds at the fixed level `Z = 32` and fails its setup on 13 of 20 seeds when its maps undulate ("no usable gate site", empty zones, rejected digs: probe of 2026-10-24). The wildlife instrument (`test/perf/wildlife_year_fixture.ts`) reads the wagon's level and would mostly cope. So the balance measurements no longer play the kind of ground the player embarks on.

## What to do

1. Make the three-year fixture find its levels from the map (the wagon's level for the surface, the hall six below the gate's own column) and choose its sites among tiles of one level, as the wildlife fixture does.
2. Run both fixtures on relief-1 regions and record new baselines in balance.md and balance-status.md, by the T-308 rule.
