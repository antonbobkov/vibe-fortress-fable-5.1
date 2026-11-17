# T-580: the three-year fortress works below ground or by the gate where ambushes spring

T-576 made the script answer an ambush only once it springs. This task changes how the fortress works once ambushes are possible (18's schedule preview: year 1 autumn at perils 2 and 4), as a player who has lost dwarves to them would. Everything here is the script's (`test/scenarios/three_years_economy.ts`, `three_years_fortress.ts`); no game rule changed.

## What an ambush finds

`test/perf/t580_exposure_probe.test.ts` plays a seed with the sweep's loop and, from the first day ambushes are possible, notes every 20 ticks each dwarf on an outdoor tile: what it is doing and how far from the gate stair. On T-576's head (`bfe96b6b`), `three-years-p4-1` at shift 0, days 56 to 140, had 3.4 dwarves outdoors on average, 1.0 of them 8 or more tiles from the gate; crafting at the surface workshops was the largest share (1.3), then eating, drinking and sleeping on the way in from the far workshops, and hauling. In year 2 the far dwarves were mostly crafting, hauling from the fields and the woods, farming, and drinking at the brook when the drink ran out.

## What the script does

1. **A workshop hall below.** From day 0 a stair goes down from the west corridor of the hall level and a hall of twelve workshop sites (four by three, a lane along every row) is dug one level below the halls, a step ahead of routine work. Each workshop sited more than `WORK_NEAR_GATE` (6) tiles from the gate goes up there instead; one already standing is built again below and the surface one taken down once its twin stands, with its orders and its worker. The forge, which takes the fortress's one anvil, is taken down first. On the probe's seeds the far workshops were all below by day 45 to 100.
2. **Food and drink below.** From the first possible ambush the surface stockpile takes no food or drink and the surface drink stockpile is removed.
3. **Farm strips by the gate.** Each new surface strip goes on the free soil nearest the gate instead of west of the first field (15 to 30 tiles out).
4. **A watch at the gate.** An ambush with nobody outdoors makes for the hearth (18 § Party AI: the nearest dwarf outdoors, else the hearth), hidden, through the open gate and into the halls. Steps 1 to 3 alone emptied the surface for most of the day, and the probe found four ambushes of five springing on the stair or in the halls in `three-years-p4-1` at shift 150 and `three-years-p4-3` at shift 0; both fortresses died out. So from the first possible ambush a squad of one stands on duty outside each gate door, going in under any alert. A watchman is at his post about a quarter of the time (he eats, drinks and sleeps below), so:
5. **War dogs.** A kennel in the workshop hall, a chain forged ahead of the squad's kit, a trainer who does nothing else until each post has its dog, every dog trained for war; a war dog is posted with each watch in the watchman's place and stays there (`SPOT_RADIUS_DOG` 10).

## Sweeps

Rows as the verdict jobs print them (alive at year 1, peril-0 grown, peril-0 with need deaths, living at year 3, dwarf deaths, extinct, need deaths).

| Code | Run | Pooled | Verdict |
|---|---|---|---|
| T-576 head `bfe96b6b` (before) | 44104161842 | `\| **Pooled** \| 20 \| 7 \| 0 \| 983.5 \| 138 \| 1 \| 0.5 \|` | blocked (deaths) |
| Steps 1 to 3, every workshop below (`0e6c4555`) | 44116079731 | `\| **Pooled** \| 19.25 \| 7 \| 0 \| 907.75 \| 151.25 \| 4.75 \| 5.5 \|` | blocked |

Steps 1 to 3 cut the ambush census's peril-2 deaths from 136 to 123 over the four shifts but raised peril 4's from 258 to 334: with the surface empty, peril 4's large ambushes walked in at the gate. With the workshops by the gate kept up and the dwarf watch (`b4ce3abe`, its verdict job cancelled; pooled from 76 of its 80 seed results) the peril-2 deaths fell further, to 89, and peril 4's stayed at 333.
