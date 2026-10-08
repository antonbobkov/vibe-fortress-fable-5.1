# Backlog

Every open item, and nothing else. A row is added when an item is accepted and deleted in the commit that closes it; git is the history. How to pick up, work and close an item is in [`process/agent-workflow.md`](process/agent-workflow.md).

- **Id.** New items take the next free `T-1nn`. The older ids below (`U-`, `F-`, `C-`, `B-`) keep theirs until they close; nothing new gets one.
- **Source.** The audit, report or plan that produced the item. An item without a source is not accepted.
- **Needs.** Items that must be closed first. "—" means it can start now.
- **Status.** `open`, `in progress (who or which branch)`, or `blocked (why)`.

| Id | Title | Source | Needs | Status |
|---|---|---|---|---|
| T-111 | [UI audit follow-up: what the U tasks changed](work/T-111-ui-audit-follow-up.md) | [`../reports/audits/ui-audit.md`](../reports/audits/ui-audit.md) | U-02, U-07 | open |
| T-113 | [A full gate run on the restructured repository](work/T-113-full-gate-run.md) | the owner, 2026-10-06 | T-140 … T-145 (the performance tier includes the 20-seed balance sweep, which cannot pass before them) | open |
| T-114 | [Audit: do the scripted playthroughs cover the game's major features?](work/T-114-audit-test-coverage.md) | the owner, 2026-10-06 | — | open |
| T-115 | [Audit: bug hunt](work/T-115-audit-bug-hunt.md) | the owner, 2026-10-06 | T-114 and its fix tasks | open |
| T-116 | [Audit: UI and UX pass](work/T-116-audit-ui-ux.md) | the owner, 2026-10-06 | T-111, T-115 and its fix tasks | open |
| T-131 | [Preserve saved web flags during load bootstrap](work/T-131-load-web-flags.md) | T-130 save/load regression probe | — | open |
| T-140 | [Dwarves walk too slowly for a day of needs](work/T-140-walking-speed-and-need-errands.md) | T-123 and [`../reports/audits/2026-10-08-economy-at-default-priority.md`](../reports/audits/2026-10-08-economy-at-default-priority.md) | T-141, T-142, T-143 | open |
| T-141 | [A hostile near the entrance stair traps civilians on it](work/T-141-stair-flee-livelock.md) | T-123 and [`../reports/audits/2026-10-08-economy-at-default-priority.md`](../reports/audits/2026-10-08-economy-at-default-priority.md) | — | open |
| T-142 | [The trade job outlives its caravan and its broker](work/T-142-stale-trade-job.md) | T-123 and [`../reports/audits/2026-10-08-economy-at-default-priority.md`](../reports/audits/2026-10-08-economy-at-default-priority.md) | — | open |
| T-143 | [An interrupted build loses the materials already delivered](work/T-143-interrupted-build-keeps-materials.md) | T-123 and [`../reports/audits/2026-10-08-economy-at-default-priority.md`](../reports/audits/2026-10-08-economy-at-default-priority.md) | — | open |
| T-144 | [Talking, sitting and the hearth visit take a quarter of the day](work/T-144-wants-without-errands.md) | T-123 and [`../reports/audits/2026-10-08-economy-at-default-priority.md`](../reports/audits/2026-10-08-economy-at-default-priority.md) | T-140 | open |
| T-145 | [The economy fixture plays at default priorities](work/T-145-economy-fixture-default-priority.md) | T-123 and [`../reports/audits/2026-10-08-economy-at-default-priority.md`](../reports/audits/2026-10-08-economy-at-default-priority.md) | T-140, T-141, T-142, T-143 | open |

The latest balance evidence is in [balance-status.md](balance-status.md). B-008 through B-012 await T-140 (walking speed against the need cycle) and T-145 (the fixture at default priorities), which T-123's diagnosis produced; their measurement journal is in the [decision archive](archive/decisions-archive.md).
