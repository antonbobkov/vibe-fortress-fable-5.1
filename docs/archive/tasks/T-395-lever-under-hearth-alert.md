# T-395 — No dwarf pulls a lever under the hearth alert

**Closed:** 2026-10-18, in 320c862, 8ba8d61, 1ea40df.

**Source:** T-151's raid stage, 2026-10-18 (`test/scenarios/defence_year_fortress.ts`, seed `defence-year`, peril 2) · **Size:** S · **Needs:** — · **Status:** open

## Why

19 § Doors, bridges, floodgates as defense guarantees *the gate*: a drawbridge over a channel linked to a lever inside; raised, it leaves no path. The moment a player raises it is when a raid comes, and that is when the hearth alert is up. But 10 § Behavior selection sends every civilian to `retreat` under the hearth alert, and "under the alert 11 offers a sheltering civilian patient-care jobs only". Soldiers take no jobs. So a `PullLever` given under the alert makes a `pull_lever` job that nobody takes until the alert ends: in T-151's run a pull ordered on day 75, with Gloam in the corridor before the gate, stayed open for the whole ambush. The lever stood inside, on the halls' level beside the gate stair.

## Decisions

- Under the hearth alert 11 also offers a sheltering civilian a `pull_lever` job whose lever lies inside its shelter: on a tile that is not `outdoor` and is reached from its retreat tile without passing a door (the area 10 already uses for want-level needs under the alert). The civilian works it and returns to shelter, as it does for patient care. A lever outside the shelter waits for the alert to end, as now.
- No other job changes.

## What to do

1. A failing stepped test: a hearth alert, a civilian with the mechanics labor in the hearth hall, a lever linked to a bridge inside the hall, `PullLever`; the bridge is raised before the alert ends.
2. The rule in 10 § Behavior selection (retreat) and 11 (what the alert offers), and the test passing.
3. T-151's script then pulls the lever under the alert (`checkDefenceRaid` names this row).

## Done

- The test passes; the specification says which jobs a sheltering civilian takes.
