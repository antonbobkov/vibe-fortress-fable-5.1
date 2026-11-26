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
| T-788 | [The hospital panel says what 80 dwarves need, before the wounded come](work/T-788-hospital-at-scale.md) | playtest 2026-11-26 ([report](../reports/data/2026-11-26-playtest-7.md)) | — | open |
| T-789 | [A tomb keeps its own coffins ready, so burial is one setting, not a chore per death](work/T-789-tomb-keeps-coffins.md) | playtest 2026-11-26 ([report](../reports/data/2026-11-26-playtest-7.md)) | — | open |
| T-790 | [Add order's "no bar" note says what is short, not only the item's name](work/T-790-order-note-says-shortfall.md) | playtest 2026-11-26 ([report](../reports/data/2026-11-26-playtest-7.md)) | — | open |
| T-793 | [Decide what a settled fortress of 80 does with its idle half](work/T-793-late-game-idle.md) | playtest 2026-11-26 ([report](../reports/data/2026-11-26-playtest-7.md)) | — | open |
| T-794 | [The Units list and a dwarf's view say when a dwarf is shut in](work/T-794-shut-in-dwarf-in-units.md) | [T-784](archive/tasks/T-784-trapped-dwarf-says-so.md) | — | open |

The latest balance evidence is in [balance-status.md](balance-status.md). Walking speed is ×1.5 since T-140's measurement. Of B-008 to B-012, read against T-145's peril-0 sweep (2026-10-17): B-009, B-011 and B-012 are closed; B-008 (year-1 wealth above the model) is T-380 and B-010 (raid sizes at peril 2) is T-381. Their older measurement journal is in the [decision archive](archive/decisions-archive.md).
