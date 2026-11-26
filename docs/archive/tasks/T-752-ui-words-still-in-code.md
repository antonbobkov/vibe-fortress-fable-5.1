# T-752 — UI words still written in code: quality words, aged names, tag items, the legend's own lines

**Closed:** 2026-11-25, in 57f54af8,78950ee0,b27b2c60,83cf17be,a5cbad28,ad7ef300,67a6870b.

**Source:** T-744, found while threading the game's strings through the UI · **Size:** S · **Needs:** — · **Status:** open

## Why

T-744 made every text of `src` that was drawn through a default-only `new Strings()` take the game's strings, and taught `strings:check` to fail on one. Some words still come from code, past the `strings.json` rows, where the scan does not look:

- **Quality words.** `panels/look.ts` and `panels/gear.ts` each keep `QUALITY_WORDS = ['poor', 'common', …]`, a copy of the `ui.item.quality.*` rows that the Stocks panel already reads. One-word literals in an array pass the scan's `drawnWord` rule, which looks at where a literal stands, not at an array that is later drawn.
- **Aged names in the creature and item views.** `look.ts`'s `itemName` calls `agedMaterial(null, …)`, so "aged" and "vintage" come from `ageWord`'s English fallback and not from `ui.item.aged` / `ui.item.vintage` (the item fields now pass the strings).
- **A match id with no item row.** `messages.ts`'s `itemName` words an id that is not an item (a recipe's tag match, `plant_food`) as the id with `_` read as spaces; `filterText` draws a `materialClass` filter as its id. T-744 gave the category and tag filters `ui.item.category.*` and `ui.item.tag.*`; the match names and material classes have no keys.
- **The legend record's own lines.** `app/legend.ts` writes `endText`'s retired and abandoned causes ("Retired in Year 2 with 7 dwarves.") and the notable kills ("Orm slew 14 enemies.") in code. `src/app` is outside `LITERAL_DIRS`, so the scan does not see them.

## What to do

- Read the quality words from `ui.item.quality.<n>` in both panels and drop the arrays.
- Pass the strings to `look.ts`'s `itemName` and to `agedMaterial` there; make `ageWord`'s strings argument required.
- Give a tag match and a material class a key (`ui.item.tag.*`, `ui.item.material_class.*`), falling back to the id.
- Move the legend's cause and kill lines to `ui.legend.*` keys, keeping the words, and decide whether `strings:check` scans `src/app` (allow-listing what is not drawn).

## Done

- [x] A `strings.json` row reaches each of those words; a test shows one per file (`test/unit/ui/t752-ui-words-in-code.test.ts`: the Look panel's quality, aged and flag words, the gear name's quality, a tag match and a material class, the legend's cause and kill lines). `qualityWord` and `materialClassWord` of `messages.ts` read `ui.item.quality.<n>` and `ui.item.material_class.<class>`; `itemName` takes the strings and words a non-item match by `tagWord`; `ageWord` and `agedMaterial` take the strings, required. The Look panel's item flags (`forbidden`, `dump`, …), an array of drawn words like the quality words, read `ui.look.item.flag.*` too, and the legend's fallback region and biome names (`ui.legend.region_unnamed`, `ui.legend.biome_unknown`).
- [x] The panels' and screens' existing tests pass unchanged (four call forms gained the strings argument: `itemName`, `lastBroughtText`, `requestText` in t618, t623, t640, t644). UI only: no world hash moves.
- [x] `src/app` is not scanned yet: the scan finds 51 literals there, most of them save-format errors and fold keys that are not drawn, some drawn (the Continue sub-label, the load errors). Sorting them is its own task (`T-776-app-words-scan.md`), with the Look item summary's category word.
