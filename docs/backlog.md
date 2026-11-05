# Backlog

Every open item, and nothing else. A row is added when an item is accepted and deleted in the commit that closes it; git is the history. How to pick up, work and close an item is in [`process/agent-workflow.md`](process/agent-workflow.md).

- **Id.** New items take the next free `T-1nn`. The older ids below (`U-`, `F-`, `C-`, `B-`) keep theirs until they close; nothing new gets one.
- **Source.** The audit, report or plan that produced the item. An item without a source is not accepted.
- **Needs.** Items that must be closed first. "—" means it can start now.
- **Status.** `open`, `in progress (who or which branch)`, or `blocked (why)`.

**Who has what (2026-10-11).** The cloud agent ([`../agents/cloud-agent.md`](../agents/cloud-agent.md)) stopped on 2026-10-11 after closing T-111, T-196, T-144, T-197, T-198, T-199 and T-212; its log is [`../reports/cloud-agent-log.md`](../reports/cloud-agent-log.md). Everything open is the local orchestrator's again.

| Id | Title | Source | Needs | Status |
|---|---|---|---|---|
| T-453 | [A river that ends in a far lake can lie beyond the drink search from the wagon](work/T-453-lake-beyond-the-drink-search.md) | T-449's measurements | — | open |
| T-456 | [The `three_years` scenario does not yet play on relief](work/T-456-three-years-main-on-relief.md) | T-451's sweep | — | open |
| T-466 | [The hand-laid defence of `defence_year` does not repel a raid](work/T-466-defence-never-repels-a-raid.md) | T-462's defence_year seeds | T-483 | blocked (needs T-483) |
| T-477 | [Runecraft 10: the whole loop played, and the docs that tell it](work/T-477-runecraft-whole-loop-scenario.md) | Runecraft design | T-483, T-491 to T-495 | blocked (needs T-483, T-491 to T-495) |
| T-482 | [Idle tame animals keep a walk that has arrived, and crowd one hall tile](work/T-482-tame-animal-stale-walk.md) | T-463's follow-up | — | open |
| T-483 | [Marksdwarves shoot their own squad](work/T-483-marksdwarf-friendly-fire.md) | T-470's arena | — | open |
| T-486 | [A peril-4 ambush can kill a whole fortress over five days](work/T-486-ambush-massacre.md) | T-479's sweep | — | open |
| T-488 | [three-years-p2-7 ends without its dining hall](work/T-488-p2-7-dining-hall-witness.md) | T-479's sweep | — | open |
| T-489 | [Why three-years-p4-4's plant job cannot walk its seed to the plot](work/T-489-p4-4-seed-delivery-walk-fails.md) | T-487's journal | — | open |
| T-490 | [11 still describes the crowded-doorway retry that crowding removed](work/T-490-stale-crowded-walk-rule.md) | T-487's journal | — | open |
| T-492 | [Remains and venom: venomed blades, the ember gland, knapped blades](work/T-492-remains-venom-and-knapped-blades.md) | Flavour report | — | open |
| T-493 | [Hexers cast Dread on dwarves, and `calm` armour answers it](work/T-493-hexer-dread-and-calm-armour.md) | Flavour report | T-483 | blocked (needs T-483) |
| T-495 | [A dead runecaster's wand among an old battlefield's arms](work/T-495-wand-on-an-old-battlefield.md) | Flavour report | — | open |
| T-496 | [A drunk vial is capped below a circlet's rune](work/T-496-vial-cap-ignores-circlet.md) | T-491's work | — | open |
| T-497 | [A turned shade that stays hidden for a while](work/T-497-turned-shade-hides-longer.md) | T-491's work | — | open |

The latest balance evidence is in [balance-status.md](balance-status.md). Walking speed is ×1.5 since T-140's measurement. Of B-008 to B-012, read against T-145's peril-0 sweep (2026-10-17): B-009, B-011 and B-012 are closed; B-008 (year-1 wealth above the model) is T-380 and B-010 (raid sizes at peril 2) is T-381. Their older measurement journal is in the [decision archive](archive/decisions-archive.md).
