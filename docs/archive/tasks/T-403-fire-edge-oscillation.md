# T-403 — A dwarf that fled a fire returns to work at the edge of it and flees again

**Closed:** 2026-10-20, in 3900995, 0634208, 9fe7212.

**Source:** T-397 review, [the diagnosis](../../../reports/audits/2026-10-18-fire-deaths-diagnosis.md) · **Size:** S · **Needs:** — · **Status:** open

## Why

A dwarf running from a fire (10 § Behavior selection, fire) selects again when it stands out of danger. The job board may hand it back the job it dropped, or another whose work tile or route lies along the fire's edge; it walks there, is in danger again within a few ticks, and flees again. Each cycle costs walking, and every cycle is a chance for the front to catch it. The flight itself is correct; the choice after it is not.

## What to do

1. Decision: while any tile within 3 tiles (horizontal Chebyshev, same level) of a job's work tile or of a need target burns, 11 offers that job, and 10 starts that need activity, to no dwarf that fled a fire in the last `FIRE_AVOID_TICKS` (200) ticks; a critical need overrides, as it overrides the avoidance of a remembered hostile (10 § Behavior selection step 1). The flight is remembered per dwarf in the brain's saved state and is empty in older saves.
2. A failing stepped test first: a dwarf with a dig job whose work tile is two tiles from a spreading fire flees, and does not return to the tile until the tiles around it have burnt out or the avoidance has lapsed; count its flights (today it flees repeatedly).
3. Spec: 10 § Behavior selection and 11 § Assignment (candidate jobs); constants table.

## Done

- The test passes, the annual instrument's bounds hold, and the commit reports the instrument rows before and after.
