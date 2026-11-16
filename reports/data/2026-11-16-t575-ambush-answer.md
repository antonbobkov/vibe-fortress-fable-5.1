# T-575: the three-year script's answer to an ambush

The script answered every party but a thief as a raid: the hearth alert, and the squad to the gatehouse stair (`checkFortressDefense`, `test/scenarios/three_years_fortress.ts`). An ambush does not come to the gate. It arrives hidden, springs on the dwarves at work outdoors and hunts them, then loiters by the gate once they are in (18 § Party AI). The squad's soldiers are on duty under the alert, so they do not flee as the civilians do (16 § Squads), and the ones caught outdoors fought it a few at a time on their way to the stair.

## The probe: 47 ambushes from saves

On T-574's code: `test/perf/t575_ambush_probe.test.ts` plays a seed at shift 0 as the sweep does and saves the game and the script's state on the tick each ambush arrives, before it springs (`T575_PROBE=save`). It then plays every save on for four days, or until the ambush is gone, under each answer (`T575_PROBE=replay`). Each row is one answer over the same saves, from the journal's census (`three_years_ambush`, below): the dwarves dead while the ambush was on the map, the soldiers among them, and the Gloam that fell. The saves were made with the script answering an ambush only once it had sprung (the first answers below), so the fortress before each save is not master's to the tick; all answers start from the same saves.

| Answer | Peril-4 saves | Sprang | Dwarves dead | Soldiers | Gloam fell |
|---|---|---|---|---|---|
| p4-1, p4-3, p4-4 (18 saves) | | | | | |
| Raid answer, from the spring | 18 | 18 | 53 | 30 | 17 |
| Squad below behind the line, from the spring | 18 | 18 | 42 | 20 | 10 |
| Squad sent out to kill every ambusher, from the spring | 18 | 18 | 121 | 70 | 41 |
| Squad stood down, from the spring | 18 | 18 | 28 | 7 | 3 |
| Raid answer, from arrival (master) | 18 | 10 | 19 | 10 | 8 |
| **Stood down when outnumbered, from arrival (T-575)** | 18 | 7 | **8** | **1** | 1 |
| p4-2, p4-5, p4-6 (18 saves) | | | | | |
| Raid answer, from the spring | 18 | 18 | 39 | 18 | 15 |
| Squad stood down, from the spring | 18 | 18 | 28 | 5 | 4 |
| Raid answer, from arrival (master) | 18 | 6 | 12 | 5 | 2 |
| **Stood down when outnumbered, from arrival (T-575)** | 18 | 6 | **5** | **0** | 1 |

Every peril-4 ambush in the probe was larger than the squad's armed soldiers (six to nine Gloam against three to five), so T-575's answer stood the squad down in all 36. Over them: 31 dwarves dead, 15 of them soldiers, with master's answer; 13 and 1 with T-575's.

Sent out against the ambush, the squad died: five soldiers against seven Gloam in steel lose (16 § Squads: a peril-4 raid of ten beats six Skilled soldiers in iron). Kept below behind the second line, it still lost two soldiers in three: on duty, a soldier caught outdoors fights what it sees on the way in. Stood down, the soldiers are civilians for the alert, flee and shelter with the others.

Peril 2 (p2-1, p2-4, p2-6; 11 saves), where an ambush is three to five and the squad three to five:

| Answer | Sprang | Dwarves dead | Soldiers | Gloam fell |
|---|---|---|---|---|
| Raid answer, from arrival (master) | 6 | 12 | 3 | 6 |
| Squad stood down for every ambush | 5 | 15 | 0 | 2 |
| **Stood down when outnumbered (T-575)** | 6 | **12** | 3 | 6 |

At peril 2 the squad at the gate stair fights an ambush of its own size about evenly and fells more of it, so an ambush no larger than the squad's armed soldiers is still met there.

## Day 297 of three-years-p4-1

