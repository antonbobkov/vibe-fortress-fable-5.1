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
| T-466 | [The hand-laid defence of `defence_year` does not repel a raid](work/T-466-defence-never-repels-a-raid.md) | T-462's defence_year seeds | — | open |
| T-477 | [Runecraft 10: the whole loop played, and the docs that tell it](work/T-477-runecraft-whole-loop-scenario.md) | Runecraft design | T-479 | blocked (needs T-479) |
| T-482 | [Idle tame animals keep a walk that has arrived, and crowd one hall tile](work/T-482-tame-animal-stale-walk.md) | T-463's follow-up | — | open |
| T-483 | [Marksdwarves shoot their own squad](work/T-483-marksdwarf-friendly-fire.md) | T-470's arena | — | open |
| T-486 | [A peril-4 ambush can kill a whole fortress over five days](work/T-486-ambush-massacre.md) | T-479's sweep | — | open |
| T-487 | [A plant job whose fetch walk failed is never retried, with every worker able to reach it](work/T-487-failed-fetch-walk-never-retried.md) | T-479's sweep | — | open |
| T-488 | [three-years-p2-7 ends without its dining hall](work/T-488-p2-7-dining-hall-witness.md) | T-479's sweep | — | open |

The latest balance evidence is in [balance-status.md](balance-status.md). Walking speed is ×1.5 since T-140's measurement. Of B-008 to B-012, read against T-145's peril-0 sweep (2026-10-17): B-009, B-011 and B-012 are closed; B-008 (year-1 wealth above the model) is T-380 and B-010 (raid sizes at peril 2) is T-381. Their older measurement journal is in the [decision archive](archive/decisions-archive.md).
