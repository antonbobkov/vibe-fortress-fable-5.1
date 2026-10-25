# T-443 — A river's source region has no river on its local map

**Closed:** 2026-10-24, in e55704e.

**Source:** T-440 (the site summary) · **Size:** S · **Needs:** — · **Status:** open

## Why

01 § Rivers gives the first region of every river a river record with no inflow edge and an outflow edge. The world map draws that region as a river (blue `~`), and the filter panel's "River: yes" keeps it. But 03 stage 2 carves a river only from the midpoint of each inflow edge ("A river with no inflow edge carves no path"), so the local map of a source region has no river at all. Before T-440 the region panel said "A river rises here and runs east." of such a region; a player who embarked there for the water found none. T-440's site summary now says "Water: none on the surface" for it, but the map glyph and the filter still promise a river.

## What to do

Decide one of these and write it into 01 and 03:

1. carve a source region's river from a spring inside the map (the map centre, or a point drawn by the stream) to the outflow edge; this moves the world hashes of every source-region fixture; or
2. keep the local map as it is, and have the world map and the filter treat a source region as having no river (draw it by its biome; "River: yes" needs an inflow edge).

Pin it with a unit test that the region's local map has a river exactly when the world map and the filter say it does.
