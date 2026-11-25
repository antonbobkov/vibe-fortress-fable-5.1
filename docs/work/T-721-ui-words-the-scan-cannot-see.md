# T-721 — Single words and readers' English the strings scan cannot see

**Source:** T-711, found while widening `strings:check` to all of `src/ui` · **Size:** S · **Needs:** — · **Status:** open

## Why

`strings:check` (`looksPlayerFacing` of `scripts/strings-check.mjs`) reads a lowercase word without a space as an id, so a drawn single word passes it. At the T-711 merge the UI still draws some of them from code:

- `src/ui/messages.ts`: `filterText`'s `food`, `drink`; `workshopList`'s articles `a` / `an`; the `animal` fallback of `announcements.ts`'s starving line (`ui.creature.the_species`).
- 18's reader words a warned party's size in English (`sizeBandOf`: `a few`, `a band`, `a horde`), which `raid-lines.ts` compares to choose a key (allow-listed there); the reader could give a band id (`few`, `band`, `horde`) instead, as `schedulePreview` now gives data.
- The list helpers of `messages.ts` (`matchName`, `alternativesName`, `filterText`, `whereMade`, `whimWhereMade`) take the strings as an optional last argument and fall back to the default table; `look.ts` (`filterText`), `build.ts`'s `inputText` and `gear.ts`'s `whereWeaponMade` call them without it, so a `strings.json` row of `ui.list.*` does not reach those lines.

## What to do

- Move the drawn single words to keys (`ui.item.food`, `ui.item.drink`, the article rule as a key or a helper over the strings).
- Give `ThreatsReader.coming()`'s `sizeBand` as an id, and update 18 § Interfaces and `raid-lines.ts`.
- Pass the strings to the list helpers at every call site and make the argument required.

## Done

- [ ] No drawn word of `src/ui` is written in code; a test plants a drawn single word and the scan (or a narrower rule) finds it.
- [ ] The panels' and screens' existing tests pass unchanged. UI only: no world hash moves.
