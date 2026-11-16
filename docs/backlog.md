# Backlog

Every open item, and nothing else. A row is added when an item is accepted and deleted in the commit that closes it; git is the history. How to pick up, work and close an item is in [`process/agent-workflow.md`](process/agent-workflow.md).

- **Id.** New items take the next free `T-1nn`. The older ids below (`U-`, `F-`, `C-`, `B-`) keep theirs until they close; nothing new gets one.
- **Source.** The audit, report or plan that produced the item. An item without a source is not accepted.
- **Needs.** Items that must be closed first. "—" means it can start now.
- **Status.** `open`, `in progress (who or which branch)`, or `blocked (why)`.

**Who has what (2026-10-11).** The cloud agent ([`../agents/cloud-agent.md`](../agents/cloud-agent.md)) stopped on 2026-10-11 after closing T-111, T-196, T-144, T-197, T-198, T-199 and T-212; its log is [`../reports/cloud-agent-log.md`](../reports/cloud-agent-log.md). Everything open is the local orchestrator's again.

| Id | Title | Source | Needs | Status |
|---|---|---|---|---|
| T-555 | [Making Do B5: hives, honey, beeswax and mead](work/T-555-making-do-farm-hive-and-medicine.md) | Making Do design; the owner, 2026-11-13 | — | open |
| T-556 | [Making Do B6: the spider ranch, the beetle jar and bat roosts](work/T-556-making-do-cages-and-roosts.md) | Making Do design; the owner, 2026-11-13 | — | open |
| T-557 | [Making Do C1: boneyards and the bone recipes](work/T-557-making-do-boneyards.md) | Making Do design; the owner, 2026-11-13 | — | open |
| T-558 | [Making Do C2: glass walls, skylights and greenhouses](work/T-558-making-do-glass-and-skylights.md) | Making Do design; the owner, 2026-11-13 | — | open |
| T-559 | [Making Do C3: ice harvesting, ice walls and fire on purpose](work/T-559-making-do-ice-and-fire.md) | Making Do design; the owner, 2026-11-13 | — | open |
| T-561 | [Making Do C5: reindeer and camels](work/T-561-making-do-animals-and-hall-life.md) | Making Do design; the owner, 2026-11-13 | — | open |
| T-562 | [Making Do A3b: scale armour, horn bows and fletching](work/T-562-making-do-scale-armour-and-bows.md) | T-546's re-cut of Making Do | — | open |
| T-563 | [Making Do B3b: candles, candle stands, lanterns and what light does](work/T-563-making-do-candles-and-lanterns.md) | T-546's re-cut of Making Do | — | open |
| T-564 | [Making Do B5b: the compost heap, fertilizer and soap](work/T-564-making-do-compost-fertilizer-soap.md) | T-546's re-cut of Making Do | — | open |
| T-565 | [Making Do C6: feasts, the Thane's whims and mugs at the table](work/T-565-making-do-hall-life.md) | T-546's re-cut of Making Do | T-555, T-557, T-563 | blocked (needs T-555, T-557, T-563) |
| T-566 | [Making Do: salt crusts, after T-547's salt](work/T-566-making-do-salt-crust.md) | T-548's runs | — | open |
| T-568 | [Seven pallets from one stack of cloth are laid one after another](work/T-568-pallets-from-one-stack.md) | T-551's runs | — | open |
| T-569 | [A −1 thought that decays by halflife is gone at the next hour](work/T-569-minus-one-halflife-thoughts.md) | T-552's runs | — | open |
| T-570 | [The fixtures' routine work waits behind the food step](work/T-570-fixture-routine-work-waits.md) | T-567's runs | — | open |
| T-572 | [Beds: a narrow rest band, mood by bed, and a wooden bed that needs bedding stuff](work/T-572-beds-narrow-rest-band.md) | the owner, 2026-11-15 | — | open |

The latest balance evidence is in [balance-status.md](balance-status.md). Walking speed is ×1.5 since T-140's measurement. Of B-008 to B-012, read against T-145's peril-0 sweep (2026-10-17): B-009, B-011 and B-012 are closed; B-008 (year-1 wealth above the model) is T-380 and B-010 (raid sizes at peril 2) is T-381. Their older measurement journal is in the [decision archive](archive/decisions-archive.md).
