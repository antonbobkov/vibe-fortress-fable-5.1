# Measurement: seven hours of sleep against the measured sleep

**Task:** T-369 · **Date:** 2026-10-21 · **Commit examined:** master `a5cd51c` · **Kind:** measurement, code reading and spec correction; no constant, formula or content value was changed · **Source:** [unmeasured spec numbers](2026-10-17-unmeasured-spec-numbers.md) § Contradictions found, 1

## The answer

- **The balance model's "7 hours of sleep per 24" is wrong; the rest rates are right; the measured 2 hours in bed is a code fault.** The three figures the contradiction named measure different things, and each is now explained.
- **When sleep ends.** A sleep ends when rest reaches 0, or after `SLEEP_HOURS`, whichever is first, and the dwarf wakes with rest 0 (`src/systems/dwarves/activities.ts`, and `creature-brains.md` already says "sleep until N.rest <= 0 or SLEEP_HOURS elapsed"). 10 § Sleeping said instead that a dwarf "sleeps `SLEEP_HOURS` unless rest is below 20"; it now says what the game does. Rest falls 15 an hour asleep and starts a sleep at most at 100, so a sleep lasts at most 6.7 hours and `SLEEP_HOURS` (7) is never the limit: of 3,363 sleeps in the probe's three fortress-years none reached it (the longest was 349 ticks, a minute's rounding short of it). By the rates (+5 an hour awake at Endurance 50, −15 asleep) rest balances at **6 hours asleep a day**, not 7.
- **What the game does: about 6 hours a day on the sleep errand, 2 of them in bed.** In the first year of the economy fixture (three seeds, 3,766 dwarf-days) a dwarf starts 1.15 to 1.24 sleep errands a day (1.14 to 1.20 in the walking-speed report), spends **3.9 to 4.7 hours a day** walking to its bed and **1.7 to 2.3 hours** in it: 6.0 to 6.4 hours, the rates' 6. It sets off with rest at a median 69 to 71 and lies down with **26 to 32**: the walk has taken 39 to 45 off its rest. **20% to 29%** of the sleep errands end the moment the dwarf reaches its bed, with rest already 0, after a walk of a median 270 ticks. 99% end at rest 0.
- **Why: rest falls at the sleeping rate during the walk.** 10's hourly need update counts a dwarf as asleep when its behaviour is `need` and its activity `sleep`, and the activity is set to `sleep` when the sleep errand starts, before the walk. 10 § Needs says rest falls "−15 per hour asleep". The measured share of sleep in use (9%, the balance model's table) and in travel (17%) are the walk and the bed of this rule; the walking-speed report's 118 to 121 ticks in use per errand are the bed.
- **The decision:** the spec keeps its rule (rest falls only asleep) and the code is to follow it, without moving the measured time budget that T-140's work share (37%) rests on: rest falls only while the dwarf lies asleep, and `REST_ASLEEP_PER_HOUR` is raised so that the time in bed stays about 2.4 hours a day (−45 an hour gives 24 × 5 / 50 = 2.4 at Endurance 50), confirmed by the work-share probe. With −15 and the walk not counted, a dwarf would sleep 6 hours in bed and walk 3 to 4 more, and the work share would fall by about a fifth of the day. Filed as [rest falls on the walk to bed](../../docs/work/T-NEW-rest-falls-on-the-walk-to-bed.md).
- **The spec now says one thing:** `balance.md` § Needs and consumption gives rest 6 hours asleep by the rates and the measured 2 in bed with the reason; 10 § Sleeping says when a sleep ends; `SLEEP_HOURS` in 10's table says it is the longest sleep and never reached. The audit's mark for `SLEEP_HOURS` ("disagrees with 7 hours") is answered here.

## What was run

`reports/data/2026-10-21-year-one.probe.ts.txt` (a vitest file under `test/perf`, not committed as a test; the same run as [year-1 wealth](2026-10-21-year-one-wealth.md)), at `a5cd51c`: the three-year fixture at peril 0, seeds `three-years`, `three-years-p0-2`, `three-years-p0-3`, 112 days each. After every tick it reads each dwarf's activity plan from 10 and records each rest errand from its start to its end: rest at the start, on lying down (the plan's `use` phase) and at the end, ticks walking and ticks in bed, the dwarf's Endurance, whether it was the scheduled sleep and whether a `Slept` event closed it. `…-year-one.json` holds the summary (`…-year-one-summary.mjs.txt`).

| Seed | Errands a dwarf-day | Hours a day walking / in bed | Rest at start / on lying down (median) | Ended on arrival | In bed per sleep, median ticks |
|---|---:|---|---|---:|---:|
| `three-years` | 1.19 | 3.93 / 2.29 | 69.6 / 31.6 | 280 of 1,432 | 112 |
| `three-years-p0-2` | 1.24 | 4.74 / 1.67 | 68.6 / 26.3 | 412 of 1,451 | 87 |
| `three-years-p0-3` | 1.15 | 4.36 / 1.76 | 71.2 / 29.1 | 421 of 1,601 | 97 |

Mean Endurance 49 to 55. The scheduled sleep (at `sleepStartHour`, rest above 20) starts at a median rest of 43 to 49 and is a tenth of the errands; the rest start at the want threshold of 60, a median 69 to 71 because a job of priority up to `NEED_DEFER_PRIORITY` comes first.

## What this does not measure

- Years 2 and 3, and a fortress whose bedrooms are nearer the work.
- The change itself: its effect on the work share is predicted from the rates, not run.
