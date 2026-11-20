# T-653: an ambush springs as the alert comes down

**Task:** T-653 · **Date:** 2026-11-20 · **Code:** branch `t653-ambush-all-clear` on master `174d3166` · **Source:** [the T-653 work file](../../docs/archive/tasks/T-653-ambush-at-the-all-clear.md), [T-650's measurement](2026-11-20-t650-peril-4-immigration.md)

## What the probe saw

`test/perf/t653_all_clear_probe.test.ts` plays a seed as the sweep does to a tick, saves it, and traces it from the save (the alert, the gate's doors, every threat party with its hidden members and where they stand against the gate stair, the dogs, the watch, the dwarves on the surface and what they are doing). Master's sweep `44661428169` is the "before": master `174d3166` differs from it only in the interface, and the replay of `p4-1` at shift 100 reproduces its deaths to the tick.

**`three-years-p4-1`, shift 100, day 295 (31 dead on master).** A raid of 20 came on day 293 and loitered at the north door with the gate locked; the squad stood on the gatehouse stair. An ambush of nine arrived on day 294, found nobody outdoors, made for the hearth and waited, hidden, one tile outside the north door, beside the watch's post the watchman had left for the alert, two tiles from the squad with a locked door between (no sight through it). There were no war dogs at the posts. The raid left; the alert came down at tick 353,280; the doors opened and the ambush sprang 28 ticks later on a dwarf on the stair. The fortress held 20 drinks for 42 dwarves (day 280); after four days inside, dozens were at critical thirst and came up the stair together for the drink by the south door and for the brook, through the ambush, while the south door's lock waited for the crowd outside it (up to the alert's 400-tick grace). Thirty-one died in two days, nearly all of them on their way to drink.

**`three-years-p4-4`, shift 150, day 261 (13 dead on master).** A pack of wolves held the fortress in short alerts for six days, the squad hunting in metal. At the alert raised at tick 311,680 the gate's north door locked 59 ticks later, the south door at its grace, with twelve dwarves still outside: at the brook for drink, asleep on the ground beside it, three soldiers on the hunt. An ambush of eight arrived at 312,001 and sprang on them at 312,133. The script answered it as an ambush (the hunters stood down, the doors already locked); the dwarves outside had no way in, and 13 died.

**What a player can see.** An ambush's members are hidden, not drawn, not on the threats panel, and no announcement names them until a dwarf, a war dog or a trap spots one (18 § Stealth). The game does give the player a way to find one: send someone to look. So the answer is the script's, not a follow-up to the game.

## The answer

Where ambushes come, an alert raised for a raid, a siege, an ambush or a threat warning comes down only once the watch has looked (testing-strategy.md § The long scenarios): the doors of the gate and of the second line are set open with the alert still up, so the civilians stay below while the watchmen take their posts; a watchman gone to eat, drink or sleep is replaced for the look by an adult who is not (after days inside, a critical need outranks any order: in the second sweep the station order alone changed nothing, and 298 of 523 looks ran their full 600 ticks); once each post has been held 60 ticks (a war dog holds its own), or 600 ticks have passed, the doors lock on the alert again and the alert comes down. Whatever the watch spots springs on it and keeps the alert up. Wild-animal alerts are not looked after.

Tried and not kept: opening the gate for the dwarves the lock had left outside when an ambush springs (the `p4-4` case). In the replay from the day-259 save it let them in and let the ambush follow into the halls: 13 dead, as on master.

In the `p4-1` replay from the day-292 save, the look made the ambush spring on the squad at the gatehouse stair 16 ticks after the doors opened, with no civilian out; but the thirsty came up through the open doors regardless (22 and 25 dead in two replays, against 31). That crowd is a matter of drink, not of the gate: [the thirsty go out under the alert](../../docs/archive/tasks/T-656-thirst-under-the-alert.md).

## The ambushes at the all-clear, by run

The ambushes that waited out an alert and sprang as the gate opened: on master, 40 to 100 ticks after the alert came down; on the branch, during the look or 40 to 100 ticks after the alert came down. Master's logs carry no spring tick, so its springs are read from the alert raised on the ambush's day (the same reading puts the branch's at 1 and 7, below).

| Master `44661428169` | Day | Spring | Size | Out at spring | Dead |
|---|---|---|---|---|---|
| p2-7 @ 50 | 243 | 40 after the all-clear | 5 | 3 | 5 |
| p4-1 @ 100 | 295 | 40 after | 9 | 6 | 31 |
| p4-2 @ 0 | 256 | 40 after | 8 | 2 | 2 |
| p4-5 @ 0 | 180 | 80 after | 6 | 1 | 8 |
| p4-5 @ 150 | 213 | 100 after | 8 | 8 | 6 |
| p4-6 @ 0 | 272 | 80 after | 8 | 5 | 1 |
| **6 ambushes** | | | | | **53** |

| Branch, final sweep `44699425493` | Day | Spring | Size | Out at spring | Dead |
|---|---|---|---|---|---|
| p2-1 @ 50 | 243 | 40 into the look | 5 | 3 | 0 |
| p2-4 @ 0 | 303 | 60 after the all-clear | 6 | 1 | 0 |
| p4-4 @ 0 | 159 | 20 into the look | 6 | 3 | 0 |
| p4-4 @ 100 | 189 | 60 into the look (into the halls) | 8 | 0 | 6 |
| p4-4 @ 100 | 262 | 40 into the look | 8 | 2 | 3 |
| p4-4 @ 150 | 272 | 20 into the look | 8 | 6 | 0 |
| p4-5 @ 100 | 180 | 60 into the look (into the halls) | 6 | 0 | 0 |
| p4-5 @ 100 | 276 | 20 into the look | 8 | 6 | 0 |
| **8 ambushes** | | | | | **9** |

The first sweep of the look (`44681816451`, before the watchmen were replaced) had 6 such ambushes and 34 dead: 12 in `p2-1` at shift 50, where the thirsty came out through the open doors (22 dwarves outside when the gate locked), and 12 in `p4-5` at shift 100, where the ambush walked in through them and was fought in the halls.

Springs while another alert was up (the `p4-4` case), by the same reading: master 3 ambushes, 14 dead; final sweep 2, 2. All the other ambushes: master 247, 239 dead; final sweep 246, 216. The peril-4 ambushes in all: master 154 with 211 dead, final sweep 155 with 143.

The looks: 523 in the final sweep's 80 timelines, 240 ticks at the median (mean 298), 64 of them running their full 600 ticks.

## Verdict

Final sweep `44699425493` (commit `67fc7518`), every seed green:

| | Alive | Grown | Hungry | Living | Deaths | Extinct | Need deaths |
|---|---|---|---|---|---|---|---|
| Pooled | 19.75 | 7 | 0 | 1099 | 98.75 | 0.25 | 0 |
| Master `44661428169` | 19.75 | 7 | 0 | 1033 | 121.75 | 0.5 | 0.75 |

Bounds 887.75 living and 161.88 deaths; verdict: pass. The two earlier sweeps of the branch (`44681816451`, `44692199876`, the second played exactly as the first) passed pooled at 1053.5 living and 116 deaths, with `p4-2` at shift 150 failing its rooms witness (six bedrooms, a fortress of 14 that never grew); in the final sweep it is green. The living move with the immigration rolls (T-650), so the rise in living is not claimed for the look; the deaths fell where the look acts, in the ambushes at the gate.

The figures can be rebuilt from the runs' `seed-*` artifacts while GitHub keeps them (14 days), with the `[three_years_ambush]`, `[three_years_alert]` and `[three_years_look]` lines; the branch's ambush lines carry the spring's tick, whether an alert was up and the ticks since the last all-clear.
