# T-799 — The priority digit says which end is urgent, and a redrawn box takes the new one

**Source:** playtest 8 ([report](../../reports/data/2026-11-26-playtest-8.md), finding 5) · **Size:** S · **Needs:** — · **Status:** done

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

Decided in the work (ambiguity protocol):

- **The Jobs header.** The priority column is 4 cells wide, so "Pri (1 first)" does not fit; the header stays "Pri" and the key line under the list says it: "[p] sooner  [S-p] later (1 first)". The panel's key lines are now three ("[Enter] center  [x] cancel", the priority line, "[o] standing orders"), and the list gives up one row for them. At either end of the scale nothing is sent and the status row says so ("Already priority 1, the most urgent.").
- **Where the band is shown:** the designation tool's status rows, the Designate panel's priority line ("(1 first)" in place of "(1–9)"), Look's designation line ("Designated: dig, priority 2 (urgent)") and `[p]`'s message.
- **A redrawn box.** 03 already gives a designated tile that passes the precondition the new designation and priority, and its producer moves the job's priority with it; what was missing was saying so. The box now counts those tiles in the status row ("Dig: 2 designated, 2 re-prioritized.").
- **Designate's `[p]`** acts on the last box drawn: its tiles sent and those of the box already designated, even when the box sent nothing new. The undo history (`Ctrl+Z`) keeps its batches as before.

## Done

- [x] The status, header and key texts; the Jobs [p]/[S-p] direction without wrap; UI tests.
- [x] Redrawn boxes re-prioritize tiles and their jobs; a test.
- [x] Designate [p] on the last box; a test.
- [x] 24 § Rules (input model), 11 § Concepts and `panels.md` § Jobs, § Designate updated (§ Designate is `fortress-screen.md` § Designate tool; also the keymap table).
