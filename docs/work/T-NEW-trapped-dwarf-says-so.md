# T-NEW — A dwarf walled in starves for two weeks, and nothing says she is shut in

**Source:** playtest 7 ([report](../../reports/data/2026-11-26-playtest-7.md), finding 1) · **Size:** M · **Needs:** — · **Status:** open

## Why

In the late-game playtest a dwarf walled into a dead-end corridor starved beside a fortress holding a thousand meals, and two other dwarves were sealed into a tomb by coffins. On Winter 2, Year 4, I built a wall across the corridor to cavern 2, as the breach hint advises. When it was finished, an immigrant, Lida Crageye, was on the far side. From Winter 4 to Winter 20 the log said "! Lida Crageye is dying of thirst." and then "! Lida Crageye is starving." fourteen times, once a day, and then "!! Lida Crageye has starved to death." No line said she could not reach food. The one hint about starving ("Dwarves are starving, and there is food at hand: 1 cat, 2 cows and 1 sheep to slaughter …") assumes the fortress lacks food (`ui/food-at-hand.ts`), and it was shown while 1,000 meals stood in the stockpiles. Earlier, I placed coffins in a 3 × 4 tomb from the far end. Coffins are impassable (`buildings-and-furniture.md`, `pass` no). Four dwarves who were placing them were left on the one free tile. Ranulf's view read "Activity: Idle", thirst 100, "-13 I am thirsty. Helps: drink they can reach; see Stocks [s]". The placement of the wall and of the last coffin gave no warning that it closed anyone in.

T-745 and T-770 already say "cannot reach drink behind the locked doors" for dwarves shut in by the alert's locks (`ui.military.cut_off.*`). A wall, a coffin or a cave-in shuts dwarves in the same way, and the game does not say so.

## What to do

Decisions taken here:

- **The need lines say when the dwarf cannot reach.** When a dwarf's `Starving` or thirst line fires and no food (drink) item that the dwarf could eat is reachable from its tile (22's walker label against the stocks' tiles; 10 already knows "food it can reach" for the Mood Helps line), the line reads "! Lida Crageye is starving, shut in at (10,13,z14) with no way to food." and its focus is the dwarf. Repeats fold by day as T-741's standing alerts do, so fourteen days are one line with "(14 days)".
- **The starving hint checks reach first.** `hint_starving` lists slaughter, fishing and gathering only when the stocks hold no edible food that some starving dwarf can reach. When food exists and a starving dwarf cannot reach it, it reads "Food is in the stockpiles, but N dwarves cannot reach it: [u] lists them."
- **Placement warns when it seals.** A wall, floor-blocking building or coffin placement whose finished state leaves a fortress creature with no path to the hearth (or the wagon) says so on the status row, as the dig tool's reach check does ("Coffin placed · seals 4 dwarves at (28,20,z28) from the hall."). It does not refuse: the player may mean it.

Leave to the implementer: whether the reach check runs on the need line's tick or once an hour per hungry dwarf (cost at 80 dwarves).

## Done

- [ ] 10's starving and thirst lines say "shut in" with a focus when no edible item is reachable; a test with a dwarf walled into a corridor.
- [ ] `hint_starving` reads reach first; a test with full stocks and one dwarf shut in.
- [ ] The build tool's status row warns when a placement seals a creature; a test with a coffin closing a 1-tile pocket.
- [ ] 24 § Announcements and the log names the new lines.
