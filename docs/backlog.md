# Backlog

Every open item, and nothing else. A row is added when an item is accepted and deleted in the commit that closes it; git is the history. How to pick up, work and close an item is in [`process/agent-workflow.md`](process/agent-workflow.md).

- **Id.** New items take the next free `T-1nn`. The older ids below (`U-`, `F-`, `C-`, `B-`) keep theirs until they close; nothing new gets one.
- **Source.** The audit, report or plan that produced the item. An item without a source is not accepted.
- **Needs.** Items that must be closed first. "—" means it can start now.
- **Status.** `open`, `in progress (who or which branch)`, or `blocked (why)`.

**Who has what (2026-10-11).** The cloud agent ([`../agents/cloud-agent.md`](../agents/cloud-agent.md)) stopped on 2026-10-11 after closing T-111, T-196, T-144, T-197, T-198, T-199 and T-212; its log is [`../reports/cloud-agent-log.md`](../reports/cloud-agent-log.md). Everything open is the local orchestrator's again.

| Id | Title | Source | Needs | Status |
|---|---|---|---|---|
| T-544 | [A well-armed squad handles wolves and bears](work/T-544-bear-mauls-unanswered.md) | T-543's runs; the owner, 2026-11-13 | — | open |
| T-546 | [Making Do: the low-level design, written into the spec](work/T-546-making-do-low-level-design.md) | Making Do design; the owner, 2026-11-13 | — | open |
| T-547 | [Making Do A1: new materials, minerals and butchering products](work/T-547-making-do-materials-and-minerals.md) | Making Do design; the owner, 2026-11-13 | T-546 | blocked (needs T-546) |
| T-548 | [Making Do A2: new plants, wild and farmed](work/T-548-making-do-plants.md) | Making Do design; the owner, 2026-11-13 | T-546 | blocked (needs T-546) |
| T-549 | [Making Do A3: substitute recipes, wicker, scale armour and bows](work/T-549-making-do-substitute-recipes.md) | Making Do design; the owner, 2026-11-13 | T-546, T-547 | blocked (needs T-546, T-547) |
| T-550 | [Making Do A4: sundries, the scarcity price and the site summary](work/T-550-making-do-sundries-and-site-summary.md) | Making Do design; the owner, 2026-11-13 | T-546, T-547 | blocked (needs T-546, T-547) |
| T-551 | [Making Do B1: beds that rest differently, bedding and pillows](work/T-551-making-do-beds.md) | Making Do design; the owner, 2026-11-13 | T-546, T-547, T-548 | blocked (needs T-546, T-547, T-548) |
| T-552 | [Making Do B2: the drying rack, smoky fuel, curing and the smokehouse](work/T-552-making-do-drying-curing-and-smoke.md) | Making Do design; the owner, 2026-11-13 | T-546, T-547 | blocked (needs T-546, T-547) |
| T-553 | [Making Do B3: the kiln, pottery, glass, candles and lanterns](work/T-553-making-do-kiln-glass-and-light.md) | Making Do design; the owner, 2026-11-13 | T-546, T-547 | blocked (needs T-546, T-547) |
| T-554 | [Making Do B4: the cellar, aging and spirits](work/T-554-making-do-cellar-and-spirits.md) | Making Do design; the owner, 2026-11-13 | T-546, T-553 | blocked (needs T-546, T-553) |
| T-555 | [Making Do B5: fertilizer, compost, hives, honey and soap](work/T-555-making-do-farm-hive-and-medicine.md) | Making Do design; the owner, 2026-11-13 | T-546, T-547, T-548, T-552 | blocked (needs T-546, T-547, T-548, T-552) |
| T-556 | [Making Do B6: the spider ranch, the beetle jar and bat roosts](work/T-556-making-do-cages-and-roosts.md) | Making Do design; the owner, 2026-11-13 | T-546 | blocked (needs T-546) |
| T-557 | [Making Do C1: boneyards and fossils](work/T-557-making-do-boneyards.md) | Making Do design; the owner, 2026-11-13 | T-546, T-547, T-553 | blocked (needs T-546, T-547, T-553) |
| T-558 | [Making Do C2: glass walls, skylights, glass floors and greenhouses](work/T-558-making-do-glass-and-skylights.md) | Making Do design; the owner, 2026-11-13 | T-546, T-553 | blocked (needs T-546, T-553) |
| T-559 | [Making Do C3: ice harvesting, ice walls and fire on purpose](work/T-559-making-do-ice-and-fire.md) | Making Do design; the owner, 2026-11-13 | T-546 | blocked (needs T-546) |
| T-560 | [Making Do C4: the Starfall region trait and star steel](work/T-560-making-do-starfall.md) | Making Do design; the owner, 2026-11-13 | T-546, T-547, T-548 | blocked (needs T-546, T-547, T-548) |
| T-561 | [Making Do C5: reindeer, camels, feasts, the Thane's whims and mugs](work/T-561-making-do-animals-and-hall-life.md) | Making Do design; the owner, 2026-11-13 | T-546, T-548, T-553 | blocked (needs T-546, T-548, T-553) |

The latest balance evidence is in [balance-status.md](balance-status.md). Walking speed is ×1.5 since T-140's measurement. Of B-008 to B-012, read against T-145's peril-0 sweep (2026-10-17): B-009, B-011 and B-012 are closed; B-008 (year-1 wealth above the model) is T-380 and B-010 (raid sizes at peril 2) is T-381. Their older measurement journal is in the [decision archive](archive/decisions-archive.md).
