# T-615: why some soldiers at drill barely train

**Task:** T-615 · **Date:** 2026-11-18 · **Code:** branch `t615-t616-squad` on master `e843d79e` (T-606, T-607) · **Source:** [the T-615 work file](../../docs/archive/tasks/T-615-soldiers-needs-keep-them-from-drill.md), [T-606's pace measurement](2026-11-18-t606-training-pace.md)

## How

T-606's probe (`test/perf/t606_pace_probe.test.ts`) now also prints, for each soldier at drill, its Agility and Endurance, its mean walking speed (`Motion.speed`), armour and health speed modifiers, mood, sleeps on the floor and in a bed, talks a day, and need errands begun a day by need. `T606_TRACE=<day>` prints every member's brain, place and walk every 20 ticks of that day. Seeds `three-years-p4-4` (to day 280), `p4-1` (250) and `p2-2` (250), shift 0. Shares below are of the day with the alert down (training stops under an alert).

```
T606_PROBE=1 T606_SEED=three-years-p4-4 T606_PERIL=4 T606_DAYS=280 T606_TRACE=230 npx vitest run -c vitest.perf.config.ts test/perf/t606_pace_probe.test.ts
```

## What sets the slow soldiers apart

Not the floor, the armour or the mood. Every soldier slept in a bed on all but 0 to 8 nights, armour slowed none by more than 7% (`armorSpeedModifier` 93 to 100), health none, and mood was 46 to 75 for fast and slow alike. Each soldier begins about the same errands a day (sleep 1.1 to 1.5, social 0.7 to 1.1, thirst 0.5 to 0.7, hunger 0.3 to 0.5, joy 0.3 to 0.5, comfort 0.2 to 0.3). What differs is how long each takes: **the slow soldiers walk slowly, and far.**

`three-years-p4-4` before (TRAIN_XP 54, master):

| Soldier | Agility | Speed | Barracks | Walking back | Sleep | Eat | Drink | Social | Level after 104 days |
|---|---|---|---|---|---|---|---|---|---|
| 218104272 | 47 | 131 | **1.9%** | 8.0% | 34.3% | 16.5% | 14.7% | 9.5% | 3 |
| 117441666 | 50 | 138 | 3.8% | 9.0% | 30.1% | 11.1% | 16.9% | 12.3% | 3 (83 days) |
| 16777713 | 60 | 145 | 10.7% | 15.2% | 28.4% | 10.7% | 12.3% | 9.7% | 7 |
| 83887186 | 82 | 177 | 23.3% | 11.8% | 26.3% | 8.1% | 9.6% | 9.4% | 10 |
| 117441136 | 91 | 190 | 21.1% | 11.9% | 26.5% | 7.5% | 9.2% | 13.0% | 10 |

In that fortress the barracks and the hearth hall are on level 26, the food and drink on levels 32 and 33, and the bedrooms at the far end of level 26, joined by one stair at the north end: a bed is 40 to 70 steps from the barracks and the drink 45 to 75 from a bed. A dwarf of Agility 47 steps every 7 to 8 ticks, one of 91 every 5 (10 § Movement: speed × (50 + Agility) / 100). On day 230 soldier 218104272 set off for its bed at bedtime, walked 360 ticks (seven hours), reached it with its thirst critical and got up at once (10 § Sleeping: a sleeper whose hunger or thirst is critical wakes and eats or drinks first), walked 560 ticks to the drink, ate, and was walking back to bed when the day ended: no drill at all. Soldier 117441666 walked 520 ticks to its bed, slept the whole night on the way (rest falls from setting off), lay down rested and walked back for joy. Each errand costs the slow soldier one and a half to two times the fast one's time, the needs keep rising on the way, and the day fills with walks. The same holds in `p4-1` and, less sharply, in `p2-2`, whose halls are compact: there a soldier of Agility 44 still stood at the barracks 26% of the day.

Every rule here works as written (10 § Movement, § Sleeping, § Behavior selection; 16 § Squads lets every want of a training soldier take it away). So no engine fault was found.

## The decisions

1. **Sparring is company** (16 § Training, 10 § Social, comfort, joy). Two dwarves sparring are in company: each session of a pair is a talk between them, with a talk's relief, its count toward friendship and `Talked`. A soldier at drill then seldom walks to the hearth hall for company, and a squad that drills together becomes friends (and grieves its own: [fun features](../../docs/fun-features.md)). It helps the soldiers who drill: in `p2-2` the social share of the day fell from 7.9% to 6.1% pooled, and from 7.2% to 3.2% for the busiest soldier. It does little for the slow soldiers, who are seldom at the barracks to spar.
2. **The three-year script picks quick soldiers.** It picked the strong squad by weapon skill alone, which immigrants seldom have, so by id; a player picks the quick and enduring ones (Agility sets the pace and the hit and the dodge, Endurance slows hunger and tiredness, 10 § Attributes). It now picks by skill first, then Agility plus Endurance ([testing strategy](../../docs/process/testing-strategy.md#the-long-scenarios)).

## After

Both changes, the same seeds (the timelines differ from the squad's forming on):

| Seed | Soldier-days | Sessions a day | Weapon xp a day | At the barracks (calm) | Social (calm) | Soldiers under 10% at the barracks |
|---|---|---|---|---|---|---|
| p4-4 before | 623 | 0.61 | 22.4 | 11.1% | 10.9% | 5 of 8 (Agility 47 to 60) |
| p4-4 sparring company only | 476 | 0.49 | 17.3 | 8.9% | 9.9% | 4 of 7 |
| p4-4 after | 622 | 0.94 | 38.7 | **18.5%** | 8.2% | 2 of 8 (Agility under 60, militia kept in the squad for its first 20 days) |
| p4-1 before | 924 | 0.76 | 31.6 | 13.7% | 10.6% | 3 of 8 |
| p4-1 after | 914 | 1.11 | 42.0 | **22.3%** | 7.8% | 2 of 9 (Agility 58; Agility 80 walking back 19% of the day) |
| p2-2 before | 702 | 1.43 | 54.0 | 28.2% | 7.9% | 0 of 10 |
| p2-2 sparring company only | 705 | 1.19 | 46.4 | 26.1% | 6.1% | 3 of 11 (drilled 6 days, under alerts 35%) |

**The stated share:** a soldier at drill stands at the barracks 10 to 40% of the calm day. One below 10% walks slowly (Agility under 60) or sleeps 50 steps or more from the barracks: 10 § Movement and § Sleeping, the walk to bed counted as rest. Picking the quick soldiers leaves two such soldiers in the two peril-4 fortresses, against eight.

The layout is the rest of it: in `p4-4` even the quickest soldier spends 13 to 17% of the day walking back to the barracks. A player would put the soldiers' beds, food and drink near the barracks; the follow-up [soldiers' quarters by the barracks](../../docs/archive/tasks/T-619-soldiers-quarters-by-the-barracks.md) measures whether the script should.
