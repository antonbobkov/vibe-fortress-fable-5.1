# Diagnosis: the hunger and thirst deaths of a fortress with no drink and a distant brook

**Task:** T-398 · **Date:** 2026-10-18 · **Commit examined:** codex-a `92171f3` (master `4febe34` plus T-364) and the same tree with `DRINK_SEARCH_RADIUS` · **Kind:** diagnosis with one rule change (the drink search radius) · **Source:** [the brook measurement](2026-10-18-brook-drinking-under-wildlife.md) § The deaths that are not about water

## The answer

- **The late start from the shelter is not what kills.** A sheltering civilian leaves for water at thirst 85 or 86 and drinks, on a walk of 13 to 30 tiles from the hall (four trips between days 52 and 58 in `wildlife-taiga-4`, three between days 78 and 82 in `wildlife-taiga-1`, each from 86 to a drink). The leaving threshold (10 § Behavior selection step 2) is left as it is.
- **The 34 `starvation` deaths of the `dry-north` opening are three causes.** Classed from the per-dwarf traces by the need that sat at 100 before the death:

| Cause | Seeds | Deaths | The rule |
|---|---|---:|---|
| **The brook freezes in winter.** From day 85 no water tile within reach is liquid (`wildlife-taiga-3`, day 86: 0 liquid, 87 frozen water tiles within 32 tiles of a thirsty dwarf). Thirst reaches 100 within a day and, 3 days (`DEHYDRATE_DAYS`) later, on days 101 to 103, the dwarves die: sheltering (taiga-1, taiga-2) or not (taiga-3). With the usual brew none of these seeds loses anyone. | taiga-1, -2, -3 | 6 + 4 + 13 = 23 | 10 § Drink search, "not frozen"; 04 § Freezing and thawing |
| **The search window is measured from the dwarf.** The drink search looked 32 tiles from the dwarf. A dwarf at the wagon (x 0) with the bank at x 40 found nothing, sat idle with thirst 100 and drank only when a job took it within range. Three died at the wagon on days 51 to 58. | temperate_forest-2 | 3 | 10 § Drink search, "within 32 tiles horizontally" |
| **Hunger, in a shelter that does not end.** The harness held the hearth alert 68,580 ticks (57 days): it lowers the alert only when no aggressive animal is within 40 tiles of the wagon. A sheltering civilian is offered patient care and lever pulls only (11 § Assignment), so nobody farmed, cooked or brewed; no meal, plant food or harvest remained, hunger stood at 100 from day 48, and eight died on days 68 to 72. Thirst was served at 86 every time. The usual opening on this seed never sheltered. | taiga-4 | 8 | 10 § Behavior selection step 2; 11 § Assignment |

## What was run

`reports/data/2026-10-18-no-drink-deaths.probe.ts.txt`: `playWildlifeYear` of the annual instrument's fixture with the `dry-north` opening (the embark's drink destroyed, no still, a brook entering at the north edge), plus an `observe` hook (new, optional, unused by the instrument) called at each 20-tick look. It records for each dwarf, whenever its behaviour, activity, thirst tenth or hunger fifth changes, the tick, alert level, needs, tile and target. Five seeds were traced before the change (taiga-1 to -4, forest-2), all twelve after. `…-freeze-probe.ts.txt` stops the year at the first dwarf with thirst 95 after day 85 and counts liquid and frozen water within 32 tiles and 8 levels. `…-summary.mjs.txt` classes the deaths.

## The change

`DRINK_SEARCH_RADIUS` = 64 tiles replaces the 32 in the drink search (10 § Drink search and its constants table), measured from the dwarf as before. A bank beyond 64 tiles is not searched for; a frozen brook still gives nothing, and 10 now says what that means for a fortress with no drink in the winter. Nothing was changed for the winter and nothing for the shelter; both are decisions of the work file, not omissions.

| `dry-north`, twelve seeds | Before | After |
|---|---|---|
| `temperate_forest-2` living at year end | 2 (3 deaths at the wagon from thirst, 8 to wolves) | 13, no death |
| Sum of the living | 98 | 93 |
| `starvation` deaths | 34 (thirst 26, hunger 8) | 41 (thirst 24, hunger 13, both 4) |

The sum stays within the noise a timeline change makes (five or more on a seed, up to ten on the sum; testing-strategy.md § Annual wildlife survival): the change moved the forest-2 fortress out of its idle thirst, and two seeds, `temperate_forest-1` (sheltered 51,800 ticks, 7 dead of hunger) and `taiga-2` (56,500 ticks, 9 dead, 6 of hunger), then fell into the long shelter that killed taiga-4 before. The shelter is now the largest single cause among the hunger deaths and is filed as its own task. The annual instrument (usual opening, no river) has the same twelve world hashes and the same figures before and after: median 13, sum of the living 143, no extinction, no hunger or thirst death.

## What this does not measure

- A bank more than about 40 tiles from the hall of a sheltering fortress: the dwarves in these traces cover about 0.09 tiles a tick (13 tiles in 140 ticks; balance.md says 0.15), so the 470 ticks from thirst 85 to 100 hold a walk of about 43 tiles. No seed has such a bank.
- Whether a dwarf should be able to drink from ice or melt it; that is a design change, not made.
- The wild animals that kill on the walk (27 deaths in the T-360 measurement); the walk is the player's risk.
