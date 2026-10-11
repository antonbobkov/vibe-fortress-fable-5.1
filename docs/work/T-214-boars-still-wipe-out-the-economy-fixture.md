# T-214 — Three boars still wipe out the economy fixture after T-196

**Source:** T-144 and its re-measure, [`../../reports/audits/2026-10-10-wants-without-errands-after-t196.md`](../../reports/audits/2026-10-10-wants-without-errands-after-t196.md) (§ With wild animals) · **Size:** L · **Needs:** — · **Status:** open (diagnosis first)

## Why

`balance.md` § Wild animals promises that a careless fortress loses about one dwarf per animal and never the whole group. T-196 measured that with one animal against seven civilians for three days. Over a year, with the game's own wild arrivals, the economy fixtures on `cloud/T-144` do much worse (one run each, peril 0):

- Rewritten fixture, seed `three-years`: three boars kill 8 of 9 dwarves on days 19–32; the fortress is empty from day 51.
- Rewritten fixture, seed `three-years-p0-1`: three boars kill 24 dwarves on days 246–267; 1 of 28 is left on day 336.
- Old fixture (the one the perf-tier `three_years` plays), seed `three-years`: 15 dwarves bleed out to boars on days 45–117, 14 of them to two boars; empty by day 224.

On `cloud/main`, without T-144, the rewritten fixture on seed `three-years` loses one dwarf to a badger in three years, although boars are on its map for weeks; but the old fixture on `cloud/main` dies out, all nine dwarves killed by boars on days 24–35. So it is not T-144's doing: which run meets the boars fatally differs from run to run, for a reason not established. Without wildlife the two codes keep dwarves on the surface for the same share of time (33.6% and 34.8% of year 1).

## Reproduction

The probe [`2026-10-10-wants-without-errands-probe.ts.txt`](../../reports/data/2026-10-10-wants-without-errands-probe.ts.txt) as the report's Method describes, runs `new-asis-cloud`, `new-p01-asis-cloud`, `old-asis-cloud`; the spawn probe [`2026-10-10-wants-without-errands-after-t196-spawns.ts.txt`](../../reports/data/2026-10-10-wants-without-errands-after-t196-spawns.ts.txt). Two traced deaths (the probe's `T140_STUCK` watch, rewritten fixture, seed `three-years`):

- Dwarf 16777293 flees a boar, then alternates between `patient` (walking back to a hospital bed at (27, 5, 32)) and `flee`, with boar 16777702 one or two tiles behind, until it bleeds out at tick 22,582. The fortress alert stays `calm`.
- Dwarf 16777298 works a `clean_wound` job at (18, 1, 32) with boar 16777700 two tiles away, sleeps on that tile, and then flees two boars until it dies at tick 26,082.

## What the spec says

- `balance.md` § Wild animals: about one dwarf per animal for a careless fortress, never the whole group; none to a badger with a medic and a squad.
- `08` § Wild behavior: a defending animal lets go once its target is out of its provoke radius from where the attack began, or unconscious, and takes no second target from the same attack.
- `10` § Behavior selection, step 1: after fleeing, a dwarf starts no noncritical need or job within `THREAT_RADIUS` of the hostile's remembered tile; critical needs override. `11` § Assignment, step 1 applies the same to job candidates.
- `17` § Patients and hospitals: a conscious patient walks to a free hospital bed; medics treat patients wherever they lie. Neither says what a patient or a medic does about an animal still beside the bed or the patient.

## What to do

1. Trace every death of `new-asis-cloud` (and a sample of `new-p01-asis-cloud`): what brought the dwarf within reach (job, need, patient walk, medic job, flight), whether it had fled from that animal before, and whether the animal was defending or hunting.
2. Find why some runs share the map with boars unharmed for weeks and others lose everyone, with more seeds.
3. Classify each link as a code fault (the spec says avoid, the code does not), a missing rule (patient and medic near a remembered danger) or a balance number, and fix the faults with a failing test first. A missing rule is decided and written into `10` or `17`.
4. Re-measure both fixtures, both seeds, as is, for a year, with a dated report.

## Done

- Each link is classified, with evidence, in a dated report.
- The careless-fortress figure of `balance.md` § Wild animals holds in a year-long run of the rewritten fixture on `three-years` and `three-years-p0-1`, or `balance.md` says what holds instead.
