# T-NEW — The priority digit says which end is urgent, and a redrawn box takes the new one

**Source:** playtest 8 ([report](../../reports/data/2026-11-26-playtest-8.md), finding 5) · **Size:** S · **Needs:** — · **Status:** open

## Why

Priority 1 is the most urgent, and 9 the least (11 § Concepts). Nothing on the screen says so:
- The player set a stair column to 9, meaning "top", and the status row read "Stairs · priority 9 · [Esc] cancel".
- In the Jobs panel, [p] stepped a job from 5 up to 9 and stopped there; Shift+P wrapped it to 1. Neither step said which way was more urgent.
- Redrawing a dig box over tiles already designated kept their old priority, 8.
- Designate's [p] ("give the tool's priority to the last batch") answered "3 designated tiles now have priority 2." That was not the box just redrawn.

The Jobs panel then explained the result correctly: "Nobody takes it yet: 2 more urgent jobs come first … Raise its priority to have it sooner." By then the player had spent weeks at the wrong end of the scale. In the other fortress, the same stair at priority 2 reached cavern 3 in six days.

## What to do

Decisions taken here:

- **Say the direction wherever a priority is shown or set.** The designation status row reads "priority 2 (urgent)", "5 (normal)" or "9 (whenever)": 1–3 urgent, 4–6 normal, 7–9 whenever. The Jobs panel's "Pri" column header reads "Pri (1 first)". [p] and Shift+P read "[p] sooner [S-p] later": [p] moves toward 1, Shift+P toward 9, and neither wraps.
- **A box drawn over designated tiles gives them the tool's priority.** Their jobs take it too, as `SetJobPriority` does. The tiles count in the status row as "N re-prioritized".
- **Designate's [p] applies to the last box drawn,** whether its tiles were new or not, and names it: "Stairs 1×1×20: priority 2."
- "Raise its priority" in the Jobs advice becomes "Give it a lower number (more urgent)".

## Done

- [ ] The status, header and key texts; the Jobs [p]/[S-p] direction without wrap; UI tests.
- [ ] Redrawn boxes re-prioritize tiles and their jobs; a test.
- [ ] Designate [p] on the last box; a test.
- [ ] 24 § Rules (input model), 11 § Concepts and `panels.md` § Jobs, § Designate updated.
