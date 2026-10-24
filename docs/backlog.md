# Backlog

Every open item, and nothing else. A row is added when an item is accepted and deleted in the commit that closes it; git is the history. How to pick up, work and close an item is in [`process/agent-workflow.md`](process/agent-workflow.md).

- **Id.** New items take the next free `T-1nn`. The older ids below (`U-`, `F-`, `C-`, `B-`) keep theirs until they close; nothing new gets one.
- **Source.** The audit, report or plan that produced the item. An item without a source is not accepted.
- **Needs.** Items that must be closed first. "—" means it can start now.
- **Status.** `open`, `in progress (who or which branch)`, or `blocked (why)`.

**Who has what (2026-10-11).** The cloud agent ([`../agents/cloud-agent.md`](../agents/cloud-agent.md)) stopped on 2026-10-11 after closing T-111, T-196, T-144, T-197, T-198, T-199 and T-212; its log is [`../reports/cloud-agent-log.md`](../reports/cloud-agent-log.md). Everything open is the local orchestrator's again.

| Id | Title | Source | Needs | Status |
|---|---|---|---|---|
| T-427 | [Wild animals in `leave` stay for weeks near the map edge](work/T-427-animals-stuck-leaving.md) | T-421's diagnosis | — | open |
| T-436 | [Surface visual variety: relief, trees, shrubs, grass, boulders](work/T-436-surface-visual-variety.md) | the owner, 2026-10-23 | T-427 | open |
| T-437 | [Dig designations blink while queued or assigned](work/T-437-blinking-designations.md) | the owner, 2026-10-23 | — | open |
| T-439 | [A step-by-step scripted tutorial](work/T-439-tutorial.md) | the owner, 2026-10-23 | T-437, T-441 | open |
| T-440 | [The embark screen says what a site has and lacks](work/T-440-embark-site-summary.md) | the owner, 2026-10-23 | — | open |
| T-441 | [Two-click rectangle designation, in 3D, and stair columns](work/T-441-two-click-3d-designation.md) | the owner, 2026-10-23 | — | open |

The latest balance evidence is in [balance-status.md](balance-status.md). Walking speed is ×1.5 since T-140's measurement. Of B-008 to B-012, read against T-145's peril-0 sweep (2026-10-17): B-009, B-011 and B-012 are closed; B-008 (year-1 wealth above the model) is T-380 and B-010 (raid sizes at peril 2) is T-381. Their older measurement journal is in the [decision archive](archive/decisions-archive.md).
