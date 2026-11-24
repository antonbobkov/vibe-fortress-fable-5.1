# T-NEW — A ruin's traps still stand, some still armed

**Source:** T-692 follow-up · **Size:** M · **Needs:** T-692 · **Status:** open

## Why

A ruin keeps its halls, some items, its furniture (T-690) and its workshops, hearth, depots and wells as wrecks (T-692, 02 § Ruins, 14 § Wrecks). Its mechanisms and traps are gone: the lever that raised the old drawbridge, the weapon traps in the old gate corridor. An old fortress's gate still set with a weapon trap or two that bite the new expedition's first miner (or the first goblin to walk in) is a story a re-embark could tell, and a fun one (`docs/fun-features.md`).

## What to do

Decide whether a ruin's traps stand (as wrecks that do nothing, or a few still armed, with their loaded weapons weathered), and its levers, plates, floodgates and bridges (wrecks, links lost). Record them beside the wrecks (`RuinRecord.wrecks`, or a trap list with the loaded items), place them at arrival through 14 (`placeWreck` or a sibling), and say in 19 whom an armed old trap catches (no faction owns it: everyone, the new dwarves too, until it is disarmed or taken apart). Keep the record small, the placement deterministic, and fresh embarks unchanged (world hashes). Spec it in 02 § Ruins, 14 § Wrecks and 19.

## Done

- [ ] Tests: a ruin's trap stands on the next embark as its record says (a wreck, or armed and springing on a creature), and taking it apart returns what it holds; a fresh embark is unchanged.
