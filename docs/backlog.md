# Backlog

Every open item, and nothing else. A row is added when an item is accepted and deleted in the commit that closes it; git is the history. How to pick up, work and close an item is in [`process/agent-workflow.md`](process/agent-workflow.md).

- **Id.** New items take the next free `T-1nn`. The older ids below (`U-`, `F-`, `C-`, `B-`) keep theirs until they close; nothing new gets one.
- **Source.** The audit, report or plan that produced the item. An item without a source is not accepted.
- **Needs.** Items that must be closed first. "—" means it can start now.
- **Status.** `open`, `in progress (who or which branch)`, or `blocked (why)`.

**Who has what (2026-10-11).** The cloud agent ([`../agents/cloud-agent.md`](../agents/cloud-agent.md)) stopped on 2026-10-11 after closing T-111, T-196, T-144, T-197, T-198, T-199 and T-212; its log is [`../reports/cloud-agent-log.md`](../reports/cloud-agent-log.md). Everything open is the local orchestrator's again.

| Id | Title | Source | Needs | Status |
|---|---|---|---|---|
| T-659 | [The steel's two fuels come in two trips](work/T-659-steel-fuel-in-one-trip.md) | [T-655](archive/tasks/T-655-furnace-jobs-fetch.md) | — | open |
| T-660 | [The smith's steel jobs are fetched again and again](work/T-660-smith-steel-refetched.md) | [T-655](archive/tasks/T-655-furnace-jobs-fetch.md) | — | open |
| T-661 | [The only axe stays with a dwarf who cannot chop](work/T-661-axe-held-by-the-absent.md) | [T-653](archive/tasks/T-653-ambush-at-the-all-clear.md) | — | open |
| T-662 | [The sweep's noise under fixed immigration rolls](work/T-662-sweep-noise-fixed-rolls.md) | [T-652](archive/tasks/T-652-immigration-roll-own-stream.md) | — | open |
| T-663 | [No water inside the gate](work/T-663-water-inside-the-gate.md) | [T-656](archive/tasks/T-656-thirst-under-the-alert.md) | — | open |
| T-664 | [A small peril-4 fortress starves with drink in stock](work/T-664-small-fortress-starves.md) | [T-656](archive/tasks/T-656-thirst-under-the-alert.md) | — | open |

The latest balance evidence is in [balance-status.md](balance-status.md). Walking speed is ×1.5 since T-140's measurement. Of B-008 to B-012, read against T-145's peril-0 sweep (2026-10-17): B-009, B-011 and B-012 are closed; B-008 (year-1 wealth above the model) is T-380 and B-010 (raid sizes at peril 2) is T-381. Their older measurement journal is in the [decision archive](archive/decisions-archive.md).
