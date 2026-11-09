# T-533 — A pass over the starting loadout's UI and UX

**Source:** the owner, 2026-11-08 · **Size:** M · **Needs:** — · **Status:** open

## Why

The owner: "make a pass on starting loadout UI/UX. Is it easy to use? Does it require a lot of clicking? Is it easy to find specific starting items? Fix any uncovered issues."

## What to do

1. Use the loadout screen as a new player would, with the headless screenshot tool (`npm run screenshot`, tooling.md § Screenshots) and the browser, and write down every friction: number of clicks or keys to set up a typical loadout, how items are found, how quantities and materials are chosen, what the screen does not explain.
2. Fix what you find, plainest first. Likely candidates to check: a search or filter box for items; categories that collapse; quantity steps (+1/+10, type a number); keyboard paths for everything; showing points left and what an item costs; sensible defaults and the existing presets being easy to start from.
3. Report the before and after (screenshots and click counts for a typical loadout) in a short audit.
- Coordinate with T-531 and T-532, which add save/load and a testing mode to the same screen; build on whichever lands first.
- Spec: 02 and the screens doc; e2e for any new path.
