# T-694 — The three-year cistern under the hearth hall

**Source:** [T-688](../archive/tasks/T-688-pressure-through-a-level-tunnel.md) · **Size:** M · **Needs:** — · **Status:** open

## Why

The three-year script (`test/scenarios/three_years_cistern.ts`, off by default through `FortressState.waterInside`) puts its cistern under a corner of the hearth hall only where the feed tunnel is at most `HALL_TUNNEL_MAX` (20) tiles, because a level tunnel used to carry the brook's water only some thirty tiles. On the twenty sweep maps the hall lies 25 to 50 tiles of tunnel from the brook, so the script always digs a well room by the brook instead, with a passage of 13 to 26 tiles to the halls, and a sheltering dwarf under an alert does not walk there for a want-level thirst (the room is outside its shelter). Since T-688 the shaft's pressure carries water to the end of any tunnel of up to `PRESSURE_SEARCH_LIMIT` full tiles, so a cistern under the hall itself is reachable on every map. It also means a floodgate left open floods the hall: `cistern-well.ts` now pulls the lever shut as soon as it has pulled it open.

## What to do

Decide whether the script's hall plan should take tunnels of the twenty maps' length (raise `HALL_TUNNEL_MAX`, or drop the well room), and measure it with `waterInside` on in the sweep, alongside T-663's open question (the nine dwarves of `three-years-p0-3` at shift 0 who starved outdoors beside full stores). Check the pulse filling on the long tunnels: a shut pull taken by a far dwarf leaves the gate open for its walk, and a long tunnel holds more water behind the gate.

Spec: `process/testing-strategy.md` § The long scenarios (the cistern's paragraph).

## Done

A sweep with `waterInside` on and the hall plan for long tunnels, and the decision whether to turn the cistern on.
