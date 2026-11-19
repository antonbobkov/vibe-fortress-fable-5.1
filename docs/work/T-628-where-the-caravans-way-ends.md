# T-628 — Show where a caravan's way to the depot ends

**Source:** [T-618's first-year audit](../../reports/audits/2026-11-18-t618-first-year-ux.md), finding 8, and T-623 · **Size:** M · **Needs:** — · **Status:** open

## Why

A caravan that cannot reach the depot now says so, naming the depot, the edge and what it needs ("a way on foot, with no deep water or drop"), and a depot placed out of reach says so when it is placed. Neither says *where* the way breaks: on a map with a river, a channel and a cliff, the player still looks for the gap by eye. The audit's river at Mossrun was easy; a three-level channel behind a hill is not.

## What to do

When a caravan's edge reaches none of the depot's tiles, find the gap: the tile a walker from the edge reaches that is nearest the depot (22's `nearestReachable` from the edge, toward the depot), and the tile nearest it on the depot's side. Show it: the caravan's line (and the depot panel's warning) focus on that place rather than on the depot, or a `[v]` key in the depot panel centres the map there, and the map marks the two tiles while the depot panel is open. Decide which in the spec (20 § Movement step 2, `panels.md` § Depot) and pin it with the T-623 channel scenario.

## Done

The channel scenario's line or panel takes the player to the channel's edge on the caravan's side; a unit test for the depot panel's mark.
