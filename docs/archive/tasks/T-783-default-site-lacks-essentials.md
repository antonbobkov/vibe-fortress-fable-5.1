# T-783 — The world map often starts a newcomer on bare rock with no soil, trees or water

**Closed:** 2026-11-26, in 22cad0c6.

**Source:** T-779 (its work file, § Measured) · **Size:** S · **Needs:** — · **Status:** open

## Why

The world map's cursor starts on the embarkable region nearest the centre, passing over a site with frostbite from the first night (`ui-screens/menus-and-world.md` § World map). The centre of a world is mountains: of the thirty probe worlds (`probe-1` … `probe-30`), thirteen still start on an alpine site that lacks soil, trees and water, all three missing essentials (02 § What a site has and lacks): no farm on the surface, wood only from the wagon, and drink only from the wagon until a cavern lake is dug to. The region panel says so in the alert colour, but a newcomer who presses Enter on the first site starts the leanest site in the game about two times in five.

## What to do

Decide whether the starting cursor should also prefer a site with fewer missing essentials (none, or at least water and trees), and in what order against the frostbite rule and the distance: for example the nearest site with no frostbite from the first night and no missing essential, else the frostbite rule alone. Measure how far the cursor moves on the thirty probe worlds and what the new starts are (biome, essentials, frostbite), as T-779's work file did; keep the move short, since a start far from the centre puts the player on a corner of the map. A player who wants the mountain can still move to it.

## Measured

The thirty probe worlds (`probe-1` … `probe-30`, standard size), with `test/perf/t783_start_site_probe.test.ts` (`T783_PROBE=1`), which builds each world's `WorldMapScreen` and prints its start beside the frostbite rule's alone.

- **Before (T-779's rule).** Thirteen starts lack all three essentials (alpine rock), fifteen lack water only (a taiga, a cold steppe, a forest or a grassland with no river, lake or spring), two lack nothing. Water is the scarce one: of all 44,126 embarkable regions of the thirty worlds only 628 lack nothing, and on every world the nearest site with water and trees also had soil, so "no missing essential" and "at least water and trees" pick the same site on all thirty.
- **After.** All thirty start on a site that lacks nothing. The cursor moves 0 regions on two worlds (`probe-14`, `probe-24`, already there), 1–4 on seventeen, 5–8 on ten and 10 on one (`probe-5`); median 4. The new start lies at most 9 regions from the centre (`probe-5`), well inside the 16 of the reach. The starts are a taiga on fifteen worlds, a temperate forest on eight, a tundra on three, a wetland on two, a cold steppe and a temperate grassland; fifteen have frostbite in winter, none earlier.

| World | Before | After | Moved |
|---|---|---|---|
| `probe-1` | 2015 alpine, lacks soil, trees, water | 2457 taiga, winter −28 °C | 7 |
| `probe-2` | 2015 alpine, lacks all three | 1703 wetland, no frostbite | 8 |
| `probe-3` | 2015 alpine, lacks all three | 1820 temperate forest, no frostbite | 3 |
| `probe-5` | 2015 cold steppe, lacks water | 1577 temperate grassland, no frostbite | 10 |
| `probe-18` | 2015 temperate forest, lacks water | 2072 taiga, winter −29 °C | 7 |
| `probe-25` | 2015 alpine, lacks all three | 2466 tundra, winter −37 °C | 7 |

(The other 24 move 0 to 6; the probe prints them all.) Placing the cursor takes 1 to 7 ms a world: `siteLacks`, the summary's lacks line without the rest of the summary, takes 11 ms for every one of `probe-1`'s 1,483 embarkable sites, where the whole summary takes 75 ms, so even a world with no site that lacks nothing opens at once.

## Decision

**Prefer a site that lacks nothing, within a reach of the centre.** The cursor starts on the nearest site (by the same Chebyshev distance and ties) with no frostbite from the first night and no missing essential, looking no farther from the centre than the world's size / `START_SITE_REACH_DIVISOR` (4: 16 regions on a standard world, 8 on a small one); with none there, on the nearest with no frostbite from the first night anywhere, as T-779 left it; with none of those, the nearest site. With a filter set, the same order runs among the sites the filter keeps first.

- **Why nothing missing, not "at least water and trees".** On the thirty worlds the two pick the same site every time, and "nothing missing" is the line the region panel already shows in the alert colour, so the first screen shows a site whose lacks line reads "none".
- **Why above the frostbite rule's fallback, not below it.** A site that lacks nothing but freezes from the first night is still passed over (the frostbite rule keeps first say), and a site with no frostbite and something missing is the fallback.
- **Why a reach.** The longest move on the thirty worlds is 10 regions and the farthest start 9 from the centre, so the reach never binds there; it keeps a world whose water is all at its rim from starting in a corner. A quarter of the size keeps the start in the middle half of the map on every world size.
- **What is given up.** No probe world now starts on a mountain: the first screen used to show the alpine rock near the Mountainhome, the hardest and most characterful site. A player who wants it moves to it, and the region panel still says what it costs. The newcomer's first fortress instead has a farm, wood and a river or lake from day one.
- **No world hash moves**: the starting cursor is the screen's, and no test or measurement embarks on it (T-763's probe and the e2e specs pick their own regions; `findEmbarkableRegion` walks to the centre first).

`siteLacks(spec, registry)` is new in `systems/embark/site.ts`; the summary's lacks line and `siteLacks` share one helper, and the test checks they agree.

## Done

- [x] A decision in `menus-and-world.md` § World map, with a test of the starting cursor, or the reason the rule stays. (`test/unit/ui/t783-start-lacks-nothing.test.ts`; 01 § Player-facing behavior and 24 § Tuning constants, `START_SITE_REACH_DIVISOR`, say it too.)
