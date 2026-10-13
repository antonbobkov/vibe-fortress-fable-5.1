# The economy fixture at default priorities — 2026-10-12

Measured for T-145 on the branch `t-145`, from `1532867` (the port) to `ac88f56` (the script the sweep ran). Raw numbers: [the six main runs](../data/2026-10-12-economy-fixture-at-default-priority-data.json), [the sweep](../data/2026-10-12-economy-fixture-sweep.json), [the probe](../data/2026-10-12-t145-probe.test.ts.txt), [a bleeding soldier's trace](../data/2026-10-12-t145-bleeding-soldier-trace.txt), [the mood instrument's output](../data/2026-10-12-economy-fixture-mood-instrument.txt).

## What was examined

The rewritten three-year economy fortress of the branch `f-17` (`ffbc723`), ported onto master `f8b626b` and changed as the Decision list of T-145 says. A year is 112 days, so the run is 336 days. Everything the script does is a player command. No file under `src/` changed.

- **Main scenario**: `npm exec -- vitest run -c vitest.perf.config.ts test/perf/three_years_main.test.ts`, seed `three-years`, peril 0, six runs, each at the commit named in the data file. A run takes 11 to 21 minutes.
- **Probe**: the fixture played to a given day, then boars placed 16 tiles south of the gate with the test world's spawn hook; 40 seconds a run. Only the probe adds an animal; the main runs and the sweep have the game's own arrivals.
- **Sweep**: `test/perf/three_years_seeds.test.ts`, 20 seeds, once, at `ac88f56`.
- **Mood instrument**: `test/perf/mood_breakdown.test.ts`, once, at `ac88f56`.

## The main scenario, run by run

| Run | Script | Stops on | Dwarves y1 / y2 / y3 | Wealth y1 / y2 / y3 | Trades / visits | Dwarf deaths |
|---|---|---|---|---|---|---|
| 1 | the port as it stood | no game fault; `forge_crafts` 0 | 16 / 25 / 0 | 17,287 / 17,245 / 10,518 | 6 / 8 | 26: one struck by a dwarf (day 223), 20 by four boars (days 248–286), 5 starved (days 314–327) |
| 2 | Decision list, spears, militia | thought-cap assertion (46.8 > 41) | 14 / 35 / 48 | 16,673 / 14,598 / 13,568 | 6 / 6 | 1: struck by a dwarf, day 85 |
| 3 | kitchens follow the population, nobody hunts | `forge_crafts` 0 | 15 / 34 / 42 | 17,967 / 19,198 / 14,331 | 6 / 6 | 2 militia after boar fights (days 314, 321); no plants from day 196, no meal or drink on day 336, mood mean 21.2 |
| 4 | surface farm strips, one anvil, iron crafts first | **only** "no dwarf died" | 16 / 25 / 46 | 22,896 / 21,792 / 21,547 | 6 / 6 | 1 militia bled out, day 159 |
| 5 | armour and bandages bought | only "no dwarf died" | 15 / 35 / 59 | 17,419 / 32,495 / 27,515 | 6 / 6 | 2 militia bled out, days 121 and 271 |
| 6 | farm and meals sized for a winter | only "no dwarf died" | 15 / 34 / 56 | 18,891 / 53,181 / 23,474 | 8 / 8 | 2 militia bled out, days 260 and 261 |

In runs 4 to 6 every recipe witness is above zero (`forge_crafts` 15 to 18, `alloy_steel` 5 to 10, `cut_gem` 9), the halls are engraved (96), a trade is made at every visit, the anvil is bought on day 126 or 127, the T-176 invariants and the three played saves hold, and the longest flight is 90 to 211 ticks. T-263 no longer stops the run.

Run 6's year-2 wealth is 41,850 marks of meals and drink out of 53,181. Food eaten is 0.36 to 0.38 meals a dwarf-day and drink 0.54 to 0.61, against the model's 0.48 and 0.77. The mood mean at day 336 is 56.7 in run 4 (46 dwarves), 38.4 in run 5 (59) and 42.5 in run 6 (56); the script has 18 beds, because its bedroom plan holds 20 rooms.

## Wild animals

**What the probe measured** (seed `three-years`, two boars beside the fortress on day 25 unless said; one run each, so each line is one sample):

| The fortress | Dwarves lost |
|---|---|
| Squad of three with wooden clubs, kill order | 4 of 7 to one boar, then one struck by a dwarf |
| The same with iron mail and shields, still clubs | 4: three to boars, one to a squad member's stray bolt |
| The same with leather jerkins and wooden shields, clubs | 5, three of them soldiers |
| Clubs, squad kept below, civilians sheltered (no kill order) | 1 soldier, then all starved under the alert by day 46 (that script had no drink in stock) |
| Three iron short swords, no armour, kill order | none |
| Three iron spears and wooden shields, kill order | none |
| Three spears, the woodcutter's axe and the miners' picks (the script), kill order | none in most probes of two or three boars; one militia bled out afterwards in the others (three boars on day 35 or 45) |
| The script without a kill order (shelter only) | 2, and 9 of 9 with three boars on day 12 (two to boars, seven starved by day 53) |

So the first-week advice of T-220 holds for the shelter, the door and the lock, but a club does not stop a boar: a real weapon does. The script therefore brings three iron spears in the wagon in place of the crossbow, its bolts and quiver, the strawberry and flax seed, the mechanism, the leather, the table, the chairs and the meat (1,498 of 1,500 marks; two spears where the anvil comes too), forms the squad on the first day from the woodcutter, the mason, the seventh founder and the two miners, raises the hearth alert and gives kill orders whenever a boar, a badger or another aggressive or territorial animal is within 14 tiles of the gate or of a dwarf on the surface, and looks every 20 ticks.

