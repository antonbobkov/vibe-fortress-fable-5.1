# T-437 — Dig designations blink while queued or assigned

**Source:** the owner, 2026-10-23 (first play session) · **Size:** S · **Needs:** — · **Status:** open

## Why

The owner wants to see at a glance which dig orders are still pending.

## Decisions

1. A designated tile whose job is not yet done blinks: it alternates between its designation glyph and the underlying tile at about 2 Hz.
2. **Queued** (no worker yet) and **assigned** (a worker claimed it) blink differently. For example, queued alternates with the tile, while assigned holds the designation colour and pulses brighter. The legend and Help say which is which.
3. **Blocked** (unreachable) designations keep their existing marking and do not blink.
4. The blink is presentation only. It is driven by the frame clock, never the sim tick, so pausing does not freeze it, and it can be turned off by a reduced-motion setting, which is on in screenshots and e2e.

## Done

- A unit test of the blink state for each designation state.
- Help and the legend updated.
- The gates pass.
