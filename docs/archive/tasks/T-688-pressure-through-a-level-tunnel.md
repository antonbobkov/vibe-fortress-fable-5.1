# T-688 — Pressure stops at a level tunnel

**Closed:** 2026-11-24, in 2e8b8990,2f027e61,9710b303,91f5c0f3.

**Source:** [T-663's report](../../../reports/data/2026-11-20-t663-water-inside-the-gate.md) · **Size:** S · **Needs:** — · **Status:** open

## Why

04's hints tell the player that water rises to the level of its source, and `fl_pressure` shows it for a U-tube whose foot is fed by source tiles. T-663's cistern is fed differently: the brook's water falls down an open shaft onto the floor of a level tunnel, and the tunnel carries it sideways to the cistern. Left open to the brook (`bd_cistern_well`'s layout with the floodgate never shut, a local probe), the tunnel and the cistern settled within a day at about six a tile (56 units in the cistern's nine tiles, the well's own tile at 7) and stayed so for eight days, and nothing rose up the well's open column, though the brook stands eight levels higher. Spread hands a neighbour at `L − 1` a unit only by equalizing, whose budget a tile renews only by a real flow (04 § The four movement rules, rule 2), so the tunnel's tiles stop one short of full; pressure lifts only from a body of full tiles (rule 3), and the shaft's full column never joins the cistern through them.

So a player's cistern cannot flood the hall above it, open or shut, while a U-tube of source tiles fills to its source's level: two answers to one question, depending on how the water arrived.

The same rule limits how far a level tunnel carries water at all: on `flat-test`, 40 tiles of 1-wide tunnel fed by a full column settled within 2,000 ticks at levels falling from 7 to 1 by the 35th tile, and nothing beyond, unchanged at 40,000 ticks. The three-year fortress's halls lie 25 to 50 tiles of tunnel from its brook, so its script digs its well room by the brook instead (T-663's report).

## What to do

Decide whether a level tunnel should carry water on to its end and the shaft's pressure with it (the hint's promise: an open floodgate would then fill the cistern, lift the water up the well's column and flood the hall, the player's doing), or whether a body joined only through tiles at `L − 1` is meant to stop (then the hint says so). If the rule changes, it changes in 04 § The four movement rules with a fluid scenario of a shaft feeding a level tunnel to a second shaft, and `bd_cistern_well` keeps its floodgate shut as it does.

Spec: 04 § The four movement rules, § Player-facing behavior.

## Done

A fluid scenario of a fall-fed level tunnel and the decision, written into 04.

## Decision

**The rule changes: pressure pushes sideways.** Rule 3 keeps its lift into the tile above, and when that finds nothing to do, a full tile pushes one unit from a higher tile of its body (`H.z > T.z`, the same bounded breadth-first search) into the first cardinal neighbour on its level that is below full. A level tunnel joined to a full column becomes one full body with it, so the water and its pressure reach the tunnel's end and rise up any open column there to one below the source's level, as the U-tube of source tiles always did. The hint's promise ("water rises to the level of its source") now holds however the water arrived, and a player's floodgate decides whether the hall floods. A body with nothing above its own level (a pond, a lake, a river at its own level) never pushes, so still water is untouched. Written into 04 § The four movement rules, rule 3, and § Player-facing behavior; `algorithms/fluids.md` has the pseudo-code.

Why, on evidence (local, `test/perf/t688_tunnel_probe.test.ts` with `T688_PROBE=1`, and `fl_perf`):

| | Master's rule | Sideways push |
|---|---|---|
| `flat-test`, source over a 7-deep shaft onto a 40-tile 1-wide tunnel, levels at 2,000, 10,000 and 40,000 ticks (the same each time) | `7 7 7 7 6 6 6 6 6 6 6 5 5 4 4 5 4 5 4 3 3 3 3 3 2 3 2 2 2 1 1 1 1 1 1 1 1 1 1 0 0`: level 1 by the 30th tile, the last at the 39th, the 40th and 41st dry; settled | every tile 7 by 2,000 ticks; settled |
| The same tunnel ending under a 12-high open shaft | the shaft dry | the shaft full from z 21 to z 27 (the source stands at z 28), nothing above; settled |
| Generated `perf-1`, every water tile touched, until settled (≤ 4,200 ticks): ticks, fluid-step time | 2,699 ticks, 5,607 ms | 2,493 ticks, 5,333 ms |
| `perf-2` (a river: never settles in 4,200 ticks) | 2,895 active at the end, 19,963 ms | 3,128 active, 19,576 ms |
| `perf-3` | 2,447 ticks, 6,413 ms | 2,415 ticks, 6,248 ms |
| `fl_perf` (reference fortress, 40-tile waterfall channel, 2,000 ticks), 04 per tick | 0.017, 0.017 ms | 0.018, 0.020 ms |

So the push costs nothing measurable and does not make ordinary water spread wider or longer: generated maps settle as fast or faster.

**`bd_cistern_well` keeps its floodgate shut**, but the lever's timing had to change: with the push, the floodgate standing open about 300 ticks (one pull to open, a dwarf walking 180 ticks to pull it shut once the water stood under the well, and the gate following each pull 100 ticks later) filled the cistern and lifted the brook up the well's column onto the hall's floor. `cistern-well.ts` now pulls the lever shut as soon as the opening pull is done, so the gate stands open only for the time between the two pulls (about 20 to 40 ticks in the scenario), and opens it again, once both pulls have reached the gate, only while the well's tile is dry. The cistern takes a level or two a tile; the well works and the hall stays dry. The three-year script shares the code and has its cistern off by default.

The three-year script's `HALL_TUNNEL_MAX` (20) was set because water stopped some thirty tiles down a tunnel; that reason is gone, and whether the hall plan should now reach the twenty maps' 25 to 50 tile tunnels is a follow-up ([T-NEW](../../work/T-694-cistern-under-the-hall.md)).

## Done

- [x] A fluid scenario of a fall-fed level tunnel: [`fl_tunnel_pressure`](../../../test/scenarios/fl_tunnel_pressure.scenario.ts) (a source over a 7-deep shaft, a 40-tile tunnel, a 12-high shaft at its end: every tunnel tile full and the shaft full to the source's level − 1 within 2,000 ticks, never above, settled); unit tests of the push in `test/unit/fluids/fluids.test.ts`.
- [x] The decision, written into 04 § The four movement rules (rule 3) and § Player-facing behavior; `acceptance-tests.md` § 04 Fluids lists the scenario.
- [x] The 40-tile tunnel re-measured (above).
- [x] Gates on `2f027e61`: CI 45445005098 green (four unit shards, checks, e2e: 46 passed). Sweep 45445012089, `sweep-verdict`: pooled 20 / 7 / 0 / 1097 living / 122.75 deaths / 0.5 extinct / 0.5 need deaths against bounds ≥ 1046.63 living and ≤ 132.5 deaths; **verdict: pass**, worth tracing by seed: none, invariant findings: none, every seed job green. Master's last sweep with the same script (T-663's third, 45046783384) pooled 1097.25 / 122.5.
