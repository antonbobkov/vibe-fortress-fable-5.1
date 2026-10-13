# T-301 — A bleeding patient in a hospital bed is not treated while cloth is in stock

> **Closed 2026-10-13** on the branch `t-301`: `a88d3cd` (the code, tests and spec edits) and the closing commit after the merge of T-308. The two guards that rejected `a88d3cd` were the subject of T-308: `defence_year` now stages its own casualties and passes, and the annual row 13 / 133 / 8 of 12 / 1 / 0 (median / sum of the living / wildlife-free / extinctions / need deaths) passes the guard on the sum. The links not fixed here are T-305, T-306 and T-307. The probe's dwarf of § Done cannot be shown to survive, because its trace does not repeat; `balance.md` § Wild animals is unchanged.

**Source:** T-145 and [`../../../reports/audits/2026-10-12-economy-fixture-at-default-priority.md`](../../../reports/audits/2026-10-12-economy-fixture-at-default-priority.md) (§ Wild animals) · **Size:** M · **Needs:** — · **Status:** closed

## Progress, 2026-10-12 (before T-308)

The diagnosis is [`2026-10-12-bleeding-patients-and-the-duty-guard.md`](../../../reports/audits/2026-10-12-bleeding-patients-and-the-duty-guard.md): nine links, each classified. The trace below does not repeat at `28e2eab`; its links are explained from the code and from three other traces.

On the branch `t-301`, one work-in-progress commit, with five stepped tests that fail first (`test/unit/health/t301-hospital-supplies.test.ts`) and the spec edits (10 § Behavior selection step 5; 11 § Job steps; 13 § Containers in play; 17 § Patients and hospitals; `algorithms/jobs-and-hauling.md`; `algorithms/creature-brains.md`):

- A hospital's built chest is stocked: the haul job stands beside the chest (`hauling.ts`, `createHaul`).
- What lies in a built chest is found and taken from a tile beside it (`api.ts` `tileOf`, `search.ts` `reached`, `board.ts` `fetchTile`, `build.ts` `holderTile`).
- A soldier called to duty gives its job back to the board (`brain.ts`, `select`).

It is not closed because two guards reject it, and neither was touched:

- `defence_year` in `npm test`: three dwarves bleed to death by day 35 where one did, and the squad has three members where the scenario asserts four.
- The twelve-seed instrument: before 13 / 8 / 0 / 8 of 12 / 1 / 0, after 13 / 6 / 0 / 8 of 12 / 1 / 0. The second-worst bound is 8. Forest seed 1 goes from 8 living to 13 and taiga seed 4 from 8 to 11; forest seed 2 from 10 to 6 and taiga seed 2 from 12 to 7.

Last run on the tree of `a88d3cd`: the six static checks (pass), `npm test` (2,544 pass, `defence_year` fails), `npm run test:e2e` (25 passed) and the instrument (rejected, as above). A first rule for T-307 was then tried on top and rejected as well (its work file).

## Decisions

- The spec was silent on how a dwarf reaches into a built chest, whose tile nobody stands on. Decided: from a walkable tile beside it, for the hauler and for the worker that takes an item out. The chest's linked item stays `installed`; only its contents have a tile, the chest's.
- The spec was silent on the job of a worker whose squad goes on duty. Decided: it is interrupted with its progress kept, like a job interrupted by an alert.
- Treatment inputs counted in units (T-305) and a call to the nearest worker (T-306) were written, tested and taken out again: the first failed the annual guard (13 / 0 / 0 / 8 of 12 / 2 / 0) and the second raised `defence_year`'s deaths from one to six. Both make a medic set out sooner, and T-307 is the likely reason that this kills.
- Needs T-307: in the one seed traced, a fix that makes treatment more likely moves deaths from patients to medics, because a medic walks to a patient that has its attacker beside it. T-307 measures this over the twelve seeds first.

## Why

