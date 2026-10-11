# Pending infection cure: annual regression check, 2026-10-11

Runtime base: `b3d5450`; experimental T-137 changes are preserved in stash
`e3b1fed802d5bde466529aa3c5f086bb4d714a5c` (`T-137 pending cure fix parked: annual wildlife-free guard 7/12 below 8/12`).
The patch is not committed or landed. No fixture, guard, balance constant or
golden was changed.

## Result

| Measure | Before | Experimental fix |
|---|---:|---:|
| Median living | 12.5 | 12.5 |
| Minimum living | 0 | 3 |
| No wildlife dwarf death | 8/12 | 7/12 |
| Extinctions | 1 | 0 |
| Hunger/thirst-labelled deaths | 2 | 2 |

The twelve cases completed, but the wildlife-free-share assertion failed.
T-137 is parked rather than reducing its bound. Improved aggregate survival
alone does not satisfy every existing guard.

| Seed | Living before | Living after | Hash before | Hash after |
|---|---:|---:|---|---|
| wildlife-temperate_forest-1 | 10 | 10 | 9597d40513375b90 | 9597d40513375b90 |
| wildlife-temperate_forest-2 | 10 | 10 | 0669c5f8cc08fb5b | 0669c5f8cc08fb5b |
| wildlife-temperate_forest-3 | 8 | 11 | f6f4a649d620bea8 | 3d8d964568337fba |
| wildlife-temperate_forest-4 | 13 | 13 | 490079551bd9defb | 490079551bd9defb |
| wildlife-taiga-1 | 11 | 10 | 311261731680600a | ea702c038ea00949 |
| wildlife-taiga-2 | 12 | 12 | da23f5960d18bc77 | da23f5960d18bc77 |
| wildlife-taiga-3 | 13 | 13 | 133fb9691c4aa045 | 133fb9691c4aa045 |
| wildlife-taiga-4 | 0 | 3 | bc8d84f2fd386b22 | 1e9e8d5aa1ca337d |
| wildlife-temperate_grassland-1 | 15 | 15 | 99c7cdcab8764933 | 99c7cdcab8764933 |
| wildlife-temperate_grassland-2 | 14 | 14 | f2db1e9cd1e340e9 | f2db1e9cd1e340e9 |
| wildlife-temperate_grassland-3 | 15 | 15 | a351a2cb4835c5b2 | a351a2cb4835c5b2 |
| wildlife-temperate_grassland-4 | 14 | 14 | e4aca96c8403d490 | e4aca96c8403d490 |

## Trace

The new wildlife death is Palnir Mosssong, `wildlife-taiga-1`, tick 130407,
day 109, `bled_out`, wolf 855638252. Independent read-only event probes reproduce
both annual hashes (`311261731680600a` before, `ea702c038ea00949` after), so this
seed's difference is deterministic.

The first recorded difference is tick 78124, day 66: successful cleaning of
patient 16777297 sets deadline 81724 in both runs. Before, the patient still
requests cleaning; completions at 78413, 78617 and 79271 move the deadline to
82871, with cure/discharge at 82872. After, the need is empty and the cure and
discharge occur at 81727, the first health cadence at the original deadline.
This is the intended correction, followed by a different workforce trajectory.

In the changed run Palnir receives wolf wounds on day 106, is treated and
discharged at 127677, and is admitted again at 130192. At tick 130290 it is
`patient`, Resting in hospital, on surface tile (27,36,32), without a bed or
hospital zone; wolf 855638252 is hungry in `attack`. It remains a patient while
further attacks continue. The trace establishes the exposed patient's state;
it does not establish a new fault in pending-cure handling or prove the entire
causal chain between the earlier cure and this encounter. Patient danger is
already within T-214's diagnosis; admission interruption remains T-211.

## Verification and reproduction

Experimental patch: four permanent stepped regressions were red before, green
after (22 focused health controls pass); six static checks pass; full suite
265 files / 2353 tests pass (622.33s); whole browser suite 25 pass (5.2m),
screenshots restored. Browser before/after end states are identical: seven
living, hash `54f0bf60c7e768c3`, no hunger/thirst death. Annual run: twelve seed
cases pass, afterAll share guard fails (852.07s). No goldens move.

Annual command: `WILDLIFE_YEAR_OUT=<output> npm exec -- vitest run --config
vitest.perf.config.ts test/perf/wildlife_year.test.ts`. See the
[before rows](../data/2026-10-11-t220-baseline-after.json),
[after rows](../data/2026-10-11-t137-annual-after.json),
[before trace](../data/2026-10-11-t137-taiga1-before-trace.json),
[after trace](../data/2026-10-11-t137-taiga1-after-trace.json), and
[probe source](../data/2026-10-11-t137-trace.test.ts.txt).

The probe uses the unchanged annual fixture and observes events without commands
or mutations. In a Node Vitest config with project aliases, include the probe
copied as a test under `.vite/task-resume`; supply `TRACE_HASH` and `TRACE_OUT`.
The after probe ran against the patch; the before probe redirected the
`@systems/health` alias to a scratch copy of HEAD's health directory. Both assert
the corresponding full annual hash, rather than accepting an observer that
changed the run. The stash contains the patch and four permanent tests.
