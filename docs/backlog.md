# Backlog

Every open item, and nothing else. A row is added when an item is accepted and deleted in the commit that closes it; git is the history. How to pick up, work and close an item is in [`process/agent-workflow.md`](process/agent-workflow.md).

- **Id.** New items take the next free `T-1nn`. The older ids below (`U-`, `F-`, `C-`, `B-`) keep theirs until they close; nothing new gets one.
- **Source.** The audit, report or plan that produced the item. An item without a source is not accepted.
- **Needs.** Items that must be closed first. "—" means it can start now.
- **Status.** `open`, `in progress (who or which branch)`, or `blocked (why)`.

**Who has what (2026-10-11).** The cloud agent ([`../agents/cloud-agent.md`](../agents/cloud-agent.md)) stopped on 2026-10-11 after closing T-111, T-196, T-144, T-197, T-198, T-199 and T-212; its log is [`../reports/cloud-agent-log.md`](../reports/cloud-agent-log.md). Everything open is the local orchestrator's again.

| Id | Title | Source | Needs | Status |
|---|---|---|---|---|
| T-448 | [The annual instrument's maps are relief 0, which no real map is](work/T-448-instrument-relief.md) | T-436 | T-449, T-451 | open |
| T-450 | [Taiga loses most on relief: wolves reach the camp earlier](work/T-450-taiga-on-relief.md) | T-448's measurements | — | open |
| T-451 | [The three-year script does not yet play on relief](work/T-451-three-year-script-on-relief.md) | T-448's measurements | T-449 | open |
| T-452 | [A dwarf stays put while water rises around it](work/T-452-dwarf-stays-in-rising-water.md) | T-449's measurements | — | open |
| T-453 | [A river that ends in a far lake can lie beyond the drink search from the wagon](work/T-453-lake-beyond-the-drink-search.md) | T-449's measurements | — | open |
| T-454 | [A natural slope of several steps loses ramps by scan order](work/T-454-slopes-of-several-steps.md) | T-449's measurements | — | open |

The latest balance evidence is in [balance-status.md](balance-status.md). Walking speed is ×1.5 since T-140's measurement. Of B-008 to B-012, read against T-145's peril-0 sweep (2026-10-17): B-009, B-011 and B-012 are closed; B-008 (year-1 wealth above the model) is T-380 and B-010 (raid sizes at peril 2) is T-381. Their older measurement journal is in the [decision archive](archive/decisions-archive.md).
