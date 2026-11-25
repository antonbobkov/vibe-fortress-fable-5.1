# T-694 — The three-year cistern under the hearth hall

**Closed:** 2026-11-24, in 5bca5c32,96e96ba4,5c1186c3,391f2982,f4c46a42,b1c125f3,b673d3a2.

**Source:** [T-688](T-688-pressure-through-a-level-tunnel.md) · **Size:** M · **Needs:** — · **Status:** done

## Why

The three-year script (`test/scenarios/three_years_cistern.ts`, off by default through `FortressState.waterInside`) puts its cistern under a corner of the hearth hall only where the feed tunnel is at most `HALL_TUNNEL_MAX` (20) tiles, because a level tunnel used to carry the brook's water only some thirty tiles. On the twenty sweep maps the hall lies 25 to 50 tiles of tunnel from the brook, so the script always digs a well room by the brook instead, with a passage of 13 to 26 tiles to the halls, and a sheltering dwarf under an alert does not walk there for a want-level thirst (the room is outside its shelter). Since T-688 the shaft's pressure carries water to the end of any tunnel of up to `PRESSURE_SEARCH_LIMIT` full tiles, so a cistern under the hall itself is reachable on every map. It also means a floodgate left open floods the hall: `cistern-well.ts` now pulls the lever shut as soon as it has pulled it open.

## What to do

Decide whether the script's hall plan should take tunnels of the twenty maps' length (raise `HALL_TUNNEL_MAX`, or drop the well room), and measure it with `waterInside` on in the sweep, alongside T-663's open question (the nine dwarves of `three-years-p0-3` at shift 0 who starved outdoors beside full stores). Check the pulse filling on the long tunnels: a shut pull taken by a far dwarf leaves the gate open for its walk, and a long tunnel holds more water behind the gate.

Spec: `process/testing-strategy.md` § The long scenarios (the cistern's paragraph).

## Decision

**The three-year cistern is on** (`waterInside` on by default; only the defence fortress turns it off). The rule set when the task was dispatched: on if the sweep passes and dwarf deaths stay within about one noise SD (~15) of master's. They do: 120.25 against master's 109.75 to 118.25 on the day's sweeps, with living up (1154 against about 1124).

What made it safe to turn on:
- The hall plan takes tunnels up to `HALL_TUNNEL_MAX` = 60 (was 20): sixteen of the twenty sweep maps put the cistern under the hearth hall (tunnels of 27 to 52 tiles), the other four keep the well room. The plan uses only a stretch of brook whose water stands full.
- The well column's last level stays a ramp until the cistern is full and the gate shut, so the hall cannot flood however long the gate stands open (this replaces T-688's open-then-shut pulse as the guard).
- The gate opens only once the brook's water stands full against it (on a shallow stretch the cistern stayed dry).
- The feed's traffic seal is set only once its tiles are empty, and covers the stair only up to the brook's water level (`feedSeal()`): sealing it to the top shut a miner into a ravine pocket on `three-years-p2-7` at shift 0, where he starved beside 537 drinks, and his burial and a haul stood unreachable (the invariant failure of sweep `45495011182`). Likely T-663's open question (dwarves starving outdoors beside full stores) too.
- Other digs and the farm strips keep off the feed's surface columns.

## Done

- [x] Sweep with the cistern on, before the seal fix: `45495011182` on `5c1186c3`, Pooled 20 | 7 | 0 | 1159 | 110.75 | 0 | 0.75, **Verdict: pass**, but seed `p2-7` at shift 0 failed its invariants (the sealed miner).
- [x] Sweep with the seal fix: `45523567918` on `96e96ba4`, Pooled 20 | 7 | 0 | 1154 | 120.25 | 0 | 0.25, **Verdict: pass**, nothing worth tracing, every seed job green. CI `45523570548` green.
- [x] Tests: `t694-cistern-column` (a 52-tile feed fills the cistern under the ramp, nothing rises above it), `t694-feed-seal` (p2-7's works at the breach: the ramp reachable with the new seal, shut in with the old), the hall case in `t663-cistern-plan`; `bd_cistern_well` passes.
- [x] The decision: the cistern on (above); `testing-strategy.md` describes the hall plan, the ramp, the full-brook breach and the seal.

