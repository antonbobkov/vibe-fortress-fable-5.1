# T-790 — Add order's "no bar" note says what is short, not only the item's name

**Source:** playtest 7 ([report](../../reports/data/2026-11-26-playtest-7.md), finding 8) · **Size:** S · **Needs:** — · **Status:** open

## Why

Two Add order notes in the playtest gave the wrong reason for an order that could not start:

- "○ Anvil · no bar: made at a smelter", while Stocks held 13 metal bars: 10 copper, 1 iron and 2 steel (15-stocks-bar-s.png). The anvil takes 5 bars of iron or steel (`forge_anvil`), and the fortress had 3. The note sent me to the smelter as if there were no bars at all. When I added the order anyway, the status row said "Ordered: x1 Anvil. Waiting for bar (12 in stock)." (16-anvil-no-bar.png), which reads as a contradiction.
- "○ Glowstone lamp · no rough gem (from mining)", while four glowstone rough gems bought an hour before stood at the depot, not yet hauled in. The next day it read "waiting for rough gem (0)" because the jeweler had cut or reserved them (T-791-glowstone-lamp-path).

`chainNote` and `missingNote` in `ui/panels/orders.ts` render the waiting input by its item type (`waiting.item`) and the source of that type. They drop the material filter, the count and where the existing units are.

## What to do

Decisions taken here:

- The note names the input as the recipe takes it, with the shortfall, when some of it is in stock: "· needs 5 iron or steel bars, 3 in stock: smelt at a smelter". With none in stock it keeps today's wording, with the material: "· no iron or steel bar: made at a smelter".
- When the missing units exist but are not usable, it says why: "· 4 rough glowstone at the depot", "· 4 rough glowstone reserved (Jeweler's workshop #1)", "· rough glowstone out of reach" (the last exists already).
- The Orders list's "waiting for rough gem (0)" uses the same words.

Decided while doing it:

- The input's name comes from 12's input filter (`recipeInputFilter`, the order's material filter only on the input the first output takes its material from): one material reads as the lists name an item ("glowstone rough gem"), several as "iron or steel bar". The step back after the colon is today's (made at a smelter, render fat at a kitchen, from mining); "smelt at a smelter" in the example is the existing "made at a smelter".
- Units held come before the shortfall: at the depot (the fortress's own: `AtDepot` less `Merchant`) first, then reserved, naming the building of the job that holds the first reserved unit; such a note names no maker. Out of reach keeps its existing note.
- When the stock holds a craft's worth and the workshop still waits (same material for every unit, distinct items), the old words stay.
- The status after adding an order says "Waiting: <the note's words>." when some is in stock or held, and "Waiting for iron or steel bar (0 in stock)." when none is; an Orders row likewise ("×1 Anvil · needs 5 iron or steel bars, 3 in stock", or "waiting for iron or steel bar (0)").
- The work file's "4 rough glowstone" reads "4 glowstone rough gems": the item lists' name for a rough gem of glowstone.

## Done

- [x] `chainNote`/`missingNote` read the filter's material and count and the units' state; tests for the anvil (short) and the lamp (at the depot, reserved).
- [x] `panels.md` § Add order updated.
