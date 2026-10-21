# Backlog

Every open item, and nothing else. A row is added when an item is accepted and deleted in the commit that closes it; git is the history. How to pick up, work and close an item is in [`process/agent-workflow.md`](process/agent-workflow.md).

- **Id.** New items take the next free `T-1nn`. The older ids below (`U-`, `F-`, `C-`, `B-`) keep theirs until they close; nothing new gets one.
- **Source.** The audit, report or plan that produced the item. An item without a source is not accepted.
- **Needs.** Items that must be closed first. "—" means it can start now.
- **Status.** `open`, `in progress (who or which branch)`, or `blocked (why)`.

**Who has what (2026-10-11).** The cloud agent ([`../agents/cloud-agent.md`](../agents/cloud-agent.md)) stopped on 2026-10-11 after closing T-111, T-196, T-144, T-197, T-198, T-199 and T-212; its log is [`../reports/cloud-agent-log.md`](../reports/cloud-agent-log.md). Everything open is the local orchestrator's again.

| Id | Title | Source | Needs | Status |
|---|---|---|---|---|
| T-113 | [A full gate run on the restructured repository](work/T-113-full-gate-run.md) | the owner, 2026-10-06 | — (T-393 closed 2026-10-18; needs a quiet machine) | open; local side (needs a quiet machine) |
| T-404 | [Combat pace is far below the balance model](work/T-404-combat-pace-below-the-model.md) | T-366's measurement | — | open |
| T-405 | [The first bandage decides a serious wound](work/T-405-first-bandage-decides-a-serious-wound.md) | T-367's measurement | — | open |
| T-408 | [Rest falls on the walk to bed](work/T-408-rest-falls-on-the-walk-to-bed.md) | T-369's measurement | — | open |
| T-409 | [A creature that cannot move holds a doorway, and a job waits on it for good](work/T-409-unconscious-in-doorway.md) | T-406's diagnosis | — | open |

The latest balance evidence is in [balance-status.md](balance-status.md). Walking speed is ×1.5 since T-140's measurement. Of B-008 to B-012, read against T-145's peril-0 sweep (2026-10-17): B-009, B-011 and B-012 are closed; B-008 (year-1 wealth above the model) is T-380 and B-010 (raid sizes at peril 2) is T-381. Their older measurement journal is in the [decision archive](archive/decisions-archive.md).
