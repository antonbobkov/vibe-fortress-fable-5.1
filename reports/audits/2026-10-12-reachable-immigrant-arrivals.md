# Reachable immigrant arrivals and the wildlife year, 2026-10-12

Runtime baseline: `1d1b1d4`; after: that commit with the T-260 working change.
Commands, farm capacity, supplied items, crop schedules and alert-policy rules
are unchanged. The new rule concerns which existing edge floor admits a wave.

## Measured cause

The [read-only arrival trace](../data/2026-10-12-t260-arrival-trace.json)
was captured on `cb30b9c`, after the clothing death handoff. At every sampled
step, Kettil Elkhelm and Modi Marblehall remain at `(0,0,32)`, tile 294912,
in a component disconnected from the wagon, with no reachable food or drink.
Their respective first observed positions are at ticks 33601 and 67201.
The sampler reads each world step and takes hourly samples before the step;
full item positions, flags, reservations and stock counts are read daily,
on first observation, and immediately before removal.

| Dwarf | First hourly critical thirst / hunger sample | Saved thirst / hunger maximum-since clocks | First daily damage request | Death |
|---|---:|---:|---:|---:|
| Kettil Elkhelm | 35400 / 36550 | 35800 / 37250 | 39601 | 54002, day 46 |
| Modi Marblehall | 69000 / 70150 | 69400 / 70850 | 73201 | 87602, day 74 |

Thirst reaches its three-day damage threshold first; hunger reaches its
seven-day threshold later. The health label `starvation` does not identify
which duration first caused the wasting. Neither dwarf completes a meal or
drink in the trace. They serve rest on the local floor but cannot create a
food or drink plan. Kettil has no remembered hostile; Modi first has one at
hourly sample 75200, after both critical crossings. All food and drink stacks
remain unreachable from their component even when critical needs override
avoidance. This is an arrival-selection game fault, rather than suppressed
critical needs or a missing farm command.

The daily samples in each first critical episode establish available stocks
at the same boundary as the needs and resource-position snapshots, before any
hearth retreat. Every listed food/drink stack is unreachable from the dwarf:

| Dwarf / critical need | Daily snapshot in first critical episode | Drinks available | Meals available | Plant food available | Reachable food/drink stacks |
|---|---:|---:|---:|---:|---:|
| Kettil Elkhelm / thirst | 36000 | 44 | 5 | 34 | 0 |
| Kettil Elkhelm / hunger | 37200 | 58 | 1 | 55 | 0 |
| Modi Marblehall / thirst | 69600 | 110 | 61 | 125 | 0 |
| Modi Marblehall / hunger | 70800 | 105 | 60 | 123 | 0 |

At removal, Kettil's fortress has 114 drinks (113 available), 60 meals (59
available), and 61 plant food (59 available); Modi's has 108 drinks, 63 meals
and 119 plant food, all available. The trace retains each stack's position,
container, carrier, flags, reservation and reachability. End stocks alone
were not used to diagnose access.

Before each staggered arrival, retain a valid planned tile, or choose another
walkable floor on the same edge connected to the hall/wagon. A blocked wave
waits at the existing arrival interval without redrawing members; save/load
and subsequent season evaluations preserve it. Other callers of the edge
helper keep their existing behavior.

## Twelve-seed measurement

Commands, each once in the foreground:
`npm exec -- vitest run -c vitest.perf.config.ts test/perf/wildlife_year.test.ts`.
The before run takes 565.35 seconds; the after run takes 583.32 seconds.
Both twelve-case suites and aggregate guards pass.

[Before raw rows](../data/2026-10-12-t260-before-wildlife.json),
[after raw rows](../data/2026-10-12-t260-after-wildlife.json).

| Figure | Before | After |
|---|---:|---:|
| Median living | 12.5 | 13 |
| Second-worst living | 9 | 9 |
| Single worst living, reported only | 0 | 0 |
| Years without a wildlife dwarf death | 8 | 8 |
| Extinct fortresses | 1 | 1 |
| Hunger/thirst-labelled dwarf deaths | 2 | 0 |

