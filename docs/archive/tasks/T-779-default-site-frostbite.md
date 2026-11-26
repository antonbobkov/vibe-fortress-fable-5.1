# T-779 — The world map often starts a newcomer on a site that freezes from the first night

**Closed:** 2026-11-26, in 8aeec12f.

**Source:** T-765 ([report](../../../reports/audits/2026-11-25-t765-alpine-frostbite.md), § How often) · **Size:** S · **Needs:** — · **Status:** open

## Why

The world map's cursor starts on the embarkable region nearest the centre (01 § Player-facing behavior, `ui-screens/menus-and-world.md` § World map), and the centre of a world is mountains, near the Mountainhome. Of the default sites of thirty worlds (`probe-1` … `probe-30`), fourteen were alpine and eight have frostbite from the first night (02 § Site summary). T-765 made such a site survivable and says so in the region panel, in the alert colour, but a newcomer who presses Enter on the first site still starts the hardest climate in the game about one time in four.

## What to do

Decide whether the starting cursor should skip a site whose summary has frostbite from the first night (`siteSummary(...).climate.frostbite.arrival`) and start on the nearest one that has none, ties as now. Measure how far it moves on the thirty probe worlds and what the new default sites are (biome, frostbite later, missing essentials). Keep the centre rule otherwise; a player who wants the cold can still move to it.

## Measured

The starting cursor of the thirty probe worlds (`probe-1` … `probe-30`, standard size), before and after; a local probe built each world's `WorldMapScreen` and read its region. Eight move, each by one region (Chebyshev), every one to a site whose frostbite waits for winter:

| World | Before | After |
|---|---|---|
| `probe-1` | 2080 alpine, frostbite spring −52 °C, lacks soil, trees, water | 2015 alpine, winter −42 °C, lacks soil, trees, water |
| `probe-2` | 2080 alpine, spring −31 °C, lacks all three | 2015 alpine, winter −39 °C, lacks all three |
| `probe-3` | 2080 alpine, spring −33 °C, lacks all three | 2015 alpine, winter −42 °C, lacks all three |
| `probe-5` | 2080 alpine, spring −31 °C, lacks all three | 2015 cold steppe, winter −29 °C, lacks water |
| `probe-8` | 2080 alpine, spring −33 °C, lacks all three | 2015 alpine, winter −39 °C, lacks all three |
| `probe-14` | 2015 taiga, spring −28 °C, lacks water | 2016 taiga, winter −34 °C, lacks nothing |
| `probe-25` | 2080 alpine, spring −34 °C, lacks all three | 2015 alpine, winter −41 °C, lacks all three |
| `probe-26` | 2080 alpine, spring −34 °C, lacks all three | 2015 alpine, winter −42 °C, lacks all three |

The other 22 keep their start. Placing the cursor looked at 38 sites' frostbite over the thirty worlds; every one of `probe-1`'s 1,483 embarkable sites takes 6 ms, so even a world where every site froze from the first night would open at once. Of the e2e seeds four move (`e2e-alpine`, `e2e-find`, `u04-drag-place`, `u06-labor-manager`); none of their specs embarks on the start site (they walk to the centre first or to a target from the cursor).

## Decision

**Skip it.** The cursor passes over a site whose summary has frostbite from the first night (`siteSummary(...).climate.frostbite.arrival`, now also `siteFrostbite(spec, registry)`) to the nearest site without it, by the same Chebyshev distance and ties to the lowest id, and starts on the nearest site after all when every site the rule keeps has it. With a filter set, the same order runs among the sites the filter keeps first. The centre rule is otherwise unchanged, the move is one region on every probe world, and a player who wants the cold moves to it; its region panel still says what it costs.

- **Not done:** skipping a site that lacks soil, trees and water as well. Thirteen of the thirty new starts are still bare alpine rock with none of the three; that is a choice about the first screen's site as a whole, not the frostbite, and is filed as a follow-up (`T-783-default-site-lacks-essentials.md`).
- **The e2e helper** `cursorStart` read the start by recomputing the rule; it now reads the cursor from the hook (`worldMapCursor()`, testing-strategy.md § E2E harness), so it holds whatever the rule becomes.

## Done

- [x] A decision in `menus-and-world.md` § World map, with a test of the starting cursor. (`test/unit/ui/t779-start-cursor.test.ts`; 01 § Player-facing behavior says it too.)
