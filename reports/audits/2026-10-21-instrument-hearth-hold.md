# Measurement: the instrument's hearth alert held at most three days (T-410)

**Task:** T-410 · **Date:** 2026-10-21 · **Commit examined:** `sim` at `dbc4819` (master `7b681df` with T-404, `87c4495`) · **Kind:** fixture change with before and after rows · **Source:** [rest on the walk to bed](2026-10-21-rest-on-the-walk-to-bed.md)

## The answer

- **The policy:** the annual instrument (`test/perf/wildlife_year_fixture.ts`) and the browser year (`test/e2e/full-year.spec.ts`) now lower a hearth alert to watchful 3,600 ticks (three days) after it was raised or after the last wild attack on a fortress creature, whichever is later, even when an aggressive animal is still within 40 tiles of the wagon. The rest of the policy is unchanged (at least 300 ticks of hearth, lowered sooner once no predator is near; 1,500 ticks before the next hearth). testing-strategy.md § E2E harness says so.
- **On the current game it moves one seed.** Before (the T-404 row, same code): median 13, worst 2, second-worst 8, sum of the living 140, 8 of 12 years without a wildlife dwarf death, no extinction, no hunger or thirst death. After: median **12.5**, worst 2, second-worst 8, sum **139**, **7** of 12, 0, 0. The only seed that changed is `temperate_forest-3`: its alert, which stood 10,580 ticks, ends at 3,600, and it loses one dwarf to a badger (13 to 12). The other eleven seeds end with the same world hash as before.
- **The guard rule:** every bound holds, but three of the five guarded figures worsen together (by one seed's one dwarf), which the combined-worsening rule blocks for a game change. This is a change of the instrument itself, and T-410's second decision is that its after row becomes the accepted row; it is accepted, `WILDLIFE_REFERENCE` is the after row, and the best figures that set the bounds (median 13, sum 148, 8 wildlife-free) are kept rather than re-derived, so the bounds do not loosen.
- **The browser year passes** (e2e: 27 passed); its alerts in the year are now at most three days long.
- Whether a fortress under T-408's sleep rule still starves behind a long alert (`temperate_forest-4` at −45, `taiga-1` and `taiga-3` at −40) is measured with T-408, rebased on this.

## What was run

The annual instrument at `dbc4819` with the fixture change (`…-t410-wildlife.json`); the before row is `…-t404-wildlife.json` (the same game code at `87c4495`). Living per seed, forest 1–4, taiga 1–4, grassland 1–4: before `12, 13, 13, 10, 13, 8, 2, 11, 15, 14, 15, 14`; after `12, 13, 12, 10, 13, 8, 2, 11, 15, 14, 15, 14`. Longest hearth alert per seed after: 300, 0, 3,600, 2,440, 0, 300, 700, 0, 0, 0, 0, 0 ticks.
