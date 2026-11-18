# T-593 — Are peril-4 ambushes too deadly for a sensible player?

**Source:** [T-580's sweeps](../../reports/data/2026-11-17-t580-ambush-surface-work.md) · **Size:** L · **Needs:** — · **Status:** open

## Decided

The orchestrator accepted the cost of honest ambushes: at T-580 the sweep's reference moved to the honest baseline (the script answering an ambush only once it springs, working below ground or by the gate, with a watch and war dogs at the gate). This task does not ask whether to move the reference again.

## Why

With T-576 and T-580 the ambush census fell at peril 2 (136 to 116 dead over four shifts) and rose at peril 4 (258 to 271). Peril 4's ambushes of six to ten Gloam, faster than a dwarf and hidden until a dwarf or a trained dog sees them at `SPOT_RADIUS` or `SPOT_RADIUS_DOG`, still kill dwarves farming, hauling and cutting wood far from the gate, and kill the war dogs that meet them, leaving a post to a watchman until another dog is trained. In large fortresses the probes also found dwarves walking 25 to 35 tiles to the brook when the drink ran short.

## What to do

Measure, over a sweep, which peril-4 ambushes kill and where (the census with T-576's notes of where each victim stood), and decide whether a sensible player can answer them: the balance of a peril-4 ambush's size, speed and stealth against what the player has (the watch, war dogs, candles at the gate, the squad), and whether the far brook walks are the drink economy's to fix. Any change to the game's numbers is a balance change, measured as such.

## Done

The decision in the spec or the balance tables, with its measurement.

## Found

[The measurement](../../reports/data/2026-11-18-t593-peril4-ambushes.md): the census of T-587's sweep (run 44254295856, master with T-596) and a probe of where the victims stood on master `8d022dd9` (`test/perf/t593_ambush_victims_probe.test.ts`, eight peril-4 timelines).

- Over four shifts 150 peril-4 ambushes sprang (6.3 a fortress, 7.4 Gloam each) and 135 dwarves died while one was on the map: **0.90 an ambush**, against **0.88** for peril 2's 96 ambushes of 4.8. Size does not predict the toll; peril 4 costs more because ambushes come twice as often, as 18 asks. A peril-4 fortress loses about 5.5 dwarves to them in three years; 55% of ambushes kill nobody; the ten worst killed 60 of the 135. The census's peril-4 deaths were 277 on T-576 and 271 on T-580.
- Every death began with a wound outdoors (23 dwarves wounded indoors, none died); ten of eleven wounded 13 or more tiles from the gate died. Most victims had seen the ambush and were fleeing: a dwarf spots at 6, a war dog at 10, a bow reaches 14, and the Gloam outrun a dwarf. Archers did 155 of the Gloam's 277 kills. Every war dog the members wounded died.
- The script's squad of five stands down for every peril-4 ambush (all are six or more), so the census measures a fortress that never fights one.

**Recommendation: (c), leave peril 4's ambushes as they are.** Smaller ambushes would not help; a warning would undo the ambush and add a nuisance alert every 45 days; a longer interval would save about 30% of ambush deaths at the cost of 18's *frequent*. What would settle it is an arena of the owner's strong squad against a peril-4 ambush, filed as a follow-up; if the squad loses, the lever is the ambush's share of archers. Recorded in [balance-status.md](../balance-status.md) (Ambush deaths, peril 4).
