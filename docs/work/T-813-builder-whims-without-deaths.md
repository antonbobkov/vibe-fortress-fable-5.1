# T-813 — The builder's whims, without the deaths

**Source:** T-806 ([work file](../archive/tasks/T-806-thane-wishes-for-the-hall.md), § Measured and § Outcome); playtest 9 ([report](../../reports/data/2026-11-26-playtest-9.md), finding 5) · **Size:** M · **Needs:** — · **Status:** open

## Why

T-806 built five builder's whims (a statue in the hall, a grander hall, an engraved bedroom, a fine table and chair, a superior work), kept a drink whim's units from the fortress's throats, and stopped the same whim being drawn twice running. The Thane then wished for eight things instead of two. Over three sweeps, every variant, with or without the kept drink, ended 13 to 17 dwarf deaths over master (121.75 to 125.25 against 108.5), more than the 8 the adoption rule allows, so none of it went into the game. The code is on branch `t806-t807-wip`, commit `934c7013` (the kept drink's switch is `keptForThane` in `src/systems/dwarves/activities.ts`).

The extra deaths are fighting deaths, not thirst. Nothing reads a whim but `thane_pleased` (+3 to everyone for 72 hours, when it is met) and `thane_grumbled` (−1 to the Thane). The builder's rows are met less often than deepfire was: 24% of seasons against about 35%. A fortress pleased less often may fight a little worse, or the three sweeps may share the timeline's noise.

## What to do

Decisions taken here:

- **Find the cause before changing the rows.** Run the T-806 code with `thane_pleased` given on every judgement, met or not (a probe, not a rule). If the deaths come back to master's level, the mood is the cause. Then make the builder's rows no harder to meet than deepfire: for example, a `tier` whim only while the hall is within reach of the next tier, or a row's `count` lowered.
- **If they do not come back,** measure the rows over eight shifts (`-f shifts=0,50,100,150,200,250,300,350`) before deciding: three four-shift sweeps of one change sharing the same excess is not yet proof that it is real.
- The kept drink is measured last and alone. Its trade-off is fun ("The Thane's barrel"), and it may come back once the rows are settled.

## Done

- [ ] The cause found and written here, with its run.
- [ ] The builder's rows adopted within 8 deaths of master, with the spec edits that T-806 lists, or this file closed with the figures.
