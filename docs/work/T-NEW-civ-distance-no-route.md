# T-NEW — The region panel shows "2048 regions" for a civilization with no land route

**Source:** T-440 (the region panel, seen while re-recording the `world_map` golden) · **Size:** S · **Needs:** — · **Status:** open

## Why

01 § Civilizations gives a region with no land route to a civilization the distance `size² × 2`, "beyond every possible route". The world map's region panel prints that number as it is: the `world_map` golden (seed `ui-test`, small world) shows "Wildwood 2048 regions (S)" and the alpine screenshot of T-440 "Gloam 2048 regions (S)". No region is 2,048 regions away on a 32 × 32 world; the line means "no land route", and the edge it names is only the dominant axis toward the home.

## What to do

When `civDistance` is the no-route value, the region panel says so ("Gloam: no land route"), in the wireframe of `menus-and-world.md` § World map and as a string. Decide whether such a civilization still arrives by its edge (caravans and raids, 18 and 20) and say it there. Unit test on a region with no route.
