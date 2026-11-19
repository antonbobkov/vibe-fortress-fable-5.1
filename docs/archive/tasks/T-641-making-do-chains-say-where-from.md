# T-641 — The Making Do recipes say where their inputs come from

**Closed:** 2026-11-19, in bbe97ca7.

**Source:** [T-635's mid-game audit](../../../reports/audits/2026-11-19-t635-midgame-ux.md), finding 21 · **Size:** S · **Needs:** — · **Status:** open

## Why

In a year-2 fortress with a still, a kitchen, a smelter and a forge, Add order reads "○ Soap · no tallow", "○ Wax candles · no beeswax", "○ Tallow candles · no tallow", "○ Press honeycomb · no farmer's »", "○ Glass mugs · kiln not built yet", "○ Bandages · clothier's shop not built yet". Each names the first missing thing and nothing further: where tallow comes from (a butchered animal's fat, rendered at a kitchen), where beeswax comes from (a hive's honeycomb, pressed at a farmer's workshop), that a hive needs a colony. The kiln and the clothier's shop had been placed in spring and were "not built yet" in late summer: their build jobs were open and unclaimed (finding 17), which this line does not say.

## What to do

1. A `○` row whose missing input is made somewhere names one step back: "Soap · no tallow: render fat at a kitchen (needs fat from butchering)"; "Wax candles · no beeswax: press honeycomb at a farmer's workshop (needs a hive)". One step, as the whim's *at hand* rule counts one step (10 § The Thane's whim).
2. "· kiln not built yet" adds how long the build has waited and why when it is longer than a day ("· kiln not built: waiting 41 days for a builder").
3. The line wraps at sidebar width rather than cutting ("farmer's »").

Spec: `ui-screens/panels.md` § Add order.

## Done

Tests for the soap, wax candle and honeycomb rows, and for a placed workshop's wait.

- [x] **One step back**, `test/unit/ui/t641-making-do-chains.test.ts`: "Soap · no tallow: render fat at a kitchen (needs fat from butchering)", and "· no tallow: render fat at a kitchen" with fat in stock; "Wax candles · no beeswax: press honeycomb at a farmer's workshop (needs honeycomb from a hive)"; "Press honeycomb · no farmer's workshop", then "· no honeycomb (from a hive)" once it is built; "Weave cloth · no thread: made at a loom" (two recipes make thread). The maker comes from the recipe table; where a raw input comes from (butchering, a hive, milking, shearing, fishing, felling trees, mining) is a string per item, `ui.orders.pick.source.<item>`, since no table says it. "(needs honeycomb from a hive)" rather than "(needs a hive)": it stays true where a hive stands and has no comb yet.
- [x] **The wait**: a placed kiln reads "· kiln not built yet" under a day; open 41 days with no mason, "· kiln not built: waiting 41 days, no dwarf has the masonry labor"; with the only mason busy, "· kiln not built: waiting 41 days for a builder"; blocked two days, "· kiln not built: waiting 2 days (no path)". The reason is `jobWait` (T-640) cut to a phrase per reason.
- [x] **Wrap**: Add order's list wraps a long row at the list's width, later lines indented under the name, the highlight over all of them; drawn at 36 cells, "Press honeycomb · no farmer's workshop" and the soap row are whole, with no `»`. The Workshop panel's recipe list keeps one row and the short "· no tallow".
- [x] Spec: `panels.md` § Add order, § Workshop.
