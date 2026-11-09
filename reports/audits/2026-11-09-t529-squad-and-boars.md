# Audit: why the three-year squad lost its dwarves to boars

**Task:** T-529 · **Date:** 2026-11-09 · **Commits examined:** master `ff018a46` (before), the T-529 branch (after) · **Kind:** a journal of every fight between a dwarf and a wild animal, and the fix · **Source:** [the T-529 work file](../../docs/archive/tasks/T-529-squad-lost-to-boars.md), [T-456's probe](../data/2026-11-07-t456-relief.probe.ts.txt)

## The answer

- **The script ordered the kills, and that was the fault.** The three-year fortress answered every boar or badger within 14 tiles of a dwarf on the surface with the hearth alert and a kill order. In six runs of seed `three-years` (peril 0, relief 1) to day 400, three years and 64 days, it gave **175 kill orders**, and **none** was on an animal that was attacking anyone: 95 were asleep or idle, 80 wandering. None was within 14 tiles of the gate; 153 were more than 20 tiles out (mean 30).
- **The squad met them alone, unarmoured, behind a locked gate.** Three spearmen at skill 0 and the two miners with picks, in bucklers only until the forge's kit (the first iron helm on day 128 at shift 0). The orders sent the five across the country one by one, so whoever reached an awake boar first fought it alone: a boar's gore lands 11 pierce every 20 ticks, a serious wound bleeding 4 on each limb or head hit. The hearth alert had locked the gate behind them, so no medic reached the wounded: the dying dwarves' `stop_bleeding` jobs stayed `open`, with cloth in stock, until they bled out, 200 to 370 ticks after the first wound in the run that logged them. **64 dwarves died** in the six runs, 61 of them bled out (54 to boars, 10 to badgers); 55 were soldiers on duty, 8 squad members off duty, 1 a civilian. The miners died early because they were in the squad.
- **The squad picking wild animals by rule is not the cause.** A soldier on duty takes a wild animal as its target only while the animal is in `attack` (16 § Concepts): 83 of the 316 engagements were a soldier striking an animal that was already defending its ground, on the way to a kill order's target.
- **Boars are not too strong for the kit, by the spec's own measure:** one unarmoured Novice against one awake boar is close to even (both often die), and balance.md already says that an unarmoured soldier sent against a boar can be killed and armour is the answer. Asleep, the boars died without a wound to the squad.
- **Civilians did not join in:** one civilian died in the six runs.
- **Fixed in the script:** a territorial animal (a boar, a badger), which attacks only a dwarf who walks into its ground, lets one that flees go, and keeps that ground away from the fortress (08 § Wild behavior), is answered only within 14 tiles of the gate. Aggressive animals (wolves, bears), which hunt dwarves, are answered as before. Same six runs after: **6 deaths** in 400 days where there were 64 (4 bled out after a boar caught a dwarf on its ground, 2 of an infected badger wound); in three years, **0 to 3 a run** where there were 4 to 11, and **57 to 80 dwarves** on day 330 where there were 4 to 48.

## How it was measured

A probe (`reports/data/2026-11-09-t529-boars.probe.ts.txt`, run as `test/perf/t529-boars.probe.test.ts`) plays the sweep's fortress on seed `three-years`, peril 0, relief 1, for 400 days at shifts 0, 50, 100, 150, 200 and 250, and journals each kill order (the animal's state, its distance from the gate, the surface dwarves near it), each first blow between a dwarf and a wild animal (who struck first, the animal's state, the dwarf's duty, target, weapon, armour and skills), each wild hit on a dwarf (the part, the damage, its blood and wounds, its medical jobs and the cloth in stock), and each death (cause, the last state seen). Measure runs 42592437448 (master `ff018a46`) and 42594557259 (the fix), on GitHub's runners; one local run of shift 200 to day 40 logged the medical jobs.

| Shift | Deaths in three years, before | Dwarves on day 330, before | Deaths in three years, after | Dwarves on day 330, after |
|---|---|---|---|---|
| 0 | 4 | 30 | 0 | 58 |
| 50 | 6 | 38 | 3 | 63 |
| 100 | 11 | 27 | 0 | 57 |
| 150 | 6 | 48 | 0 | 80 |
| 200 | 8 | 4 | 0 | 63 |
| 250 | 6 | 21 | 2 | 65 |

Three years are 336 days. Over the whole 400 days the six runs lost 64 dwarves before and 6 after. The sweep's seven peril-0 seeds lost 0 to 8 a run in three years on master (T-528's sweep, Measure run 42445103211), most of them none, and lose 0 or 1 with the change; `three-years` now loses 0 to 3.

The twenty-seed sweep passes (Measure run 42597472537): pooled 20 alive at year 1, 7 peril-0 grown, 0 with need deaths, 969 living, 134.75 deaths, against 20, 7, 0.25, 983.75 and 136 on master after T-528 (run 42445103211). Its seven peril-0 seeds lose 1 dwarf in their 28 runs where they lost 18 (`three-years-p0-4` 0, 0, 0, 0 where it lost 4, 0, 4, 8); the peril-2 and peril-4 seeds, whose deaths are raids', move with the timeline. The annual instrument does not play this script and passes (run 42597481783).

Before, the first engagement of a fight was with a sleeping animal in 194 of 316 (a struck territorial animal does not wake: below), with an animal already defending its ground in 107, with a wandering, fleeing or idle one in 15. After, the script gave 22 kill orders in the six runs, every one within 15 tiles of the gate.

## Other findings

- **A sleeping boar sleeps through its own death.** A territorial animal fears nothing (08 § Wild behavior), and a sleeping animal wakes only for a threat, so a boar or badger that is struck in its sleep neither defends nor flees, though 08 says a wounded animal flees unless aggressive: of 194 engagements begun on a sleeping animal, the animal never struck back in 181 (13 struck back later in the fight). It favours the squad here and did not cause a loss. Filed as a new row.
- **No bandage outside the locked gate.** The medics in the halls never took the wounded soldiers' `stop_bleeding` jobs on the surface while the alert stood. This is the class of walks T-530 is about (health jobs under the hearth alert); it is not changed here, and with the squad no longer sent far out it costs far less.
- **The drift to the deep shaft.** T-456 saw its first tile open and untaken from day 120 to about day 340 once both miners were dead. On master `ff018a46` it does not recur: in shifts 0 and 50 the drift was dug by day 210 to 240 with up to 20 dwarves holding the mining labor.
- **`three_years_main` fails on master, with or without the change.** On seed `three-years-p0-3` it makes no steel (`alloy_steel` 0): master `a9a24607` and the T-529 branch give the identical run, since that map has no boar or badger near its gate. Filed as a new row.
- **A squad that bites off more than it can chew stays.** An aggressive animal near a surface dwarf is still hunted, and a boar whose ground reaches the gate still is, by the same five: sometimes it costs a soldier, which is the trade-off of sending Novices without armour, readable in the combat log and not a fortress-ender.
