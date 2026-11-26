# T-784 — A dwarf walled in starves for two weeks, and nothing says she is shut in

**Closed:** 2026-11-26, in 915de50d.

**Source:** playtest 7 ([report](../../../reports/data/2026-11-26-playtest-7.md), finding 1) · **Size:** M · **Needs:** — · **Status:** open

## Why

In the late-game playtest a dwarf walled into a dead-end corridor starved beside a fortress holding a thousand meals, and two other dwarves were sealed into a tomb by coffins. On Winter 2, Year 4, I built a wall across the corridor to cavern 2, as the breach hint advises. When it was finished, an immigrant, Lida Crageye, was on the far side. From Winter 4 to Winter 20 the log said "! Lida Crageye is dying of thirst." and then "! Lida Crageye is starving." fourteen times, once a day, and then "!! Lida Crageye has starved to death." No line said she could not reach food. The one hint about starving ("Dwarves are starving, and there is food at hand: 1 cat, 2 cows and 1 sheep to slaughter …") assumes the fortress lacks food (`ui/food-at-hand.ts`), and it was shown while 1,000 meals stood in the stockpiles. Earlier, I placed coffins in a 3 × 4 tomb from the far end. Coffins are impassable (`buildings-and-furniture.md`, `pass` no). Four dwarves who were placing them were left on the one free tile. Ranulf's view read "Activity: Idle", thirst 100, "-13 I am thirsty. Helps: drink they can reach; see Stocks [s]". The placement of the wall and of the last coffin gave no warning that it closed anyone in.

T-745 and T-770 already say "cannot reach drink behind the locked doors" for dwarves shut in by the alert's locks (`ui.military.cut_off.*`). A wall, a coffin or a cave-in shuts dwarves in the same way, and the game does not say so.

## What to do

Decisions taken here:

- **The need lines say when the dwarf cannot reach.** When a dwarf's `Starving` or thirst line fires and no food (drink) item that the dwarf could eat is reachable from its tile (22's walker label against the stocks' tiles; 10 already knows "food it can reach" for the Mood Helps line), the line reads "! Lida Crageye is starving, shut in at (10,13,z14) with no way to food." and its focus is the dwarf. Repeats fold by day as T-741's standing alerts do, so fourteen days are one line with "(14 days)".
- **The starving hint checks reach first.** `hint_starving` lists slaughter, fishing and gathering only when the stocks hold no edible food that some starving dwarf can reach. When food exists and a starving dwarf cannot reach it, it reads "Food is in the stockpiles, but N dwarves cannot reach it: [u] lists them."
- **Placement warns when it seals.** A wall, floor-blocking building or coffin placement whose finished state leaves a fortress creature with no path to the hearth (or the wagon) says so on the status row, as the dig tool's reach check does ("Coffin placed · seals 4 dwarves at (28,20,z28) from the hall."). It does not refuse: the player may mean it.

Leave to the implementer: whether the reach check runs on the need line's tick or once an hour per hungry dwarf (cost at 80 dwarves).

## Decisions made while implementing

- **The reach check runs on the need line's tick**, once per `Starving` event (one per starving dwarf per day): 13's `countAvailable` of the need's filter and one `findItem` on the dwarf's walker label (`shutAway` in `ui/shut-in.ts`, beside the locked-door check it mirrors). Searching with `{ reservable: true }`, as 10 and the locked-door check do, so forbidden, owned or depot food counts as out of reach.
- **Thirst counts stored drink only.** A dwarf dying of thirst with drink stored and none on its label reads "shut in … with no way to drink"; a well or a brook it could reach would have kept it from dying of thirst at all, so they are not searched.
- **The shut-in line replaces the dwarf's place in the day's line**, one line per dwarf (`announce.starving_shut_in`, `announce.thirsting_shut_in`), a standing alert keyed by `dwarf`, so the fold gives "(14 days)" and the days after the first neither flash nor pause. Its subject is the dwarf. A dwarf shut in by the alert's locked doors gets it too at `Starving`: the words are true there as well.
- **The hint's other case.** With food stored and every starving dwarf able to reach some, the hint keeps the food-at-hand list as before (the dwarf is on its way to eat).
- **Sealing in counts dwarves only**, not animals: the playtest's losses were dwarves, and the words say "dwarves". Home is the hearth, else the wagon; a dwarf already cut off from home is not this placement's doing. Blocking buildings still planned count with the new one ("whose finished state"), so the sixth coffin of a tomb is the one that warns. A dwarf standing on a tile the building will block counts by the tiles beside it (14 steps it off there). The check is a flood of 22's walker edges from home with the blocked tiles taken out and no corner cut past one; it stops when every dwarf is met. On the playtest's Year 7 save (80 dwarves, 48 × 48 × 48) it took 4 to 20 ms a placement. A drag is one check for all its tiles. The warning is in the alert colour and is also an alert in the log, focused on the first sealed dwarf, as the depot's unreachable placement is.
- UI only: no world hash moves.

## Done

- [x] 10's starving and thirst lines say "shut in" with a focus when no edible item is reachable; a test with a dwarf walled into a corridor.
- [x] `hint_starving` reads reach first; a test with full stocks and one dwarf shut in.
- [x] The build tool's status row warns when a placement seals a creature; a test with a coffin closing a 1-tile pocket.
- [x] 24 § Announcements and the log names the new lines.
