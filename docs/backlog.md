# Backlog

Every open item, and nothing else. A row is added when an item is accepted and deleted in the commit that closes it; git is the history. How to pick up, work and close an item is in [`process/agent-workflow.md`](process/agent-workflow.md).

- **Id.** New items take the next free `T-1nn`. The older ids below (`U-`, `F-`, `C-`, `B-`) keep theirs until they close; nothing new gets one.
- **Source.** The audit, report or plan that produced the item. An item without a source is not accepted.
- **Needs.** Items that must be closed first. "—" means it can start now.
- **Status.** `open`, `in progress (who or which branch)`, or `blocked (why)`.

| Id | Title | Source | Needs | Status |
|---|---|---|---|---|
| T-111 | [UI audit follow-up: what the U tasks changed](work/T-111-ui-audit-follow-up.md) | [`../reports/audits/ui-audit.md`](../reports/audits/ui-audit.md) | U-02, U-07 | open |
| T-113 | [A full gate run on the restructured repository](work/T-113-full-gate-run.md) | the owner, 2026-10-06 | T-140, T-144 (`homestead_year` fails on its branch), T-145 (the performance tier includes the 20-seed balance sweep, which cannot pass before them) | open |
| T-116 | [Audit: UI and UX pass](work/T-116-audit-ui-ux.md) | the owner, 2026-10-06 | T-111, and the fix tasks of T-115 (T-169 … T-177, T-180 … T-187) | open |
| T-133 | [A refused malformed command cannot poison the next save](work/T-133-malformed-command-log-save.md) | T-184 and [`../reports/audits/2026-10-09-paused-command-log-save.md`](../reports/audits/2026-10-09-paused-command-log-save.md) | — | open (resolution proposed) |
| T-134 | T-195 follow-up: squad orders respect need activities (work in progress on branch `t-134-wip`, commit `c97c17c`; its task file is in that commit) | Codex's critical read of the T-195 fix, 2026-10-10 | T-144 (it changes the same `select()` and re-seeds `hospital_run`, which this follow-up trips) | open; ten regressions and a fix written, not green: `hospital_run` 1 of 3 wounded, per-system perf 19 of 22 |
| T-140 | [Dwarves walk too slowly for a day of needs](work/T-140-walking-speed-and-need-errands.md) | T-123 and [`../reports/audits/2026-10-08-economy-at-default-priority.md`](../reports/audits/2026-10-08-economy-at-default-priority.md) | T-145 (the work share is 30.5% after T-144 with 7.6% idle; re-measure with its work supply; `npm run test:perf` includes the sweep) | open: walking speed is ×1.5; two Done items wait |
| T-144 | [Talking, sitting and the hearth visit take a quarter of the day](work/T-144-wants-without-errands.md) | T-123 and [`../reports/audits/2026-10-08-economy-at-default-priority.md`](../reports/audits/2026-10-08-economy-at-default-priority.md) | — | in progress (t-144): the four rules, the scenario and the report are done; `homestead_year` fails at `job: hunt` (T-198) and the wants are under-served (T-197); not closed |
| T-145 | [The economy fixture plays at default priorities](work/T-145-economy-fixture-default-priority.md) | T-123 and [`../reports/audits/2026-10-08-economy-at-default-priority.md`](../reports/audits/2026-10-08-economy-at-default-priority.md) | T-144, T-196 (with wildlife on, the fixture dies out by boar in year 1) | open |
| T-150 | [A year in the browser is played through the real UI](work/T-150-full-year-through-the-ui.md) | T-114 and [`../reports/audits/2026-10-08-playthrough-coverage.md`](../reports/audits/2026-10-08-playthrough-coverage.md) | — | open |
| T-151 | [A defence year: traps, a gate, a trained squad, a raid repelled](work/T-151-defence-year-scenario.md) | T-114 and [`../reports/audits/2026-10-08-playthrough-coverage.md`](../reports/audits/2026-10-08-playthrough-coverage.md) | T-140, T-141 | open |
| T-155 | [Browser specs for the panels and screens that are only opened](work/T-155-browser-specs-for-unused-panels.md) | T-114 and [`../reports/audits/2026-10-08-playthrough-coverage.md`](../reports/audits/2026-10-08-playthrough-coverage.md) | — | open |
| T-156 | [The long fixtures check their own steps, and the sweep asserts what it exercises](work/T-156-long-fixtures-check-their-steps.md) | T-114 and [`../reports/audits/2026-10-08-playthrough-coverage.md`](../reports/audits/2026-10-08-playthrough-coverage.md) | T-145 | open |
| T-196 | [Wild predators kill civilians outside the walls, and livestock starve on pasture](work/T-196-wild-predators-and-civilians.md) | T-151 and the T-188 re-measure | — | open |
| T-197 | [Social, comfort and joy are under-served when work is always open](work/T-197-wants-under-served-with-work-open.md) | T-144 and [`../reports/audits/2026-10-10-wants-without-errands.md`](../reports/audits/2026-10-10-wants-without-errands.md) | T-144 | open (needs the owner's decision) |
| T-198 | [Hunters split the weapons and the bolts between them and none can shoot](work/T-198-hunt-tool-fetch-splits-weapon-and-ammo.md) | T-144 and [`../reports/audits/2026-10-10-wants-without-errands.md`](../reports/audits/2026-10-10-wants-without-errands.md) | — | open |
| T-199 | [The still waits for an empty barrel while every barrel holds food](work/T-199-still-waits-for-an-empty-barrel.md) | T-144 and [`../reports/audits/2026-10-10-wants-without-errands.md`](../reports/audits/2026-10-10-wants-without-errands.md) | — | open |

The latest balance evidence is in [balance-status.md](balance-status.md). Walking speed is ×1.5 since T-140's measurement. B-008 through B-012 await T-197 (the three wants are under-served after T-144: mood 49.9), T-196 (wildlife kills the fixture at peril 0) and T-145 (the fixture at default priorities); their measurement journal is in the [decision archive](archive/decisions-archive.md).
