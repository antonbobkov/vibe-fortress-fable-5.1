# T-606: the training pace in a fortress

**Task:** T-606 · **Date:** 2026-11-18 · **Code:** branch `t606-training-pace` on master `62630648` (T-603) with T-607's barracks posts · **Source:** [the T-606 work file](../../docs/work/T-606-strong-squad-pace.md), [T-603's report](../data/2026-11-18-t603-strong-squad.md)

## How

`test/perf/t606_pace_probe.test.ts` plays one three-year seed (shift 0) and, every 20 ticks, looks at each member of a squad in `train` mode: what its brain is doing (a need, by the need its activity names; duty on a barracks tile; duty elsewhere, which is walking to the barracks; hospital) and whether the fortress is under an alert (no training then). It counts each member's `TrainingSession` events and the experience its held weapon's skill gains. Seeds `three-years-p2-2`, `p2-3`, `p2-4`, `p2-5`, `p4-1` and `p4-4` to day 230 to 250 (the strong squad of T-603 formed on day 113 to 225); `p2-1`, `p4-2` and `p4-3` had not formed it by then.

```
T606_PROBE=1 T606_SEED=three-years-p2-3 T606_PERIL=2 T606_DAYS=250 npx vitest run -c vitest.perf.config.ts test/perf/t606_pace_probe.test.ts
```

## Before: `TRAIN_XP` 12

3,470 soldier-days at drill (the Warden among them, so a pair's session gives 15 to each skill):

| Seed | Soldier-days | Sessions a day | Weapon xp a day | At the barracks |
|---|---|---|---|---|
| p2-3 | 823 | 1.55 | 17.5 | 25.6% |
| p2-5 | 585 | 1.20 | 10.9 | 18.1% |
| p2-2 | 654 | 0.90 | 8.5 | 14.8% |
| p4-1 | 799 | 0.73 | 7.2 | 10.5% |
| p2-4 | 151 | 0.57 | 4.1 | 8.4% |
| p4-4 | 458 | 0.48 | 3.8 | 6.3% |
| **All** | **3,470** | **1.00** | **9.9** | **15.5%** |

Where a soldier's day goes (all seeds): sleep 25%, eating and drinking 18% (most of it walking to the food and the drink, a level below the barracks on several seeds), company, joy and comfort 18% (want-level needs, which training does not hold, 16 § Squads), alerts 13%, walking back to the barracks 10.5%, at the barracks 15.5%. Needs take 60% of the day. A session is granted when a member is present and its last session's `SPAR_TICKS` have passed, so the barracks' 15.5% (186 ticks a day) gives about one session a day, not the four a full day could.

The pace varies by soldier as much as by seed: in each squad two or three soldiers stand at the barracks 20 to 37% of the day and gain a level in four to six days early on, and one to three stand there 1 to 6%, spending 70 to 80% of the day on needs (more sleep, longer meals). At 9.9 xp a day, 0 to Proficient (3,700 xp, 10 § Skills and experience) takes **about 370 days**, more than three years of drill; T-603's estimate of 200 days took 1.3 sessions a day.

## The decision

The owner asked for "a steel-equipped well-trained squad" to handle incursions, and the orchestrator decided on the owner's behalf that a soldier at full-time drill in a working fortress reaches Proficient in about 84 days (three seasons). That needs 3,700 / 84 = 44 xp a day. At the measured 0.825 xp a day for each point of `TRAIN_XP` (Warden included), `TRAIN_XP` is **54** (67 with a Warden, 33 alone); without a Warden, about 105 days.

The session length stays: presence, not the 300-tick cooldown, binds, and shorter sessions would roll more sparring injuries and spend more bolts. The experience ladder already slows each level (`xpToNext = 100 + 60 × level`), but at 44 a day full-time drill would make a soldier Legendary in about 300 days, so a session grants half its experience to a skill at `TRAIN_TAPER_LEVEL` (10) or above: Proficient in about 84 days, 10 to 20 in about 440 more. Combat experience is not halved.

## After: `TRAIN_XP` 54, halved from 10

The same seeds to day 280 (the timelines differ from day 113 on: squads are stronger and leave drill once all are Proficient):

| Seed | Soldier-days | Sessions a day | Weapon xp a day | At the barracks | Proficient (days after joining) |
|---|---|---|---|---|---|
| p2-3 | 1,015 | 1.62 | 61.3 | 28.5% | 8 of 13: 37 to 63 (the others left the squad after 23 to 62 days) |
| p2-2 | 762 | 1.47 | 57.7 | 26.2% | 7 of 10: 29 to 108 (the others drilled 35 to 55 days) |
| p2-5 | 820 | 1.42 | 48.6 | 22.7% | 7 of 8: 33 to 85 (one at 5 after 111 days) |
| p4-1 | 1,133 | 0.74 | 29.5 | 10.9% | 6 of 9: 55 to 158 (two at 8 after 159 days) |
| p4-4 | 623 | 0.61 | 22.4 | 9.6% | 2 of 8: 97 and 104 (the others at 0 to 7) |
| **All** | **4,353** | **1.18** | **44.4** | **19.7%** | |

44.4 xp a day pooled: Proficient in 83 days at the pooled pace; the 30 soldiers who reached it took a median of 53 days. The soldiers who stand at the barracks reach it in five to ten weeks; the ones needs keep away (1 to 6% at the barracks) still do not, which is a follow-up ([T-NEW](../../docs/work/T-NEW-soldiers-needs-keep-them-from-drill.md)).
