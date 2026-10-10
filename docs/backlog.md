# Backlog

Every open item, and nothing else. A row is added when an item is accepted and deleted in the commit that closes it; git is the history. How to pick up, work and close an item is in [`process/agent-workflow.md`](process/agent-workflow.md).

- **Id.** New items take the next free `T-1nn`. The older ids below (`U-`, `F-`, `C-`, `B-`) keep theirs until they close; nothing new gets one.
- **Source.** The audit, report or plan that produced the item. An item without a source is not accepted.
- **Needs.** Items that must be closed first. "—" means it can start now.
- **Status.** `open`, `in progress (who or which branch)`, or `blocked (why)`.

**Who has what (2026-10-10).** Rows marked "cloud agent" in the Status column are handed to the Claude agent that runs in the cloud; its brief is [`../agents/cloud-agent.md`](../agents/cloud-agent.md). It works in its own worktrees on branches `cloud/main` and `cloud/<task id>` and never pushes to `master`; the local orchestrator merges `cloud/main` when its log lists a step as ready. It files new rows as T-210 … T-259. Everything else is the local orchestrator's.

| Id | Title | Source | Needs | Status |
|---|---|---|---|---|
| T-111 | [UI audit follow-up: what the U tasks changed](work/T-111-ui-audit-follow-up.md) | [`../reports/audits/ui-audit.md`](../reports/audits/ui-audit.md) | — | open; cloud agent (chain B): mechanical draft done, the walkthrough remains |
| T-113 | [A full gate run on the restructured repository](work/T-113-full-gate-run.md) | the owner, 2026-10-06 | T-140, T-144, T-145 (the performance tier includes the 20-seed balance sweep, which cannot pass before them) | open; local side (needs a quiet machine) |
| T-116 | [Audit: UI and UX pass](work/T-116-audit-ui-ux.md) | the owner, 2026-10-06 | T-111, and the fix tasks of T-115 (T-169 … T-177, T-180 … T-187) | open; cloud agent (chain B) |
| T-133 | [A refused malformed command cannot poison the next save](work/T-133-malformed-command-log-save.md) | T-184 and [`../reports/audits/2026-10-09-paused-command-log-save.md`](../reports/audits/2026-10-09-paused-command-log-save.md) | — | open; cloud agent (chain A, step 4); resolution accepted |
| T-134 | T-195 follow-up: squad orders respect need activities (work in progress on branch `t-134-wip`, commit `c97c17c`; its task file is in that commit) | Codex's critical read of the T-195 fix, 2026-10-10 | T-144 (it changes the same `select()` and re-seeds `hospital_run`, which this follow-up trips) | open; cloud agent (chain A, step 3): work in progress on branch `t-134-wip` |
| T-140 | [Dwarves walk too slowly for a day of needs](work/T-140-walking-speed-and-need-errands.md) | T-123 and [`../reports/audits/2026-10-08-economy-at-default-priority.md`](../reports/audits/2026-10-08-economy-at-default-priority.md) | T-144 (the work share is re-measured after it), T-145 (`npm run test:perf` includes the sweep) | open: walking speed is ×1.5; two Done items wait |
| T-144 | [Talking, sitting and the hearth visit take a quarter of the day](work/T-144-wants-without-errands.md) | T-123 and [`../reports/audits/2026-10-08-economy-at-default-priority.md`](../reports/audits/2026-10-08-economy-at-default-priority.md) | — | open; cloud agent (chain A, step 2): done on branch `t-144` with T-197 and T-198, red only on a wild badger (T-196); to be landed and closed |
| T-145 | [The economy fixture plays at default priorities](work/T-145-economy-fixture-default-priority.md) | T-123 and [`../reports/audits/2026-10-08-economy-at-default-priority.md`](../reports/audits/2026-10-08-economy-at-default-priority.md) | T-144 | open; cloud agent (chain A, step 5) |
| T-150 | [A year in the browser is played through the real UI](work/T-150-full-year-through-the-ui.md) | T-114 and [`../reports/audits/2026-10-08-playthrough-coverage.md`](../reports/audits/2026-10-08-playthrough-coverage.md) | — | open; local side |
| T-151 | [A defence year: traps, a gate, a trained squad, a raid repelled](work/T-151-defence-year-scenario.md) | T-114 and [`../reports/audits/2026-10-08-playthrough-coverage.md`](../reports/audits/2026-10-08-playthrough-coverage.md) | T-140, T-141 | open; cloud agent (chain A, step 6): three stages are on master, the raid stage remains |
| T-156 | [The long fixtures check their own steps, and the sweep asserts what it exercises](work/T-156-long-fixtures-check-their-steps.md) | T-114 and [`../reports/audits/2026-10-08-playthrough-coverage.md`](../reports/audits/2026-10-08-playthrough-coverage.md) | T-145 | open; local side, held until the cloud agent has closed T-145 (same fixture files) |
| T-196 | [Wild predators kill civilians outside the walls, and livestock starve on pasture](work/T-196-wild-predators-and-civilians.md) | T-151 and the T-188 re-measure | — | in progress; cloud agent on `cloud/T-196`; the capture is in `reports/data/2026-10-10-wildlife-capture.md` |

The latest balance evidence is in [balance-status.md](balance-status.md). Walking speed is ×1.5 since T-140's measurement. B-008 through B-012 await T-144 (the three wants as errands) (the stalled still) and T-145 (the fixture at default priorities); their measurement journal is in the [decision archive](archive/decisions-archive.md).
