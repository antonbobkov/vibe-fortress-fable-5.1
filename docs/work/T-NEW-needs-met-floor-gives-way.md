# T-NEW — A gloomy dwarf turns Miserable at the first point of ordinary tiredness or thirst

**Source:** T-763 ([report](../../reports/audits/2026-11-25-t763-first-week-misery.md), § With `lonely` counted once) · **Size:** M · **Needs:** — · **Status:** open

## Why

15 § Mood: `mood = max(raw, MOOD_NEEDS_MET_FLOOR − needPressure)`. A dwarf whose negative thoughts have reached `NEGATIVE_CAP` sits on the floor at 20, and the floor drops by every point of need pressure. One point is an evening's tiredness (rest just over 60) or thirst just over 50 on the way to a drink: the ordinary daily cycle, not neglect. In T-763's 40 first-fortnight timelines, with `lonely` counted once as T-763 tried, the first miserable dwarf by day 4 was still this case in 12: a restless, sensitive dwarf with nothing it may do (`restless` −10.4, `bored` −9.7), or a gregarious one holding `lonely` −13, tipped below 20 by tired −3 or thirsty −4. The same mechanism makes the tier flap through the day (T-714).

## What to do

Measure before deciding; do not retune in this task. With T-763's probe (`test/perf/t763_first_week_probe.test.ts`), record how often the floor is what holds a dwarf at 20 and how much pressure breaks it, by hour of the day. Then decide whether pressure below a margin (for example, under halfway from a need's want threshold to its critical one) should leave the floor at 20, and run the sweep: T-714 showed that a rule keeping dwarves lower for longer costs lives, so measure this direction with the same care.

## Done

- [ ] A dated audit report with the measurement and the decision.
- [ ] Either a spec and code change, with tests and a sweep, or a note in the report that the design stands.
