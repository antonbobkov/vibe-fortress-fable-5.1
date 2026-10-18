# T-400 — No hostile opens a door: the mover reads `opensDoors` where the content has none

**Closed:** 2026-10-18, in 860a0ef, 41ca3c7.

**Source:** T-389's diagnosis of `three-years-p2-6`, 2026-10-18 (probe of the failed walks of the Gloam ambush that stays) · **Size:** M · **Needs:** — · **Status:** open

## Why

`03-content/creatures.md` gives the Gloam and the Hillfolk bandit the flag `O`, and 14 § Doors and hatches lets a hostile with it pass an unlocked door (D-074). The content export puts the flag under `flags` (`src/content/creatures.json`: `"flags": { "opensDoors": true, … }`, as `src/content/schema.ts` declares it), but every reader looks for it at the top of the row:

- `src/app/headless.ts:374-375` (`movement.speciesOpensDoors`, the mover of every walk);
- `src/systems/threats/ai.ts:138-140` (`nearestReachableExit`, a retreating member's exit);
- `src/systems/dwarves/brain.ts:189-193` (a dwarf's mover; harmless, doors stop only hostiles, `deep` and `wild`).

So since the doors were built, no hostile has opened a door. The connectivity labels pass an unlocked door (14's `blocksMovementAt` with no faction), so 18's goal choice finds the hearth reachable while every walk to it fails: in `p2-6` the ambush's leader at the north edge (1, 0, 32) asks for the hearth (35, 7, 26) every time a terrain change sends it back to `approach`, and the path search of its mover (`opensDoors: false`) fails at once, while a search with `opensDoors: true` finds a path of 42 tiles. T-389 stops the party from staying on the map; it does not make it pass the door.

## Decisions

- The three readers read `flags.opensDoors`, as `breaksDoors` is read in `ai.ts` (`spRow?.flags?.breaksDoors`); a test pins that a Gloam walks through an unlocked door and is stopped by a locked one.
- This changes every peril-2 and peril-4 run: a party that comes while the gate is not locked walks in. Measure the three-year sweep (perils 2 and 4) and the defence year before and after, and record the deaths and party outcomes in the commit and in `balance-status.md`.

## Done

- The test passes; the sweep and the defence year are measured before and after, and the specification needs no change (it already says what the code will do).
