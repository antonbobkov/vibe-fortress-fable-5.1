# T-712 — A wild grazer eats grass that snow fell on while it walked there

**Closed:** 2026-11-24, in 098c0886,edf3cd3c.

**Source:** T-701 (the check of grazing under snow) · **Size:** S · **Needs:** — · **Status:** open

## Why

08 says snow-covered grass cannot be eaten, and every tame path honours it (`animals/tame.ts` checks `TileFlag.Snow` beside `TileFlag.Grass` at each of its five sites), as does the wild search (`grassNear` in `animals/brain.ts` skips snowed grass). The wild `graze` state does not on arrival: `brain.ts`, `case 'graze'`, eats the tile it stands on when it has `Grass`, without asking about `Snow`. A deer that set off for a bare tile and arrived after snow covered it clears the grass under the snow (`GrassGrazed`), so the tile is bare when the snow melts.

Small and rare (snow lays at most eight chunk columns an hour, and a graze walk is short), but it is the one place the rule is broken.

## What to do

Decision: in the wild `graze` arrival, eat only grass with no `snow` (`!map.hasFlag(at, TileFlag.Snow)`); otherwise look again with `grassNear` as for a tile with no grass. Spec: 08 § Wild behavior, `graze` ("on arrival, clear its grass" becomes "on arrival, clear its grass unless snow now covers it, else look again").

## Done

- [x] Test: a wild grazer walking to a grass tile that is snowed before it arrives does not clear that tile's grass.
- [x] The instrument's verdict in the commit body (wild grazing moves the wildlife year).
