# T-518 — The three-year fortress is one broken door from its halls, and a siege's trollkin break it when they follow a dwarf there

**Closed:** 2026-11-07, in 96935615.

**Source:** T-512's sweep and siege probe ([probe](../../../reports/data/2026-11-06-t512-siege.probe.ts.txt)). With T-512's sowing rule, `three-years-p4-3` dies out in its year-2 siege on day 188–189 in all three timeline samples (runs 42325947404, 42325949783, 42325952264). It survives the same siege in all three samples of master (42325939870, 42325942200, 42325944699). · **Size:** M · **Needs:** — · **Status:** open

## Why

The siege of day 186 is the same in both: north edge, 38 members (2 gloam captains, 4 trollkin, 9 archers, 20–21 warriors, 2 hexers). Its goal, the hearth, cannot be reached, so it loiters at the nearest tile it can reach (24,5,32). The alert is up and both gatehouse doors are locked. The gatehouse is the stair tile (`cx+6, cy+6`) between a north and a south door, with nothing between the stair and the halls below.

- **On master** the siege stands north of the gate. Its trollkin stand one level down (24,4,32 and 26,4,32), next to no door, and they never break one. After five days the siege leaves with loot, and no dwarf dies.
- **With the sowing rule**, the day before the siege arrives, 6 dwarves are on the surface, some of them at and south of the gate (master has 1). Some of the siege's members follow them round to the south side. A trollkin stands next to the locked south door, breaks it in `DOOR_BREAK_TICKS` (600), and the siege walks down the stair into the halls. 31 to 40 dwarves die on days 187–188.

Which side the trollkin end up on depends on where the last dwarves are when the siege comes, so this is not a farming rule. The sowing change only moved who was outdoors at that moment, and moved it the same way in each sample (the samples' one-tick shifts do not separate this seed's timelines much). The game rules work as written: trollkin break doors (18 § Party AI), and a locked door is the only thing between the gate and the halls. A player who has seen a siege with trollkin builds a second line. The script does not.

## What to do

- In `three_years_fortress.ts` (`checkFortressDefense`), give the gatehouse a second line, as a player who expects sieges would build one. For example, a door at the foot of the stair on the hall level that locks on alert, or a drawbridge raised on a siege's warning. A broken gate door should then leave the siege in the gatehouse, not in the halls.
- Optionally, station the squad at the gate stair when a siege's door-breakers are next to a door: the squad meets them there, and does not wait below.
- Measure it on the twenty-seed sweep over shifted samples (T-513). `p4-3` with T-512 should survive its year-2 siege, and no other seed should get worse.

## Done

- No three-year seed loses its halls to a single broken gate door; the sweep's set rule holds over the samples.