`balance.md` § Wild animals promises that a fortress with a medic with cloth and a squad sent to kill the animal loses nobody to a badger. In the rewritten economy fixture a militia member with an iron spear is bitten by a badger, the squad kills the badger, and the dwarf bleeds to death in the hospital bed 560 ticks after the first bite, with five cloth and five thread in stock and four dwarves with the medicine labor alive.

## Reproduction

The probe [`2026-10-12-t145-probe.test.ts.txt`](../../../reports/data/2026-10-12-t145-probe.test.ts.txt), copied to `test/perf/` as a `.test.ts` file at the commit `edc0d48` of the branch `t-145`, run with `PROBE_END_DAY=45 PROBE_SPAWN_DAY=999` through `npm exec -- vitest run -c vitest.perf.config.ts <file>`: seed `three-years`, peril 0, the three-year economy fixture, no animal added by the probe. The trace is [`2026-10-12-t145-bleeding-soldier-trace.txt`](../../../reports/data/2026-10-12-t145-bleeding-soldier-trace.txt), one line every 20 ticks while the dwarf bleeds. The same death repeats on every run of the probe (three runs).

Dwarf 16777284 (the woodcutter, a squad member), day 44:

- tick 52,091: a badger is near, the alert goes to `hearth`, the squad gets a kill order.
- tick 52,211: admitted as a patient (`needs: stop_bleeding, clean_wound, diagnose`). Behaviour stays `duty` until about tick 52,520 (this part is T-211).
- tick 52,220 to about 52,520: `stop_bleeding` is claimed by dwarf 16777286 and stays in `fetching` for 300 ticks. A serious cut (bleed 3) is added at tick 52,260; blood falls from 616 to about 280 of 618.
- tick 52,540: the dwarf is `patient`, "Resting in hospital", at the hospital bed. `stop_bleeding` is `open` with no worker.
- tick 52,551: the alert returns to `calm`.
- tick 52,560 to 52,600: `stop_bleeding` and `suture` are `blocked: missing_input`, with 5 cloth and 5 thread in the fortress.
- tick 52,620 to 52,760: `stop_bleeding`, `suture` and `diagnose` are `open` with no worker for 140 ticks; `clean_wound` has been `fetching` since tick 52,220; the patient is unconscious from tick 52,580.
- tick 52,777: dies, `bled_out`.

Two more observations from the same probe (the report, § Wild animals):

- With three boars placed on day 35, a militia member takes a serious puncture and loses 700 blood in 260 ticks; `stop_bleeding` is claimed at once and is still `fetching` when the dwarf dies in the hospital bed.
- On day 35 and on day 60 all cloth and thread are on the surface (five of each in the wagon's container, the rest loose), though the hospital zone with its bed and chest has stood six levels down since day 12. A stockpile with the `hospital` preset beside the bed did not receive them either.

In the main scenario and the sweep at `ac88f56`, 19 militia bled out or died of infection after 14 + 22 alerts for a wild animal (runs 3 to 6 and the seven peril-0 seeds).

## What the spec says

- `17` § Patients and hospitals: medics treat patients wherever they lie; the hospital's chests are a stockpile that wants the supply counts.
- `11` § Assignment: a worker that asks for a job takes the best open one whose labor it has; under a `hearth` alert a civilian is offered only jobs for a patient.
- `balance.md` § Wild animals: a medic with cloth, and a squad sent to kill the animal: none to a badger.

## What to do

1. From the trace and a rerun with the job board's events, find why the first `stop_bleeding` claim fetches for 300 ticks (where the cloth was, whether the medic walked to a moving patient), what reserved the cloth when the job blocked `missing_input` (the hospital chest's stocking haul is the first suspect), and why nobody took the open job for 140 ticks in a calm fortress of eleven.
2. Classify each link as a code fault, a missing rule or a number, and fix the faults with a failing test first. Do not repeat T-211's part (the soldier that stays on duty).
3. Re-run the probe, and the twelve-seed wildlife year for its guards.

## Done

- Each link is classified with evidence in a dated report. (Done: the report above.)
- The probe's dwarf survives the badger, or `balance.md` § Wild animals says what holds instead.
