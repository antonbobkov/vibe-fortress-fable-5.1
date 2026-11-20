# T-661 — The only axe stays with a dwarf who cannot chop

**Source:** the fix for master's red sweep seed `three-years-p4-2` at shift 150 (branch `t653b-all-clear-fixes`, measure.yml run 44741164080), traced from saves · **Size:** S–M · **Needs:** — · **Status:** done

## Why

In that timeline the founder who came with the axe was the only woodcutter. He stood in the squad, lay in the hospital from about day 61 and later died. Other dwarves had the woodcutting labor, but a dwarf with no axe leaves a chop to one who carries an axe (11 § Assignment), and a held tool stays unavailable to searches while its holder keeps it (11 § Tools). So 6 to 8 chops stood open and untaken from day 61 to the end of the run, the fortress had no log from day 84, and its bedrooms' beds were never built. The three-year script now passes the woodcutter's trade to an idle dwarf and has the forge make a second axe, but a player's fortress would stall the same way, with nothing saying why.

## What to do

Decide how a tool held by a dwarf who cannot use it comes back to the fortress: a dwarf in a hospital bed, a soldier on long duty, a dwarf away for a long time; and check that a dead dwarf's tool is dropped where it can be found. One option: a held tool becomes available to a search once its holder has been away from `work` for `JOB_HOLD_TICKS` (the holder takes it up again, or another, when it returns). Another: the Jobs panel's wait reason (T-640's `jobWait`) says "the only axe is with Urist, in the hospital". Write the rule into 11 and test it.

## Done

A unit test where the only axe-holder lies in a hospital bed and an open chop is taken by another woodcutter (or the panel says why not); the sweep's verdict if the simulation changes.

- [x] **The rule** (11 § Assignment, a tool held from the fortress; `toolAway` in 11 § State and system-state.md): a pick, axe or launcher held as `Worker.toolId` by a worker that is down, a patient, or a soldier on duty with another weapon in its weapon slot is put down on its tile once that has lasted `JOB_HOLD_TICKS` (the count saved, ended by any tick that sees the worker able); a soldier on duty fighting with the tool keeps it. `dropToolsOfTheUnable` in `jobs/items-adapter.ts`. A dead holder's tool already dropped at its death tile and a dwarf's kit beside its corpse (11, 13; `t160-death-held-items`, `t541-fallen-soldier-kit`).
- [x] **The panel**: an open job whose tool only an absent dwarf holds, with none free, says so: "Nobody takes it yet: the only axe is with Urist, in the hospital. Make another, or wait for it to come back." (`tool_held` in `ui/job-wait.ts`; panels.md § Jobs).
- [x] **Tests** (`test/unit/jobs/t661-axe-held-by-absent.test.ts`): Urist, the only axe-holder, lies in a hospital bed with a broken leg; the panel names him, and after the hold Bob takes up the axe and fells the tree while Urist is still a patient; the count survives a save; a discharged holder keeps his axe; a soldier on duty puts down a spare pick and keeps the one it fights with.
- [x] **The script**: `keepWoodcutter` stays. Its second axe is no longer needed for a hospitalised or dead founder (his axe comes back), but it still is when he stands in the squad fighting with it, and passing the trade on is a player's labor choice.
- [x] **Sweep** (measure.yml run 44779584442 on `92dae2ea`, the branch merged with master's T-652 and T-657): Pooled 19.75 | 7 | 0 | 1059 | 142.5 | 1.25 | 9.25; **Verdict: pass**; all 80 seed jobs green. Before the merge, run 44758378154 on `1ce44fb9`: Pooled 19.75 | 7 | 0 | 1079.25 | 126 | 0.75 | 5, pass, all seeds green.
