# T-718 — "Calm: everyone works." while a training squad does no work

**Source:** playtest 2026-11-24 (second) ([report](../../reports/data/2026-11-24-playtest-2.md), finding 5) · **Size:** S · **Needs:** — · **Status:** open

## Why

A new player who picks the Warband preset reads the Military panel's own hint ("A squad of three with iron spears and a kill order holds off boars.") and help step 7 ("a squad [m] with iron spears"), makes a squad of the two axedwarves and the crossbowdwarf on day 1, and sets it to Train. The panel's alert line says "Calm: everyone works." (`15-squad.png`). From then on the three are "On duty" in Units all spring and summer (`16-units-d7.png`): three of seven dwarves never haul, dig, farm or fish, in a fortress that ran out of food on Spring 15. With no barracks yet the panel did warn "No barracks: the squad cannot train." but the members still left work to stand about at the wagon.

By 16 § Squads this is the rule (a soldier on duty in `train` works no job, as in Dwarf Fortress). The text says otherwise, and nothing tells the player the cost of Train.

## What to do

Decisions:

- **The Calm line says who does not work**: "Calm: everyone works but squads on Train or Active." When no squad is on duty it stays "Calm: everyone works." (`ui.military.alert_calm`).
- **The squad's mode line says what Train costs**: under "Mode: train", "3 dwarves off work: they drill at the barracks." and with no barracks "3 dwarves off work, and with no barracks they cannot drill: [z] Barracks, then [b], or [o] Off." The Off key is in the line.
- The rule does not change: a training squad stays off work.

Spec: `ui-screens/panels.md` § Military (the alert line and the mode line); `ui.military.*` strings.

## Done

- [ ] Tests (`describe` with the task id): with a squad on Train the Calm line names it; the mode line counts the members off work; with no barracks it says they cannot drill and names `[o]`.
- [ ] UI only: world hashes unchanged.
