# Backlog

Every open item, and nothing else. A row is added when an item is accepted and deleted in the commit that closes it; git is the history. How to pick up, work and close an item is in [`process/agent-workflow.md`](process/agent-workflow.md).

- **Id.** New items take the next free `T-1nn`. The older ids below (`U-`, `F-`, `C-`, `B-`) keep theirs until they close; nothing new gets one.
- **Source.** The audit, report or plan that produced the item. An item without a source is not accepted.
- **Needs.** Items that must be closed first. "—" means it can start now.
- **Status.** `open`, `in progress (who or which branch)`, or `blocked (why)`.

| Id | Title | Source | Needs | Status |
|---|---|---|---|---|
| T-110 | [Close the migration: pending decisions, archive, large data files](work/T-110-close-the-migration.md) | [`work/docs-restructure.md`](work/docs-restructure.md) | T-102 … T-109 | open |
| T-111 | [UI audit follow-up: what the U tasks changed](work/T-111-ui-audit-follow-up.md) | [`../reports/audits/ui-audit.md`](../reports/audits/ui-audit.md) | U-02, U-07 | open |
| T-113 | [A full gate run on the restructured repository](work/T-113-full-gate-run.md) | the owner, 2026-10-06 | U-02, U-07, T-103 … T-112 | open |
| T-114 | [Audit: do the scripted playthroughs cover the game's major features?](work/T-114-audit-test-coverage.md) | the owner, 2026-10-06 | T-113 | open |
| T-115 | [Audit: bug hunt](work/T-115-audit-bug-hunt.md) | the owner, 2026-10-06 | T-114 and its fix tasks | open |
| T-116 | [Audit: UI and UX pass](work/T-116-audit-ui-ux.md) | the owner, 2026-10-06 | T-111, T-115 and its fix tasks | open |
| T-123 | [The economy fortress cannot run its economy at default priorities](work/T-123-economy-fortress-at-default-priority.md) | F-17 and [`../reports/audits/2026-10-07-balance-after-f17.md`](../reports/audits/2026-10-07-balance-after-f17.md) | — | open |
| T-131 | [Preserve saved web flags during load bootstrap](work/T-131-load-web-flags.md) | T-130 save/load regression probe | — | open |

The latest balance evidence is in [balance-status.md](balance-status.md). B-008 through B-012 await T-123; their measurement journal is in the [decision archive](archive/decisions-archive.md).
