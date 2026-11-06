# Measurement: the sweep after T-482, and the three-year fortress that outgrew its food

**Task:** T-507, widened by the orchestrator · **Date:** 2026-11-05 · **Commits examined:** `947c303c` (T-501, the master before T-482), `d96cfc9c` (T-482 merged) and `d2f68294` (T-508 merged, today's master), each unshifted and one and two ticks later (the same code with `w.step(n)` before the opening, on throwaway branches, now deleted); the fix on the T-507 branch over `d96cfc9c` and over `d2f68294` · **Kind:** a timeline-noise measurement, a food journal, one fault in the three-year script fixed · **Source:** [the T-507 work file](../../docs/work/T-507-three-years-food-under-growth.md), [T-482's report](2026-11-05-t482-pets-heap.md#the-sweep), [T-508's report](2026-11-05-t508-idle-dwarves-by-the-hearth.md)

## The answer

- **T-482's sweep was mostly chance; one part of it may have been real, and T-508 has taken it away.** Over three timelines each, the living at year 3 do not move: 894 on average before T-482 (spread 831 to 980), 884 after it (855 to 924), 895 on today's master (841 to 930). Need deaths and extinctions do not move either: they come from single seeds in single timelines on every commit. Deaths other than hunger did rise with T-482 in all three samples (148 to 192, against 93 to 143 before), in the peril-2 and peril-4 fights; on today's master they are back to 123 to 135. The rise is not shown to be T-482's beyond doubt (three samples), and it is gone, so the heap and the stale-walk fix were not taken apart.
- **`three-years-p0-3` starving is not chance: it is a fault of the three-year script, on every commit.** It starves 23 on T-482's master and on today's master one and two ticks later, 4 before T-482 (one tick later), 1 on today's master unshifted. Its cave farm is on the west side of the stair (T-455 moves it there when the east side opens to the hillside), and the script laid the four cave strips, the farm's only room to grow, east of the stair as if the farm were there: in solid rock, joined to nothing. The first strip's 32 digs stood `blocked (unreachable)` from day 60 to the end, the script waited for them to be dug before planning another, and the cave seed bought for them (90 dimcap by day 126, 186 by day 245) lay in stock for three years. The cave farm stayed at the wagon's 32 tiles while the fortress grew from 7 to 67.
- **Why that starves a growing fortress.** The surface farm grows with the dwarves but harvests only in spring and early summer, and nothing in winter; the cave farm is the only food from day 308 to day 336. 32 cave tiles fed 28 dwarves; they cannot feed 55 to 67. Meals ran out in the spring of year 3 (day 238) and again in late autumn (day 301); 23 died in winter.
- **The fix:** `caveStripTiles` in `three_years_economy.ts` mirrors the strips about the stair when the farm is west of it, and takes only rock joined to the farm or an earlier strip, so a strip can always be dug. A strip tile whose designation is gone without being dug no longer holds the next strip back. With it, `p0-3` digs all four strips (172 cave tiles by day 252) and ends year 3 with 74 dwarves and no death on today's master (80 on T-482's). It changes only the four seeds whose cave farm is west of the stair (`p0-3`, `p0-6`, `p2-2`, `p2-4`); the other sixteen are tick for tick the same.
- **A second fault, left to its own task.** The script sows surface crops that cannot ripen before winter: strawberries and barley in the second half of summer, turnips at the end of autumn. The frost killed 101 such crops in year 2 and 165 in year 3 on `p0-3`, with their seed. A rule is written and measured once (branch `t507-food-b`), but it moves every seed's timeline, so it is [T-NEW: the three-year script sows crops too late](../../docs/work/T-NEW-three-years-sows-crops-too-late.md).

## The timeline samples

Twenty seeds, `measure.yml` suite `sweep`. Deaths / living at year 3 / need deaths (seeds with any) / extinct seeds.

