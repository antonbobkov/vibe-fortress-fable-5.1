# T-593: are peril-4 ambushes too deadly for a sensible player?

A measurement and a recommendation; no game rule and no script changed. Two sources:

- **The latest master sweep**, T-587's (run 44254295856, code `0cdf16bb`: master with T-596's squad that hunts an ambusher in the halls). Its 80 seed logs hold the journal's census (`three_years_ambush`: each sprung ambush's size, dwarves on the surface, armed soldiers, dwarves dead while it was on the map, its members fallen, the day it ended) and every death with its killer's species (`three_years_death`). The sweep pooled 1057.25 living and 100.75 deaths; its rows are T-596's.
- **A probe on master `8d022dd9`**, `test/perf/t593_ambush_victims_probe.test.ts` (local diagnosis, not part of `npm test`). It plays a seed with the sweep's loop and notes, for each sprung ambush, where its members stood and the fortress creature nearest them (the likely spotter), and for each fortress creature its members wound, where the first wound found it and how it ended. Eight peril-4 timelines (`p4-1` to `p4-6` at shift 0, `p4-5` and `p4-6` at shift 50) and two of peril 2 (`p2-4`, `p2-5`). T-599 changed the timelines since the sweep, so the probe's ambushes are not the sweep's; they are master's.

## The census (sweep, four shifts)

