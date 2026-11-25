# T-699 — A starving fortress is told nothing about the food at hand

**Closed:** 2026-11-24, in d112318b,7351b3cd.

**Source:** playtest 2026-11-24 ([report](../../../reports/data/2026-11-24-playtest.md), finding 1) · **Size:** M · **Needs:** — · **Status:** open

## Why

A new player's Farmstead fortress (world seed `deep-522-1`, region 42,30 "Ashford", a temperate forest with a lake, the second embark on that site) did what the hints asked: a stockpile, a dug hall, a farm plot (one tile took), chopping. The wagon's food was gone by the end of spring. `hint_food` ("Food is running low…") came on Spring 26, with `HINT_FOOD_DAYS` = 2 days of food left; from Summer 3 the log said "N dwarves are starving" once a day, and by Summer 18 all nine dwarves had been starving for two weeks, seven of them idle, torsos wasting (`reports/data/2026-11-24-playtest/61-summer18.png`, `62-starving-dwarf.png`). Stocks held no food at all (`59-stocks.png`).

All that time there was food at hand that the player was never pointed to: 2 cows, 2 goats, 2 sheep and 4 chickens to slaughter, a lake to fish, bramble and nutbush to gather, and from Summer 10 a Hillfolk caravan waiting at the edge for a depot. The only advice the game gave was the once-only `hint_food`, two days before the stores ran out, and it names farm plots (weeks away) and a kitchen (needs stone). The daily starving line names who starves, never what to do.

Reproduce: generate `deep-522-1`, embark Farmstead on region (42,30), make a small farm and run 50 days with the hook's `step`.

## What to do

Decisions:

- **The first `Starving` of a fortress gives a hint**, `hint_starving`, after the day's starving line, that names what is at hand now, in this order and only what exists: tame animals that can be slaughtered ("2 cows, 2 goats, 2 sheep: [n] then [S-s] slaughter"), fishable water with no fishing zone ("a lake to fish: [z] Fishing"), ripe gatherable plants ("40 ripe shrubs: [d] Gather"), a caravan at the edge or the depot that sells food ("the Hillfolk sell food: build a depot"). With none of them: "Nothing to eat is at hand: dig for a cavern or trade." Counts are the live ones; the keys follow the bindings as every hint does.
- **`HINT_FOOD_DAYS` goes from 2 to 5** (*unmeasured*): fishing, gathering and slaughter need a day or two to set up and a farm three weeks, so two days' warning leaves only the slaughter.
- Not taken: dwarves feeding themselves (gathering or fishing unasked) when starving: a rule change to 10 and 09 with balance effects, out of this task's scope; it could be a follow-up if the hint is not enough.

Spec: `ui-keymap-and-screens.md` § Hints (new row `hint_starving`, `hint_food`'s days), 24 § Tuning constants (`HINT_FOOD_DAYS`), 24 § Announcements and the log (starving).

## Done

- [x] Tests: a starving fortress with tame grazers and a lake gets `hint_starving` naming both, once; one with nothing at hand gets the "nothing to eat" text; `hint_food` fires at five days of food (`test/unit/ui/t699-starving-hint.test.ts`, which also covers the shrubs clause, thirst alone, the hint after the day's starving line in a running game, and a starving dwarf that gathers and eats once the shrubs are designated).
- [x] UI only: no world hash moves (`world-hashes.test.ts` unchanged). The fishing clause reads a new pure 09 reader, `foraging.fishableWater()`, a fresh flood fill that leaves the saved water bodies alone (the UI's map reader cannot see fluid types or sources).
- [x] Why seven starving dwarves were idle: not a bug and not a labour setting. Every labour is on by default (`labors.json`), and a dwarf at a critical hunger with no food to reach falls through to work (10 § Behavior selection); there was simply no work. Gathering needs a gather designation or zone, fishing a fishing zone, slaughter a mark and a butcher's shop, all player orders; hunting needs a crossbow or bow. Once shrubs are designated a starving dwarf gathers and eats (the test above). Written into 10 § Eating and drinking. Dwarves feeding themselves unasked stays out of scope, as decided above.
