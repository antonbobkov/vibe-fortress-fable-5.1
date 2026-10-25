# T-447 — One Gloam captain kills 28 dwarves in one fortress

**Source:** T-446's sweep (`three-years-p4-6`) · **Size:** M · **Needs:** — · **Status:** open (measurement first)

## Why

In the twenty-seed sweep of T-446 (master c18fd4c), `three-years-p4-6` (peril 4) lost 51 dwarves to raids between days 150 and 189 and died out. One gloam captain killed 28 of them, a gloam warrior 9, a gloam archer 7 and a trollkin 5. 20 were killed outright, 29 bled out and 2 died of infection. A single raider killing more than half a fortress is far outside T-404's duel figures, where a fully kitted Novice beats two goblins in 55 of 60 duels.

## What to do

1. Journal p4-6's raids from the T-446 probe (`reports/data/2026-10-24-t446-seeds.json` and the three_years_seeds runner stopped at day 190):
   - the captain's skill, kit and wounds over time;
   - who fought it, with what kit and at what skill;
   - whether the fortress's squad was armed and on duty;
   - whether the captain was ever wounded, healed between fights or regenerated;
   - how its victims died, by blows or by bleeding afterwards;
   - whether the hearth alert and the gate were used.
2. Name the cause. Possible causes:
   - the captain's skill (10 at peril 4, per threat-schedules) against unarmed civilians;
   - a captain that never tires or retreats;
   - civilians who fight back instead of fleeing;
   - the script's alert policy leaving civilians outside;
   - a fault such as a raider that cannot be hit.
3. A fault gets a failing test and a fix. A balance cause goes into the work file with the decision it needs, and the orchestrator decides.

## Done

- The cause is in a dated report with the journal.
- A fix (if a fault) passes the instrument by the T-308 rule, pp_defence, and the twenty-seed file, with p4-6's deaths reported.

## Diagnosed (2026-10-24)

Not a fault: the captain leads the year's first siege (35 on day 186: 24 warriors, 11 archers, 5 trollkin, 2 captains, per the peril-4 schedule). The siege broke the north gate door, killed the five soldiers at the gate in 50 ticks, and went down into the hearth hall, where it cut down 46 sheltering civilians over 1.6 days; no dwarf ever struck the captain, which ended at full blood ([report](../../reports/audits/2026-10-24-one-raider-kills-28.md)).

**Decision needed (orchestrator):**
- (a) the schedule: a smaller or later first peril-4 siege, or one scaled by the fortress's military as well as renown;
- (b) 10: a civilian in a shelter that a party has entered fights back when attacked and no exit leads out, instead of fleeing within it;
- (c) the fixture: the player answers a siege warning by arming every adult with a weapon or fighting at the gate;
- (d) accept: a peril-4 siege can wipe out an unprepared fortress.
