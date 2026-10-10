# Backlog

Every open item, and nothing else. A row is added when an item is accepted and deleted in the commit that closes it; git is the history. How to pick up, work and close an item is in [`process/agent-workflow.md`](process/agent-workflow.md).

- **Id.** New items take the next free `T-1nn`. The older ids below (`U-`, `F-`, `C-`, `B-`) keep theirs until they close; nothing new gets one.
- **Source.** The audit, report or plan that produced the item. An item without a source is not accepted.
- **Needs.** Items that must be closed first. "—" means it can start now.
- **Status.** `open`, `in progress (who or which branch)`, or `blocked (why)`.

| Id | Title | Source | Needs | Status |
|---|---|---|---|---|
| T-111 | [UI audit follow-up: what the U tasks changed](work/T-111-ui-audit-follow-up.md) | [`../reports/audits/ui-audit.md`](../reports/audits/ui-audit.md) | U-02, U-07 | open |
| T-113 | [A full gate run on the restructured repository](work/T-113-full-gate-run.md) | the owner, 2026-10-06 | T-140, T-144, T-145, T-188 (the performance tier includes the 20-seed balance sweep, which cannot pass before them) | open |
| T-116 | [Audit: UI and UX pass](work/T-116-audit-ui-ux.md) | the owner, 2026-10-06 | T-111, and the fix tasks of T-115 (T-169 … T-177, T-180 … T-187) | open |
| T-133 | [A refused malformed command cannot poison the next save](work/T-133-malformed-command-log-save.md) | T-184 and [`../reports/audits/2026-10-09-paused-command-log-save.md`](../reports/audits/2026-10-09-paused-command-log-save.md) | — | open (resolution proposed) |
| T-140 | [Dwarves walk too slowly for a day of needs](work/T-140-walking-speed-and-need-errands.md) | T-123 and [`../reports/audits/2026-10-08-economy-at-default-priority.md`](../reports/audits/2026-10-08-economy-at-default-priority.md) | T-144 (the work share is re-measured after it), T-145 (`npm run test:perf` includes the sweep) | open: walking speed is ×1.5; two Done items wait |
| T-144 | [Talking, sitting and the hearth visit take a quarter of the day](work/T-144-wants-without-errands.md) | T-123 and [`../reports/audits/2026-10-08-economy-at-default-priority.md`](../reports/audits/2026-10-08-economy-at-default-priority.md) | — | open |
| T-145 | [The economy fixture plays at default priorities](work/T-145-economy-fixture-default-priority.md) | T-123 and [`../reports/audits/2026-10-08-economy-at-default-priority.md`](../reports/audits/2026-10-08-economy-at-default-priority.md) | T-144, T-188 | open |
| T-150 | [A year in the browser is played through the real UI](work/T-150-full-year-through-the-ui.md) | T-114 and [`../reports/audits/2026-10-08-playthrough-coverage.md`](../reports/audits/2026-10-08-playthrough-coverage.md) | — | open |
| T-151 | [A defence year: traps, a gate, a trained squad, a raid repelled](work/T-151-defence-year-scenario.md) | T-114 and [`../reports/audits/2026-10-08-playthrough-coverage.md`](../reports/audits/2026-10-08-playthrough-coverage.md) | T-140, T-141 | open |
| T-155 | [Browser specs for the panels and screens that are only opened](work/T-155-browser-specs-for-unused-panels.md) | T-114 and [`../reports/audits/2026-10-08-playthrough-coverage.md`](../reports/audits/2026-10-08-playthrough-coverage.md) | — | open |
| T-156 | [The long fixtures check their own steps, and the sweep asserts what it exercises](work/T-156-long-fixtures-check-their-steps.md) | T-114 and [`../reports/audits/2026-10-08-playthrough-coverage.md`](../reports/audits/2026-10-08-playthrough-coverage.md) | T-145 | open |
| T-157 | [Every command, event, job type and building type is exercised by a test](work/T-157-everything-exercised-once.md) | T-114 and [`../reports/audits/2026-10-08-playthrough-coverage.md`](../reports/audits/2026-10-08-playthrough-coverage.md) | — | open |
| T-185 | [A thief that finds nothing to steal leaves empty-handed](work/T-185-thief-with-nothing-to-steal.md) | T-115 and [`../reports/audits/2026-10-09-bug-hunt-spec-reading.md`](../reports/audits/2026-10-09-bug-hunt-spec-reading.md) | T-169 | open |
| T-186 | [Eighteen rules to write down or remove](work/T-186-rules-to-write-down-or-remove.md) | T-115 and [`../reports/audits/2026-10-09-bug-hunt-spec-reading.md`](../reports/audits/2026-10-09-bug-hunt-spec-reading.md) | — | open; spec items done, code items remain |
| T-187 | [Cosmetic findings of the spec reading](work/T-187-spec-reading-cosmetic-findings.md) | T-115 and [`../reports/audits/2026-10-09-bug-hunt-spec-reading.md`](../reports/audits/2026-10-09-bug-hunt-spec-reading.md) | T-186 | open |
| T-188 | [A workshop job stalls for weeks and the fortress dies of thirst](work/T-188-still-stalls-and-the-fortress-dies-of-thirst.md) | T-140 and [`../reports/audits/2026-10-09-walking-speed.md`](../reports/audits/2026-10-09-walking-speed.md) | — | open |
| T-190 | [The bandage_animal job is not produced for wounded tame animals](work/T-190-bandage-animal-job.md) | T-152 and its run of `hospital_run.scenario.ts` | — | open |
| T-193 | [Initial cavern monsters emit no MonsterSpawned event upon cavern breach](work/T-193-cavern-breach-monster-event.md) | T-154 and its run of `descent.scenario.ts` | — | open |
| T-194 | [magma_kiln lacks magmaVariantOf and has no authored recipes](work/T-194-magma-kiln-no-recipes.md) | T-154 and its run of `descent.scenario.ts` | — | open |

The latest balance evidence is in [balance-status.md](balance-status.md). Walking speed is ×1.5 since T-140's measurement. B-008 through B-012 await T-144 (the three wants as errands), T-188 (the stalled still) and T-145 (the fixture at default priorities); their measurement journal is in the [decision archive](archive/decisions-archive.md).
