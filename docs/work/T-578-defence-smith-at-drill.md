# T-578 — The defence year's smith drills while the squad's kit waits at the forge

**Source:** T-570's probe of `defence_year` ([data](../../reports/data/2026-11-16-t570-job-waits.md)) · **Size:** S · **Needs:** — · **Status:** open

`defence_year` plays the three-year economy at peril 2, where the anvil comes in the wagon, so the economy dedicates the seventh founder to the forge as its named worker (`checkArming`: the smith, and the founding mason as the chain's second hand) and orders the squad's mail, shields and swords at `KIT_FIRST`. The squad is made on day 1 from `MILITIA` (the woodcutter, the mason, the smith and the two miners), and from about day 40, once the barracks stand, the defence script sets it to `train`, full time. A soldier on duty does no civilian work (16), and a workshop with a named worker offers its job to nobody else (12), so the forge's job stood open from day 27 or 35 to the end of the run (197 and 189 days in T-570's two probes) and the fortress stays in its `arming` phase for good: the squad never gets its metal kit, and the economy's later phases that wait for it (the stone crafts staffed, the fuel worker, the export goods) never come.

## What was tried

T-570 handed a specialist role held by a soldier on duty (its labors and its workshop) to a free immigrant. In one probe of `defence_year` the metal chain then ran at `KIT_FIRST` with the general hands it took, and the routine work waited longer than before: the carpenter's job 128 days, the mechanic's 125, the drawbridge 123, and the fortress ended with 13 dwarves instead of 15. T-570 left it out.

## Done

The defence year's squad drills without holding the forge's only worker, or the forge's chain is staffed so that the kit is forged without starving the defence works; decided from a probe (`test/perf/t570_job_waits_probe.test.ts`, `-f suite=job_waits -f probe_seeds='"defence"'`) and `defence_seeds`, whose means must hold.