T-574's save (tick 355,200, T-555's code) played on three days with `t575_replay.test.ts`: T-555's code lost 37 dwarves; T-574's 3 (one soldier, who fought alone outside the gate as it locked); T-575's 2, none of them soldiers.

## The gate's lock

19 § Hearth alert retreat locks a `lock_on_alert` door once no fortress creature has stood on its outer side for 20 ticks, or 400 ticks (eight hours) after the alert. The 25 shut out on day 297 were walking back and forth on 22's path cache (T-574); with T-574 the gate locked on that ambush with no civilian outside. A gate that waits longer for a dwarf who does not come in holds itself open to the ambush that is hunting that dwarf. The rule stands.

## The census over the sweep

The journal's census (`three_years_ambush`) notes each ambush that sprang once its party is gone: its size, the dwarves on the surface when the script looked, the squad's armed soldiers (those stood down included), the dwarves and soldiers dead and its members fallen in between, and the dwarves on the surface (the gate stair's included) when the gate's first door locked. It reads events and commands nothing. Over the sweep's four shifts, both on T-574's code:

| | Ambushes sprung | Dwarves dead | Soldiers among them | Gloam fell | Gate locks | Dwarves on the surface at the lock (mean) |
|---|---|---|---|---|---|---|
| Peril 4, before (`0cff7a8f`, run 43888912003) | 79 | 155 | 81 | 69 | 62 | 3.5 |
| Peril 4, T-575 (`034c90e6`, run 43899961488) | 62 | 97 | 18 | 7 | 47 | 1.6 |
| Peril 2, before | 57 | 90 | 35 | 43 | 44 | 3.5 |
| Peril 2, T-575 | 51 | 83 | 25 | 31 | 39 | 2.9 |
| All, before | 136 | 245 | 116 | 112 | 106 | 3.5 |
| All, T-575 | 113 | 180 | 43 | 38 | 86 | 2.2 |
| Peril 4, T-575 on T-563 (`73e6aa81`, run 43921695628) | 66 | 92 | 21 | 5 | 51 | 1.3 |
| Peril 2, T-575 on T-563 | 53 | 104 | 32 | 44 | 38 | 3.5 |

Before is T-574's code with the census alone (`0cff7a8f`), which pooled exactly T-574's row (1070.25 living, 109.5 deaths): the census changes nothing. The two timelines part at the first ambush, so the ambushes are not the same ones. At peril 4 more than half the dwarves an ambush killed had been soldiers (81 of 155); now fewer than one in five (18 of 97). The Gloam fall less: the squad no longer meets them.

## The sweep

| Code | Run | Living | Deaths | Extinct | Need deaths | Verdict |
|---|---|---|---|---|---|---|
| T-574 with the census (`0cff7a8f`) | 43888912003 | 1070.25 | 109.5 | 0.5 | 1 | pass |
| T-575 on T-574 (`034c90e6`) | 43899961488 | 1113 | 89.5 | 0 | 0.5 | pass |
| T-563, master `a50f4ebc` (its commit) | 43894285997 | 1043.25 | 117 | 0.25 | 0.75 | pass |
| T-575 on T-563 (`73e6aa81`) | 43921695628 | 1057.5 | 99.25 | 0 | 0.5 | pass |

On each base the deaths fall by 18 to 20 a sweep and the living rise by 14 to 43. One seed job failed its own witness in each T-575 sweep: `three-years-p4-1` at shift 50 on T-574 ended with 8 living and no dining hall (before T-575 it died out on day 142), and `three-years-p4-4` at shift 100 on T-563 with no dining hall, as on T-563's own sweep. The reference is left as T-574's: one set of four shifts is not a best figure (§ The twenty-seed sweep).

`defence_seeds` (run 43921701893, `73e6aa81`): pass, 6.13 raids turned back of 8 and a soldier killed in 6.75 (T-574: 6.25 and 7.63). The annual instrument (run 43921707459): pass, the pooled row T-563's. `ci.yml` (run 43921712040): green, 3,930 tests and e2e 44 passed.
