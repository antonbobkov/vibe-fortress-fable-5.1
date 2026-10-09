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
| T-116 | [Audit: UI and UX pass](work/T-116-audit-ui-ux.md) | the owner, 2026-10-06 | T-111, and the fix tasks of T-115 (T-169 … T-177, T-180 … T-187) | open |
| T-140 | [Dwarves walk too slowly for a day of needs](work/T-140-walking-speed-and-need-errands.md) | T-123 and [`../reports/audits/2026-10-08-economy-at-default-priority.md`](../reports/audits/2026-10-08-economy-at-default-priority.md) | T-141, T-142, T-143 | open |
| T-144 | [Talking, sitting and the hearth visit take a quarter of the day](work/T-144-wants-without-errands.md) | T-123 and [`../reports/audits/2026-10-08-economy-at-default-priority.md`](../reports/audits/2026-10-08-economy-at-default-priority.md) | T-140 | open |
| T-145 | [The economy fixture plays at default priorities](work/T-145-economy-fixture-default-priority.md) | T-123 and [`../reports/audits/2026-10-08-economy-at-default-priority.md`](../reports/audits/2026-10-08-economy-at-default-priority.md) | T-140, T-141, T-142, T-143 | open |
| T-150 | [A year in the browser is played through the real UI](work/T-150-full-year-through-the-ui.md) | T-114 and [`../reports/audits/2026-10-08-playthrough-coverage.md`](../reports/audits/2026-10-08-playthrough-coverage.md) | — | open |
| T-151 | [A defence year: traps, a gate, a trained squad, a raid repelled](work/T-151-defence-year-scenario.md) | T-114 and [`../reports/audits/2026-10-08-playthrough-coverage.md`](../reports/audits/2026-10-08-playthrough-coverage.md) | T-140, T-141 | open |
| T-152 | [A hospital and burial run](work/T-152-hospital-and-burial-scenario.md) | T-114 and [`../reports/audits/2026-10-08-playthrough-coverage.md`](../reports/audits/2026-10-08-playthrough-coverage.md) | — | open |
| T-153 | [A homestead year: livestock, leather, cloth, hunting, fishing, gathering](work/T-153-homestead-year-scenario.md) | T-114 and [`../reports/audits/2026-10-08-playthrough-coverage.md`](../reports/audits/2026-10-08-playthrough-coverage.md) | — | open |
| T-154 | [A descent: caverns, deepsilver, the Deep, magma workshops](work/T-154-descent-scenario.md) | T-114 and [`../reports/audits/2026-10-08-playthrough-coverage.md`](../reports/audits/2026-10-08-playthrough-coverage.md) | — | open |
| T-155 | [Browser specs for the panels and screens that are only opened](work/T-155-browser-specs-for-unused-panels.md) | T-114 and [`../reports/audits/2026-10-08-playthrough-coverage.md`](../reports/audits/2026-10-08-playthrough-coverage.md) | — | open |
| T-156 | [The long fixtures check their own steps, and the sweep asserts what it exercises](work/T-156-long-fixtures-check-their-steps.md) | T-114 and [`../reports/audits/2026-10-08-playthrough-coverage.md`](../reports/audits/2026-10-08-playthrough-coverage.md) | T-145 | open |
| T-157 | [Every command, event, job type and building type is exercised by a test](work/T-157-everything-exercised-once.md) | T-114 and [`../reports/audits/2026-10-08-playthrough-coverage.md`](../reports/audits/2026-10-08-playthrough-coverage.md) | — | open |
| T-170 | [An ambush is hidden until it is sprung](work/T-170-ambush-is-hidden.md) | T-115 and [`../reports/audits/2026-10-08-bug-hunt.md`](../reports/audits/2026-10-08-bug-hunt.md) | — | open |
| T-171 | [Soldiers do not claim a caravan's goods](work/T-171-soldiers-claim-caravan-goods.md) | T-115 and [`../reports/audits/2026-10-08-bug-hunt.md`](../reports/audits/2026-10-08-bug-hunt.md) | T-162 | open |
| T-174 | [A work order's material filter is the same after a load](work/T-174-material-filter-changes-on-load.md) | T-115 and [`../reports/audits/2026-10-08-bug-hunt.md`](../reports/audits/2026-10-08-bug-hunt.md) | — | open |
| T-175 | [Cosmetic findings of the bug hunt](work/T-175-bug-hunt-cosmetic-findings.md) | T-115 and [`../reports/audits/2026-10-08-bug-hunt.md`](../reports/audits/2026-10-08-bug-hunt.md) | — | open |
| T-176 | [The bug hunt's probes become permanent tests](work/T-176-bug-hunt-probes-as-tests.md) | T-115 and [`../reports/audits/2026-10-08-bug-hunt.md`](../reports/audits/2026-10-08-bug-hunt.md) | T-160 … T-174 | open |
| T-177 | [Three rules of the spec have no code](work/T-177-rules-with-no-implementation.md) | T-115 and [`../reports/audits/2026-10-08-bug-hunt.md`](../reports/audits/2026-10-08-bug-hunt.md) | — | open |
| T-184 | [A save taken while paused after a designation plays like the unsaved game](work/T-184-paused-designation-and-the-save.md) | T-115 and [`../reports/audits/2026-10-09-bug-hunt-spec-reading.md`](../reports/audits/2026-10-09-bug-hunt-spec-reading.md) | — | open |
| T-185 | [A thief that finds nothing to steal leaves empty-handed](work/T-185-thief-with-nothing-to-steal.md) | T-115 and [`../reports/audits/2026-10-09-bug-hunt-spec-reading.md`](../reports/audits/2026-10-09-bug-hunt-spec-reading.md) | T-169 | open |
| T-186 | [Eighteen rules to write down or remove](work/T-186-rules-to-write-down-or-remove.md) | T-115 and [`../reports/audits/2026-10-09-bug-hunt-spec-reading.md`](../reports/audits/2026-10-09-bug-hunt-spec-reading.md) | — | open |
| T-187 | [Cosmetic findings of the spec reading](work/T-187-spec-reading-cosmetic-findings.md) | T-115 and [`../reports/audits/2026-10-09-bug-hunt-spec-reading.md`](../reports/audits/2026-10-09-bug-hunt-spec-reading.md) | T-186 | open |

The latest balance evidence is in [balance-status.md](balance-status.md). B-008 through B-012 await T-140 (walking speed against the need cycle) and T-145 (the fixture at default priorities), which T-123's diagnosis produced; their measurement journal is in the [decision archive](archive/decisions-archive.md).
