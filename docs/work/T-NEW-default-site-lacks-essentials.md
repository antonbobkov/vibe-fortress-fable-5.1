# T-NEW — The world map often starts a newcomer on bare rock with no soil, trees or water

**Source:** T-779 (its work file, § Measured) · **Size:** S · **Needs:** — · **Status:** open

## Why

The world map's cursor starts on the embarkable region nearest the centre, passing over a site with frostbite from the first night (`ui-screens/menus-and-world.md` § World map). The centre of a world is mountains: of the thirty probe worlds (`probe-1` … `probe-30`), thirteen still start on an alpine site that lacks soil, trees and water, all three missing essentials (02 § What a site has and lacks): no farm on the surface, wood only from the wagon, and drink only from the wagon until a cavern lake is dug to. The region panel says so in the alert colour, but a newcomer who presses Enter on the first site starts the leanest site in the game about two times in five.

## What to do

Decide whether the starting cursor should also prefer a site with fewer missing essentials (none, or at least water and trees), and in what order against the frostbite rule and the distance: for example the nearest site with no frostbite from the first night and no missing essential, else the frostbite rule alone. Measure how far the cursor moves on the thirty probe worlds and what the new starts are (biome, essentials, frostbite), as T-779's work file did; keep the move short, since a start far from the centre puts the player on a corner of the map. A player who wants the mountain can still move to it.

## Done

- [ ] A decision in `menus-and-world.md` § World map, with a test of the starting cursor, or the reason the rule stays.
