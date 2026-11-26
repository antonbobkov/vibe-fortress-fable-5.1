# T-767 — A gloomy dwarf turns Miserable at the first point of ordinary tiredness or thirst

**Source:** T-763 ([report](../../reports/audits/2026-11-25-t763-first-week-misery.md), § With `lonely` counted once) · **Size:** M · **Needs:** — · **Status:** done, adopted (see § Measured)

## Why

15 § Mood: `mood = max(raw, MOOD_NEEDS_MET_FLOOR − needPressure)`. A dwarf whose negative thoughts have reached `NEGATIVE_CAP` sits on the floor at 20, and the floor drops by every point of need pressure. One point is an evening's tiredness (rest just over 60) or thirst just over 50 on the way to a drink: the ordinary daily cycle, not neglect. In T-763's 40 first-fortnight timelines, with `lonely` counted once as T-763 tried, the first miserable dwarf by day 4 was still this case in 12: a restless, sensitive dwarf with nothing it may do (`restless` −10.4, `bored` −9.7), or a gregarious one holding `lonely` −13, tipped below 20 by tired −3 or thirsty −4. The same mechanism makes the tier flap through the day (T-714).

## What to do

Measure before deciding; do not retune in this task. With T-763's probe (`test/perf/t763_first_week_probe.test.ts`), record how often the floor is what holds a dwarf at 20 and how much pressure breaks it, by hour of the day. Then decide whether pressure below a margin (for example, under halfway from a need's want threshold to its critical one) should leave the floor at 20, and run the sweep: T-714 showed that a rule keeping dwarves lower for longer costs lives, so measure this direction with the same care.

## Measured (2026-11-25), and the decision

[Report](../../reports/audits/2026-11-25-t767-needs-met-floor.md). T-763's probe on master `ba3b6e90`, 40 first fortnights: the floor holds a dwarf at exactly 20 with no pressure in only 55 and 21 dwarf-hours (busy, with a meeting area; about 0.1%), because a dwarf at `NEGATIVE_CAP` nearly always carries some pressure; a quarter of the Miserable hours (165 of 687, 212 of 914) are at a pressure of 1 to 4, most of them in hours 16 to 19 of the day, before the sleep window. Of the 32 first Miserable lines by day 7, 19 are a restless, sensitive dwarf with nothing it may do, 16 of them at a pressure of 1 to 4.

Rule adopted (`half`): hunger, thirst and rest lower the floor only once at least `FLOOR_MARGIN_SHARE` (0.5) of the way from want to critical (67.5, 67.5, 75); `lonely` always. Gaps decided: a need past its margin counts in full; `lonely`, having no critical threshold, keeps lowering the floor as before (its margin, if any, is T-766's question). On the probe: Miserable dwarf-hours 687 → 593 and 914 → 809, runs with a dwarf Miserable by day 7 10 → 6 and 12 → 10, mean moods unchanged.

| Run | Commit | Living | Deaths | Pooled |
|---|---|---|---|---|
| 45776840989 | `ba3b6e90`, master (the base) | 1163, 1179, 1169, 1174 | 118, 115, 110, 97 | 1171.25 / 110 |
| 45777368709 | `43a550e6`, the rule | 1199, 1145, 1169, 1164 | 113, 128, 110, 102 | 1169.25 / 113.25 |

75 of 80 timelines are identical to the base; `p4-2` at shift 50 (4 → 18 dead, raids) is more than the whole rise. Defence check 45777372304: pass, raids turned back 7.50 of 8, a soldier killed 6.50. Within the bars (deaths within about 8, living no more than about 30 lower), so adopted.

## Done

- [x] A dated audit report with the measurement and the decision.
- [x] Either a spec and code change, with tests and a sweep, or a note in the report that the design stands.
