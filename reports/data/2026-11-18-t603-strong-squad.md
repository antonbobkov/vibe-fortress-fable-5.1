# T-603: the three-year script builds toward the strong squad

**Task:** T-603 · **Date:** 2026-11-18 · **Code:** branch `t603-strong-squad` on master `991a884d` · **Source:** [the T-603 work file](../../docs/work/T-603-script-builds-strong-squad.md), [T-601's report](2026-11-18-t601-script-fights-ambushes.md), [T-600's arena](../audits/2026-11-18-t600-ambush-arena.md)

## The change

At perils 2 and 4 (where ambushes come) `test/scenarios/three_years_fortress.ts` now builds toward T-601's bars as a player would:

- **The squad.** From day 112, with 24 adults and the first kit forged, the squad is six soldiers taken from immigrants no role holds (one more than the bar, so each spars with a partner). They lose the mining and woodcutting labors, prefer short swords (wooden training swords from the carpenter until a metal one is free, since the skill is the held weapon's), and train full time with a Warden among them in a barracks dug off a hall-level corridor (a 4 × 5 block, dug two weeks ahead). A squad trains while one of it is below Proficient and the fortress keeps 20 adults; then it works as civilians do (no skill rust). The militia founders go back to work.
- **Marksdwarves.** With 30 adults, two join a ranged squad of their own ("Bolts"): iron crossbows and 50 iron bolts from the forge, an archery target in a corner of the barracks, 40 wooden bolts kept by the carpenter. They go out with a squad that fights an ambush and are sent after the same members; under other alerts they stay in the barracks.
- **Steel.** The forge makes each of five soldiers missing one a steel sword, shield, helm, mail shirt and greaves, first among its orders, and takes its metal-craft orders off while any piece is owed. The smelter makes steel from day 168 (224 elsewhere). The Mountainhome is asked for steel bars, steel kit and flux, bought ahead of other goods.
- **The aftermath.** Once an ambush the squad went out to fight has broken and nothing else threatens, the alert comes down at once, not 300 ticks later: the gate's doors lock on the alert and the medics reach the wounded outside only through them.
- **Fixes on the way.** T-601's marksdwarf check read the bolts from the quiver slot; 16 equips them carried beside the quiver, so it now asks the shooter's ammunition (`findAmmoForShooter`). `src/systems/combat/training.ts`: practice that used a soldier's last bolt left the quiver slot naming it (an immigrant hunter's bolts are in that slot), and an invariant failed in 3 of the 35 timelines the first sweep played; the slot is now cleared, as a shot clears it.
- **Report lines.** The sweep's verdict prints, by peril, how many fortress-timelines cleared each bar and when, and the ambushes' toll by first answer.

## The sweeps (all 80 seed jobs passed in each)

| Run | Plan | Alive y1 | Peril-0 grown | Peril-0 need deaths | Living y3 | Deaths | Extinct | Need deaths | Bars cleared |
|---|---|---|---|---|---|---|---|---|---|
| master (T-601, 44335803229) | none | 19.5 | 7 | 0 | 1087 | 112.5 | 1 | 4.75 | 0 |
| v3, 44370201748 (`3447e9e9`, the final plan) | 24 adults from day 112 | 19.5 | 7 | 0 | **1046.25** | **110.75** | 0.5 | 3.5 | **0** |
| v4, 44388235434 | peril 2 at 16 adults from day 84 | 19.5 | 7 | 0 | 980 | 112 | 0.75 | 7 | 0 |

The reference (1010.5 living, 137 deaths; bounds 887.75 and 161.88) is not moved. An earlier plan with 16 adults from day 84 at both perils (44363096852, cancelled after 35 of 80 jobs) lost 25 living dwarves and gained 6 deaths a peril-4 timeline against master's same shifts, and some fortresses starved after ambushes took their workers; the peril-2 timelines lost 7 living and 2.7 deaths.

By peril, v3 against master over the same four shifts (means a sweep): peril 0 466 living, 1.5 deaths, unchanged; peril 2 367 living (389.5), 45.25 deaths (43); peril 4 213.25 (231.5), 64 deaths (68).

## How far the fortresses come

**No fortress-timeline cleared either bar.** Training is the binding step now, and steel the second:

- **Training pace.** A soldier at drill gains about a level every one to two weeks (12 xp a session, 15 with the Warden; a session every 300 ticks while present, but needs, sleep and the odd one out leave about 1.3 sessions a day). From 0 to Proficient is 3,700 xp, some 200 days. In local probes (`test/perf/t603_probe.test.ts`) squads formed on day 113 to 119 stood at 5 to 8 on day 259; marksdwarves, who shoot alone, reached 10 by about day 250 when they joined early. In v3 the best-armed squads' best soldier had median skill 4 and best 10; no fortress had five soldiers at 10.
- **Steel.** In T-601's sweep the smelter made 0 to 3 steel bars over year 3 (iron ~70 bars over three years, flux 1 to 5 in stock). With the earlier alloy order, the crafts paused and the Mountainhome's steel, five soldiers armed in metal wore steel body armour in 3 of the 52 peril-2 and peril-4 timelines, four in two more; steel body armour on 30 of 141 soldiers armed in metal at year 3.
- **Ambushes.** None was fought. By first answer, v3: stood down 152 (151 ended: 142 dwarves dead, 35 of them soldiers, 0.94 a sprung ambush), met at the gate 91 (89 ended: 94 dead, 39 soldiers), in the halls 9, with another threat 1. The census in T-601 counted the answers only, so the toll has no earlier row to compare.
- **What the economy gave up.** Six to eight dwarves at drill from a fortress of 24 or more, for the rest of the run in most fortresses; at perils 2 and 4 about 20 living a sweep each (v3), within the bounds.

## Follow-ups

- `docs/work/T-606-strong-squad-pace.md`: the squad does not reach Proficient in three years at the measured pace; measure the pace and decide whether training or the bar's timing changes.
- `docs/work/T-607-barracks-post-on-a-blocked-tile.md`: a training member's barracks post can be the archery target's tile; one marksdwarf stood at 0 for 140 days in a probe.
