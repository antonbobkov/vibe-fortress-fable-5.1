# T-686 — An abandoned fortress leaves ruins a new embark can find

**Source:** T-672 follow-up · **Size:** L · **Needs:** T-672 · **Status:** open

## Why

T-672 lets a fortress be abandoned and a new one founded on the same world. The ended fortress is remembered only as a line on the world map's region panel ("Ruins of Frostreach: Abandoned in Year 1 by 7 dwarves."), read from the Legends record. Embarking on that site again starts on fresh ground, and nothing the first fortress did (its trade standing with the civilizations, its kills, the Hollow it woke) carries over to the next one on the world. A second fortress finding the first one's halls, stockpiles and graves would be a strong story.

## What to do

Decide how much of an ended fortress the world keeps: at least its dug-out halls and some of its items as ruins on its site's local map, and possibly the civilizations' standing. That needs the world's own record of ended sites (the save's world map, or a world-history store beside the Legends), local map generation that lays the ruins over the site, and a balance check that ruins do not make a re-embark too rich. Spec it in `02-systems/02-embark-and-loadout.md` and `ui-screens/menus-and-world.md` § A new embark on the same world. This changes world generation and the simulation, so the three-year sweep applies.

Also: the end texts read the fortress's cached population, which is 0 before the first tick, so a fortress retired or abandoned on its embark tick says "with 0 dwarves". Count the living dwarves there instead.

## Done

- [x] Tests: an abandoned site's next embark has the old fortress's dug tiles and some of its items; a site with no ended fortress is unchanged (world hashes equal) (`test/unit/embark/t686-site-ruins.test.ts`, which also covers fallen constructions, a second ruin over the first, determinism and the wagon's load leaving with the expedition; `t672-sticky-preset.test.ts` checks the abandoned world carries the ruin).
- [x] Tests: a fortress retired on its embark tick names its seven dwarves (same file): the end texts and peak population count the living dwarves through 10's reader.
- [x] Spec: 02 § Ruins (the record, what it keeps, the balance, and why the civilizations' standing does not carry over), 02 § Local map specification and § Arrival, 03 § Local map generation stage 10b, 01 § State (`WorldMap.ruins`), `schemas/system-state.md`, `save-format.md` § Optional fields, 24 § The legend record and § Game menu, `ui-screens/menus-and-world.md` § A new embark on the same world.
- [x] The record lives in the world map (saved with the next fortress), not the Legends: the changed tiles packed (about 5 bytes a tile) and at most `RUIN_ITEMS_MAX` items; telling it regenerates the site once (about 0.5 s) when the fortress ends. Fresh embarks draw nothing new, so the three-year sweep is unaffected.
- Follow-up: `T-NEW-ruins-stand-and-show.md` (furniture standing as buildings, a ruin mark on the world map).
