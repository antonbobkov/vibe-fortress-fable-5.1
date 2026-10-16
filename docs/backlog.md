# Backlog

Every open item, and nothing else. A row is added when an item is accepted and deleted in the commit that closes it; git is the history. How to pick up, work and close an item is in [`process/agent-workflow.md`](process/agent-workflow.md).

- **Id.** New items take the next free `T-1nn`. The older ids below (`U-`, `F-`, `C-`, `B-`) keep theirs until they close; nothing new gets one.
- **Source.** The audit, report or plan that produced the item. An item without a source is not accepted.
- **Needs.** Items that must be closed first. "—" means it can start now.
- **Status.** `open`, `in progress (who or which branch)`, or `blocked (why)`.

**Who has what (2026-10-11).** The cloud agent ([`../agents/cloud-agent.md`](../agents/cloud-agent.md)) stopped on 2026-10-11 after closing T-111, T-196, T-144, T-197, T-198, T-199 and T-212; its log is [`../reports/cloud-agent-log.md`](../reports/cloud-agent-log.md). Everything open is the local orchestrator's again.

| Id | Title | Source | Needs | Status |
|---|---|---|---|---|
| T-113 | [A full gate run on the restructured repository](work/T-113-full-gate-run.md) | the owner, 2026-10-06 | T-140, T-145 (the performance tier includes the 20-seed balance sweep, which cannot pass before them) | open; local side (needs a quiet machine) |
| T-140 | [Dwarves walk too slowly for a day of needs](work/T-140-walking-speed-and-need-errands.md) | T-123 and [`../reports/audits/2026-10-08-economy-at-default-priority.md`](../reports/audits/2026-10-08-economy-at-default-priority.md) | T-145 (the work share is 28.4% in year 1 after T-144 and T-197, with 6.3% idle, and 14–17% in years 2–3 with 17–18% idle; re-measure with its work supply; `npm run test:perf` includes the sweep) | open: walking speed is ×1.5; two Done items wait |
| T-145 | [The economy fixture plays at default priorities](work/T-145-economy-fixture-default-priority.md) | T-123 and [`../reports/audits/2026-10-08-economy-at-default-priority.md`](../reports/audits/2026-10-08-economy-at-default-priority.md) | T-305 to T-307 and T-211 (the links of the bleeding-patient diagnosis that remain; no peril-0 seed is without a death while they stand), T-302 to T-304 (the sweep stops on them at perils 2 and 4) | open: the script is merged-ready and the scenario fails only "no dwarf died"; gaps are named in the work file |
| T-150 | [A year in the browser is played through the real UI](work/T-150-full-year-through-the-ui.md) | T-114 and [`../reports/audits/2026-10-08-playthrough-coverage.md`](../reports/audits/2026-10-08-playthrough-coverage.md) | — | open; local side. Three of four stages are on master (played through the UI with the clock paused, food margin and survival asserted; the day through the frame loop is the `frame-loop-day` spec). Stage 4 (trade, panel uses, save/load hash) is unverified work in progress on branch `t-150-stage4-wip` |
| T-151 | [A defence year: traps, a gate, a trained squad, a raid repelled](work/T-151-defence-year-scenario.md) | T-114 and [`../reports/audits/2026-10-08-playthrough-coverage.md`](../reports/audits/2026-10-08-playthrough-coverage.md) | T-140, T-141 | open; local side (the cloud agent stopped before it): three stages are on master, the raid stage remains |
| T-156 | [The long fixtures check their own steps, and the sweep asserts what it exercises](work/T-156-long-fixtures-check-their-steps.md) | T-114 and [`../reports/audits/2026-10-08-playthrough-coverage.md`](../reports/audits/2026-10-08-playthrough-coverage.md) | T-145 | open; local side, held until the cloud agent has closed T-145 (same fixture files) |
| T-331 | [More invariants, checked in every scenario](work/T-331-invariants-in-every-scenario.md) | the process review, [`../reports/audits/2026-10-15-process-review.md`](../reports/audits/2026-10-15-process-review.md) | — | open; after the medicine batch in worktree `sim` (the same systems) |
| T-333 | [Mark the spec numbers nobody has measured](work/T-333-unmeasured-spec-numbers.md) | the process review, [`../reports/audits/2026-10-15-process-review.md`](../reports/audits/2026-10-15-process-review.md) | — | open |
| T-312 | [KillRecorded's hostile flag is always false](work/T-312-kill-recorded-hostile-flag.md) | found during T-279 | — | open |
| T-340 | [The Depot panel names a stack of goods in the singular](work/T-340-depot-names-stacks-in-the-singular.md) | found in the T-332 review | — | open |
| T-341 | [A grazer can still loop on grass behind a no_pets door](work/T-341-grazer-loops-on-a-no-pets-door.md) | the review of T-335 | — | open |
| T-342 | [A confirmation names a work order by its index, and the game keeps running behind it](work/T-342-confirm-dialog-names-an-order-by-index.md) | the review of T-278 | — | open |
| T-343 | [A door locked by hand still traps a creature in its doorway](work/T-343-manual-door-lock-traps-a-creature.md) | the review of T-303 | — | open |
| T-344 | [Item haul planning costs time in proportion to the items that wait](work/T-344-haul-planning-cost-scales-with-waiting-items.md) | T-283, [`../reports/audits/2026-10-16-reference-fortress.md`](../reports/audits/2026-10-16-reference-fortress.md) | — | open |
| T-345 | [The workshops job producer visits every building every tick](work/T-345-workshops-producer-visits-every-building.md) | T-283, [`../reports/audits/2026-10-16-reference-fortress.md`](../reports/audits/2026-10-16-reference-fortress.md) | — | open |
| T-360 | [Measure brook drinking under wild animals](work/T-360-brook-drinking-under-wildlife.md) | the review of T-350 | — | open |

The latest balance evidence is in [balance-status.md](balance-status.md). Walking speed is ×1.5 since T-140's measurement. B-008 through B-012 await T-145 (the fixture at default priorities) and, for survival with wildlife, T-214; their measurement journal is in the [decision archive](archive/decisions-archive.md).
