# T-448 — The annual instrument's maps are relief 0, which no real map is

**Source:** T-436 · **Size:** M · **Needs:** T-436 · **Status:** open

## Why

T-436 rescaled region relief so that any height difference gives relief 1 or more. In twelve standard worlds no region is relief 0 now, so every real site has slopes, ramps, ridges and crags. The annual wildlife instrument (`test/perf/wildlife_year_fixture.ts`) builds its twelve maps from region specs with relief 0, so it measures a level surface that the game no longer generates. Adding relief-0 swells moved the instrument from 13/6/7/142/8/0/0 to 12.5/0/1/127/7/1/0. Terrain shape matters to survival, and the instrument should measure the terrain players get.

## What to do

1. Give the instrument's region specs the relief their biomes have in generated worlds: the median relief of that biome over the twelve standard worlds, or a stated value per biome.
2. Measure the instrument before (relief 0) and after, twice each if the noise warrants, and record both rows in a dated report.
3. This is a fixture change (testing-strategy.md § Annual wildlife survival). The after row becomes the reference by the orchestrator's decision, with the bounds re-derived from it, as T-410 did.
4. Look at what changes. If survival falls sharply on realistic relief, file the cause, for example wildlife reaching dwarves faster over ramps, or flight paths blocked by crags. Do not tune in this task.

## Done

- The instrument's maps have realistic relief.
- The before and after rows are in a report, and the reference row is updated by the orchestrator's decision.
- The three-year fixture (48 × 48) is checked the same way. If its regions are relief 0 too, apply the same change and run the twenty-seed file before and after.
