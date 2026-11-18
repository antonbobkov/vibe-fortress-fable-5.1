# T-598 — Stairs carved into a constructed wall

**Source:** T-594 (stairs are not cut under a building) · **Size:** S · **Needs:** — · **Status:** open

## Why

03's `dig` refuses a `constructed` wall, but `stairs_up` and `stairs_updown` accept any `wall`. A constructed wall carved into stairs keeps its `constructed` flag, drops what digging its block material drops, and 14 removes the wall's construction record when its tile stops being a wall, so the blocks it was built of are not returned. Since T-594 a constructed floor takes no stairs (it holds a building), so the wall is the one construction a stair designation still carves.

## What to do

Make `stairs_up` and `stairs_updown` refuse a constructed wall as `dig` does, with a skip reason in the Stairs tool, or define what carving one returns. Write it in 03 § Tile transitions and test it.

## Done

The rule in 03, the code and a test.