| Commit | Shift | Run | Deaths | Living | Need deaths | Extinct | p0 d / l | p2 d / l | p4 d / l |
|---|---|---|---|---|---|---|---|---|---|
| `947c303c` (T-501) | 0 | 42119697821 | 125 | 980 | 0 | 0 | 3 / 389 | 58 / 307 | 64 / 284 |
| | 1 | 42140134127 | 149 | 831 | 6 (2) | 0 | 9 / 413 | 65 / 267 | 75 / 151 |
| | 2 | 42140140260 | 112 | 871 | 19 (1) | 3 | 2 / 366 | 57 / 285 | 53 / 220 |
| `d96cfc9c` (T-482) | 0 | 42134070351 | 220 | 874 | 28 (2) | 2 | 23 / 427 | 81 / 282 | 116 / 165 |
| | 1 | 42140137121 | 150 | 855 | 2 (1) | 0 | 2 / 405 | 94 / 184 | 54 / 266 |
| | 2 | 42140143461 | 173 | 924 | 0 | 1 | 1 / 438 | 74 / 299 | 98 / 187 |
| `d2f68294` (T-508) | 0 | 42144703997 | 135 | 930 | 1 (1) | 0 | 6 / 413 | 60 / 242 | 69 / 275 |
| | 1 | 42144707575 | 162 | 841 | 27 (2) | 1 | 29 / 418 | 68 / 235 | 65 / 188 |
| | 2 | 42144711420 | 147 | 915 | 24 (2) | 1 | 28 / 396 | 65 / 232 | 54 / 287 |

| Commit | Deaths, mean (range) | Deaths but hunger | Living, mean (range) | Extinct seeds |
|---|---|---|---|---|
| `947c303c` | 129 (112–149) | 93–143 | 894 (831–980) | 0, 0, 3 |
| `d96cfc9c` | 181 (150–220) | 148–192 | 884 (855–924) | 2, 0, 1 |
| `d2f68294` | 148 (135–162) | 123–135 | 895 (841–930) | 0, 1, 1 |

- **Living:** the same on the three commits; one commit's spread (831 to 980 on the oldest) is wider than any difference between them.
- **Peril 4's two wipe-outs on T-482's master** (`p4-2`, `p4-3`) were chance: the old master wipes out three seeds two ticks later (`p2-4`, `p4-1`, `p4-4`), and T-482's own code one tick later none.
- **Need deaths:** `p0-3` (the fault below) accounts for 23 in four of the nine samples; the rest are a starving remnant after a siege or raid (`p4-1` 19 on the old master two ticks later, `p4-4` 2 to 4) or a few dwarves on a peril-2 seed.
- **Deaths in the fights:** with T-482 the peril-2 deaths were above the old master's in all three samples (74 to 94 against 57 to 65) and the peril-4 deaths in two. Causes are the old ones (bled out, killed, infection: [data](../data/2026-11-05-t507-sweeps.md)). With T-508 peril 2 is 60 to 68 again. T-508 gives idle dwarves their own stand tile in the hall instead of one tile at its way in, a crowd T-482's report found; that it removes the rise is a likely reading, not a probed one.
- **The set rule** held on all nine (peril-0 need deaths at most one seed); it holds only because `p0-3` is the one seed with a hunger death in each failing sample.

**On T-509 (the annual instrument's bounds).** These figures say the same of the sweep: one or two ticks of shift on unchanged code move the total deaths by up to 70 and the living by up to 149, and a seed's survival flips. A single sweep can judge only a change larger than that; this one needed three samples a commit to say anything.

## The food journal of `three-years-p0-3`

The probe ([source](../data/2026-11-05-t507-food-journal.probe.ts.txt)) plays the seed as the sweep does and writes, every 7 days from day 112, the farm (tiles, sown, ripe, by plot kind), harvests, meals cooked and drink brewed, meals and raw plants eaten, stocks, plant food and seed by crop, food jobs and their blocks, the kitchens' and stills' orders, who has the food labors and what they are doing, and the cave strips' digs ([data](../data/2026-11-05-t507-food-journal-p0-3.txt): master, master one tick later, the fix with the sowing rule, the fix on today's master). Master `d96cfc9c`, unshifted (reproduces the sweep: 23 starve, 44 living):

