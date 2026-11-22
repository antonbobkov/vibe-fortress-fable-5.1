# T-672 — The embark preset is remembered, and a fortress can be abandoned for a new embark on the same world

**Closed:** 2026-11-21, in 9de25819.

**Source:** the owner's feedback of 2026-11-21 · **Size:** M · **Needs:** — · **Status:** open

## Why

Each new embark falls back to the default preset, so a player who plays the Testing preset picks it again every time. And when a fortress is lost or no longer fun, there may be no way to abandon it and embark again on the same world (check first).

## What to do

Remember the last embark preset (and other embark choices worth remembering) in the settings store and preselect it on the next embark. Check whether abandoning a fortress and re-embarking on the same world exists; if not, add it from the game menu (confirm, end the fortress, return to embark site choice on the same world, keep the world's history). Spec the flow in the UI docs.

## Done

- [x] Tests: the preset survives a reload; abandon then re-embark keeps the world seed and offers the site choice (`test/unit/ui/t672-sticky-preset.test.ts`).
- [x] Abandon did not exist (only Retire, which ended at the main menu). Added `Abandon fortress` (`[a]`, `c_abandon`) to the game menu; a retired or fallen fortress's legend offers `[Enter] New embark on this world`; the world map names past fortresses as ruins from the Legends.
- [x] Spec: `ui-screens/menus-and-world.md` § A new embark on the same world, 24 § Game menu, `embark.md` § Presets menu, 02 § Presets.