| Seed | Living before / after | Wildlife dwarf deaths before / after | Need deaths before / after |
|---|---:|---:|---:|
| wildlife-temperate_forest-1 | 10 / 10 | 3 / 3 | 0 / 0 |
| wildlife-temperate_forest-2 | 10 / 10 | 3 / 3 | 0 / 0 |
| wildlife-temperate_forest-3 | 0 / 0 | 9 / 9 | 0 / 0 |
| wildlife-temperate_forest-4 | 13 / 13 | 0 / 0 | 0 / 0 |
| wildlife-taiga-1 | 11 / 13 | 0 / 0 | 2 / 0 |
| wildlife-taiga-2 | 12 / 12 | 0 / 0 | 0 / 0 |
| wildlife-taiga-3 | 13 / 13 | 0 / 0 | 0 / 0 |
| wildlife-taiga-4 | 9 / 9 | 2 / 2 | 0 / 0 |
| wildlife-temperate_grassland-1 | 15 / 15 | 0 / 0 | 0 / 0 |
| wildlife-temperate_grassland-2 | 14 / 14 | 0 / 0 | 0 / 0 |
| wildlife-temperate_grassland-3 | 15 / 15 | 0 / 0 | 0 / 0 |
| wildlife-temperate_grassland-4 | 14 / 14 | 0 / 0 | 0 / 0 |

Only taiga seed 1 changes; the other eleven rows, including their hashes,
are byte-equivalent as data. Taiga seed 1 ends with all thirteen arrivals alive,
no deaths and no added supply or farm capacity. Its end stocks are 60 drinks,
23 meals and no plant food. Changing alert commands counted by the instrument
reflects its unchanged response policy reacting to different game events.

No guarded figure worsens against the fresh before row. Retain the better
historical second-worst (10), wildlife-free (8) and extinction (0) measurements;
raise best median to 13 and reduce best need deaths to zero. The resulting
bounds are median 12, second-worst 8, wildlife-free 6, extinction cap 1 and
need-death cap 1. Targets and tolerance constants do not change. The minimum
and extinction still miss the general survival target.

## Baseline instability since the previous accepted measurement

Before this arrival fix, the fresh baseline already has forest seed 3 extinct
rather than ten living, and taiga seed 4 living with nine rather than extinct.
The intervening behavior change is the corpse handoff in T-139. This is the
second distinct seed in the living instability record: forest seed 3, beside
the already-recorded taiga seed 4. No additional outcome class changes under
the arrival fix; no seed or guard is removed.

## Regression evidence

Five new T-260 tests fail on the old game: an isolated edge floor, a qualifying
floor between spread candidates, a blocked wave across save/load and a later
opened path, no redraw at a season evaluation, and revalidation between wave
members. The season-redraw assertion also failed independently with the first
entry fix installed. All 65 focused immigration/threat tests pass afterward.
No existing assertion or long-fixture setup has been edited.

## Full verification and browser records

All six static checks pass (50 tables / 1624 content rows; 1140 strings;
24 interfaces; 305 documents with zero broken links). npm test passes
277 files / 2438 tests in 769.33 seconds. The whole npm run test:e2e
passes 25 tests in 4.7 minutes; screenshots are restored. No golden moves.
The full-year before and after records are identical, including the hash.