| Day | Dwarves | Cave tiles | Surface tiles (sown) | Harvest, 7 days (surface + cave) | Meals cooked / eaten | Lavish meals in stock | Plant food | Dimcap seed in stock |
|---|---|---|---|---|---|---|---|---|
| 126 | 28 | 32 | 107 (5) | 0 + 18 | 95 / 75 | 292 | 2 | 90 |
| 168 | 28 | 32 | 107 (66) | 12 + 86 | 176 / 73 | 464 | 128 | 90 |
| 182 | 40 | 32 | 144 (101) | 253 + 40 | 241 / 103 | 666 | 157 | 90 |
| 196 | 40 | 32 | 144 (101) | 0 + 28 | 144 / 108 | 755 | 26 | 91 |
| 203 | 46 | 32 | 164 (0: frost killed 101) | 0 + 61 | 108 / 129 | 660 | 9 | 91 |
| 224 | 46 | 32 | 164 (0) | 0 + 40 | 37 / 122 | 205 | 8 | 91 |
| 238 | 55 | 32 | 193 (99) | 0 + 11 | 16 / 129 + 3 raw | 0 | 2 | 90 |
| 266 | 55 | 32 | 193 (100) | 334 + 26 | 297 / 145 + 13 raw | 155 | 158 | 186 |
| 294 | 67 | 32 | 237 (165) | 0 + 113 | 97 / 161 + 8 raw | 5 | 0 | 186 |
| 301 | 67 | 32 | 237 (165) | 0 + 0 | 0 / 6 + 6 raw | 0 | 0 | 186 |
| 315 | 67 | 32 | 237 (0: frost killed 165) | 0 + 64 | 6 / 6 + 82 raw | 0 | 0 | 186 |
| 322 | 62 | 32 | 237 (0) | 0 + 14 | 4 / 6 + 26 raw; 5 starve | 0 | 0 | 186 |
| 336 | 44 | 32 | 237 (0) | 0 + 104 | 10 / 12 + 74 raw; 23 starved | 0 | 0 | 186 |

What the rows show:

