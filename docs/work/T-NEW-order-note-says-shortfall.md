# T-NEW — Add order's "no bar" note says what is short, not only the item's name

**Source:** playtest 7 ([report](../../reports/data/2026-11-26-playtest-7.md), finding 8) · **Size:** S · **Needs:** — · **Status:** open

## Why

Two Add order notes in the playtest gave the wrong reason for an order that could not start:

- "○ Anvil · no bar: made at a smelter", while Stocks held 13 metal bars: 10 copper, 1 iron and 2 steel (15-stocks-bar-s.png). The anvil takes 5 bars of iron or steel (`forge_anvil`), and the fortress had 3. The note sent me to the smelter as if there were no bars at all. When I added the order anyway, the status row said "Ordered: x1 Anvil. Waiting for bar (12 in stock)." (16-anvil-no-bar.png), which reads as a contradiction.
- "○ Glowstone lamp · no rough gem (from mining)", while four glowstone rough gems bought an hour before stood at the depot, not yet hauled in. The next day it read "waiting for rough gem (0)" because the jeweler had cut or reserved them (T-NEW-glowstone-lamp-path).

`chainNote` and `missingNote` in `ui/panels/orders.ts` render the waiting input by its item type (`waiting.item`) and the source of that type. They drop the material filter, the count and where the existing units are.

## What to do

Decisions taken here:

- The note names the input as the recipe takes it, with the shortfall, when some of it is in stock: "· needs 5 iron or steel bars, 3 in stock: smelt at a smelter". With none in stock it keeps today's wording, with the material: "· no iron or steel bar: made at a smelter".
- When the missing units exist but are not usable, it says why: "· 4 rough glowstone at the depot", "· 4 rough glowstone reserved (Jeweler's workshop #1)", "· rough glowstone out of reach" (the last exists already).
- The Orders list's "waiting for rough gem (0)" uses the same words.

## Done

- [ ] `chainNote`/`missingNote` read the filter's material and count and the units' state; tests for the anvil (short) and the lamp (at the depot, reserved).
- [ ] `panels.md` § Add order updated.
