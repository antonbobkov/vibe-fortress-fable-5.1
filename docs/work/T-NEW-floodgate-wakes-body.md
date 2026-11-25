# T-NEW — Reopening a full cistern's floodgate does nothing: the water never climbs the well's column

**Source:** playtest 2026-11-25 (peril 4) ([report](../../reports/data/2026-11-25-playtest-4.md), finding 2) · **Size:** M · **Needs:** — · **Status:** open

## Why

The fun feature "The floodgate left open" ([fun-features.md](../fun-features.md), T-688) says that a cistern's floodgate left open floods the hall above: the water rises up the well's column. With a finished well it does not.

The test was `bd_cistern_well`'s fortress (seed `bd-cistern-well`), run until its well worked (tick 14,580; the driver is [cistern.test.ts.txt](../../reports/data/2026-11-25-playtest-4/cistern.test.ts.txt)). At that point the floodgate at (2, 19, z23) was shut, the cistern was full (7) under the well at (4, 17), the well's column was open from the cistern (z23) up to the hall (z26), and the feed shaft at (2, 22) was full up to the brook at z31. I clicked the lever at (4, 15, z26) and pressed `[y] pull`, and a dwarf pulled it: "Lever: on", "→ Floodgate #1: open". After 3,000 ticks the column held no water above the cistern and the hall was dry (`30-gate-open-hall-dry.png`). Then I called the fluids system's `touch` on the cistern tile under the column, (4, 17, z23). In 600 ticks the hall held 175 units of water and two dwarves and two dogs drowned (`31-touched-hall-floods.png`).

The cause is in 04's wake rule. A `BuildingStateChanged` touches only the gate's footprint and its six neighbours (`src/systems/fluids/index.ts`, `sim.touch`). All of those tiles are full and none can move: the tile above each is rock, and its sideways neighbours are full. So they idle and settle. The tile under the well's column now has the brook's head behind it (rule 3, pressure), but it is four tiles away in the same body. It was settled before the gate opened and it stays settled, so rule 3 never runs for it. The hall floods only when the gate is open *while* the cistern fills under an open column. A well built the script's safe way (column last) can never flood, whatever the player does with the lever. The same holds wherever a floodgate or a lowered bridge joins a settled full body to a higher one.

## What to do

Decisions:

- **Opening a fluid-blocking building wakes the bodies it joins.** This applies when 14's `blocksFluidAt` turns from true to false on a footprint (a floodgate opens, a bridge lowers or is taken down). For each fluid tile beside the footprint, 04 walks breadth first over the full tiles of the same type joined to it (the same joining as rule 3's body: through an upper tile's open bottom vertically), at most `PRESSURE_SEARCH_LIMIT` tiles from each start, and activates each tile it reaches (settled bit cleared, idle count 0). A tile that still cannot move settles again after `FLUID_SETTLE_STEPS`, as now.
- Closing a gate, or raising a bridge, stays a touch of its footprint.
- The fun feature stands as written. Its "Remove by" cell is unchanged.

Spec: 04 § Activation (`touch` and the new wake on opening), § Events consumed (`BuildingStateChanged`); a sentence in fun-features.md's row that the flood comes whenever the gate is left open with the column dug.

## Done

- [ ] Tests (`describe` with the task id): a unit test in fluids. A shaft full to z+7, a level tunnel with a shut floodgate, and a full, settled cistern with an open column above its far end. After the gate opens, the column fills to the shaft's level within N steps (state N from the run). The regression check: with the wake left out, it stays empty. A scenario check on `bd_cistern_well`'s fortress: after the well works, the lever pulled open and left fills the hall within 1,000 ticks, and pulled shut at once it does not.
- [ ] Goldens: any whose run opens a gate on a settled body may move. Regenerate them with `npm run golden:update` and give the reason in the commit. Run the sweep on GitHub, since the three-year cistern opens and shuts a gate; put its pooled row and verdict in the commit.
