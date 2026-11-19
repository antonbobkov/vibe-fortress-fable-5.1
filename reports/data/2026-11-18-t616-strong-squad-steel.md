# T-615 and T-616: steel for the strong squad, and the sweep

**Tasks:** T-615, T-616 · **Date:** 2026-11-18 · **Code:** `b149a964` on branch `t615-t616-squad` (master `e843d79e` with T-615's sparring company and quick soldiers, and T-616's steel) · **Source:** [the T-616 work file](../../docs/archive/tasks/T-616-strong-squad-steel.md), [T-606's sweep](2026-11-18-t606-sweep.md), [T-615's measurement](../audits/2026-11-18-t615-soldiers-needs.md)

## Where the steel went (before)

From the seed logs of T-606's sweep (44428448217: the smelter's weekly journal, the recipes, the Mountainhome's trades), the 48 peril-2 and peril-4 fortress-timelines still living:

- **The smelter made 3.0 steel bars a timeline in three years** (0 to 10), from day 168.
- **Iron went to the forge's standing orders.** The smelter made 62 iron smelts a timeline (two bars each) and the forge used 134 bars, nearly all on standing iron armour and weapons (`SQUAD_KIT` and `HUNT_KIT` mail, shields, swords, helms and greaves kept at three in stock, which a soldier's claim empties again, and the 'iron goods' helms, greaves, gauntlets, boots and axes). The steel kit's orders stood first but could not run, so the forge took the next runnable order, an iron one. Iron bars in stock: a weekly median of 2.4.
- **Flux leaked.** The stone crafts take any raw stone (110 a timeline), flux included, and flux went to the depot as cargo: in `p4-1` the stock fell from 46 to 0 between days 259 and 308 with no steel made.
- **One worker burned and smelted.** The fuel worker kept both the wood furnace and the smelter: 167 charcoal a timeline, a weekly median of 2.5 in stock, and a steel bar burns two. A fuel worker who died was not replaced.
- **The Mountainhome** comes once a year from year 2 (two visits in the squad's time) and brought a few bars a visit.

## The fix (T-616)

The script now plays steel as a player who has chosen it: while a soldier lacks a piece of the kit, the forge's standing iron and steel orders come off (the picks stay) and go back after; no flux goes to the depot and the stone crafts take the commonest other stone; a second furnace worker burns charcoal; a dead furnace worker is replaced; steel is smelted from the day the squad forms. The sweep's log gains a metal ledger (`metalRecipes`, `bought`) and the trade journal the materials and the steel on offer.

## After: the sweep (44450472571, all 80 seed jobs passed)

| Run | Alive y1 | Peril-0 grown | Peril-0 need deaths | Living y3 | Deaths | Extinct | Need deaths |
|---|---|---|---|---|---|---|---|
| T-606 (44428448217) | 20 | 7 | 0 | 1043.75 | 115.25 | 1 | 1.75 |
| T-615 + T-616 (44450472571) | 20 | 7 | 0 | 997.5 | 127.5 | 0.75 | 3.25 |
| Reference | 19.5 | 7 | 0 | 1010.5 | 137 | 1.75 | 6.25 |

Verdict: pass (bounds 887.75 living, 161.88 deaths). The reference is not moved.

**Steel, the 52 peril-2 and peril-4 timelines:** the smelter made **13.0** steel bars a timeline (0 to 49), the Mountainhome sold 7.2 bars and 0.5 kit pieces, and the forge made 10.1 kit pieces of steel. Of the 43 fortresses that kept 20 adults, 5 had the 50 bars of five kits and 13 had 30 or more. What binds now: charcoal (20 of the 43 had under five in stock on a weekly average, 15 under fifteen logs: the wood of a 48 × 48 map runs short), then iron (12 with under five bars, 6 with under fifteen ore); flux in 5. Steel body armour was on 38 of 166 soldiers armed in metal at the end (T-606: 23 of 165).

**Bars:** the soldiers' bar (five in steel at Proficient) in **3 of 28** peril-2 timelines (days 278 to 337, median 296), none of 24 at peril 4; the full squad's bar in none. Five soldiers in steel at Proficient at most in one fortress, two marksdwarves.

**Ambushes** (255 sprung), by the first answer, the dead from the spring until the party was gone:

| Answer | T-606 | T-615 + T-616 |
|---|---|---|
| Fought (the soldiers alone) | 0 | **2: 0 dead, 3 of the ambush felled** |
| Met at the gate | 96 (95 ended): 68 dead, 34 of the squad | 95: 90 dead, 42 of the squad |
| Stood down | 149 (148 ended): 175 dead, 38 of the squad | 146: 162 dead, 27 of the squad |
| In the halls | 11: 25 dead, 14 of the squad | 8: 22 dead, 13 of the squad |
| With another threat | 1: 0 dead | 3: 10 dead, 1 of the squad |

## The decision

Five steel kits in three years are within reach of a fortress rich in wood and iron and out of reach of most; the rest is the economy (charcoal from a small map's trees, iron ore), not the script. T-601's bar stays at steel: T-600's arena has five Skilled soldiers in iron with two marksdwarves losing 1.1 to 2.6 fighters a fight against 6 to 10 Gloam, more than the 0.9 dwarves an ambush kills while the fortress hides. Recorded in the [testing strategy's three-year section](../../docs/process/testing-strategy.md#the-long-scenarios). Charcoal for the steel is a follow-up: [fuel for the squad's steel](../../docs/work/T-620-fuel-for-the-squads-steel.md).

## The other gates

On the final head; see the commit closing T-616.
