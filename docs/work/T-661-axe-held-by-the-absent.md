# T-661 — The only axe stays with a dwarf who cannot chop

**Source:** the fix for master's red sweep seed `three-years-p4-2` at shift 150 (branch `t653b-all-clear-fixes`, measure.yml run 44741164080), traced from saves · **Size:** S–M · **Needs:** — · **Status:** open

## Why

In that timeline the founder who came with the axe was the only woodcutter. He stood in the squad, lay in the hospital from about day 61 and later died. Other dwarves had the woodcutting labor, but a dwarf with no axe leaves a chop to one who carries an axe (11 § Assignment), and a held tool stays unavailable to searches while its holder keeps it (11 § Tools). So 6 to 8 chops stood open and untaken from day 61 to the end of the run, the fortress had no log from day 84, and its bedrooms' beds were never built. The three-year script now passes the woodcutter's trade to an idle dwarf and has the forge make a second axe, but a player's fortress would stall the same way, with nothing saying why.

## What to do

Decide how a tool held by a dwarf who cannot use it comes back to the fortress: a dwarf in a hospital bed, a soldier on long duty, a dwarf away for a long time; and check that a dead dwarf's tool is dropped where it can be found. One option: a held tool becomes available to a search once its holder has been away from `work` for `JOB_HOLD_TICKS` (the holder takes it up again, or another, when it returns). Another: the Jobs panel's wait reason (T-640's `jobWait`) says "the only axe is with Urist, in the hospital". Write the rule into 11 and test it.

## Done

A unit test where the only axe-holder lies in a hospital bed and an open chop is taken by another woodcutter (or the panel says why not); the sweep's verdict if the simulation changes.
