# Backlog

Every open item, and nothing else. A row is added when an item is accepted and deleted in the commit that closes it; git is the history. How to pick up, work and close an item is in [`process/agent-workflow.md`](process/agent-workflow.md).

- **Id.** New items take the next free `T-1nn`. The older ids below (`U-`, `F-`, `C-`, `B-`) keep theirs until they close; nothing new gets one.
- **Source.** The audit, report or plan that produced the item. An item without a source is not accepted.
- **Needs.** Items that must be closed first. "—" means it can start now.
- **Status.** `open`, `in progress (who or which branch)`, or `blocked (why)`.

**Who has what (2026-10-11).** The cloud agent ([`../agents/cloud-agent.md`](../agents/cloud-agent.md)) stopped on 2026-10-11 after closing T-111, T-196, T-144, T-197, T-198, T-199 and T-212; its log is [`../reports/cloud-agent-log.md`](../reports/cloud-agent-log.md). Everything open is the local orchestrator's again.

| Id | Title | Source | Needs | Status |
|---|---|---|---|---|
| T-606 | [The strong squad does not reach Proficient in three years](work/T-606-strong-squad-pace.md) | [T-603](archive/tasks/T-603-script-builds-strong-squad.md) | — | open |
| T-607 | [A training soldier's barracks post can be a tile nobody can stand on](work/T-607-barracks-post-on-a-blocked-tile.md) | [T-603](archive/tasks/T-603-script-builds-strong-squad.md) | — | open |
| T-609 | [A zone answers at once, and its inspector has the keys it names](work/T-609-zone-tool-feedback.md) | [T-605](archive/tasks/T-605-first-hour-ux.md) | — | open |
| T-610 | [A designation no dwarf can reach says so when it is made](work/T-610-unreachable-designations.md) | [T-605](archive/tasks/T-605-first-hour-ux.md) | — | open |
| T-611 | [Inspecting a dwarf from Units shows that dwarf](work/T-611-units-inspect-dwarf.md) | [T-605](archive/tasks/T-605-first-hour-ux.md) | — | open |
| T-612 | [The legend and the hover line explain the surface](work/T-612-surface-legend.md) | [T-605](archive/tasks/T-605-first-hour-ux.md) | — | open |
| T-613 | [The world map shows where the cursor is and what its words mean](work/T-613-world-map-readability.md) | [T-605](archive/tasks/T-605-first-hour-ux.md) | — | open |
| T-614 | [The log panel's filter field](work/T-614-log-filter-field.md) | [T-608](archive/tasks/T-608-readable-log-and-hints.md) | — | open |

The latest balance evidence is in [balance-status.md](balance-status.md). Walking speed is ×1.5 since T-140's measurement. Of B-008 to B-012, read against T-145's peril-0 sweep (2026-10-17): B-009, B-011 and B-012 are closed; B-008 (year-1 wealth above the model) is T-380 and B-010 (raid sizes at peril 2) is T-381. Their older measurement journal is in the [decision archive](archive/decisions-archive.md).
