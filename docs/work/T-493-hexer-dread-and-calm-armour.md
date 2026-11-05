# T-493 — Hexers cast Dread on dwarves, and `calm` armour answers it

**Source:** [flavour report](../../reports/audits/2026-11-03-flavour-left-out.md) (item 12) · **Size:** M · **Needs:** T-483 · **Status:** blocked (needs T-483)

The owner (2026-11-04): "I like all of these, let's try to make it work (but drop if too complex)."

## What to do

- Give the Gloam hexer a second kit: a wand of Dread (sapphire), as well as the frost wand. Pick one per hexer (one in three Dread is a starting point), on 18's existing draws or on stream 25 if it must draw; peril 2 still draws nothing new.
- Dread on dwarves: an affected dwarf runs from the hexer for the effect's time and comes back, reusing combat's `stepFled` (`combat/fled.ts`). Soldiers on duty and civilians alike; Willpower resists as for creatures. A fled soldier is out of the fight for a while: the same trade-off the owner kept for `fearsome` (T-485).
- Bring back the `calm` armour enchantment (sapphire): the wearer is immune to Dread and `fearsome`, and resists Daze better.
- The thought for a dwarf put to flight, mild and short.

**Drop rule.** This is a fun feature, and the owner said to drop it if it is too complex. If the plainest version needs a new mechanism much larger than the effect, or breaks a set rule that a small change cannot fix, stop, commit the findings, and report it as dropped with the reason. That is a valid outcome. If it lands, list it in [`docs/fun-features.md`](../fun-features.md) § In the game, marked removable.

## Done

- Tests: a hexer's Dread sends at most four dwarves running and they return; `calm` makes a dwarf immune; Willpower resists.
- Measured: the peril-4 hexer arena (T-479's) with and without Dread hexers, then the twenty-seed file once; the set survival rule holds.
