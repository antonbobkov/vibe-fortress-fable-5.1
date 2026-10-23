# T-427 — Wild animals in `leave` stay for weeks near the map edge

**Source:** T-421, [boars maul p0-2](../../reports/audits/2026-10-22-boars-maul-p0-2.md) · **Size:** S · **Needs:** — · **Status:** open

## Why

In `three-years-p0-2` at master (`20f0447`), three boars were in state `leave` for the whole journal of days 238 to 272 and never despawned:

| Boar | Arrived on day | Tiles it moved between |
|---|---|---|
| 94193 | 106 | (11–12, 38–41) |
| 41282 | 60 | (5, 43) and (6, 44) |
| 50070 | 213 | (1, 45) and (2, 45), next to the west edge |

08 § Wild behavior has a leaving animal walk to an edge tile and despawn there. These did not, and they stayed on the surface, counted among the wildlife, for weeks. They attacked no one in the journal.

## What to do

Find why `leave` does not end for them. Likely candidates are an edge tile that cannot be reached, a walk that returns neither `arrived` nor `unreachable`, or a test of the edge that misses x = 1. Fix 08 or its spec with a unit test.

## Done

- A unit test of an animal leaving from a tile next to the edge, through the case found.
- The annual instrument by the T-308 rule.
