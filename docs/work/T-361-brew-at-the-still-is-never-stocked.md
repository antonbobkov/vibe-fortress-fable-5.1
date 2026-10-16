# T-361 — Brew left at the still is never stocked, and dwarves drink water beside it

**Source:** T-145's run 3 ([journal](../../reports/data/2026-10-16-t145-run3.jsonl)) · **Size:** M · **Needs:** T-350 · **Status:** open

## What was found

In the three-year fortress (seed `three-years`, at `290f923`) the drink in stock sat at 598 to 631 units from day 154 to day 224, all of it in barrels that stood off any stockpile. From day 161 the drink stockpiles held none (`stocked` 78 on day 161, 0 from day 168), and the dwarves drank water: from day 168 to day 196 every drink was water (17 to 25 a week), beside 620 units of brew. The run's 2,585 water drinks in three years against 2,758 of alcohol ([run 2](../../reports/data/2026-10-16-t145-run2.txt)) come from this.

The rules as written make it a lock:

- 12 § Operation: a brew takes an empty barrel wherever it is, including one that a drink stockpile wanted and stocked, and the drink is made into it at the still.
- 13 § Stockpiles: a drink goes onto a stockpile only into a barrel of that stockpile with room; the full barrel is not hauled as a whole, since a stockpile's filter takes the drink, not the barrel.
- 10 § Needs, drink search: stocked alcohol first, then a well, then water, and loose alcohol last; brew in a barrel off a stockpile is loose.

So the stills empty the drink stockpiles of their barrels, the brew stays at the still, a stockpile asks for an empty barrel only while one is free, and the fortress's barrels are full of brew that nobody drinks while the brook is in reach. Nothing in the player's tools says why: the stocks panel shows 600 drinks.

## Decision

To be made before the work starts (orchestrator). The options seen: (a) a full barrel of drink is hauled whole to a drink stockpile that accepts its drink and has a free tile, as a container with its contents (13); (b) a brew never takes a barrel that stands on a stockpile wanting barrels (12); (c) 10 ranks brew in a barrel at the still before water. (a) matches what a player expects and the containers spec's "a container is hauled with its contents".

## Done

- With drink stockpiles that want barrels and a still brewing, the brew reaches the stockpiles and dwarves drink it before water; a scenario on a generated map with a brook shows it; the spec sections changed say so.
