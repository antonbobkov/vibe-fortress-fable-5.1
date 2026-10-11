# Pack prey size and pastured grazers

**Date:** 2026-10-11 · **Task:** T-218 · **Code measured:** `57cace7` on `codex-a`
(the same runtime was measured before that checkpoint commit); its LF-normalized
runtime fingerprints are in [the year data](../data/2026-10-11-t218-pack-years.json).
**Follows:** [T-212's hungry-predator report](2026-10-11-hungry-predators.md).

## The rule and the result

A living pack judges an animal's size against the members that perceive that quarry,
counted up to three. A lone wolf still cannot take a sheep. Two or three nearby wolves
can take sheep or goats, three can take pigs, and even four cannot take a cow. Fourteen
regressions pin size, perception, pack identity, sharing and release when a pack shrinks;
seven failed on the previous code. No existing constant was tuned.

The year comparison added one male sheep, goat and cow to each fortress's existing
pasture. Wolves killed a goat in the exposed pasture on forest seed 2, and a goat and
sheep in its enclosure. Every other grazer death recorded was starvation, not a wolf
kill. The enclosed case on that seed already had wolves inside when it was built:
**this is not evidence that wolves crossed a door**. In the other five seeds, no
pastured grazer was killed by a wolf in either geometry. The sample does not show
livestock wiped out everywhere and gives no reason to change the accepted cap to two.

The short boundary control puts the enclosure in place before its wolves: in 6,000
ticks the exposed pasture loses one sheep and has three wolves inside; the enclosure
loses no grazer and never has a wolf inside. The goat and cow survive both controls.

## The 24 year cases

Each cell is **dwarves killed by wolves / supplied grazers killed by wolves**.
All four columns use the six seeds `t212-<biome>-1..3`, peril 0. Each starts with
three supplied grazers, so 18 are at risk in each column. The cow is never wolf prey.

| Seed | Ignore, exposed | Ignore, enclosure | React, exposed | React, enclosure |
|---|---|---|---|---|
| Taiga 1 | 8 / 0 | 7 / 0 | 7 / 0 | 3 / 0 |
| Taiga 2 | 0 / 0 | 13 / 0 | 0 / 0 | 13 / 0 |
| Taiga 3 | 0 / 0 | 3 / 0 | 0 / 0 | 2 / 0 |
| Forest 1 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| Forest 2 | 7 / 1 | 3 / 2 | 3 / 1 | 4 / 2 |
| Forest 3 | 9 / 0 | 0 / 0 | 4 / 0 | 0 / 0 |
| Total | 24 / 1 | 26 / 2 | 14 / 1 | 22 / 2 |

| Outcome over six fortresses | Ignore, exposed | Ignore, enclosure | React, exposed | React, enclosure |
|---|---|---|---|---|
| Grazers killed by wolves | 1 goat | 1 goat, 1 sheep | 1 goat | 1 goat, 1 sheep |
| Grazers dead of starvation | 9 | 9 | 12 | 13 |
| Grazers still alive at stop | 8 | 7 | 5 | 3 |
| Fortresses extinct before the year ended | 3 | 3 | 2 | 2 |

These are modified-fixture figures, not a before/after comparison with the original
T-212 fortress, which had no grazers. They do not certify a competent player's defence:
workers still leave the settlement, the squad forms on day 10, and several fortresses
stop early after losing all their dwarves. All 86 wildlife-attributed dwarf deaths in
this sample have a wolf killer. A door around a pasture is not a defence for outside
workers. The poor whole-fortress outcomes still need T-220's diagnosis.

## Starting condition and the door trace

[Setup snapshots](../data/2026-10-11-t218-setups.json) record when the shared fortress
setup returned: forest seeds 1/2/3 at ticks 612/7,605/539; taiga seeds 1/2/3 at
688/707/677. Thus forest seed 2 adds its grazers and enclosure on day 7, after its
first wolf pack has already arrived. The other five start on day 1 with no wolves.

The [entry trace](../data/2026-10-11-t218-door-entry-trace.json) shows wolf `117440619`
walking to `(27,26,32)` at tick 6,924, **before** the enclosure is placed at 7,605.
Its first attack on the goat is at 7,612 from `(26,24,32)` to `(25,23,32)`, inside
the pasture. Another wolf is on the future perimeter at setup. The prebuilt setup
helper can enclose existing creatures; this is not a normal player's completed
construction sequence. Do not infer a breached or ineffective door from this case.
The enclosure at day 1 on the other five seeds, and the short control with wolves
outside, lose no grazer to wolves.

Of the 43 recorded grazer starvation deaths, 42 occur in winter on days 92?97. The
remaining cow dies on day 34 in the extincting forest-2 reacting enclosure. Some
runs stop with living grazers because the last dwarf died first; their later fate
was not measured. The pasture and winter-care question belongs to T-210. Neither
the year script nor its farms, food stocks, production timing or military kit was
tuned for these measurements.

## Reproduction and verification

The [year probe](../data/2026-10-11-t218-probe-year.test.ts.txt) derives from T-212's
probe and uses the unchanged shared fortress script on its generated 48 × 48 map,
wealth 2, mixed geology, brook, forest/taiga and no trait. It adds the three male
grazers after setup, preventing breeding between the supplied animals. Exposed is
the existing pasture; enclosure adds a prebuilt granite perimeter and an unlocked
oak door. Neither enlarges the pasture. Non-wolf arrivals are removed at the first
ten-tick loop after setup, as in T-212. No other wild species killed a dwarf here.

`ignore` follows the script's raid response; `react` also raises watchful, activates
its squad and orders each wild attacker killed, then stands down after 600 quiet
ticks. Both have the script's day-10 squad, not a new early defence. A run measures
112 elapsed days, or stops when no fortress dwarf remains. Full runs label their
endpoint day 113 because day labels start at one. Daily pasture condition and grass,
quarry identities, causes and killer identities are in the year data.

Copy the year source and [config](../data/2026-10-11-t218-probe.config.ts.txt) to
`.vite/task-resume/t218-probe-year.test.ts` and `t218-probe.config.ts`; run
`npm exec -- vitest run --config .vite/task-resume/t218-probe.config.ts` with
`T212_SEED`, `T212_BIOME`, `T212_MODE=ignore|react`, `T212_ONLY=wolf`,
`T212_DAYS=112`, `T218_ENCLOSURE=open|door` and `T212_OUT` set.
The [batch runner](../data/2026-10-11-t218-run-years.py.txt) runs the 24 cases.
Only revision-3 records enter the frozen data: earlier pilots with an open entrance
but walls around the pasture were discarded and repeated with exposed geometry.

The [setup probe](../data/2026-10-11-t218-setup.test.ts.txt) uses
[its config](../data/2026-10-11-t218-setup.config.ts.txt) and `T212_DAYS=0` to capture
starting positions; [the trace source](../data/2026-10-11-t218-door-trace.test.ts.txt)
and [config](../data/2026-10-11-t218-trace.config.ts.txt) use forest seed 2, ignore,
door, and 12 days. The saved trace keeps the first attack and its movement history;
the source reproduces all attacks. The [short-control source](../data/2026-10-11-t218-door-short.test.ts.txt),
[config](../data/2026-10-11-t218-short.config.ts.txt) and
[data](../data/2026-10-11-t218-door-short.json) isolate a three-wolf arrival on a flat
map, with no natural surface arrivals, no dwarves and no initial intruders.

Verification of the runtime checkpoint: all six static checks; 2,321 tests in 259
files; the whole e2e suite, 25 tests. The browser full-year end state is identical
before and after: nine of twelve dwarves alive, wealth 2,735, stocks 100 drink /
58 meals / 46 plant food, hash `9321580b8c3227e1`. No survivor floor or golden moved.
The report/closure commit repeats the static checks and full test suite.