- **Labour is not short.** 39 to 49 dwarves have the farming, cooking and brewing labors, and most are idle at each look (36 of 39 at day 245, 49 of 49 at day 301). The kitchens' lavish order is at its cap of 999 from day 231; the kitchens wait on ingredients (`kitchen: blocked (missing_input)` at day 224).
- **The surface farm yields once a year.** Its harvests are a turnip crop on day 182 (253) and a strawberry crop on day 266 (334), and little else. What was sown after them did not ripen: turnips, cabbage and strawberries sown at the end of autumn of year 2 and strawberries and barley sown in the second half of summer of year 3 lay dormant, and the frost killed 101 and 165 crops. From day 231 the surface plots have 21 `plant` jobs blocked for `missing_input`: the seed died with them. That is [the second fault](#the-second-fault-crops-sown-too-late).
- **The cave farm never grows.** It is the only food in winter, and it stays at 32 tiles (20 dimcap, 10 cavewheat). `checkCaveStrips` planned its first strip before day 60 and designated it; all 32 digs were blocked `unreachable` at every look from day 60 to day 336, and while a strip is waiting to be dug no other is planned. The dimcap seed bought for it (90 from the day-124 caravan, 96 more on day 240) was never sown.
- **Drink does not run out:** the brook gives water (107 to 255 drinks of water a week in year 3), and the stills' order still takes plants ahead of the kitchens (brewing 320 drink, 64 plants, in the week to day 294, while 97 meals were cooked). With water at hand that order costs meals; it is a margin of the script's plan, not changed here.
- **One tick later** (the second table in the data) the fortress grows more slowly (18 dwarves until day 224, 43 at the end), and the same faults are there: the strip unreachable, 160 dimcap seed unused, the frost killing 52 and 140 crops. It does not starve because it never outgrows 32 cave tiles in winter.

## The fault: cave strips east of a west farm

`caveSite` (T-455) puts the cave farm east of the stair (`cx + 7` to `cx + 14`), or, where that would open it to the hillside, on the side and level with the most soil, west of the stair (`cx − 2` to `cx + 5`). `CAVE_STRIPS` gives the strips as offsets from the centre for the east farm only. On `p0-3` the farm is west (its first tile is at x 23 with `cx` 22) and the first strip came to x 29 to 36: the far side of the stair, in rock with no open tile beside it. `checkCaveStrips` waits until every tile of its last strip is floor before it plans the next, so one unreachable strip ends the cave farm's growth for the game. Four sweep seeds have a west farm: `p0-3`, `p0-6`, `p2-2` and `p2-4`.

**Fixed** in `test/scenarios/three_years_economy.ts`:

- `caveStripTiles(w, state, n)` mirrors strip `n` about the stair (`cx + 6`) for a west farm, and keeps only the rock joined (8-neighbour) to the farm or an earlier strip.
- A strip tile whose dig designation is gone without its being dug no longer holds the strip; the strip's floor tiles are zoned.

**Test:** `test/unit/t507-cave-strips.test.ts` sets up `p0-3` (west) and `p0-1` (east) and checks that each of the four strips is joined to the farm or an earlier strip and that the first is at least 16 tiles. On the old code `p0-3`'s first strip has 32 tiles joined to nothing and the test fails.

### Measured

| Run | Commit | Deaths | Living | Need deaths | Extinct | `p0-3` | `p0-6` | `p2-2` | `p2-4` |
|---|---|---|---|---|---|---|---|---|---|
| master | `d96cfc9c` | 220 | 874 | 28 | 2 | 44, 23 starved | 50 | 26 | 45 |
| the fix (42143433600) | over `d96cfc9c` | 204 | 847 | 6 | 3 | **80**, none | 56 | 2 | 0 |
| master | `d2f68294` | 135 | 930 | 1 | 0 | 46, 1 starved | 53 | 35 | 8 |
| the fix (FIXD_RUN) | over `d2f68294` | FIXD | | | | | | | |

On `d96cfc9c` the sixteen east-farm seeds give the same figures with and without the fix, seed by seed; the four west seeds move. `p2-2` and `p2-4` fall in their peril-2 fights on the new timelines: `p2-2` keeps 2 dwarves, and `p2-4` is extinct on day 65, in year 1 (so the set rule's year-1 count is 19 of 20 on this run). `p2-4` is the most fragile seed of the file on every commit: it keeps 3 to 45 dwarves in the nine samples above and is extinct on the old master two ticks later (day 292).

The journal of `p0-3` with the fix on today's master: the first strip is dug and sown by day 175 (92 cave tiles), the second by day 238, the third and fourth by day 252 (172 tiles, 120 sown). The fortress grows to 74; lavish meals in stock stay above 560 from day 189 to the end, and no dwarf dies.

`three_years_main` (the economy scenario, east farm): FIXM.

## The second fault: crops sown too late

`checkCrops` gives each surface plot, for each season, the first crop of `SURFACE_CROPS` whose seed covers half the plot, without asking whether it can ripen. A surface crop needs four stages of `stageDays` and grows only in its seasons; sown with too few days left it lies dormant and the frost kills it and its seed (07 § Growth). On `p0-3` the frost took 101 crops in the first week of year 2's winter and 165 in the first week of year 3's; with the cave fix and no sowing rule it still takes 96 and 200 on today's master. A rule (sow in the season under way only what ripens in its seasons with three days to spare, else leave the plot fallow; branch `t507-food-b`, commit `292af817`) cut those to 6 and 45 and gave, with the cave fix under it on `d96cfc9c` (run 42143696598), 170 deaths, 855 living, no peril-0 need death, three extinctions in peril-2 and peril-4 fights. It moves every seed's timeline, and the cave fix alone ends the starvation, so it is [a task of its own](../../docs/work/T-NEW-three-years-sows-crops-too-late.md).

## Noticed on the way

- Two shifted runs failed one seed's own witnesses after the fortress all but died in its fights: `p2-1` on T-482's master one tick later (1 living, "gate walls built") and `p2-4` two ticks later (3 living, "a dining hall"). A fortress of one to three cannot build what a witness asks; the witnesses do not allow for a collapsed fortress. The set rule and the summary are unaffected. Not filed: it is the fixture's witness rule meeting a peril-2 collapse, and T-509's noise work is where a collapsed timeline's figures belong.