| | Peril 2 (28 fortresses) | Peril 4 (24 fortresses) |
|---|---|---|
| Ambushes sprung | 96, 3.4 a fortress | 150, 6.3 a fortress (41, 58 and 51 in years 1 to 3) |
| Size | 4.8 (3 to 6) | 7.4 (5 to 10) |
| Dwarves dead while one was on the map | 84, **0.88** an ambush | 135, **0.90** an ambush |
| Ambushes that killed nobody | 57 (59%) | 82 (55%) |
| Ambushes that killed five or more | 5 | 5 |
| Soldiers among the dead | 22 | 24 |
| How long one stays, spring to gone | 1.6 days (at most 5) | 2.0 days (at most 4) |
| Its members fallen | 76 of 457 (17%) | 84 of 1,113 (8%) |
| War dogs killed by ambushes | 104 | 133, 5.5 a fortress |
| Dwarf deaths, all causes | 166 (5.9 a fortress) | 234 (9.8 a fortress) |
| Of them, by ambushes (killer an ambush's warrior or archer, on its days) | 82 | 123, and 5 more on days a raid was also on the map |
| By raids and sieges | 13 | 51 |
| By wild animals | 8 | 5 |
| Living at year 3 | 1,280 (45.7 a fortress) | 959 (40.0 a fortress) |

So a peril-4 fortress loses about 5.5 dwarves to ambushes in three years, 1.8 a year, out of a fortress of 15 to 70; ambushes are 55% of peril 4's deaths and 51% of peril 2's. Of the 277 dwarves the Gloam killed in the sweep (ambushes, raids and sieges), archers killed 155.

**An ambush at peril 4 is no deadlier than one at peril 2.** Each kills 0.9 dwarves on average at both perils, though peril 4's are half again as large. Size does not predict the toll at peril 4 either: ambushes of six killed 0.50 each (42), of seven 1.38 (47, the two worst among them), of eight 0.58 (24), of nine 1.12 (25), of ten 0.64 (11). Peril 4 costs more because ambushes come about twice as often (every 28 to 56 days against 60 to 120), as the schedule says they should.

**The toll is a tail.** The ten worst peril-4 ambushes killed 60 of the 135; the two worst killed 14 each, both on shift 50: in `p4-5` (day 180, ten dwarves still on the surface when the gate locked) and in `p4-6` (day 192, nobody outdoors at the spring, so most likely by the gate or in the halls; four soldiers among the dead). Two of peril 4's three extinctions were year-1 raids (`p4-1` at shift 50 on day 63, `p4-2` at shift 150 on day 82), the third that `p4-5` ambush. Peril 2's worst was an ambush of five that killed 12 (`p2-4` at shift 150).

**The trend.** The census's peril-4 deaths over the same four shifts: 277 on T-576 (the script answering an ambush only once it springs), 271 on T-580 (work moved below ground and by the gate, a watch and war dogs), 135 now, after T-596. Peril 2's: 162, 116 and 84.

## Where the victims stood (probe, peril 4)

Fifty-two ambushes sprang in the eight timelines; 39 dwarves died with an ambush member as their killer (raids and sieges killed 11). The members wounded 87 dwarves and 40 war dogs.

| First wound | Wounded | Dead within two days |
|---|---|---|
| Indoors (the gatehouse, the stair, the halls) | 23 | **0** |
| Outdoors, 0 to 2 tiles from the gate stair | 26 | 8 |
| Outdoors, 3 to 5 | 8 | 4 |
| Outdoors, 6 to 8 | 11 | 7 |
| Outdoors, 9 to 12 | 8 | 4 |
| Outdoors, 13 or more | 11 | **10** |
| All | 87 | 33 (24 civilians, 5 soldiers, 4 watchmen) |

- **Every death began outdoors**, and the farther out, the surer: ten of eleven dwarves wounded 13 or more tiles from the gate died. Seven of the 33 were wounded outdoors on another level than the gate's (fields and woods on the terraces below or above it).
- **The victims had seen the ambush.** 22 of the 33 were already fleeing when first wounded. A dwarf spots at `SPOT_RADIUS` 6, a war dog at `SPOT_RADIUS_DOG` 10, and a bow reaches 14: at the spring the archers have the fleeing dwarf in range, and a gloam archer (0.18) or warrior (0.165) outruns a dwarf (0.15). 23 of the 33 bled out, 17 of them after reaching the halls, a median 197 ticks after the wound; ten were killed outright.
- **Who saw it first.** The fortress creature nearest the members at the spring was a civilian in 31 ambushes, a soldier in 9, a watchman in 5 and a war dog in 7; a dwarf was at the edge of its radius (6) in 21 of 45. The members are strung out on the leader's path when it springs, the nearest member often in the open by the gate and the rest up to 30 tiles out.
- **War dogs.** All 40 dogs the members wounded died. The dogs posted with the watch spot and then fight, and the kennel replaces them.
- **Peril 2 has the same tail.** In the probe's `p2-4` an ambush of four sprang on day 63 on a field a level below the gate and killed eight in a day, a medic at a bandage and a dwarf bringing water among them; the fortress died out.

## Against what the spec and the owner ask

- 18's schedule calls peril-4 ambushes *frequent*, and the vision makes peril the difficulty: peril 4 is the hardest map. The sweep's peril-4 fortresses live (21 of 24) and grow to 40 on average, and lose 1.8 dwarves a year to ambushes, the same toll per ambush as at peril 2.
- The owner's bar for wildlife (a steel-equipped, well-trained squad of about five fighters, a few archers and a wizard should have no problem) is a bar for squads. The script's squad of five never meets a peril-4 ambush: an ambush larger than its armed soldiers is sheltered from (T-575), and every peril-4 ambush is six or more. So the census measures a player who always hides from a peril-4 ambush and never fights one; a player with the owner's squad would fight some. Whether that squad beats six to ten Gloam in iron in the open is not measured (the arenas measured three soldiers against an ambush of four).
- "Don't make them come too often, it's a nuisance" was said of wildlife. A peril-4 ambush comes every 45 days or so, stays two days, and in 55% of cases kills nobody: an alert, a sheltering, a lost day's work.

## Options

| | Change | Expected effect | Cost |
|---|---|---|---|
| (a) Smaller | Lower peril 4's ambush `base`, `perRenown` or `max` | Little: per-ambush deaths do not fall with size (peril 2's ambushes of five kill as many as peril 4's of seven). | One content row and a sweep; peril 4's ambushes lose what sets them apart. |
| (a) Slower | Longer interval (say peril 3's 40 to 80 instead of 28 to 56) | Deaths fall with the count, about 30% fewer: some 10 a sweep, 1.7 a peril-4 fortress over three years; fewer alerts. | One content row and a sweep; 18's *frequent* holds only loosely. |
| (a) Fewer archers | Ambush composition 60/40 to, say, 80/20 | Archers do more than half the Gloam's killing, on fleeing dwarves; perhaps a quarter of ambush deaths. *Unmeasured.* | One content row (it applies to every peril); an arena and a sweep to measure it. |
| (b) Wider spotting | `SPOT_RADIUS` or `SPOT_RADIUS_DOG` up, or a watch bonus | Small: the victims had already seen the ambush; a bow still reaches 14, and the watch and dogs stand where deaths are rarest (by the gate). | A constant and a sweep; thieves get easier too. |
| (b) A tell | A vague warning when an ambush arrives | Large: most of the 34 ambush deaths a sweep, since every death began outdoors and the player could call everyone in. | Undoes the ambush as 18 defines it (no warning), adds an alert every 45 days at peril 4 (the nuisance), moves the sweep's reference. |
| (c) Leave as is | Nothing | The sweep stays at about 1057 living and 101 deaths (1132 and 83 with T-582's burial). | Peril 4 keeps a tail of bad ambushes, as peril 2 does. |

## Recommendation: (c), leave peril 4's ambushes as they are

A peril-4 ambush kills no more than a peril-2 one; the extra cost at peril 4 is how often they come, which is what 18 asks of the hardest peril. The deaths have halved since T-596, every one of them began with a dwarf outdoors, and the census measures a fortress that hides from every peril-4 ambush and never fights one, which a player with a strong squad need not do. Of the levers, a smaller ambush would not help, and a tell would take away what an ambush is.

One thing is unmeasured and would decide it: whether the owner's squad (five Proficient steel soldiers, three marksdwarves and a caster) can meet a peril-4 ambush of six to ten Gloam in iron in the open. If it can, a player at peril 4 has an answer the script does not use, and (c) stands. If it cannot, the lever is the ambush's archers (60/40 to 80/20), not its size or the warning. Filed as a work file, `docs/work/T-NEW-peril4-ambush-arena.md`.
