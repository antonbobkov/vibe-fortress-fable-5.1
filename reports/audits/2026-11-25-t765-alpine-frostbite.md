# T-765: an alpine default embark lost its party to frostbite

**Task:** T-765 · **Date:** 2026-11-25 · **Code:** master `1591d123`; the change at `bd5ce077` on branch `t765-alpine-frost` · **Source:** [the T-765 work file](../../docs/archive/tasks/T-765-alpine-embark-frostbite.md), [T-763's report](2026-11-25-t763-first-week-misery.md) § Seen in passing

## How

T-763's probe (`test/perf/t763_first_week_probe.test.ts`) on world seed `probe-5`: the standard world, the embarkable region nearest the centre (region 2080, alpine, mean −20 °C, temper 3, `old_battlefield` and `deep_well`), the Balanced preset, a newcomer's day-1 orders (a stair shaft four levels down beside the wagon with a 5 × 5 room at its foot, a chop box, a carpenter's workshop with four beds ordered, a stockpile). A diagnostic run of the same site logged each hour the weather, the surface temperature, each dwarf's tile temperature, whether it stood outdoors, its activity, every limb's hp and wounds, the cloth in the fortress, and every `LimbLost`, `NoDressing`, treatment and death.

```
T763_PROBE=1 T763_DAMAGE=1 T763_SEEDS=probe-5,probe-3 T763_VARIANTS=busy,meeting T763_SHIFTS=0,17,331,613 T763_DAYS=8 npx vitest run -c vitest.perf.config.ts test/perf/t763_first_week_probe.test.ts
```

## The cause chain on master

1. **The site is very cold.** Spring at a −20 °C alpine region is −13 to −20 °C by day and −24 °C on a clear night (06: `seasonBase` −18, the day curve ±6); snow adds −2 and lies as cover, and 05 makes a snow-covered tile 5 °C colder. The party's tiles read −25 to −30 °C most nights from the first.
2. **The party is outside all night.** With no hearth hall, 10 sends an idle dwarf to the wagon and a dwarf with no bed to sleep on the floor at the wagon. The room four levels below was dug by hour 36 and stood at 10 °C, but from the second night every dwarf idled and slept at the wagon, outdoors, at −29 °C.
3. **Frostbite stacked into amputation.** 17 checks every creature outdoors each hour; below `COLD_INJURY_C` (−25) it deals 5 damage to a random limb, half the time when clothed. The spec calls it a light wound, but the code dealt a flat 5 and let it stack: a dwarf's limb has 36 hp, frost wounds take five days to heal, and seven of them destroy the limb. By hour 69 the first limbs were at 1 or 0 hp.
4. **A destroyed limb bleeds.** 17 loses a destroyed limb with a grievous cut at the stump, bleeding 6 a health tick until bandaged. That was the "grievous cuts" of T-763's log: no animal, no fall, no ice. On a dog (12-hp limbs) or a cat (3) the flat 5 was a serious or grievous frost wound, and a grievous frost wound bleeds 1: the two dogs and the cat lost limbs on the first night and bled.
5. **No dressing was left.** The five linen every preset carries were all reserved by hour 29 and gone by hour 32: two of the four ordered beds took two cloth each (`make_bed`: a log and two cloth), and one bandaged a dog. The dogs and the cat bled out on day 2; from day 4 each dwarf whose limb fell (`LimbLost` at hours 80, 104, 121 …) raised `NoDressing` and bled out within hours. Six of seven dwarves were dead by day 7 in the diagnostic run, every one `bled_out`; T-763 saw six or seven in each of its four busy timelines.

Nothing said any of it before the first limb fell: the region panel showed "frozen, about −20°C", and a frost wound raised no line.

## What is a bug, and what is the climate

- **Bug:** frostbite severing limbs, and a heat or cold wound being serious or grievous on a small creature, against 17's "light wound". Fixed: the wound is light on any creature and, as a fall's, never takes a limb below 1 hp. Frostbite still hurts (5 pain a wound, stacking to unconsciousness at `PAIN_UNCONSCIOUS`) and still heals in five days.
- **Gap:** the dwarves had shelter dug and did not use it. Fixed: while the wagon is colder than `COLD_SHELTER_C` (−15 °C), the idle goal and the floor-sleep fallback is the first covered floor a walker reaches from the wagon (10 § Behavior selection, *Out of the cold*).
- **Climate, now said:** a −30 °C night is the site, and frostbite outside in it is meant. The region panel says so among the missing essentials, in the alert colour ("Frostbite from the first night: nights fall to about -31°C, and below -25°C dwarves outside are wounded. Dig a room underground on the first day; they idle and sleep there."), and the season's first frostbitten dwarf raises the `Frostbitten` alert naming the shelter.

## After the change

The same probe at `bd5ce077`, eight days:

| | busy (4 timelines) | with a meeting area (4) |
|---|---|---|
| `probe-5` dwarves alive on day 8 | 7, 7, 7, 7 | 7, 7, 7, 7 |
| `probe-3` dwarves alive on day 8 | 7, 6, 7, 7 | 7, 7, 7, 7 |
| Limbs lost to frostbite | 0 | 0 |
| Frost wounds on dwarves, days 1–5, `probe-5` | 12, 12, 56, 51 | not counted |

The one death on `probe-3` (busy, shift 17) is a snow leopard's: five bites on day 6 and the dwarf bled out, a wild beast and not the cold. The frost wounds still come, mostly on the first two nights before the room is dug and on trips outside for drink, and now cost pain and slow work rather than limbs. In the unit test of the same site, from the third day the party spent 87% of the hours the wagon was within ten degrees of frostbite under rock, against none on master.

## How often

Of the default sites of thirty worlds (`probe-1` … `probe-30`), fourteen are alpine; eight have frostbite from the first night (`probe-1`, `-2`, `-3`, `-5`, `-8`, `-14`, `-25`, `-26`), thirteen more in a later season, and nine never. Of all 44,126 embarkable regions of those worlds, 4,986 have frostbite from the first night and 19,127 in a later season. A later season's frostbite is common enough to be a note in the Climate row, not an essential.

## The linen

The bed order that emptied the wagon of linen on the first day is not the cold's doing, and it will meet the first cut of any busy fortress. Recorded as a follow-up (`docs/work/T-778-bed-order-eats-the-linen.md`), with the world map's habit of starting on such sites (`docs/work/T-779-default-site-frostbite.md`).

## Gates

The measurements at `bd5ce077`; CI ([45741766628](https://github.com/antonbobkov/vibe-fortress-fable-5.1/actions/runs/45741766628)) green at `adf2dc62`, with the two event tables CI found at `bd5ce077` ([45739043923](https://github.com/antonbobkov/vibe-fortress-fable-5.1/actions/runs/45739043923)) brought up to date: 4,954 unit tests and 47 e2e passed. The two verdict jobs stood queued on GitHub for over an hour behind other branches, so each verdict was run locally on its run's downloaded samples, with the same test the job runs (`three_years_sweep_verdict.test.ts`, `wildlife_year_verdict.test.ts`); every seed and sample job had passed on GitHub.

| | Pooled (4 shifts) | Shifts | Reference | Bounds | Verdict |
|---|---|---|---|---|---|
| Sweep [45739041464](https://github.com/antonbobkov/vibe-fortress-fable-5.1/actions/runs/45739041464): living at year 3 | 1171.25 | 1163, 1179, 1169, 1174 | 1151.75 | ≥ 1046.63 | pass |
| Sweep: dwarf deaths | 110 | 118, 115, 110, 97 | 98.25 | ≤ 132.5 | pass |
| Sweep: alive at year 1, peril-0 grown, need deaths, extinct | 20, 7, 0, 0 | | | | pass |

Master's latest sweep was about 1169 living and 110 deaths: the change does not move the twenty-seed file, whose sites do not reach the frostbite mark often. No seed is worth tracing.

| | Median | Worst | Second-worst | Sum of the living | Wildlife-free | Extinct | Starved years | Verdict |
|---|---|---|---|---|---|---|---|---|
| Instrument [45739057642](https://github.com/antonbobkov/vibe-fortress-fable-5.1/actions/runs/45739057642), pooled over 8 | 13 | 8.25 | 9.13 | 150.25 | 9 | 0 | 0 | pass |
| Reference | 12.94 | 9.63 | 10.5 | 151.88 | 9.38 | 0 | 0 | |
