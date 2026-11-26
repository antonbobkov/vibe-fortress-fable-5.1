# T-779 — The world map often starts a newcomer on a site that freezes from the first night

**Source:** T-765 ([report](../../reports/audits/2026-11-25-t765-alpine-frostbite.md), § How often) · **Size:** S · **Needs:** — · **Status:** open

## Why

The world map's cursor starts on the embarkable region nearest the centre (01 § Player-facing behavior, `ui-screens/menus-and-world.md` § World map), and the centre of a world is mountains, near the Mountainhome. Of the default sites of thirty worlds (`probe-1` … `probe-30`), fourteen were alpine and eight have frostbite from the first night (02 § Site summary). T-765 made such a site survivable and says so in the region panel, in the alert colour, but a newcomer who presses Enter on the first site still starts the hardest climate in the game about one time in four.

## What to do

Decide whether the starting cursor should skip a site whose summary has frostbite from the first night (`siteSummary(...).climate.frostbite.arrival`) and start on the nearest one that has none, ties as now. Measure how far it moves on the thirty probe worlds and what the new default sites are (biome, frostbite later, missing essentials). Keep the centre rule otherwise; a player who wants the cold can still move to it.

## Done

- [ ] A decision in `menus-and-world.md` § World map, with a test of the starting cursor.
