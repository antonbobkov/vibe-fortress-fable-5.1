# T-426 — The three-year script never rebuilds a gate wall that burns

**Source:** T-421, [boars maul p0-2](../../reports/audits/2026-10-22-boars-maul-p0-2.md) · **Size:** S · **Needs:** — · **Status:** open

## Why

`checkFortressDefense` in `test/scenarios/three_years_fortress.ts` places the six gate walls only until the `gate walls` phase is reached. The walls are wooden, and a wooden construction burns (05 § Fire). Under T-421's measured variant, a wildfire burnt all six walls of `three-years-p2-1` on days 287.5 to 288.3, and one wall of `three-years-p4-1` on day 249.2. Nothing placed them again, so the T-156 witness "gate walls built" failed at the end of year 3 in both seeds. On master no gate wall burns, so the gap is hidden until a change reroutes a seed into a fire.

## What to do

A player places a burnt gate wall again. The script places any missing gate wall once the phase is reached, with the same ghost test. That command is sent only when a wall is gone, so no seed whose walls stand changes. Or the witness asks only that the walls were built once. Choose one and write the choice in the script's comment.

## Done

- The script or the witness changed, and a run of p2-1 under T-421's variant (or any seed whose walls burn) passes the witness.
