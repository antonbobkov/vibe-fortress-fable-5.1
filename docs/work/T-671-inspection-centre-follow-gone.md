# T-671 — Centre and follow the thing in view, and say when it is gone

**Source:** [the inspection design](../../reports/designs/2026-11-21-inspection-and-follow.html), § 8 third task · **Size:** M · **Needs:** T-670 · **Status:** open

## Why

Watching a dwarf means panning by hand; the one centring key is in Units and jumps once (design § 1).

## What to do

Build the design's third task: `[S-c]` centre and `[S-f]` follow in the creature and item views (§ 4: follow keeps the thing inside the middle half of the map view and changes level with it; status row 2 says what is followed; every way of moving the view ends it, zoom, pause, speed and panel scroll do not), and the gone states of § 5 (died, used up or merged, hidden, left the map), which keep the title, give the last place and end follow. If T-674's keymap proposal has landed, use its keys.

## Done

Unit tests of the follow box on a moving creature, of each way that ends follow, and of each gone state.
