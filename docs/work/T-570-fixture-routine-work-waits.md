# T-570 — The fixtures' routine work waits behind the food step

**Source:** T-567's probes (seeds p2-6 at shifts 0 and 150, `defence_year`) · **Size:** S · **Needs:** — · **Status:** open

The three-year script sets farming, brewing and cooking a step ahead of every other labor (`STEP_LABORS`), every immigrant has every labor, and 11 never ages a job (§ Assignment: priority is strict). So routine work that no dedicated worker holds waits for as long as the food work lasts, and in a growing fortress that is for good.

## What was seen

- **The mason** (fixed in T-567): with the founding mason on the metal chain or the stone crafts, the mason's job (a table, a door, a chair) stood open for 150 days at a time; the dining hall ended year 3 with its chairs planned. T-567 made the builder the workshop's worker.
- **The other workshops and the furniture.** At the end of a `defence_year` probe the mechanic's, the carpenter's, the kitchen's and the craftdwarf's jobs were open with nobody on them, and so were the bedrooms' beds and the halls' tables and chairs at routine priority.
- **Raw stone that is not available.** At the end of `three-years-p2-6` at shift 150 (T-551's tip) the fortress held 82 raw stones and none was available, so the mason waited for stone. What holds them (the depot, a reservation, a construction) was not traced.
- **The defence year's workforce.** Its squad of five trains full time in a fortress of ten to twenty, and holds the woodcutter, the mason and the smith as well as the miners. T-567 tried training immigrants in place of the founding miners and woodcutter: the dig went on, but with the general hands in the squad nobody built the traps, the lever or the bridge, and the scenario failed. T-567 only takes the tool labors from the soldiers.

## Done

For each routine chain the fixtures depend on, either a named worker (as the forge, the craftdwarf and now the mason have) or an order a step ahead while it is owed, decided from a probe of how long each workshop's job waits; the raw stone that is not available explained; the sweep's verdict and `defence_seeds` green.
