# Infection cure and annual wildlife tolerance guards, 2026-10-11

Runtime: `ef65bb6` plus the pending-cure correction. Unchanged twelve-seed
instrument opening, maps, food, farms, equipment and alert commands. No game
balance number changes.

## Correction and guard policy

Successful infection cleaning fixes its first cure deadline and stops further
cleaning requests for that wound. It stays a Patient until the infection cures.
A different untreated infection or uncleaned wound can still be selected, with
brightleaf only for the selected untreated infection; failure still consumes
inputs and remains a need.

The accepted policy tolerates at most two wildlife-free seeds or one median
survivor below the best measured figure. Worst-seed survival, extinctions and
need deaths cannot worsen. Any two of the five figures worsening together block
the change, comparing the actual latest before and after row. Keep the latest
accepted row separate from best guarded measurements: a previously tolerated
loss is not counted again when comparing a later change. Every accepted
improvement tightens its corresponding measured bound in the same commit.
The targets (median 11, minimum 8, zero need deaths) remain unchanged.

## Measurement

| Measure | Before | After |
|---|---:|---:|
| Median living | 12.5 | 12.5 |
| Minimum living | 0 | 3 |
| Wildlife-free years | 8/12 | 7/12 |
| Extinctions | 1 | 0 |
| Hunger/thirst-labelled dwarf deaths | 2 | 2 |

Best guarded figures after this change: median 12.5, minimum 3, wildlife-free
8/12, zero extinctions and two need deaths. Computed bounds: 11.5 / 3 / 6 / 0 / 2.
One figure worsens; two improve. The new policy accepts this correction, while
minimum survival and need deaths still miss the intended target.

The [before cohort](../data/2026-10-11-t220-baseline-after.json) and
[earlier corrected cohort and traced new death](2026-10-11-pending-infection-cure-annual-check.md)
are frozen separately. The [official re-run data](../data/2026-10-11-infection-cure-wildlife.json) matches every earlier corrected row and hash exactly; all twelve cases and the decided guards pass (859.19s).

Reproduction: `WILDLIFE_YEAR_OUT=<output> npm exec -- vitest run --config
vitest.perf.config.ts test/perf/wildlife_year.test.ts`. Reference rows and best
measured values live in `test/perf/wildlife_year_constants.ts`; the policy is
computed in `wildlife_year_measurements.ts`, with twelve permanent synthetic
controls. The cure itself has four stepped regressions, red on the merged
baseline before restoring the fix.

## Completed re-run

| Seed | Living | Hash |
|---|---:|---|
| wildlife-temperate_forest-1 | 10 | 9597d40513375b90 |
| wildlife-temperate_forest-2 | 10 | 0669c5f8cc08fb5b |
| wildlife-temperate_forest-3 | 11 | 3d8d964568337fba |
| wildlife-temperate_forest-4 | 13 | 490079551bd9defb |
| wildlife-taiga-1 | 10 | ea702c038ea00949 |
| wildlife-taiga-2 | 12 | da23f5960d18bc77 |
| wildlife-taiga-3 | 13 | 133fb9691c4aa045 |
| wildlife-taiga-4 | 3 | 1e9e8d5aa1ca337d |
| wildlife-temperate_grassland-1 | 15 | 99c7cdcab8764933 |
| wildlife-temperate_grassland-2 | 14 | f2db1e9cd1e340e9 |
| wildlife-temperate_grassland-3 | 15 | a351a2cb4835c5b2 |
| wildlife-temperate_grassland-4 | 14 | e4aca96c8403d490 |

Forest median/minimum: 10.5/10; taiga: 11/3; grassland: 14.5/14. Dwarf
wildlife deaths: twelve wolf, four boar and one badger. Two deaths are labelled
starvation; three fortress-animal losses are dogs killed by wolves. The annual
opening has no beds or hospital, so the treatment regressions separately prove
care with a bed, medicine-20 worker and real supplies. No fixture was tuned.

Verification: six static checks pass; 23 focused controls pass; full suite
269 files / 2374 tests pass (603.65s); whole browser suite 25 pass (4.0m),
screenshots restored; twelve annual cases pass (859.19s). Browser before/after:
seven living, hash `54f0bf60c7e768c3`, no hunger/thirst death. No golden changes.
