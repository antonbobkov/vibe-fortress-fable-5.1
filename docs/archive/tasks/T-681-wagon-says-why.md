# T-681 — The wagon says why its goods stay

**Closed:** 2026-11-22, in b5051a1e,cb59d62c.

**Source:** T-676 · **Size:** S · **Needs:** — · **Status:** open

## Why

T-676 found the owner's wagon kept its food because a Food stockpile that wants no barrels refused every food (all of it wants a barrel); that is fixed, but goods still stay in the wagon for good reasons the player cannot see: no stockpile accepts them (picks, weapons, barrels of drink and bags of seed with only a Food and a Furniture stockpile placed), or every stockpile that accepts them is full. The wagon's panel and hover line show its contents and nothing about why they wait.

## What to do

On the wagon's panel (and its hover line, 24), count the goods still in it by reason, read from 13's hauling state (`noHome`: no stockpile accepts them, or the accepting ones are full; on their way; waiting for a wanted container): for example "12 goods wait: 8 have no stockpile that takes them, 4 wait for room". Name the categories of the first kind so the player knows which stockpile to place.

## Done

- [x] A UI test: an embark with only a Food stockpile shows the wagon's tools and drink as having no stockpile, and the line goes once an Everything stockpile with room takes them (`test/unit/ui/t681-wagon-says-why.test.ts`: the Balanced embark on the flat world, a Food stockpile placed; the wagon's panel reads `212 goods wait: 212 have no stockpile that takes them (drink, seed, wood, bar, furniture, container, weapon, ammo, tool, textile, medical)` and the hover line over its centre ends `· 212 goods wait: 212 no stockpile`; with an Everything stockpile they are being hauled, and the line goes from both once the wagon is empty). 13's Reader gains `items.haulState(id)` (job, container, wants, no_stockpile, full, none); `src/ui/goods-wait.ts` counts the goods by reason, adding 11's haul jobs (no path, nobody with Hauling on).
