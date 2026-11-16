# T-571 data: the sweep's living, by merge and by cause

Source: the `sweep` and `seed-*` artifacts of the Measure runs below (each seed's result file and its `[three_years_economy]` line, whose `immigration` list records every season's evaluation: spirit, wealth, eligibility, the roll and its probability, the wave's size). The tables were made with throwaway Python over the downloaded artifacts; the probe that adds the `growth` months to each result file is [2026-11-15-t571-growth-watch.probe.ts.txt](2026-11-15-t571-growth-watch.probe.ts.txt).

## Living is founders plus immigrants less deaths

Births are nil in every run (year-3 population = 7 + immigrants − deaths in every timeline, to within one dwarf). So a slower fortress is fewer or smaller waves.

## Every sweep since T-544, with the immigration rolls' luck taken out

Per sweep (means over the run's shifts). `fail` is the season rolls that came up "luck" (no wave); `expF` the number expected from their probabilities (700 + 2 × reputation permille); `excess` = fail − expF, so a negative excess is a lucky run. `adjLiv` = living + excess × the run's mean non-guaranteed wave size: living as it would be with exactly the expected number of failed rolls. `spir<55` is the evaluations skipped because hall spirit was under `IMMIGRATION_SPIRIT_MIN`; `tier3%` the share of rolled evaluations at Content (spirit ≥ 65), which adds two to a wave.

| run | commit | merges | shifts | living | immigrants | deaths | rolls | fail | expF | excess | wave size | adjLiv | spir<55 | tier3% |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 43573320107 | `4ab37734` | T-544 + T-545 (the reference) | 0–150 | 1024.25 | 1014.5 | 130.75 | 150.2 | 37.8 | 44.8 | −7.1 | 7.89 | 968.4 | 26.0 | 14.3 |
| 43573322208 | `4ab37734` | same | 200–350 | 972.25 | 928.8 | 96.75 | 153.0 | 47.5 | 45.6 | +1.9 | 7.60 | 986.3 | 24.8 | 17.2 |
| 43578896745 | `0236c0c7` | T-547 alone | 0–150 | 1052 | 1027.2 | 115.5 | 149.5 | 36.8 | 44.6 | −7.8 | 7.98 | 989.4 | 24.5 | 13.5 |
| 43585632340 | `a0f2aacd` | T-548 | 0–150 | 966 | 949.0 | 123.25 | 155.5 | 47.0 | 46.4 | +0.6 | 7.58 | 970.6 | 21.0 | 13.7 |
| 43595554569 | `3b7a3117` | T-548 + T-547 (= master `e203969c`) | 0–150 | 972.25 | 968.8 | 136.75 | 149.2 | 42.0 | 44.5 | −2.5 | 7.85 | 952.3 | 27.8 | 12.9 |
| 43762037484 | `3b7a3117` | same | 200–350 | 963.5 | 939.2 | 115.75 | 148.5 | 44.5 | 44.3 | +0.2 | 7.81 | 965.1 | 27.0 | 15.2 |
| 43605504391 | `52135744` | + T-553 | 0–150 | 968.5 | 951.2 | 123.5 | 149.2 | 41.8 | 44.5 | −2.8 | 7.67 | 947.1 | 26.0 | 13.9 |
| 43642004454 | `2334f26c` | + T-554, T-549, T-551 (= master `4eea2920`) | 0–150 | 955.25 | 927.8 | 112.5 | 148.0 | 42.0 | 44.1 | −2.1 | 7.55 | 939.1 | 27.5 | 13.9 |
| 43642144210 | `f03a68f6` | T-550 alone, on master `427fc9d0` | 0–150 | 964.5 | 959.8 | 135.5 | 151.0 | 42.8 | 45.1 | −2.3 | 7.69 | 946.8 | 25.2 | 12.9 |
| 43661653905 | `f5c91764` | master after T-551 and T-550 | 0–150 | 922 | 903.5 | 121.5 | 147.2 | 45.5 | 43.9 | +1.6 | 7.63 | 934.0 | 28.8 | 14.8 |
| 43660208893 | `6219173c` | + T-552 (= master `a97e17eb`) | 0–150 | 937.5 | 922.5 | 125 | 147.5 | 44.0 | 44.0 | 0.0 | 7.69 | 937.5 | 26.8 | 14.1 |
| 43661633075 | `9650b986` | + T-567's script (draft) | 0–150 | 922.75 | 899.0 | 116.75 | 143.5 | 40.2 | 42.8 | −2.6 | 7.48 | 903.5 | 32.2 | 11.7 |
| 43662587705 | `0d13619c` | master with T-548's conversions off | 0–150 | 908.75 | 889.8 | 121 | 145.2 | 44.2 | 43.3 | +0.9 | 7.55 | 915.7 | 33.5 | 14.5 |
| 43769154757 | `6b1b230f` | the same, without the probe | 200–350 | 956.75 (shift 250: 19 seeds) | | 117 | | | | | | | | |
| 43765955049 | `41e735d8` | master `b4750f39` + T-571's dormitories (+ the probe) | 0–150 | 1016 | 995.8 | 120 | 154.0 | 41.5 | 45.9 | −4.4 | 7.72 | 981.7 | 22.5 | 21.4 |

Commits whose sweeps came out identical seed for seed (the merges in between moved no timeline): `3b7a3117` and `715788a1` (T-554 on top of T-548 and T-547); `52135744` and `cba40aea` (T-549 on top of T-553 and T-554); `500d0720` and `2334f26c`. The probes' per-seed final hashes equal the plain runs' (40 of 40 for `4eea2920` against `2334f26c`; `three-years-p0-1` at shift 0 on `a97e17eb` against `6219173c`), so the probe changes no timeline.

The per-sweep standard deviation of living, from the spread of each run's four shifts, is 56 raw and 37 with the rolls' luck taken out: a 4-shift mean is ±28 raw and ±18.5 adjusted, an 8-shift mean ±13 adjusted.

Luck-adjusted means by period:

| period | runs | sweeps | adjusted living |
|---|---|---:|---:|
| T-544 merged with T-545 | `4ab37734` | 8 | 977 |
| after T-548, T-547, T-553 (and T-550 alone) | `3b7a3117` ×8, `a0f2aacd`, `52135744`, `f03a68f6` | 20 | 956 |
| after T-551 (with T-550, T-552, T-567, the no-conversions probe) | `2334f26c`, `f5c91764`, `6219173c`, `9650b986`, `0d13619c` | 20 | 926 |
| with the dormitories | `41e735d8` | 4 | 982 |

By peril (adjusted living per sweep): peril 0 is 460 for `4ab37734` (8 shifts), 449 to 460 in every later run, 454 with the dormitories; the reported 456 → 444 → 428 for peril 0 is the rolls' luck (`4ab37734`'s first four shifts failed 15.2 rolls against 18.4 expected; master `f5c91764`'s 21.8 against 18.6).

## Deaths by cause, per sweep

| period | sweeps | bled out | killed | infection | starvation | burnt |
|---|---:|---:|---:|---:|---:|---:|
| T-544 + T-545 | 8 | 56.6 | 46.2 | 8.5 | 1.6 | 0.4 |
| T-548 to T-553 | 16 | 70.9 | 48.5 | 6.9 | 2.9 | 0.1 |
| T-551 | 4 | 63.5 | 43.8 | 4.8 | 0.2 | 0.2 |
| after T-550 | 16 | 69.1 | 46.4 | 4.8 | 0.7 | 0.1 |

## Where the dwarf-time goes, before and after T-551, and with the dormitories

The probe (observation only) counts, every tick, each fortress dwarf: working (a job in hand while behaving `work`), on the sleep errand (walking to bed, rest already falling, or in bed), on an eat or drink errand; and each sleep's end (`Slept` on the floor, a pallet or a bed, or woken before it). Hours are per dwarf-day.

Master before T-551 (`427fc9d0` + probe, run 43762771314, shifts 0 and 50, 40 timelines):

| | work | sleep errand (walk / in bed) | eat and drink | floor share of sleeps | woken |
|---|---:|---|---:|---:|---:|
| first month | 51.73% | 6.08 h (2.90 / 3.19) | 2.88 h | 84.0% | 258 |
| year 1 | 36.93% | 6.28 h (4.12 / 2.16) | 4.82 h | 25.2% | 1,877 |
| year 2 | 31.84% | 6.34 h (4.20 / 2.13) | 5.17 h | 29.9% | 6,822 |
| year 3 | 30.90% | 6.23 h (3.56 / 2.66) | 5.38 h | 55.8% | 10,836 |

Master with T-551 (`4eea2920` + probe, run 43762773467, the same 40 timelines' seeds and shifts):

| | work | sleep errand (walk / in bed) | eat and drink | floor share of sleeps | woken |
|---|---:|---|---:|---:|---:|
| first month | 44.09% | 9.01 h (2.57 / 6.44) | 2.61 h | 88.1% | 3,448 |
| year 1 | 35.24% | 7.37 h (3.74 / 3.63) | 4.52 h | 28.4% | 7,155 |
| year 2 | 28.48% | 7.39 h (3.95 / 3.44) | 5.06 h | 27.2% | 15,208 |
| year 3 | 25.96% | 8.10 h (3.21 / 4.89) | 5.12 h | 51.2% | 18,215 |

Master `b4750f39` with the dormitories (`41e735d8`, run 43765955049, shifts 0 to 150, 80 timelines):

| | work | sleep errand (walk / in bed) | eat and drink | floor share of sleeps | woken |
|---|---:|---|---:|---:|---:|
| first month | 43.99% | 9.03 h (2.55 / 6.49) | 2.60 h | 88.9% | 6,885 |
| year 1 | 35.59% | 7.33 h (3.76 / 3.57) | 4.48 h | 27.4% | 14,747 |
| year 2 | 31.66% | 6.47 h (4.34 / 2.14) | 5.06 h | 3.1% | 23,792 |
| year 3 | 29.88% | 6.31 h (4.22 / 2.09) | 5.50 h | 0.7% | 34,389 |

The beds: `items.count('bed')` stays at 20 from day 196 on `three-years-p0-1` (the bed order is capped by the bedroom plans) while the population reaches 61; the bedroom plans number 16 to 20 per seed (48 × 48 map, the wagon at y 0 to 8, the south corridor's rooms cut off at the map's edge), the hospital among them.
