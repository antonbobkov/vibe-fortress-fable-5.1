# T-364 — Measure farm yield

**Source:** T-333, [`../../reports/audits/2026-10-17-unmeasured-spec-numbers.md`](../../reports/audits/2026-10-17-unmeasured-spec-numbers.md) (rank 1) · **Size:** M · **Needs:** — · **Status:** open

## Why

Every fortress eats from its plots every day, and the balance model sizes them from one figure nobody has measured: a farm tile gives 0.25 plants a day ("4 plants per 16 days", `balance.md` § Food chain), so 20 cave tiles feed twenty dwarves and 13 dimcap tiles keep the still in drink. That figure comes from `BASE_GROWTH` (07), the season growth multipliers (06 § Seasons) and `SEEDS_PER_HARVEST` (07), all marked *unmeasured*. The three-year fortress starved past about 40 dwarves ([the food-chain diagnosis](../../reports/audits/2026-10-16-t145-food-chain-diagnosis.md)); its causes were script choices, so no measurement says whether a plot of the promised size would have fed it.

## What to do

1. Build a stepped fixture with no other food: one cave plot (dimcap, and once with cave wheat) and one surface plot (one crop per season), each with a set number of tiles and one farmer with plenty of seed, enough barrels and a still and kitchen beside them. Run a full year (112 days), with no immigration and no wild animals; then once with a seed stock of the plot's size only, to see whether one seed per harvest keeps the plot sown.
2. Record per plot and per season: plants harvested per tile per day, sowings that waited for seed, the farmer's share of time, and the days a tile stood empty. Record the drinks and meal units that the harvest became.
3. Compare with `balance.md` § Food chain and § Drink chain: 0.25 plants per tile per day; 20 cave tiles for 4.8 raw units a day; 13 tiles for 3.1 plants a day; seeds never a bottleneck. Write the report under `reports/audits/`, add a `balance-status.md` row, and replace the *unmeasured* marks of `BASE_GROWTH`, `SEEDS_PER_HARVEST`, the season multipliers and the food-chain row with the report.

## What would change the number

A yield below about 80% of 0.25 (or seeds running out on the plot sizes the spec gives) means either `BASE_GROWTH`, the crop growth times in `plants.md`, or the plot sizes of the balance model move; a yield far above it means the model's plot sizes are too generous and food stops being a decision. A tune is its own task.

## Done

- The report exists; the four marks are replaced by it; `balance-status.md` has a farm-yield row.
