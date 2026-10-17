# T-382 — The game says when a hearth alert has locked every dwarf outside its gate

**Source:** T-363 (2026-10-17): on seed `three-years-p2-5` from day 193, wolves kept a hearth alert up, both `lock_on_alert` gate doors locked, and all seven dwarves were on the surface; nobody could reach anything inside for days. The game followed 19 (the lock waits out its grace; a civilian shut out skips the retreat), and the test script was changed to lift such an alert. A player gets no warning. · **Size:** S · **Needs:** — · **Status:** open

## Why

The lock-on-alert rule is meant to keep raiders out, and it can lock the whole fortress out instead. The script now notices; a player cannot.

## What to do

Decide and implement the smallest fix a player would expect, in this order of preference: (a) an alert line and a pause when a `lock_on_alert` door locks with every fortress dwarf on its far side ("Every dwarf is outside the locked gate."), with the panel naming the doors; (b) if the spec allows it, the door does not lock while no fortress dwarf is inside the area it guards. Write the decision here, fold it into 19 and 24, and test it with the seed's situation built by hand.

## Done

- The player is told (or the doors do not lock) when an alert would shut every dwarf out; gates as for a behaviour change.
