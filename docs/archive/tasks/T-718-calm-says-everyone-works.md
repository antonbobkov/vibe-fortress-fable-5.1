# T-718 — "Calm: everyone works." while a training squad does no work

**Closed:** 2026-11-25, in b6d9456c,e5966ba6,c34d34a4.

**Source:** playtest 2026-11-24 (second) ([report](../../../reports/data/2026-11-24-playtest-2.md), finding 5) · **Size:** S · **Needs:** — · **Status:** open

## Why

A new player who picks the Warband preset reads the Military panel's own hint ("A squad of three with iron spears and a kill order holds off boars.") and help step 7 ("a squad [m] with iron spears"), makes a squad of the two axedwarves and the crossbowdwarf on day 1, and sets it to Train. The panel's alert line says "Calm: everyone works." (`15-squad.png`). From then on the three are "On duty" in Units all spring and summer (`16-units-d7.png`): three of seven dwarves never haul, dig, farm or fish, in a fortress that ran out of food on Spring 15. With no barracks yet the panel did warn "No barracks: the squad cannot train." but the members still left work to stand about at the wagon.

By 16 § Squads this is the rule (a soldier on duty in `train` works no job, as in Dwarf Fortress). The text says otherwise, and nothing tells the player the cost of Train.

## What to do

Decisions:

- **The Calm line says who does not work**, naming each squad on Train or Active with its members and its mode: "Calm: everyone works but 3 in The Hearthguard (Train) and 2 in The Cold Bolts (Active)." (taken at the work: a count and a name tell more than the rule alone). An Off or empty squad is not named; with none on duty it stays "Calm: everyone works." (`ui.military.alert_calm`). The line wraps whole, never cut (24 § the sidebar's text). It appears only in the Military panel: the status bar and the help show no alert line.
- **The squad's mode line says what Train costs**: under "Mode: train" and its keys row, "3 dwarves off work: they drill at the barracks." and with no barracks "3 dwarves off work, and with no barracks they cannot drill: [z] Barracks, then [b], or [o] Off." The Off key is in the line.
- The rule does not change: a training squad stays off work.

Spec: `ui-screens/panels.md` § Military (the alert line and the mode line); `ui.military.*` strings.

## Done

- [x] Tests (`describe` with the task id): with a squad on Train the Calm line names it; the mode line counts the members off work; with no barracks it says they cannot drill and names `[o]`.
- [x] UI only: world hashes unchanged (only `src/ui` changed).
