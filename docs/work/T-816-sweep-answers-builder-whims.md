# T-816 — The sweep's player answers the builder's whims

**Source:** T-813 ([work file](../archive/tasks/T-813-builder-whims-without-deaths.md), § What was found and § Decision) · **Size:** M · **Needs:** — · **Status:** open

## Why

T-813 found why the builder's whims (T-806) cost deaths in the sweep. They cost 17.75 deaths and 38.5 living a sweep over eight shifts. The sweep's player (`test/scenarios/three_years_making_do.ts`) works for two of the Thane's whims: fine meals (the kitchen's order raised to 25 and moved first) and something strong (a distilling ahead of the brew, the still's order raised to 20, the deepfire set aside). It answers none of the builder's rows. Once the Thane wishes for a statue or a grander hall, the player stops cooking and distilling for him. The fortress is pleased half as often (25% of seasons against 49%), drinks water more often, and ends 1.2 mood lower with fewer immigrants. A player who answered the statue as the script answers the fine meals would not pay that. The sweep cannot measure the rows fairly until its player answers them too.

## What to do

Decisions taken here:

- **The script answers the builder's rows it can make**, as it answers fine meals: while a whim stands and is not met, one order or designation for it, removed when the whim passes.
  - `whim_statue_hall`: a statue ordered at the mason's (or the craftsdwarf's) workshop and placed in the hearth hall once made.
  - `whim_fine_furniture`: a table and a chair ordered at the carpenter's until one of each is fine or better, then placed in the dining hall.
  - `whim_engraved_room`: the Thane's bedroom's smoothed tiles designated for engraving.
  - `whim_hall_tier`: what the room inspector says raises the hall (smoothing first, then engraving), designated in the hall.
  - `whim_superior`: no answer. The script's crafters make what they make.
- **A statue or a piece of furniture placed for the Thane stays**, as the lantern does (`whim_lantern`), so a later whim of the same row is met as it is drawn.
- **Measure in two steps.** First the script alone on master: it changes nothing while no builder's row is drawn, so its sweep must equal master's, seed for seed. Then the rows from T-813's `cda2cbc5` (the rows and the no-repeat rule, without the kept drink) on top, paired with master and the script over eight shifts (`-f shifts=0,50,100,150,200,250,300,350`). Adopt the rows if paired deaths are within 8 and the defence seeds pass, with the spec edits that T-806 lists.
- The kept drink stays out: "The Thane's deepfire is drunk" is a keep (`fun-features.md`).

## Done

- [ ] The script answers the four rows, with a unit test for each answer.
- [ ] The script's sweep on master equals master's.
- [ ] The rows measured over eight shifts with the script, and adopted or this file closed with the figures.
