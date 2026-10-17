# Backlog

Every open item, and nothing else. A row is added when an item is accepted and deleted in the commit that closes it; git is the history. How to pick up, work and close an item is in [`process/agent-workflow.md`](process/agent-workflow.md).

- **Id.** New items take the next free `T-1nn`. The older ids below (`U-`, `F-`, `C-`, `B-`) keep theirs until they close; nothing new gets one.
- **Source.** The audit, report or plan that produced the item. An item without a source is not accepted.
- **Needs.** Items that must be closed first. "—" means it can start now.
- **Status.** `open`, `in progress (who or which branch)`, or `blocked (why)`.

**Who has what (2026-10-11).** The cloud agent ([`../agents/cloud-agent.md`](../agents/cloud-agent.md)) stopped on 2026-10-11 after closing T-111, T-196, T-144, T-197, T-198, T-199 and T-212; its log is [`../reports/cloud-agent-log.md`](../reports/cloud-agent-log.md). Everything open is the local orchestrator's again.

| Id | Title | Source | Needs | Status |
|---|---|---|---|---|
| T-113 | [A full gate run on the restructured repository](work/T-113-full-gate-run.md) | the owner, 2026-10-06 | T-140 (T-145 is closed; the performance tier includes the 20-seed balance sweep) | open; local side (needs a quiet machine) |
| T-140 | [Dwarves walk too slowly for a day of needs](work/T-140-walking-speed-and-need-errands.md) | T-123 and [`../reports/audits/2026-10-08-economy-at-default-priority.md`](../reports/audits/2026-10-08-economy-at-default-priority.md) | — (T-145 closed 2026-10-17: re-measure the work share with its fixture) | open: walking speed is ×1.5; two Done items wait |
| T-150 | [A year in the browser is played through the real UI](work/T-150-full-year-through-the-ui.md) | T-114 and [`../reports/audits/2026-10-08-playthrough-coverage.md`](../reports/audits/2026-10-08-playthrough-coverage.md) | — | open; local side. Three of four stages are on master (played through the UI with the clock paused, food margin and survival asserted; the day through the frame loop is the `frame-loop-day` spec). Stage 4 (trade, panel uses, save/load hash) is unverified work in progress on branch `t-150-stage4-wip` |
| T-151 | [A defence year: traps, a gate, a trained squad, a raid repelled](work/T-151-defence-year-scenario.md) | T-114 and [`../reports/audits/2026-10-08-playthrough-coverage.md`](../reports/audits/2026-10-08-playthrough-coverage.md) | T-140, T-141 | open; local side (the cloud agent stopped before it): three stages are on master, the raid stage remains |
| T-156 | [The long fixtures check their own steps, and the sweep asserts what it exercises](work/T-156-long-fixtures-check-their-steps.md) | T-114 and [`../reports/audits/2026-10-08-playthrough-coverage.md`](../reports/audits/2026-10-08-playthrough-coverage.md) | — (T-145 closed 2026-10-17) | open; local side, held until the cloud agent has closed T-145 (same fixture files) |
| T-360 | [Measure brook drinking under wild animals](work/T-360-brook-drinking-under-wildlife.md) | the review of T-350 | — | open |
| T-370 | [The held-job release: spec wording, the away flicker, a longer world-order guard](work/T-370-held-job-release-nits.md) | found by the simulation agent and reviews | — | open |
| T-364 | [Measure farm yield](work/T-364-measure-farm-yield.md) | T-333, the unmeasured-numbers report | — | open |
| T-365 | [Measure the work pace](work/T-365-measure-work-pace.md) | T-333, the unmeasured-numbers report | — | open |
| T-366 | [Measure the combat pace](work/T-366-measure-combat-pace.md) | T-333, the unmeasured-numbers report | — | open |
| T-367 | [Measure wound recovery and infection](work/T-367-measure-wound-recovery-and-infection.md) | T-333, the unmeasured-numbers report | — | open |
| T-368 | [Measure renown and raid size](work/T-368-measure-renown-and-raid-size.md) | T-333, the unmeasured-numbers report | — | open |
| T-369 | [Seven hours of sleep against the measured sleep](work/T-369-sleep-hours-against-the-measured-sleep.md) | T-333, the unmeasured-numbers report | — | open |
| T-380 | [Year-1 wealth of the economy fixture is two to three times the model](work/T-380-year-one-wealth-above-the-model.md) | T-145's peril-0 sweep | — | open |
| T-381 | [Measure raid sizes at peril 2 with the economy fixture](work/T-381-raid-sizes-at-peril-2-with-the-economy-fixture.md) | T-145's peril-0 sweep | — | open |
| T-382 | [The game says when a hearth alert has locked every dwarf outside its gate](work/T-382-alert-locks-everyone-outside.md) | T-363 | — | open |
| T-383 | [A craft job's unit search enumerates every matching item, one search at a time](work/T-383-find-units-enumerates-every-match.md) | T-344 and its review | — | open |
| T-384 | [Waiting items are not parked in a fortress with a hospital](work/T-384-parking-is-off-with-a-hospital.md) | T-344 and its review | — | open |

The latest balance evidence is in [balance-status.md](balance-status.md). Walking speed is ×1.5 since T-140's measurement. Of B-008 to B-012, read against T-145's peril-0 sweep (2026-10-17): B-009, B-011 and B-012 are closed; B-008 (year-1 wealth above the model) is T-380 and B-010 (raid sizes at peril 2) is T-381. Their older measurement journal is in the [decision archive](archive/decisions-archive.md).
