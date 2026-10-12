# One bed per sleeper or patient: annual guard and fixture corrections

Measured 2026-10-11 on `f3a539f` plus the T-223 bed-hold patch in this commit.
[Raw annual output](../data/2026-10-11-bed-holds-wildlife.json) is compared with the
[accepted cure baseline](../data/2026-10-11-infection-cure-wildlife.json).

| Runtime | Median | Worst | Wildlife-free years | Extinctions | Hunger/thirst deaths |
|---|---:|---:|---:|---:|---:|
| Before bed holds | 12.5 | 3 | 7/12 | 0 | 2 |
| After bed holds | 12.5 | 3 | 7/12 | 0 | 2 |

Every seed record, including its world hash, is identical. The second-worst is
10 in both rows (derived from the twelve survivor counts). Forest median/minimum
is 10.5/10, taiga 11/3, grassland 14.5/14. The instrument passes all guards;
its survival targets remain unmet. It took 565.18 seconds. The fixture builds
workshops, a hearth and depot, but no bed or hospital; bed exclusion is exercised
by the dedicated stepped tests and `hospital_run`, not by this opening.

The whole e2e suite passes 25 tests in 4.0 minutes. Browser year before and after:
7 living, no hunger/thirst death, drink 101, meal 59, plant food 50, wealth 2840,
hash `54f0bf60c7e768c3`. The full suite passes 273 files / 2,417 tests in 429.36
seconds, and all six static checks pass. No golden changes.

## Small fixture corrections, with unchanged assertions

`hospital_run` failed twice on its required suture completion. Its medicine-0
worker 16777279 claims suture job 157 at tick 6765 and completes it at 7056;
the treatment fails. Patient 184549575 had been discharged at tick 6679 after
bandaging, so no replacement is produced. The [event trace](../data/2026-10-11-t223-failed-suture.json)
pins the living, unsutured target and worker skill. The scenario already sets
up a dedicated medicine-20 Chief Medic and asserts required care by rule. It
now enables medical labor only for that medic, including disabling it on its
staged laborers. There is no added capacity, extra bed, wound change, changed
supply or re-timing, and every assertion stays intact. The separate failed-job
retry fault is filed as [T-262](../../docs/archive/tasks/T-262-failed-treatment-after-discharge.md).

The synthetic command-sweep fixture's ready barley is automatically harvested
at tick 3461, while waiting for TradeOpen; setup ends at 3467 with no ripe crop
left for DesignateHarvest. Its existing single control crop is now created
on its original tile after the setup waits, so the control means what it says.
The field sweep and all 78 paused command controls, with their existing next-50-hash
assertions, pass. No assertion is weakened or removed.
