# T-767: the needs-met floor and ordinary need pressure

**Task:** T-767 · **Date:** 2026-11-25 · **Code:** master `ba3b6e90`; the rule at `43a550e6` on branch `t767-needs-floor` · **Source:** [the T-767 work file](../../docs/archive/tasks/T-767-needs-met-floor-gives-way.md), [T-763's report](2026-11-25-t763-first-week-misery.md)

## How

T-763's probe (`test/perf/t763_first_week_probe.test.ts`), the same 40 timelines: seeds `deep-5589-1`, `probe-2` … `probe-5`, shifts 0, 17, 331 and 613, busy and with a meeting area, 14 days each. T-767 adds to it, for every dwarf-hour: the hour of the day; whether the floor holds the dwarf at exactly 20 with no need pressure; for each Miserable hour, the floored need pressure `P`, which need thoughts made it and whether each is *pressing* (at least halfway from its want threshold to its critical one: hunger and thirst 67.5, rest 75, read from the thought's value without the personality's scale), and whether the hour is floor-bound (mood = 20 − P) or raw-bound (raw mood under 20 but above 20 − P). It also replays each Miserable hour under five candidate floor rules: since a Miserable mood has a raw mood under 20, a rule keeps it at 20 exactly when its floor pressure floors to 0.

```
T763_PROBE=1 T763_SEEDS=<seed> T763_SHIFTS=0,17,331,613 T763_OUT=<file> npx vitest run -c vitest.perf.config.ts test/perf/t763_first_week_probe.test.ts
```

One process a seed, about a minute each.

## Found on master (`ba3b6e90`)

Master has moved since T-763 (`a2713f8d`): the same probe gives fewer miserable hours (busy days 1–4: 38 against T-763's 65).

| | busy (20 runs) | with a meeting area (20) |
|---|---|---|
| Dwarf-hours | 46,827 | 47,040 |
| Held at exactly 20 by the floor, no pressure | 55 | 21 |
| Miserable dwarf-hours, 14 days (days 1–4) | 687 (38) | 914 (45) |
| … of them raw-bound | 539 | 710 |
| … at pressure 1, 2, 3, 4 | 47, 39, 45, 34 (165, 24%) | 69, 48, 50, 45 (212, 23%) |
| Runs with a dwarf Miserable by day 2 / 4 / 7 / 14 | 1 / 4 / 10 / 14 | 1 / 5 / 12 / 17 |

The floor itself rarely holds a dwarf at 20 with nothing pressing (55 and 21 dwarf-hours, about 0.1%): a dwarf whose negatives reach `NEGATIVE_CAP` nearly always carries some need pressure too, so the floor's work is done at 20 − P, and P is what decides whether it is Miserable. A quarter of the Miserable hours are at a pressure of 1 to 4: the floor giving way to a point or two of tiredness, thirst or loneliness.

**By hour of the day** (busy; game hours 0–23):

| Hour | 0 | 2 | 4 | 6 | 8 | 10 | 12 | 14 | 16 | 17 | 18 | 20 | 22 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Miserable hours | 29 | 25 | 29 | 33 | 32 | 23 | 25 | 34 | 31 | 36 | 34 | 29 | 23 |
| Mean pressure | 6.8 | 7.8 | 8.2 | 8.3 | 9.2 | 9.0 | 10.0 | 9.1 | 7.2 | 6.7 | 6.8 | 7.8 | 6.9 |
| … at pressure 1–4 | 9 | 4 | 3 | 5 | 5 | 6 | 4 | 8 | 11 | 12 | 11 | 6 | 8 |

Small pressure breaks the floor most in the late afternoon and evening, hours 16 to 19, before the sleep window (20 to 23): that is an evening's tiredness. The midday hours carry the heaviest pressure, which is thirst. With a meeting area the shape is the same.

**What makes the pressure** (busy, Miserable hours, `!` pressing): `thirsty!` alone 277 (the embark's drink runs out from day 12; neglect), `thirsty` not pressing 50, `lonely` (pressing or not) 80, `lonely` with thirst 60, then smaller mixtures. Over the first week the case of the work file shows clearly in each dwarf's first Miserable hour: of the 32 first Miserable lines by day 7 over the 40 timelines, 19 are a restless, sensitive dwarf with nothing it may do (Knud Ironheart, Yrsa Copperpick, Brand Coldsong, Hrolf Boarheart; `restless` and `bored` −10.4 each, `uncomfortable` −5.2) on its fourth to seventh day, 16 of them at a pressure of 1 to 4, mostly tired or a little thirsty, with `lonely` 0 to 1.8. The others are the gregarious dwarves of T-763 (Dain Brighteye, Ulfar Ironfist, Oddvar Flintaxe, Asgeir Ravenfoot, Halla Granitestone), `lonely` −5 to −13, and Torfi Coldshield, thirsty and tired at 10.

**Candidate rules** (Miserable hours each would keep at 20, of 687 busy / 914 with a meeting area):

| Rule | busy | meeting | days 1–4 |
|---|---|---|---|
| `half`: hunger, thirst and rest lower the floor only once pressing; `lonely` always | 94 | 105 | 2 of 38; 5 of 45 |
| `half+social`: the same, `lonely` from social 75 | 154 | 220 | 2; 5 |
| `flat3`: the floor drops by pressure over 3 | 131 | 167 | 2; 4 |
| `flat4`: over 4 | 165 | 212 | 2; 4 |
| `flat5`: over 5 | 200 | 255 | 2; 4 |

The misery of days 1–4 is lonely-made (29 of 38 and 35 of 45), which no rule here but T-766's touches. The floor case is days 4 to 7. The flat rules rescue more because they also forgive a few points of `lonely`, which T-766 decides; `half` is the one that keeps to the work file's question (ordinary hunger, thirst and tiredness) and is the smallest.

## The rule

**`half`**, 15 § Mood: `mood = max(raw, MOOD_NEEDS_MET_FLOOR − floorPressure)`, where `floorPressure` counts the need thoughts past their margin (hunger, thirst or rest at least `FLOOR_MARGIN_SHARE` = 0.5 of the way from want to critical) and `lonely`; `raw` and `needPressure` are unchanged, so a need thought still counts twice above the floor. Gap decided: a pressing thought counts in full, not only its part past the margin (the simpler rule; the floor then drops by 3 to 5 at once, as it did by 1 to 2 before). `lonely` has no critical threshold, so it always counts, and its share stays T-766's question.

The probe on the rule (`43a550e6`), same 40 timelines:

| | busy | with a meeting area |
|---|---|---|
| Miserable dwarf-hours, 14 days (days 1–4) | 593 (36), master 687 (38) | 809 (40), master 914 (45) |
| … at pressure 1, 2, 3, 4 | 15, 14, 20, 23 | 38, 23, 24, 26 |
| Runs with a dwarf Miserable by day 2 / 4 / 7 / 14 | 1 / 3 / 6 / 13 (master 1 / 4 / 10 / 14) | 1 / 4 / 10 / 17 (1 / 5 / 12 / 17) |
| Mean mood, days 1 / 4 / 7 / 14 | 52.6 / 46.8 / 43.3 / 36.8 (master the same, 36.7 on day 14) | 52.8 / 46.7 / 43.4 / 37.4 (the same) |
| First Miserable lines by day 7 | 24 (master 32) | |

The rule removes 94 and 105 Miserable dwarf-hours, as replayed, and mean moods do not move. The restless, sensitive dwarves' first Miserable hour comes later or not at all in the first week (19 lines to 11; at a pressure under 5, 16 to 7); those that remain fall at a single point of `lonely` (social about 58) or a pressing need.

## The sweep, and the decision

Sweeps, living at year 3 / dwarf deaths, by shift 0, 50, 100, 150 and pooled, paired on one base:

| Run | Commit | Shift 0 | 50 | 100 | 150 | Pooled |
|---|---|---|---|---|---|---|
| [45776840989](https://github.com/antonbobkov/vibe-fortress-fable-5.1/actions/runs/45776840989) | `ba3b6e90`, master (the base) | 1163 / 118 | 1179 / 115 | 1169 / 110 | 1174 / 97 | **1171.25 / 110** |
| [45777368709](https://github.com/antonbobkov/vibe-fortress-fable-5.1/actions/runs/45777368709) | `43a550e6`, the rule | 1199 / 113 | 1145 / 128 | 1169 / 110 | 1164 / 102 | **1169.25 / 113.25** |

Both verdicts pass (bounds ≥ 1046.63 living, ≤ 132.5 deaths), neither flags a seed worth tracing, and every seed job is green.

Paired seed for seed, 75 of the 80 timelines end year 3 exactly as on master: a three-year fortress rarely has a dwarf on the floor at a small pressure, so the rule seldom engages. The five that differ: `p4-2` at shift 50, 52 living / 4 dead → 19 / 18 (12 bled out, 6 killed, 23 raids against 21: raids landing differently); `p2-7` at 150, 65 / 7 → 55 / 12; `p2-5` at 0, 24 / 9 → 56 / 8; `p2-4` at 0, 56 / 13 → 60 / 9; `p2-3` at 50, 66 / 11 → 65 / 10. One timeline's raid shuffle (`p4-2`+50) is the whole of the rise in deaths and more; the others net out. Need deaths: none in either.

Defence check [45777372304](https://github.com/antonbobkov/vibe-fortress-fable-5.1/actions/runs/45777372304) on `43a550e6`: **pass**, raids turned back 7.50 of 8 (rule ≥ 5), a soldier killed 6.50 (≥ 4), dwarves killed by raids 1.13 a cadence, living at the end 26.67 a seed.

**Decision: adopted.** Paired deaths are 3.25 above the base (the bar: within about 8), living is 2 lower (the bar: no more than about 30 lower), and the defence verdict passes. 15 § Mood and `balance.md` § Mood floor carry the rule and `FLOOR_MARGIN_SHARE`; `test/unit/morale/t767-floor-margin.test.ts` checks it.

Left for later, not done here: the residual floor case is now a point or two of `lonely` (social about 58 for a sensitive dwarf), which lowers the floor in full; whether `lonely` should take a margin too (rule `half+social` above, social 75) belongs with T-766, which decides how `lonely` counts.
