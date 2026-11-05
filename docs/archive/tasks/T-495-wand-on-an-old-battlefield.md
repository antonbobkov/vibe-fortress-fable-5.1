# T-495 — A dead runecaster's wand among an old battlefield's arms

**Closed:** 2026-11-05, in e3fa0e2e,a299ff0c,79d72438.

**Source:** [flavour report](../../../reports/audits/2026-11-03-flavour-left-out.md) (item 17) · **Size:** S · **Needs:** — · **Status:** open

The owner (2026-11-04): "I like all of these, let's try to make it work (but drop if too complex)."

## What to do

- On an `old_battlefield` map, a separate pick on its own generation stream (like T-468's rare patches) sometimes leaves one stoneless staff or a wand with a stone among the old arms. T-470 kept the channel rows out of `metal()` in `terrain/generate/traits.ts` so the ordinary arms do not change; keep it so, and add this as its own pass.
- A starting chance of about one battlefield in three, and at most one channel per map.
- The item is old and found, so it is a dwarf's to claim like any other stock once hauled; it needs a runecaster to be more than a stick.
- Only battlefield maps change. The local-map golden may move for battlefield maps only; name it in `golden:`.

**Drop rule.** This is a fun feature, and the owner said to drop it if it is too complex. If the plainest version needs a new mechanism much larger than the effect, or breaks a set rule that a small change cannot fix, stop, commit the findings, and report it as dropped with the reason. That is a valid outcome. If it lands, list it in [`docs/fun-features.md`](../../fun-features.md) § In the game, marked removable.

## Done

- Tests: battlefield maps sometimes hold one channel, never more; other maps are unchanged; the ordinary arms are unchanged.
