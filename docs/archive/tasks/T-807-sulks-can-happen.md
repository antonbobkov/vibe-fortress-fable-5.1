# T-807 — A neglected fortress has its small troubles: sulks that can happen after the first fortnight

**Closed:** 2026-11-27, in 6bb2ddaf.

**Source:** playtest 9 ([report](../../../reports/data/2026-11-26-playtest-9.md), finding 6); playtest 7 · **Size:** S · **Needs:** — · **Status:** done

## Why

The game puts sulks in place of tantrums: no violence, no spiral, a broken chair or a day off (15 § Sulks; `vision.md`). Nobles, mandates, strange moods and artifacts are left out on purpose (`scope.md`). So the sulk is the game's whole stock of characterful trouble, and it almost never happens:

- **Playtest 7:** no sulk in six years, at up to 80 dwarves (its driver logged `Sulk`).
- **Playtest 9, fortress A:** one sulk in 364 days, on day 14 ("argue"). By Year 4, 78 dwarves lived in a fortress with 17 bedrooms. The census read "bored ×72, no_bedroom ×61, restless ×58, thirsty ×45", with 1 Miserable and 11 Unhappy, and hall spirit Fine (52). Nobody sulked.
- **The counter never runs.** `sulkCounterDays` counts days on which the dwarf is Miserable at `DayPassed`, and decays by one on any other day. It was 0 for every dwarf in fortress A's saves at days 224 and 336, and in playtest 7's Year 7 save. Miserable came and went 312 times in fortress A ("tier→0"), yet the counter stood at 0 at every save: the misery passed within hours (mood is recomputed hourly), and never held at the day's turn seven days running.

The fortress in these playtests is never neglected enough to need a sulk. Its moments of trouble are flat lines in the log.

## What to do

A decision for the owner. Two options:

- **(a) Count the day, not the instant.** A dwarf who was Miserable for `SULK_DAY_HOURS` (6) or more hours of a day counts that day, and the counter decays only on a day with no Miserable hour. `SULK_DAYS` stays at 7. A fortress that leaves dwarves without beds, drink or company for a week sees sulks. One fed and housed does not, so the anti-spiral guarantee (15 § Mood) is unchanged.
- **(b) Leave it.** Sulks stay a first-fortnight event, and the game's character comes from elsewhere.

Recommendation: (a). A sulk is harmless by design, and it is the one thing that tells a player in words that the fortress is failing its dwarves. Measure it in the twenty-seed sweep: sulks per fortress-year, and that deaths do not move.

## Why it never runs (measured)

A probe of the three-year script sampled every fortress dwarf's tier each hour for 336 days on two seeds (on the T-806 code):

| Seed | Dwarf-days | With a Miserable hour | 6+ hours | Miserable at the day's turn | Sulks (rule then) | Sulks under (a) | Longest run of 6+ hour days |
|---|---|---|---|---|---|---|---|
| `three-years-p1-2` (peril 1, to 66 dwarves) | 10,943 | 202 (1.8%) | 50 | 41 | 0 | 1 | 7 |
| `three-years-p0-3` (peril 0, to 80 dwarves) | 14,261 | 88 (0.6%) | 28 | 20 | 1 (day 12) | 2 | 7 |

Two causes. First, a scripted fortress is rarely Miserable at all: the needs-met floor holds mood at 20 or above unless a need is past halfway to critical or the dwarf is lonely (15 § Mood, `balance.md` § Mood floor), and the script feeds and houses its dwarves. Second, when misery comes it is mostly short, 1 to 5 hours while a need rises and is met, spread evenly over the day, so the instant at `DayPassed` sees it on few of the days it happens. The counter reached 3 and 6 on these seeds but never 7.

## Decision

**(a), adopted** (§ Measured): a day counts with 6 Miserable hours or more (`SULK_DAY_HOURS`), a day with none takes one off, a day between keeps the count; `SULK_DAYS` stays 7. The hours are saved on `Mood` (`miserableHours`, omitted while 0), counted at each `HourPassed` recompute (`hourPassedDue` saved while one waits), and spent at `DayPassed`.

- A well-run fortress still sees almost none (1 or 2 a year in the probe, mostly in the hungry first fortnight); a neglected one, such as playtest 9's 78 dwarves with 17 bedrooms, sees them. That is the point: the sulk is the game's one word that the fortress is failing its dwarves.
- The days between (1 to 5 hours) keep the count rather than decay it, as the work file says ("decays only on a day with no Miserable hour").
- Only the `HourPassed` recompute counts an hour; the extra recompute a burial triggers does not, so no hour counts twice.

## Measured

The three-year sweep (twenty seeds at shifts 0, 50, 100 and 150), with the sweep's seed files counting sulks by kind. The rule was measured on top of T-806's code, its paired base:

| Code | Run | Living at year 3 | Dwarf deaths | Need deaths | Sulks (per fortress-year) |
|---|---|---|---|---|---|
| T-806 (the base; sulks by the day's turn) | 45929412665 | 1113.5 | 125.25 | 0.75 | 38 (0.16): argue 13, day off 15, weep 4, break 4, hoard 2 |
| T-806 + (a) | 45929962747 | 1120 | 122.75 | 0.5 | 188 (0.78) |
| master `9a13599a`, for reference | 45911220303 | 1139.75 | 108.5 | 0.25 | not counted |

Deaths are 2.5 under the paired base and living 6.5 over it, so the rule is adopted: about one sulk per fortress-year over the twenty seeds, five times the old count, with no deaths added. The defence seeds on the same code passed (run 45929965356: 7.00 of 8 raids turned back, 3.61 dwarf deaths a seed, against 7.00 and 3.19 on the base, run 45929415331).

## Done

- [x] The decision recorded here and in 15 § Sulks (and 02-systems/README, the data model, the component and state schemas).
- [x] (a): the hour count saved on `Mood`, the rule, a test that a dwarf Miserable 6 hours a day for 7 days sulks and one Miserable 1 hour a day does not (`test/unit/morale/t807-sulks-can-happen.test.ts`), and the sweep measured (§ Measured).
