# Backlog

Every open item, and nothing else. A row is added when an item is accepted and deleted in the commit that closes it; git is the history. How to pick up, work and close an item is in [`process/agent-workflow.md`](process/agent-workflow.md).

- **Id.** New items take the next free `T-1nn`. The older ids below (`U-`, `F-`, `C-`, `B-`) keep theirs until they close; nothing new gets one.
- **Source.** The audit, report or plan that produced the item. An item without a source is not accepted.
- **Needs.** Items that must be closed first. "—" means it can start now.
- **Status.** `open`, `in progress (who or which branch)`, or `blocked (why)`.

| Id | Title | Source | Needs | Status |
|---|---|---|---|---|
| T-106 | [Triage D-rows: systems 14–19](work/T-106-triage-systems-14-19.md) | [`work/docs-restructure.md`](work/docs-restructure.md) | — | open |
| T-107 | [Triage D-rows: systems 20–24, content and implementation](work/T-107-triage-systems-20-24-and-content.md) | [`work/docs-restructure.md`](work/docs-restructure.md) | — | open |
| T-109 | [Balance status: one row per measure, latest figure only](work/T-109-balance-status.md) | [`work/docs-restructure.md`](work/docs-restructure.md) | F-17 | open |
| T-110 | [Close the migration: pending decisions, archive, large data files](work/T-110-close-the-migration.md) | [`work/docs-restructure.md`](work/docs-restructure.md) | T-102 … T-109 | open |
| T-111 | [UI audit follow-up: what the U tasks changed](work/T-111-ui-audit-follow-up.md) | [`../reports/audits/ui-audit.md`](../reports/audits/ui-audit.md) | U-02, U-07 | open |
| T-113 | [A full gate run on the restructured repository](work/T-113-full-gate-run.md) | the owner, 2026-10-06 | U-02, U-07, F-17, T-103 … T-112 | open |
| T-114 | [Audit: do the scripted playthroughs cover the game's major features?](work/T-114-audit-test-coverage.md) | the owner, 2026-10-06 | T-113 | open |
| T-115 | [Audit: bug hunt](work/T-115-audit-bug-hunt.md) | the owner, 2026-10-06 | T-114 and its fix tasks | open |
| T-116 | [Audit: UI and UX pass](work/T-116-audit-ui-ux.md) | the owner, 2026-10-06 | T-111, T-115 and its fix tasks | open |
| T-113 | [`DwarfDied`: the specification says 10 emits it, the code never does](work/T-113-dwarfdied-event.md) | T-102 (found while replacing the interface note of `02-systems/10-dwarves.md`) | — | open |
| T-117 | [Resolve retained systems 01–07 decision/code mismatches](work/T-117-retained-system-decisions.md) | [T-104 triage](archive/tasks/T-104-triage-systems-01-07.md) | owner resolutions for D-048, D-053, D-076, D-101, D-102 | open |
| T-130 | [Resolve retained animal/job decisions and catalog mirrors](work/T-130-retained-decisions-08-13.md) | [T-105 triage](archive/tasks/T-105-triage-systems-08-13.md) | owner resolutions for D-070 and D-109; catalog regeneration | open |
| F-17 | [Balance follow-ups from the economy fortress](work/F-17-balance-followups.md) | [`../reports/audits/M8-balance-economy.md`](../reports/audits/M8-balance-economy.md) | — | in progress (branch `f-17`) |
| C-009 | System 21's performance allocation is a literal 0.00 ms, which no measured run can meet; its budget assertion is `it.todo` | [`05-plan/DECISIONS.md`](05-plan/DECISIONS.md) § Contradictions, row C-009 | an owner decision: a positive allocation, or an exemption for zero allocations | open |
| B-008 | Balance finding: the wealth curve over years 1–3 against the model | [`../reports/audits/M8-balance-economy.md`](../reports/audits/M8-balance-economy.md) | F-17 (re-measure) | open; folds into T-109 |
| B-009 | Balance finding: immigration waves in years 2 and 3 against the model | [`../reports/audits/M8-balance-economy.md`](../reports/audits/M8-balance-economy.md) | F-17 (re-measure) | open; folds into T-109 |
| B-010 | Balance finding: raid sizes in years 2 and 3 at peril 2 against the model | [`../reports/audits/M8-balance-economy.md`](../reports/audits/M8-balance-economy.md) | F-17 (re-measure) | open; folds into T-109 |
| B-011 | Balance finding: mood in a surviving fortress against the model | [`../reports/audits/M8-balance-economy.md`](../reports/audits/M8-balance-economy.md) | F-17 (re-measure) | open; folds into T-109 |
| B-012 | Balance finding: food and drink consumed per dwarf per day against the model | [`../reports/audits/M8-balance-economy.md`](../reports/audits/M8-balance-economy.md) | F-17 (re-measure) | open; folds into T-109 |

The measurement history of B-008 … B-012 is in the decision log's § Balance findings until T-109 replaces it with `docs/balance-status.md`.
