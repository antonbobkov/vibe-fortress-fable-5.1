# Diagnosis: the annual instrument's taiga seed 1 has no food or drink by day 100 (T-481)

**Task:** T-481 · **Date:** 2026-11-02 · **Commit examined:** `98ca6dfc` (`master` at `ddc67821` with no change to `src` or the instrument); the fix is `7dc83730` · **Kind:** journal of one seed, a fix to the instrument's opening, two instrument samples; nothing tuned · **Source:** the T-463 follow-up and T-464 rows

## The answer

- **The cause is the instrument's opening, not the game.** `wildlife-taiga-1` puts its wagon on a rise at the map's west edge. The camp window has no level 3 by 3 patch at the wagon's level, so the opening takes all six building sites from its relief fallback, which filled the wagon's own level first however far away: the carpenter, mason, still, kitchen, hearth and depot went 50 to 70 tiles from the food stockpile, while level ground lay 8 to 15 tiles away, one or two levels up or down. The opening also drew half of its turnip plot over the wagon (4 of the plot's 8 tiles), where nothing can be sown.
- **What that did to the fortress.** With the kitchen 58 tiles from the food, the cook made 12 meals in the first two weeks where taiga seed 3 made 64, so the embark food was eaten raw or brewed rather than cooked into four meals per two plants. The plants were gone at the end of day 16, fifteen days before the first cave harvest, and the seven dwarves starved from day 17 to day 31. All year the dwarves spent their time walking: no idle time from day 36 on, against a quarter to a third of it in taiga seed 3. Turnips (4 tiles) gave little, so after the summer barley the kitchen had one ingredient and cooked almost nothing; the fortress lived on raw dimcap.
- **What ended it.** In taiga's winter the cave plot one level down is at −7 °C, below dimcap's 2 °C, from day 85 to the end of the year: the crops stand still in every taiga seed. Taiga seed 1 went into winter with 97 drinks, 2 meals and 34 plants for 12 dwarves. The plants ran out on day 96, the drink on day 108. All 12 dwarves were starving from day 97; under a slightly different timeline they die on days 106 to 109, which is the T-463 rows.
- **The fix is in the opening** (`test/perf/wildlife_year_fixture.ts`): sites the camp window lacks are the nearest by walk from the camp's stockpile, on the wagon's level or up to two levels above or below; a zone is never drawn over a building or a chosen site, and the fixture fails a seed with a plot tile under a building. In taiga seed 1 the sites are now 6 to 13 steps from the stockpile, the turnip plot has 12 sowable tiles (10 sown, from its 10 seeds), and the year ends with 78 drinks, 36 meals and 22 plants: 26 Starving notes (three days in the first month) instead of 326.
- **The instrument** goes from the accepted 12.5/7/11/148/7/0/0 to **13/7/10/149/7/0/0** (sample 1) and **12/6/9/143/7/0/0** (sample 2, the same code shifted by one tick at embark). Both pass. Taiga seed 1 lives in both, with 12 and 13 dwarves, 26 and 7 Starving notes and no need death. See [Instrument rows](#instrument-rows).
- **What is left is a real edge, filed for the owner:** a dimcap plot one level under a taiga surface does not grow at all in winter, against the spec's "cave plots produce all year". Every taiga seed lives through its winter on its autumn store; taiga seed 3 ends with 6 drinks, 1 meal and 1 plant for 13 dwarves. The work file `T-NEW-cave-plot-freezes-in-taiga-winter.md` holds the figures and the choices.

## How

A probe (`reports/data/2026-11-02-t481-journal.probe.ts.txt`) plays the instrument's year for one seed through the fixture's `observe` hook and records, at the first look of each day: stocks of drink, meals, plant food by material, raw meat and seeds; every crop by species and stage; the temperature of each plot's first tile and of the surface; the dwarves' mean hunger and thirst; the behaviour and activity of every dwarf at every look; and the day's harvests, sowings, crop deaths, items made, meals eaten, drinks and Starving notes. For the journals from day 1, the hook was called in the opening's 300-tick steps as well (a read-only change made for the probe and not kept). A second probe printed each plot's tiles with the building on each, and a third printed where each seed's opening put its sites.

The journal run reproduces the accepted T-464 row for this seed exactly (12 living, 326 Starving notes, 68 harvests, stocks 0/0/0). The instrument is deterministic, so the second sample of the fixed opening moves the timeline by one tick at embark.

Data: [taiga 1 before](../data/2026-11-02-t481-taiga1-before.json), [taiga 3 before](../data/2026-11-02-t481-taiga3-before.json), [taiga 1 after](../data/2026-11-02-t481-taiga1-after.json).

## Journal

Each row is a week. Stocks are at the week's end; the weeks with a caravan (29–35, 57–63) count its wares at the depot, which leave with it. Harvested plants count the plants a harvest gives, not the harvests. The last column is the share of the dwarves' looks spent on needs, work, no job and alert duty.

### Taiga seed 1 before the fix

| Days | Living | Drink, meals, plant food at the end | Harvested plants | Meals cooked | Drink brewed | Starving notes | Need / work / idle / duty share |
|---|---:|---|---:|---:|---:|---:|---|
| 1–7 | 7 | 76, 2, 24 | 0 | 4 | 40 | 0 | 53 / 42 / 4 / 0 |
| 8–14 | 7 | 93, 0, 8 | 0 | 8 | 40 | 0 | 73 / 27 / 0 / 0 |
| 15–21 | 7 | 85, 0, 0 | 0 | 0 | 20 | 26 | 68 / 9 / 23 / 0 |
| 22–28 | 7 | 51, 0, 0 | 0 | 0 | 0 | 49 | 54 / 5 / 36 / 5 |
| 29–35 | 10 | 309, 102, 130 | 35 | 108 | 300 | 30 | 68 / 18 / 7 / 7 |
| 36–42 | 9 | 52, 2, 12 | 36 | 8 | 60 | 1 | 66 / 23 / 0 / 7 |
| 43–49 | 9 | 98, 3, 21 | 44 | 16 | 80 | 0 | 65 / 26 / 0 / 9 |
| 50–56 | 9 | 101, 0, 55 | 56 | 16 | 40 | 0 | 65 / 25 / 0 / 10 |
| 57–63 | 12 | 412, 4, 151 | 29 | 16 | 360 | 0 | 68 / 26 / 0 / 6 |
| 64–70 | 12 | 91, 3, 23 | 8 | 12 | 40 | 0 | 70 / 24 / 0 / 6 |
| 71–77 | 12 | 103, 3, 38 | 47 | 24 | 60 | 0 | 65 / 27 / 0 / 8 |
| 78–84 | 12 | 97, 2, 34 | 28 | 12 | 40 | 0 | 72 / 23 / 0 / 5 |
| 85–91 | 12 | 78, 0, 8 | 3 | 0 | 20 | 5 | 76 / 19 / 0 / 5 |
| 92–98 | 12 | 49, 0, 0 | 0 | 4 | 20 | 47 | 65 / 26 / 3 / 7 |
| 99–105 | 12 | 7, 0, 0 | 0 | 0 | 0 | 84 | 75 / 16 / 5 / 4 |
| 106–112 | 12 | 0, 0, 0 | 0 | 0 | 0 | 84 | 55 / 5 / 31 / 9 |

What the journal shows, by stage:

- **Days 1–15, the embark food.** 10 meals, 20 turnips, 20 dimcaps and 10 boar meat. The still's standing order (keep 100 drinks) took 20 dimcaps in five brews; the kitchen, 58 tiles from the stockpile, cooked three times. The rest was eaten raw. Plant food was zero at the end of day 16.
- **Days 14–20, sowing.** The cave plot was ordered on day 10; its 20 dimcap seeds (27 tiles, 20 seeds, as in every seed) were sown over days 14 to 20, against all 20 on day 11 in taiga seed 3. The turnip plot had 4 crops; 6 turnip seeds lay in the store all year, because the other 4 tiles of the plot were under the wagon.
- **Days 17–31, the first hunger.** Hunger at its maximum for all seven dwarves from day 19; the first dimcap harvest on day 31.
- **Days 31–84.** Production about matched consumption. Barley from the summer plot (10 seeds) was harvested once; the second sowing was still green at the end of summer and its 10 crops died of frost on day 58 (a surface crop out of its seasons below the frost line), taking the last barley seeds with them. Taiga seed 3 loses its barley the same way on day 59. After that the only second ingredient was 4 tiles of turnips, so the kitchen made 12 to 24 meals a week and the dwarves ate dimcap raw. No dwarf was ever idle.
- **Days 85–112, winter.** The turnips died of frost on day 85. The cave plot's tile read −6 to −7 °C at midnight all winter; its 20 crops did not advance a stage. 97 drinks, 2 meals and 34 plants at the end of day 84; plants gone on day 96, drink on day 108. Thirst at its maximum from day 110.
- **Wildlife.** The alert stood at watchful from day 27 to day 84 (a wolf pack within 40 tiles), and duty took 5–10% of the looks. One dwarf bled out on day 39. Neither explains the hunger: the fixed taiga seed 1 has the same watchful alert from day 23 to day 63 and does not go hungry.

### Taiga seed 3, the same game and opening

| Days | Living | Drink, meals, plant food at the end | Harvested plants | Meals cooked | Drink brewed | Starving notes | Need / work / idle / duty share |
|---|---:|---|---:|---:|---:|---:|---|
| 1–7 | 7 | 112, 39, 6 | 0 | 48 | 80 | 0 | 52 / 46 / 3 / 0 |
| 8–14 | 7 | 80, 34, 2 | 0 | 16 | 0 | 0 | 61 / 15 / 23 / 0 |
| 15–21 | 7 | 47, 13, 2 | 0 | 0 | 0 | 0 | 66 / 1 / 34 / 0 |
| 22–28 | 7 | 15, 0, 29 | 35 | 0 | 0 | 0 | 62 / 2 / 36 / 0 |
| 29–35 | 11 | 203, 153, 80 | 87 | 186 | 240 | 0 | 60 / 27 / 13 / 0 |
| 36–42 | 11 | 97, 63, 16 | 0 | 32 | 40 | 0 | 58 / 8 / 34 / 0 |
| 43–49 | 11 | 104, 64, 97 | 115 | 40 | 60 | 0 | 60 / 16 / 24 / 0 |
| 50–56 | 11 | 113, 60, 96 | 31 | 32 | 60 | 0 | 61 / 7 / 32 / 0 |
| 57–63 | 13 | 252, 59, 520 | 76 | 40 | 200 | 0 | 60 / 12 / 28 / 0 |
| 64–70 | 13 | 113, 60, 104 | 0 | 48 | 60 | 0 | 59 / 7 / 33 / 0 |
| 71–77 | 13 | 113, 64, 40 | 0 | 44 | 60 | 0 | 60 / 8 / 32 / 0 |
| 78–84 | 13 | 116, 60, 73 | 83 | 40 | 60 | 0 | 61 / 14 / 25 / 0 |
| 85–91 | 13 | 97, 62, 45 | 0 | 40 | 40 | 0 | 64 / 9 / 26 / 0 |
| 92–98 | 13 | 102, 59, 15 | 0 | 36 | 60 | 0 | 66 / 10 / 24 / 0 |
| 99–105 | 13 | 64, 41, 1 | 0 | 20 | 20 | 0 | 67 / 9 / 24 / 0 |
| 106–112 | 13 | 6, 1, 1 | 0 | 0 | 0 | 0 | 68 / 2 / 31 / 0 |

Its sites are 11 to 31 steps from the stockpile and its 8-tile turnip plot is whole. Its cook turned the embark food into 64 meals in two weeks, so it never went hungry before its first harvest on day 28. Its cave plot freezes in winter as well (the same 20 crops from day 85 on), and it reaches day 112 with two days of food and drink left.

### Taiga seed 1 after the fix

| Days | Living | Drink, meals, plant food at the end | Harvested plants | Meals cooked | Drink brewed | Starving notes | Need / work / idle / duty share |
|---|---:|---|---:|---:|---:|---:|---|
| 1–7 | 7 | 112, 35, 6 | 0 | 44 | 80 | 0 | 52 / 40 / 8 / 0 |
| 8–14 | 7 | 77, 29, 0 | 0 | 16 | 0 | 0 | 69 / 8 / 23 / 0 |
| 15–21 | 7 | 44, 7, 0 | 0 | 0 | 0 | 0 | 64 / 2 / 34 / 0 |
| 22–28 | 7 | 31, 4, 65 | 78 | 4 | 20 | 20 | 61 / 6 / 21 / 12 |
| 29–35 | 10 | 387, 162, 161 | 48 | 188 | 400 | 0 | 61 / 24 / 6 / 10 |
| 36–42 | 10 | 101, 60, 54 | 35 | 28 | 40 | 0 | 64 / 11 / 16 / 9 |
| 43–49 | 10 | 114, 57, 128 | 119 | 64 | 60 | 0 | 63 / 16 / 12 / 8 |
| 50–56 | 10 | 108, 61, 99 | 0 | 36 | 40 | 0 | 66 / 8 / 18 / 8 |
| 57–63 | 13 | 487, 59, 297 | 78 | 56 | 440 | 0 | 64 / 12 / 18 / 6 |
| 64–70 | 13 | 107, 66, 79 | 0 | 72 | 60 | 0 | 62 / 11 / 23 / 4 |
| 71–77 | 13 | 107, 61, 31 | 0 | 44 | 60 | 0 | 61 / 9 / 30 / 0 |
| 78–84 | 13 | 107, 61, 114 | 120 | 44 | 60 | 0 | 64 / 15 / 20 / 0 |
| 85–91 | 13 | 109, 64, 82 | 0 | 40 | 60 | 0 | 69 / 12 / 19 / 0 |
| 92–98 | 13 | 115, 60, 52 | 0 | 36 | 60 | 0 | 69 / 13 / 17 / 0 |
| 99–105 | 12 | 106, 60, 28 | 0 | 32 | 40 | 1 | 64 / 16 / 7 / 6 |
| 106–112 | 12 | 78, 36, 22 | 0 | 4 | 20 | 5 | 56 / 5 / 0 / 8 |

The cave crop still stands still from day 85, but the fortress enters winter (end of day 84) with 107 drinks, 61 meals and 114 plants, and ends the year with a week of food. The short hunger of days 26–28 is the gap before the first cave harvest (day 27); here it is three days.

## Where each seed's opening puts its sites

Steps from the camp's stockpile to the middle of each building site (carpenter, mason, still, hearth, kitchen, depot) after the fix, and what moved:

| Seed | Sites (steps) | What the fix moved |
|---|---|---|
| forest 1, forest 2, grassland 1–4 | 12–38 | nothing: the camp window had all eight sites |
| forest 3 | 11–16 | the still and kitchen, one level up and nearer; the barley plot, which lay under a workshop (9 tiles) |
| forest 4 | 16–33 | two plots that lay under workshops (9 and 6 tiles) |
| taiga 1 | 6–13 | all six sites (were 50–70 tiles away) and the turnip plot (4 tiles under the wagon) |
| taiga 2 | 7–20 | the depot, meeting area and bedroom |
| taiga 3, taiga 4 | 11–31 | the bedroom |

## Instrument rows

Median/worst/second-worst/sum/wildlife-free/extinct/need deaths.

| Sample | Row | Verdict | Rows |
|---|---|---|---|
| Accepted (T-464) | 12.5/7/11/148/7/0/0 | — | [rows](../data/2026-11-01-t464-wildlife.json) |
| The fix, `7dc83730` | 13/7/10/149/7/0/0 | passes; no guarded figure worsens | [rows](../data/2026-11-02-t481-wildlife.json) |
| The fix, shifted one tick at embark (`7dc83730` with one `game.step(1)` before the opening, not kept) | 12/6/9/143/7/0/0 | passes; median and sum worsen, within their bounds | [rows](../data/2026-11-02-t481-shift-wildlife.json) |

Living per seed, forest 1–4, taiga 1–4, grassland 1–4:

- accepted: `13, 11, 12, 11, 12, 11, 13, 7, 15, 14, 15, 14`
- the fix: `13, 11, 13, 12, 12, 10, 13, 7, 15, 14, 15, 14`
- shifted: `9, 11, 6, 13, 13, 11, 11, 11, 15, 14, 15, 14`

The shift moves forest seeds 1 and 3 by four and seven living (wolves: four and five dwarves bled out, against none), and taiga seed 4 by four the other way. Neither forest seed's sites moved; this is the instrument's known wildlife noise, which the sum's tolerance of 12 is for.

Taiga seed 1, the seed this task is about:

| Sample | Living | Starving notes | Harvests | Drink, meals, plant food at the end | Need deaths |
|---|---:|---:|---:|---|---:|
| Accepted (T-464) | 12 | 326 | 68 | 0, 0, 0 | 0 |
| T-463 first version | 0 | 341 | — | 0, 0, 0 | 10 |
| T-463 follow-up | 0 | 338 | 62 | 0, 0, 0 | 11 |
| The fix | 12 | 26 | 119 | 78, 36, 22 | 0 |
| The fix, shifted | 13 | 7 | 120 | 78, 52, 0 | 0 |

## What is not a fault

- **The temperature of the cave plot.** −7 °C one level under a −15 °C surface is 05's blend (`UNDERGROUND_BASE_C` 10, `NEAR_SURFACE_DEPTH` 3), and dimcap's `minC` 2 stops it. The game does what its rules say; the spec's own sentence that cave plots produce all year disagrees, which is the filed row.
- **The barley lost to frost on day 56.** A surface crop outside its seasons dies below the frost line (07). The opening sows barley in spring and summer only, so its last summer sowing is lost in every taiga seed; the player in this instrument does not stop sowing late.
- **The 20 dimcap seeds for a 27-tile plot.** Seeds do not multiply (07 § Seeds), and every seed's opening has the same 20.
