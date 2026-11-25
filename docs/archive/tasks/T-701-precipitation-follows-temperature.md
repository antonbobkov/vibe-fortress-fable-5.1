# T-701 — Snow falls at 11 °C and rain at −2 °C

**Closed:** 2026-11-24, in 6d6da63e,cfc441a4.

**Source:** playtest 2026-11-24 ([report](../../../reports/data/2026-11-24-playtest.md), finding 3) · **Size:** M · **Needs:** — · **Status:** open

## Why

On a temperate spring site (world `deep-522-1`, region 42,30, Farmstead) the status bar read "* snow 11°C" on day 7, with the whole surface white under snow cover (`reports/data/2026-11-24-playtest/39-day7.png`, `42-wolf-view.png`), and "Snow begins to fall." came on days 3, 7 and 23 of spring with the bar at 11 °C. Sampled hourly over days 15 to 19 the same game showed "rain −2" and "rain 5" in one state.

06 § Weather transitions applies `SNOW_C` once, when a state is drawn, against the hour before; the state then lasts 4 to 36 hours (`constrain` in `src/systems/weather/transitions.ts`, called only from the draw in `weather/index.ts`). A snow drawn at a 0 °C dawn keeps snowing through an 11 °C afternoon, and snow cover is laid all that time and melts only once the snow ends. It matters beyond the bar: 08 § Pastures and feeding says snow-covered grass cannot be eaten, so a warm-day snow keeps the grazers from the grass (the same game's pasture starved, finding 2); and a rain below freezing waters crops and lays mud where snow should lie.

## What to do

Decision: **precipitation follows the temperature every hour.** Each weather tick, after the hour's temperature is computed, a `snow` state whose `surfaceTempC` is above `SNOW_C` becomes `rain`, and a `rain` or `storm` state at or below `SNOW_C` becomes `snow`, keeping the state's end tick (no new draw, so the transition table and the durations are unchanged). The change is a `WeatherChanged` like any other, announced as now ("Snow begins to fall." only when it turns to snow). A `frostmarrow` site keeps its rule (rain and storm are always snow there). The draw-time constraint stays, so a state never starts on the wrong side.

Spec: 06 § Weather transitions (the hourly rule), § Effects if a sentence there assumes the state is fixed for its duration.

This moves every fortress's weather, so world hashes and the scenarios that cross a snow or a cold rain move: update the goldens the change predicts, and run the twenty-seed sweep and the annual instrument.

## Done

- [ ] Tests: a snow state whose hour warms past `SNOW_C` turns to rain at the next weather tick and lays no more cover; a rain whose hour cools to `SNOW_C` turns to snow; a frostmarrow rain is snow; the state's end tick is kept.
- [ ] Sweep and instrument verdicts in the commit body; goldens moved with a `golden:` paragraph.
