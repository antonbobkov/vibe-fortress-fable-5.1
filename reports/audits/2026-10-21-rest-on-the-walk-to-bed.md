# Measurement: rest on the walk to bed (T-408), blocked by the annual instrument

**Task:** T-408 · **Date:** 2026-10-21 · **Commit examined:** `bd80aaa` with the T-408 change in the working tree (parked on branch `t408-wip`) · **Kind:** measurement of a code change that was not merged · **Source:** [the sleep measurement](2026-10-21-sleep-hours.md)

## The answer

- **The change does what the work file asks in the fortress.** With rest held on the walk to bed and falling only while the dwarf lies asleep, the economy fixture's first year has a work share of **35.9%** and a sleep share in use of **8.3%** at `REST_ASLEEP_PER_HOUR` −45 (before: 37.4% and 9.4%); both inside the work file's bands (35–39% and 8–11%). No sleep errand ends on lying down any more (0 of 4,501 in three seeds, against 20% to 29%); a dwarf walks 3.8 to 4.6 hours a day to its bed and lies in it 1.8 to 2.0.
- **The work file's first decision was amended.** Counting the walk as awake time, as decision 1 said, made the walk add tiredness: errands rose, the sleep share in travel rose from 16.7% to 18.3% and year-1 work fell to **32.3%**, below the band at −45 and at every rate that keeps the time in bed in its band. Holding rest on the walk (neither rising nor falling) keeps the time budget; 10 § Needs and § Sleeping were written that way in the parked change.
- **The annual wildlife instrument fails its guards, and the change is not merged.** Before (`bd80aaa`): median 13, worst 6, second-worst 9, sum of the living 144, 8 years without a wildlife death, no extinction, no hunger or thirst death. After at −45: median **11.5**, sum 137, 6 wildlife-free, **1** extinct, **10** hunger deaths; the median and the hunger-death bound fail. At −40 (the next step the work file allows): median 12, sum **104**, 5 wildlife-free, **3** extinct, **19** hunger deaths.
- **Every extinction and hunger death is a fortress starving behind a hearth alert that stands for weeks.** The instrument raises the hearth alert when a dwarf is attacked and lowers it only when no aggressive animal is within 40 tiles of the wagon. In `temperate_forest-4` at −45 a bear lay 25 tiles from the wagon from day 47 to the end: the alert stood 52,840 ticks, the sheltered dwarves could not farm, the food ran out and ten dwarves starved on days 89 to 92. At −40 `taiga-1` (27,680 ticks) and `taiga-3` (17,840) starve the same way. Before the change the longest alert was 11,280 ticks and nobody starved. The same seed `temperate_forest-4` lives at −40 (12) and −50 (10), so single seeds flip; whether the sleep rule makes long alerts more likely (dwarves now walking outside more often for sleep) is not established.
- **What follows:** the instrument's policy is filed as [the hearth alert held by a bear](../../docs/work/T-410-instrument-hearth-alert-held-by-a-denning-bear.md); T-408 waits for it and is then re-measured from the parked branch. No constant or rule of the merged spec changed.

## What was run

All at `bd80aaa`, one at a time: the figures are in `reports/data/2026-10-21-rest-on-the-walk-to-bed.json`.

| Run | Code | Result |
|---|---|---|
| Work-share probe (`reports/data/2026-10-18-t140-share-probe.ts.txt`), 336 days | before | year 1 work 37.4%, needs in use 19.8 / travel 40.8, rest in use 9.4 / travel 16.7; year 2 37.0%; year 3 30.1% |
| same | walk awake, −45 | year 1 work **32.3%**, rest in use 9.9 / travel 18.3; year 3 population 32 against 56 |
| same | walk held, −45 | year 1 work **35.9%**, rest in use 8.3 / travel 16.9; years 2 and 3: 33.9%, 32.3% |
| same | walk held, −40 | year 1 work 35.2%, rest in use 8.8 / travel 17.3; years 2 and 3: 36.0%, 30.0% |
| Year-one probe (`reports/data/2026-10-21-year-one.probe.ts.txt`), three seeds, 112 days | walk held, −45 | 1.12–1.24 errands a dwarf-day; 3.8–4.6 h walking, 1.8–2.0 h in bed; rest on lying down = rest at setting off (69–72); none ended on arrival; longest sleep 150 ticks |
| Annual instrument, 12 seeds | before / walk held −45 / walk held −40 | sum of the living 144 / 137 / 104; extinct 0 / 1 / 3; hunger deaths 0 / 10 / 19 |
| `wildlife-temperate_forest-4` alone (`reports/data/2026-10-21-t408-forest-4.probe.ts.txt`) | −45 / −40 / −50 | 0 / 12 / 10 living; a bear 25 tiles from the wagon holds the alert from day 47 at −45 |

Per-seed rows of the instrument (living): before 12, 13, 13, 9, 13, 6, 9, 11, 15, 14, 15, 14; after −45: 11, 11, 12, **0**, 13, 10, 11, 11, 15, 14, 15, 14; after −40: 12, **0**, 6, 12, **0**, 12, **0**, 4, 15, 14, 15, 14 (forest 1–4, taiga 1–4, grassland 1–4).
