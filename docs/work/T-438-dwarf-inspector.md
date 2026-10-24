# T-438 — A dwarf sheet: status, needs, mood, job, orders, health, gear

**Source:** the owner, 2026-10-23 (first play session) · **Size:** M · **Needs:** — · **Status:** open

## Why

The owner could not find a way to inspect a dwarf. The look panel's creature section exists (identity, activity, skills, current job), but it is thin and hard to find.

## Decisions

1. **Opening it.** Clicking a dwarf on the map, or choosing one in the Units panel, opens a dwarf sheet. The look panel's creature line gets an entry to it.
2. **Tabs.**
   - **Status:** current activity and job, with the job's target and progress, and why the dwarf is idle or blocked.
   - **Needs:** each need, its value and its want threshold.
   - **Mood:** the value, plus recent thoughts with their effects.
   - **Health:** wounds by part, treatment state and patient status.
   - **Gear:** worn and carried items.
   - **Labors:** enabled labors, with a toggle that is the same command as the labor manager.
   - **Orders:** squad, station and burrow.
   - **Skills.**
3. Every number shown is the simulation's own, read through the readers, as the look panel's rule requires.
4. Keys follow T-424's keymap rules.
5. Write the spec section in the panels doc first.

## Done

- A unit test per tab on a fixture dwarf.
- An e2e test that clicks a dwarf, opens the sheet and switches tabs, with a screenshot.
- The gates pass.
