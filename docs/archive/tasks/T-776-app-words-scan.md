# T-776 — Words drawn from `src/app` and the item view's category, past the strings scan

**Closed:** 2026-11-25, in fd1489d0.

**Source:** T-752, found while widening `strings:check` to `src/app` · **Size:** S · **Needs:** — · **Status:** open

## Why

T-752 moved the legend record's own lines into `ui.legend.*` keys and tried the literal scan of `scripts/strings-check.mjs` over `src/app` as well as `src/ui`. It found 51 literals there. Most are not drawn (save-format errors thrown to tests and the console, fold keys like `text|${}`, `SaveLoadError`), but some are, and the scan cannot tell them apart without an allow-list built by reading each:

- `game.ts`: the Continue button's sub-label `` `${fortress} · Year ${year}` ``, and `'Unknown'` as the last dwarf's name when the event carries none (it reaches the legend's cause line).
- `save-manager.ts` / `game-save.ts`: the load errors ("this save needs a newer game version (save format 3, this build reads 2)", "not a Deepholm save: bad magic"), which the Load screen may show to the player; check where they are drawn.
- `main.ts`: "Deepholm failed to start: …" and "Bundled font did not load", shown before the strings table exists.

And in `src/ui`, one the scan's rule does not see: the Look panel's item summary (`itemSummary`, "Furniture · common · 10 ☼") draws the item's top category as its id with `_` as spaces, capitalized, where `ui.item.category.*` has keys for some categories only.

## What to do

- Read each `src/app` literal and decide: drawn ones become keys (`ui.menu.continue_sub`, `ui.legend.unknown_dwarf`, `ui.load.error.*`); the rest are allow-listed in `LITERAL_ALLOWED` with why. A text shown before the strings load (`main.ts`) is allow-listed with that reason.
- Add `src/app` to `LITERAL_DIRS` once the list is clean.
- Word the item summary's category through a key per top category (`ui.item.category.<top>`), falling back to the id.
- **Decided while doing it:** a save's faults are worded by the error the load throws, not by its message. `WordedError` (`save-manager.ts`) carries a strings key and its params; `SaveFormatError`, `SaveVersionError` and `SaveLoadError` are `WordedError`s, and `errorWords` gives the Load screen's and an import's failure line their words (`ui.load.error.not_a_save`, `.newer`, `.damaged`, `.section`, `.missing_content`, `.no_store`). The messages stay in the code's words for the console and the tests, and are allow-listed as such. A storage error from the browser still shows its own message. The Load screen used to show only a failed section's name ("Could not load that save: items"); it now says "the items section of the save is damaged or missing". The last dwarf with no name is "whose name is lost" (`ui.legend.unknown_dwarf`: "The last dwarf, whose name is lost, has died."). `main.ts`'s and `boot`'s failure texts are allow-listed because no strings table exists yet. The headless game's, the screenshot script's and the simulation host's errors are programming faults thrown to their callers, and are allow-listed. The top categories' words are the ids, except `ammo`, which reads "ammunition" ("Ammunition · common · ×20 · 12 ☼").

## Done

- [x] `strings:check` scans `src/app`, and a test plants a drawn literal there and sees it fail.
- [x] A `strings.json` row reaches the Continue sub-label and the item summary's category; a test shows each.
