# T-577 — p4-4 at shift 100 ends without a dining hall

**Source:** T-565's sweep 43956170681 (seed job `sweep (p4-4, 100)`) · **Size:** S · **Needs:** — · **Status:** open

## What was seen

`three-years-p4-4` at shift 100 failed its T-156 witness "a dining hall" (`test/scenarios/three_years_fortress.ts`, the rooms witness at `ROOMS_WITNESS_POPULATION`). The sweep's verdict passed (pooled living 1070.25, deaths 104), and the other three shifts of the seed were fine. T-567 saw the same witness fail on `three-years-p2-6` at shift 0 (the hall's chairs were never made); this is another seed and shift. T-565 made tables want a mug per chair beside them, so haulers now carry mugs to dining tables, and moved the timelines; whether that plays a part here is not known.

## What to do

Find why the fortress has no dining hall that meets its requirements at the witness on this timeline (the tables and chairs placed, built or not; stone; the mason's orders; mug hauls), and make the fixture or the game hold. Run the sweep.

## Done

Explained; the fixture or the game fixed where it is at fault; the sweep green with no seed failing that witness.
