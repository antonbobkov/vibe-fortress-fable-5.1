# Backlog

Every open item, and nothing else. A row is added when an item is accepted and deleted in the commit that closes it; git is the history. How to pick up, work and close an item is in [`process/agent-workflow.md`](process/agent-workflow.md).

- **Id.** New items take the next free `T-1nn`. The older ids below (`U-`, `F-`, `C-`, `B-`) keep theirs until they close; nothing new gets one.
- **Source.** The audit, report or plan that produced the item. An item without a source is not accepted.
- **Needs.** Items that must be closed first. "—" means it can start now.
- **Status.** `open`, `in progress (who or which branch)`, or `blocked (why)`.

**Who has what (2026-10-11).** The cloud agent ([`../agents/cloud-agent.md`](../agents/cloud-agent.md)) stopped on 2026-10-11 after closing T-111, T-196, T-144, T-197, T-198, T-199 and T-212; its log is [`../reports/cloud-agent-log.md`](../reports/cloud-agent-log.md). Everything open is the local orchestrator's again.

| Id | Title | Source | Needs | Status |
|---|---|---|---|---|
| T-576 | [The three-year script sees an ambush before it springs](work/T-576-script-sees-hidden-ambush.md) | T-575's runs | — | open |
| T-582 | [The three-year fixture buries its dead](work/T-582-fixture-buries-its-dead.md) | [T-581](archive/tasks/T-581-defence-population.md) | T-580 | blocked (needs T-580) |
| T-584 | [Caravans bring the sand, clay and brightleaf they list](work/T-584-caravans-bring-worthless-goods.md) | [T-583](archive/tasks/T-583-making-do-reach.md) | — | open |
| T-585 | [A keep order of glass blocks counts glass](work/T-585-keep-order-fixed-material.md) | [T-583](archive/tasks/T-583-making-do-reach.md) | — | open |
| T-586 | [An ice designation survives the afternoon thaw](work/T-586-ice-designation-daily-thaw.md) | [T-583](archive/tasks/T-583-making-do-reach.md) | — | open |
| T-587 | [A site one soil level deep yields no sand, clay or peat](work/T-587-shallow-soil-loads.md) | [T-583](archive/tasks/T-583-making-do-reach.md) | — | open |
| T-588 | [The long fixtures play some of Making Do](work/T-588-fixture-makes-do.md) | [T-583](archive/tasks/T-583-making-do-reach.md) | T-580, T-582 | blocked (needs T-580, T-582) |
| T-590 | [A level shows nothing above it](work/T-590-no-view-above.md) | the owner's playtest | — | open |
| T-591 | [An always-on hover line, with water depth](work/T-591-hover-line.md) | the owner's playtest | — | open |
| T-592 | [A selection box shows over unexplored rock](work/T-592-selection-shows-underground.md) | the owner's playtest | — | open |

The latest balance evidence is in [balance-status.md](balance-status.md). Walking speed is ×1.5 since T-140's measurement. Of B-008 to B-012, read against T-145's peril-0 sweep (2026-10-17): B-009, B-011 and B-012 are closed; B-008 (year-1 wealth above the model) is T-380 and B-010 (raid sizes at peril 2) is T-381. Their older measurement journal is in the [decision archive](archive/decisions-archive.md).
