# T-642: iron for the squad's steel

**Task:** T-642 · **Date:** 2026-11-19 · **Code:** branch `t642-iron-for-steel` on master `6aeaea32` (T-638); the final sweep below ran on `2cd2b957`, whose script is the branch's · **Source:** [the T-642 work file](../../docs/archive/tasks/T-642-iron-for-the-squads-steel.md), [T-619 and T-620's sweep](2026-11-19-t619-t620-squad-quarters-and-fuel.md)

## Where the iron went

**The ore was there.** From the master sweep before this task (44599385650, on `6aeaea32`, the 52 peril-2 and peril-4 fortress-timelines): the miners dug 130 iron ore a timeline and the smelter smelted 54 of it (108 bars); the forge made 52 pieces of iron, nearly all before the strong squad formed (its first squad's kit, picks, crafts), and the smelter 14.3 steel bars. Of the 38 timelines with under five iron bars in stock on a weekly average, 31 held ten iron ore or more on the same average, and only 6 were short of both. The mines were not what bound: `test/perf/t642_iron_probe.test.ts` shows the script designating 20 to 80 new faces of ore, gems and flux a season in years 2 and 3, its drift tiles growing from about 400 by day 56 to 770 (`three-years-p2-1`, shift 0) and 1067 (`three-years-p4-6`, shift 50) by day 336, and 30 to 50 (`p2-1`, from day 126) and 80 to 130 (`p4-6`, from day 154) iron ore lying unsmelted.

**The smelter was what bound.** It works one job at a time, by its one assigned worker, and made about 113 jobs a timeline in all, whatever the ore: 54 iron smelts, 44 coal smelts and 14 alloys. In the weekly journal of the 52 timelines the smelter's job stood open, waiting for its worker, at 62% of the looks (the worker asleep, eating, drinking, resting or retreating), was being fetched for at 19% and worked at 4%. The probe, sampling the worker every 20 ticks from day 70, has it at the job 22 to 38% of the time, asleep 25 to 30%, at hunger, thirst and comfort 7 to 19% each; each job took it some 500 to 1000 ticks of work against a recipe's 150, nearly all of it fetching: the iron ore lay where it was dug, 28 to 37 steps (and four a level) from the smelter, since the fuel store by the furnaces (T-620) is full of logs and no other stockpile below takes ore. In `p2-1` the smelter made 2 to 7 jobs in each fourteen days.

**The coal came first.** T-620 ordered the coal smelts after the steel and ahead of the iron, to keep thirty bars of coal, whatever the charcoal in stock: they took 39% of the smelter's jobs, and half the timelines (26 of 52) held 20 or more charcoal on a weekly average. In `p4-6` at shift 50 the smelter made nothing but coal from day 266 on, with 120 iron ore and no iron bar in stock, and in this task's first tries its alloy job stood `blocked: missing_input` at look after look while 16 charcoal lay on the surface stockpile, counted as fuel but out of reach from below behind the locked gate, holding the smelter from the coal ore it could have smelted without fuel (a follow-up: [a workshop order runnable on goods out of reach](../../docs/work/T-648-workshop-order-runnable-out-of-reach.md)).

## What the script does now

As a player who sees ore pile by a busy smelter:

- **The coal first only while the fuel is short.** The smelter's coal orders come first, ahead of the alloy, while fewer than twenty charcoal and coal bars lie under a roof (charcoal on the surface does not count), and after the alloy and the iron otherwise.
- **A second smelter.** Once the steel is owed and ten iron ore stand free, a second smelter goes up on a free site of the workshop hall, keeps twenty steel bars and smelts the iron for them, worked by the smith, whose forge waits on the steel while the kits are owed. A full hall is first dug one site more, against its south lane (or its north where the south would open to the hillside or water), at routine priority. A first try gave it to the charcoal burner beside its furnace: the burner then made too little charcoal (2 to 14 in stock at `p2-1`), and the steel waited on fuel instead; and with iron smelts only, `p4-6` filled to 40 iron bars while its one alloy job waited.
- **An ore store by the smelter.** Twenty-four tiles of the workshop hall's lanes nearest the smelter, none of a workshop site, are a stockpile of ore, so the haulers carry the ore down from the drifts and not the smelter's worker.
- **Iron bars from the Mountainhome.** The strong squad's requests ask for iron bars (priority 2) in place of the charcoal, and coal at priority 1: the request weights are as before (13), so the steel bars' share is unchanged.

Melting iron goods was looked at and left: a melt returns 60% of a good's bars, rounded down (12), so a helm or a craft gives nothing back and a two-bar sword one. Opening more iron faces was left too: the ore was not short.

Probe runs on the two seeds the work file names, days 126 to 336, steel bars smelted before and after: `p2-1` at shift 0, 8 and 31; `p4-6` at shift 50, 20 and 25 (with a worker of its own at the second smelter, 19 and 32, and `p2-1`'s five kits all forged by day 294). One probe run is one timeline; the sweep below is the measure.

```
T642_PROBE=1 T642_SEED=three-years-p2-1 T642_PERIL=2 T642_SHIFT=0 T642_DAYS=336 T642_FROM=126 npx vitest run -c vitest.perf.config.ts test/perf/t642_iron_probe.test.ts
```

## The sweep

Before: the master sweep 44599385650 on `6aeaea32`. After: 44646912929 on `2cd2b957`, all 80 seed jobs passed. Two earlier tries were swept on the way, and are kept here for what they taught. Figures read from the verdict jobs.

| Run | Alive y1 | Peril-0 grown | Peril-0 need deaths | Living y3 | Deaths | Extinct | Need deaths |
|---|---|---|---|---|---|---|---|
| Master (44599385650) | 19.75 | 7 | 0 | 1067.5 | 111.25 | 0.5 | 0.75 |
| Try 1: second smelter with a worker of its own, on the surface when the hall is full (44617202130, `012a9f71`) | 19.75 | 7 | 0 | 1027.25 | 123.75 | 0.5 | 1 |
| Try 2: as try 1, but below only, the full hall dug a row of four sites longer ahead of routine work (44636307536, `21e55deb`) | 19.75 | 7 | 0 | 1008.25 | 121 | 0.5 | 3.75 |
| **T-642 (44646912929)** | 19.75 | 7 | 0 | **1031.5** | **105.25** | 0.5 | 0.5 |
| Reference | 19.5 | 7 | 0 | 1010.5 | 137 | 1.75 | 6.25 |

Verdict: pass (bounds 887.75 living, 161.88 deaths). The reference is not moved.

**The steel ledger**, the 52 peril-2 and peril-4 fortress-timelines, a timeline (from each seed's `[three_years_economy]` and weekly `[three_years_steel]` lines; a timeline "has five kits" when 25 steel kit pieces were forged or bought in it):

| | Master | Try 1 | Try 2 | T-642 |
|---|---|---|---|---|
| Steel bars smelted | 14.3 | 22.7 | 27.4 | **24.7** |
| Steel bars bought | 6.2 | 6.0 | 6.4 | 6.1 |
| Steel kit pieces forged / bought | 10.6 / 0.4 | 13.6 / 0.4 | 15.6 / 0.4 | 13.0 / 0.5 |
| Timelines with five kits | 3 | 8 | 14 | **11** |
| 50 steel bars or more (smelted and bought) | 4 | 9 | 17 | 12 |
| 30 or more | 14 | 25 | 27 | 25 |
| Iron ore mined / iron smelts | 130 / 54 | 132 / 65 | 126 / 69 | 130 / 64 |
| Iron bars bought | 4.9 | 6.1 | 6.0 | 6.1 |
| Coal smelts / charcoal burned | 44 / 172 | 49 / 181 | 55 / 183 | 51 / 183 |
| Under five iron bars on a weekly average | 38 | 28 | 28 | **27** |
| of which ten iron ore or more in stock | 31 | 21 | 21 | 20 |
| Under five charcoal | 8 | 11 | 13 | 9 |
| Under fifteen logs | 10 | 18 | 18 | 12 |
| Soldiers in steel at Proficient, at their best (sum) | 15 | 42 | 57 | 48 |
| Timelines that cleared a bar (full squad) | 1 (1) | 5 (4) | 8 (5) | 3 (3) |

**What the tries cost.** Try 1 lost 40 living dwarves a sweep at peril 4 (242 to 202; 72 deaths against 57): where the workshop hall was full, the second smelter went up on the surface, and in `three-years-p4-2` and `p4-3` at shift 0 (two of the worst) its worker and its haulers worked there through the ambush season. Try 2 kept it below, but went with 24 fewer living at peril 2 (352.5 to 328.5) as well, with its row of four sites dug ahead of routine work and the second smelter's worker taken from the fortress's other work; the ambushes killed no more (268 against 265 in all). T-642 digs a full hall one site more at routine priority and gives the second smelter to the smith, whose forge waits on the steel: deaths fell to 105.25 (45.75 at peril 2 against 52.75, 58.25 at peril 4 against 56.75), but the living stayed 36 under master's, nearly all at peril 4 (210.75 against 242), where 908 immigrants came against 1027 with the hall spirit, wealth, renown and the Mountainhome's trade unchanged (spirit 61.0 against 59.3 at year 3, wealth 45,328 against 44,234). Why fewer waves came is not found; a follow-up: [peril-4 immigration with the second smelter](../../docs/work/T-650-peril-4-immigration-with-the-second-smelter.md).

The ambush toll by answer (52 timelines), master and T-642: met at the gate 94 ambushes, 90 deaths, and 92, 83; stood down 146, 133 and 148, 131; in the halls 12, 41 and 13, 39; fought by the full squad 1, 1 and 1, 0.

## The other gates

On the final head; see the commit closing T-642.