```
Before
full-year end state: {"livingCount":7,"wealth":2840,"stocks":{"drink":101,"meal":59,"plantFood":50,"log":55,"stoneBlock":1},"waves":[{"day":29,"count":2,"guaranteed":true},{"day":57,"count":3,"guaranteed":true}],"caravanDay":{"hillfolk":45,"wildwood":73,"mountainhome":null},"trades":0,"starving":1,"alerts":[{"tick":66740,"level":"watchful"},{"tick":68800,"level":"calm"},{"tick":68860,"level":"watchful"},{"tick":71720,"level":"hearth"},{"tick":73740,"level":"watchful"},{"tick":75240,"level":"hearth"},{"tick":77460,"level":"watchful"},{"tick":77480,"level":"calm"},{"tick":77540,"level":"watchful"},{"tick":78960,"level":"hearth"},{"tick":79940,"level":"watchful"},{"tick":85040,"level":"hearth"},{"tick":85720,"level":"watchful"},{"tick":85740,"level":"calm"},{"tick":85780,"level":"watchful"},{"tick":87220,"level":"hearth"},{"tick":88100,"level":"watchful"},{"tick":88120,"level":"calm"},{"tick":88260,"level":"watchful"},{"tick":91020,"level":"hearth"},{"tick":91940,"level":"watchful"},{"tick":91960,"level":"calm"},{"tick":92120,"level":"watchful"},{"tick":93440,"level":"hearth"},{"tick":94040,"level":"watchful"},{"tick":94060,"level":"calm"},{"tick":94200,"level":"watchful"},{"tick":97580,"level":"calm"},{"tick":97860,"level":"watchful"},{"tick":98700,"level":"calm"},{"tick":99000,"level":"watchful"},{"tick":99880,"level":"calm"},{"tick":100120,"level":"watchful"},{"tick":101080,"level":"calm"}],"deaths":[{"day":60,"tick":71912,"kind":"dwarf","name":"Oskar Stonetongue","cause":"bled_out","killerId":50331976,"killerSpecies":"wolf","killerState":"attack"},{"day":62,"tick":74162,"kind":"dwarf","name":"Gefjun Runemark","cause":"bled_out","killerId":251658488,"killerSpecies":"wolf","killerState":""},{"day":65,"tick":77932,"kind":"dwarf","name":"Rurik Oakpick","cause":"bled_out","killerId":50331977,"killerSpecies":"wolf","killerState":"attack"},{"day":72,"tick":85392,"kind":"dwarf","name":"Sigrun Ashbrook","cause":"bled_out","killerId":50331977,"killerSpecies":"wolf","killerState":""},{"day":77,"tick":91247,"kind":"dwarf","name":"Halvar Cragspark","cause":"bled_out","killerId":318767379,"killerSpecies":"wolf","killerState":""}],"hash":"a4b660f007544cc3"}

After
full-year end state: {"livingCount":7,"wealth":2840,"stocks":{"drink":101,"meal":59,"plantFood":50,"log":55,"stoneBlock":1},"waves":[{"day":29,"count":2,"guaranteed":true},{"day":57,"count":3,"guaranteed":true}],"caravanDay":{"hillfolk":45,"wildwood":73,"mountainhome":null},"trades":0,"starving":1,"alerts":[{"tick":66740,"level":"watchful"},{"tick":68800,"level":"calm"},{"tick":68860,"level":"watchful"},{"tick":71720,"level":"hearth"},{"tick":73740,"level":"watchful"},{"tick":75240,"level":"hearth"},{"tick":77460,"level":"watchful"},{"tick":77480,"level":"calm"},{"tick":77540,"level":"watchful"},{"tick":78960,"level":"hearth"},{"tick":79940,"level":"watchful"},{"tick":85040,"level":"hearth"},{"tick":85720,"level":"watchful"},{"tick":85740,"level":"calm"},{"tick":85780,"level":"watchful"},{"tick":87220,"level":"hearth"},{"tick":88100,"level":"watchful"},{"tick":88120,"level":"calm"},{"tick":88260,"level":"watchful"},{"tick":91020,"level":"hearth"},{"tick":91940,"level":"watchful"},{"tick":91960,"level":"calm"},{"tick":92120,"level":"watchful"},{"tick":93440,"level":"hearth"},{"tick":94040,"level":"watchful"},{"tick":94060,"level":"calm"},{"tick":94200,"level":"watchful"},{"tick":97580,"level":"calm"},{"tick":97860,"level":"watchful"},{"tick":98700,"level":"calm"},{"tick":99000,"level":"watchful"},{"tick":99880,"level":"calm"},{"tick":100120,"level":"watchful"},{"tick":101080,"level":"calm"}],"deaths":[{"day":60,"tick":71912,"kind":"dwarf","name":"Oskar Stonetongue","cause":"bled_out","killerId":50331976,"killerSpecies":"wolf","killerState":"attack"},{"day":62,"tick":74162,"kind":"dwarf","name":"Gefjun Runemark","cause":"bled_out","killerId":251658488,"killerSpecies":"wolf","killerState":""},{"day":65,"tick":77932,"kind":"dwarf","name":"Rurik Oakpick","cause":"bled_out","killerId":50331977,"killerSpecies":"wolf","killerState":"attack"},{"day":72,"tick":85392,"kind":"dwarf","name":"Sigrun Ashbrook","cause":"bled_out","killerId":50331977,"killerSpecies":"wolf","killerState":""},{"day":77,"tick":91247,"kind":"dwarf","name":"Halvar Cragspark","cause":"bled_out","killerId":318767379,"killerSpecies":"wolf","killerState":""}],"hash":"a4b660f007544cc3"}
```
