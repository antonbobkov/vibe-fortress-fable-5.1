# T-517 — An attacked caravan whose guard keeps a target never leaves the map

**Source:** T-512's sweep, `three-years-p4-6` with T-512's sowing rule, unshifted (run 42325947404, artifact `seed-p4-6`, kept until about 2026-11-20). The seed's T-176 invariants failed at tick 100800 (day 84) with `caravan.present-over-20d`: "party … wildwood caravan state wait since t75687 arrived t75600 members 8/13 size 13". · **Size:** S · **Needs:** — · **Status:** open

## Why

The Wildwood caravan arrived on day 63 and reached the depot 87 ticks later (`unload` sets the party to `wait`). Peril-4 raiders are about on that seed, and 5 of its 13 members died. 21 days later it was still on the map.

A reading of `TradeSystem` (`src/systems/trade/index.ts`), not yet probed:

- On `AttackResolved` against a caravan member, the caravan's own state goes to `leave` but its `Party.state` is left as it was (`wait`). The invariant line and anything else that reads the party see a caravan at the depot.
- In `leave`, a guard that has a combat target (`combat.targetOf(id)`) counts as not yet gone, and the caravan departs only when every living member has gone. The leave has no limit. A guard that keeps a target it never reaches or kills (a raider behind a door, one that fled out of reach, a target 16 never drops) holds the caravan on the map for good.
- While it stands there, every civ's next caravan is pushed back a day at a time (`if (this.active) entry.nextArrivalTick += TICKS_PER_DAY`), so no caravan comes at all.

This is a game rule, not the three-year script: the sowing rule only moved this seed's timeline onto it.

## What to do

- Probe the seed. Replay `three-years-p4-6` with T-512's sowing rule as the sweep plays it, and log from day 63 the caravan's state, each member's position and its combat target, to confirm which guard holds it and why.
- Set `Party.state` to `leave` with the caravan's state on an attack, as `pack` does.
- Give the leave a limit: after a number of days in `leave`, a guard still fighting gives up its target and walks out, or the caravan departs without it. Put the rule in 20 § Caravans.
- A unit test: an attacked caravan with a guard holding a target it cannot reach leaves the map within the limit.

## Done

- No caravan stays on the map past its limit; the test passes; `three-years-p4-6` keeps its invariants.
