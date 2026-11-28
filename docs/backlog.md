# Backlog

Every open item, and nothing else. A row is added when an item is accepted and deleted in the commit that closes it; git is the history. How to pick up, work and close an item is in [`process/agent-workflow.md`](process/agent-workflow.md).

- **Id.** New items take the next free `T-1nn`. The older ids below (`U-`, `F-`, `C-`, `B-`) keep theirs until they close; nothing new gets one.
- **Source.** The audit, report or plan that produced the item. An item without a source is not accepted.
- **Needs.** Items that must be closed first. "—" means it can start now.
- **Status.** `open`, `in progress (who or which branch)`, or `blocked (why)`.

**Who has what (2026-10-11).** The cloud agent ([`../agents/cloud-agent.md`](../agents/cloud-agent.md)) stopped on 2026-10-11 after closing T-111, T-196, T-144, T-197, T-198, T-199 and T-212; its log is [`../reports/cloud-agent-log.md`](../reports/cloud-agent-log.md). Everything open is the local orchestrator's again.

| Id | Title | Source | Needs | Status |
|---|---|---|---|---|
| T-766 | [Lonely counts once: confirm the sweep's deaths and adopt](work/T-766-lonely-counts-once.md) | [T-763](archive/tasks/T-763-busy-first-week-misery.md) | — | open |
| T-802 | [Peril grows with renown](work/T-802-peril-grows-with-renown.md) | [T-793](archive/tasks/T-793-late-game-idle.md) | — | open |
| T-815 | [Balanced brings an iron spear, and plants instead of the boar meat](work/T-815-balanced-spear-and-food.md) | owner, 2026-11-28 ([decisions](decisions.md)) | — | open |
| T-816 | [The sweep's player answers the builder's whims](work/T-816-sweep-answers-builder-whims.md) | [T-813](archive/tasks/T-813-builder-whims-without-deaths.md) | — | open |
| T-818 | [the peril-0 smelter's open steel jobs lose their iron bar to the forge](work/T-818-peril0-steel-race.md) | [T-817](archive/tasks/T-817-three-years-main-alloy-steel.md) | — | open |
| T-819 | [A merge's sweep is judged by its paired seed-shifts, and master's drift is watched against a fixed reference](work/T-819-sweep-drift-check.md) | [T-814](archive/tasks/T-814-master-drift-t795-t798.md) | — | open |

The latest balance evidence is in [balance-status.md](balance-status.md). Walking speed is ×1.5 since T-140's measurement. Of B-008 to B-012, read against T-145's peril-0 sweep (2026-10-17): B-009, B-011 and B-012 are closed; B-008 (year-1 wealth above the model) is T-380 and B-010 (raid sizes at peril 2) is T-381. Their older measurement journal is in the [decision archive](archive/decisions-archive.md).
