# T-NEW — The giant cave spider's bite venom is written and not played

**Source:** T-492 (its commit) · **Size:** S · **Needs:** — · **Status:** open

## Why

[creatures.md](../03-content/creatures.md) § Cavern monsters gives the giant cave spider's bite as "bite pierce 16 size 4 (venom: pain +20 for 300 ticks)". The export drops the bracket: `creatures.json` has the bite with no venom, and no code adds pain on a spider's bite. T-492 added a timed `pain` effect on `Spellbound`, read in 17's pain sum, for the `venomed` blade made from the spider's own venom. The spider itself still bites without it.

## What to do

1. Make the bracket a column the export reads (an attack's `on_hit` of `pain` value and ticks), and add the `pain` effect on a spider's bite that does damage, through `addEffect` as `applyEnchantOnHit` does.
2. Or drop the bracket from the row, if the owner prefers the spider as it plays.

This moves where spiders bite dwarves: run the annual instrument and `pp_defence` and explain any move.

## Done

- A spider's bite pains its target by 20 for 300 ticks, with a test; or the row no longer says so.