**What still kills.** In runs 3 to 6 the alert was raised 14 times for a wild animal and 7 militia died, every one of bleeding or infection after the fight, none in it. The trace of one such death (a badger bite, probe, day 44) is in the data: the dwarf stays `duty` for 300 ticks after admission (T-211), `stop_bleeding` is `fetching` for 300 ticks, then `blocked: missing_input` with five cloth in stock, then open with no taker for 140 ticks, and the dwarf dies in the hospital bed. In another probe a serious puncture drains 700 blood in 260 ticks while the medic's fetch is still under way. In every probe the cloth and thread stayed on the surface for 60 days, though a hospital zone with a bed and a chest stood six levels down. This is filed as T-301.

**Dwarf struck by dwarf.** An immigrant hunter arrives with a crossbow. In the probe a squad member holding one hit a patient in the hospital with a bolt meant for a boar, and the patient bled out; `16` § Ranged says a creature in the path is hit with half the chance, so it is the rule, not a fault. Run 1's first death and run 2's only death have a dwarf as killer and no alert standing; their cause was not traced. The script now switches hunting off and brings no crossbow, and no dwarf-on-dwarf hit was journalled in runs 3 to 6 or in the sweep.

## The sweep

One run at `ac88f56`.

| Seed | Dwarves y1 / y2 / y3 | Wealth y1 / y2 / y3 | Dwarf deaths | Of what | Mood | Trades |
|---|---|---|---|---|---|---|
| `p0-1` | 13 / 24 / 48 | 16,668 / 32,163 / 14,317 | 1 | bled out after a boar, day 47 | 25.5 | 6 |
| `p0-2` | 10 / 21 / 49 | 12,610 / 33,464 / 13,302 | 4 | bled out after boars, days 43, 43, 75, 260 | 19.6 | 8 |
| `p0-3` | 19 / 52 / 34 | 24,028 / 11,040 / 13,645 | 25 | starvation, days 232–238 | 37.8 | 6 |
| `p0-4` | 14 / 33 / 50 | 18,170 / 63,188 / 26,732 | 2 | bled out, days 40 and 225 | 39.0 | 8 |
| `p0-5` | 14 / 39 / 23 | 24,193 / 59,354 / 13,435 | 32 | 4 bled out, 28 starved in the third winter | 45.2 | 8 |
| `p0-6` | 15 / 31 / 22 | 9,823 / 48,591 / 12,981 | 27 | starvation, from day 319 | 46.4 | 8 |
| `p0-7` | 16 / 42 / 48 | 19,043 / 80,952 / 13,964 | 6 | 1 bled out, 5 starved | 18.6 | 8 |

**Peril 0: seven of seven survive, none without a death.** Two causes:

- *Bleeding after a fight* (five seeds, 12 deaths): T-301 and T-211.
- *Starvation once the fortress passes about 40 dwarves* (four seeds, 85 deaths). The stock of lavish meals lifts wealth to 48,000–81,000 marks in year 2, waves of 7 to 11 follow, the population reaches 48 to 53, the plant stock is at or near zero from then on, and the meal stock is eaten in one season. The surface strips grow nothing in winter and a harvest returns one seed, so the cave plots stay at the wagon's 30 seeds. This is the script's farm, not yet a game fault; it is the same shape as the old fixture's year-3 starvation (T-215).

**Perils 2 and 4: no seed reaches day 216.** All 13 stop on a T-176 invariant finding, which the sweep asserts for these perils: 10 seeds on `item.nowhere` (the wagon's brightleaf ×5, single seeds, drink) between day 59 and day 124, two on `creature.on-impassable` (a dwarf on a tile of kind 2 beside the gate, days 19 and 38), one on a stalled thief party (day 215). Before stopping they lost 0 to 14 dwarves to Gloam warriors and archers, bandits, boars and bleeding; `p2-5` was extinct by day 112. Filed as T-302, T-303 and T-304. Survival, kit dates and raid sizes at perils 2 and 4 are therefore not measured.

## The mood instrument

See § Mood in [`balance-status.md`](../../docs/balance-status.md) for the figures taken from [its output](../data/2026-10-12-economy-fixture-mood-instrument.txt).

## What this explains about other tasks

- **T-214** (boars wipe out the economy fixture). The fixtures it measured formed a squad on day 10 with no weapon, raised no alert for an animal, and had no hospital. The probe reproduces the wipe-out with clubs and removes it with spears. Which run meets boars differs with any change to the script, because the arrivals follow the random stream: run 2 raised no alert in 336 days, runs 3 and 5 five each. The deaths that remain are T-301's.
- **T-215** (the old fixture starves in year 3). One kitchen made 477 lavish jobs in 336 days for 48 dwarves (run 2) and no meal was in stock at the end; with three kitchens the plants ran out instead (run 3). Its orders and its farm did not follow the population. That is the script.
- **The old script's "unreachable" mine** (asked by T-145). Not run. From reading: the old script designates the mine shaft on day 30 whether or not the trunk corridor has reached its head; the rewrite waits for the corridor's floor. Not established by a run, and the old script is no longer in the tree.

## Not established

- Why the first `stop_bleeding` claim fetches for 300 ticks, what reserves the cloth, and why the hospital's supplies are never brought down (T-301).
- What removes the position of the wagon's brightleaf and of single seeds at perils 2 and 4 (T-302). A raider's loot is the first suspect; it was not traced.
- The cause of the two dwarf-on-dwarf deaths of runs 1 and 2.
- The share of dwarf time at work and idle: not measured here.
