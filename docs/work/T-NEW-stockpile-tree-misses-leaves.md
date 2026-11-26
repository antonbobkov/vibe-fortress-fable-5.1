# T-NEW — The stockpile editor's tree lacks nine of 13's leaves, so a player cannot pick them alone

**Source:** T-774 (playtest 2026-11-25 (military) ([report](../../reports/data/2026-11-25-playtest-6.md), finding 7), checked while T-774 was done) · **Size:** S · **Needs:** — · **Status:** open

## Why

T-774 checked 13's category tree against the categories items use. Every item type's category is now a node of the spec's tree (13 § Category tree, which T-774 completed with `furniture/archery_target`, `furniture/chain` and `tool/quiver`). But the code's `CATEGORY_TREE` (`src/systems/items/stockpiles.ts`) does not have all of the spec's leaves: `furniture/stone_bed`, `furniture/bedding`, `furniture/pillow`, `furniture/lantern`, `furniture/archery_target`, `furniture/chain`, `tool/candle`, `tool/firebrand` and `tool/quiver` are missing. The stockpile editor builds its tree from `CATEGORY_TREE` alone (`src/ui/panels/stockpile-editor.ts`), so a player can take `furniture` or `tool` as a whole but cannot pick, say, lanterns or candles alone. `categoryNodes()` accepts them in a command, and Stocks shows them, because both add every prefix of an item type's path.

## What to do

- Add the missing leaves to `CATEGORY_TREE`, in the spec's order.
- A test: every category in `items.json` is a node of `CATEGORY_TREE`, so the code and the spec's tree cannot drift apart again.
- Check that no preset changes what it takes (presets name top nodes or explicit leaves).

Spec: 13 § Category tree (unchanged), `ui-screens/panels.md` § Zones (unchanged).

## Done

- [ ] `CATEGORY_TREE` has every leaf of 13's tree; the test above passes.
