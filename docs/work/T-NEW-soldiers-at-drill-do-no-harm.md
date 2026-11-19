# T-NEW — Soldiers at drill strike a raider for nothing

**Source:** the T-639 branch's sweep, seed `three-years-p4-6` at shift 150 (measure.yml run 44595278154, job "sweep (p4-6, 150)"), traced on the branch · **Size:** S–M · **Needs:** — · **Status:** open

## Why

In that timeline a gloam ambush archer walked into the fortress before its doors shut and stood beside the barracks for over ten days (ticks 232,800 to 246,000), fighting the squad at drill. Over the first 2,500 ticks the soldiers' blows on it landed 404 times, all for 0 damage. The archer's bow-bash did 2 to 6 damage now and then, which healed. No one fell on either side. T-639 ended the fight with a stalemate rule (18 § Engage, `ENGAGE_STALEMATE_TICKS`): the party now stalls and goes home. Still, a squad on duty cannot hurt one raider in its own barracks, and the player is not told why.

## What to do

Find why every blow did 0 damage: training weapons kept in hand once a real enemy comes (16 § Training: they are wooden and do 0 damage), the gloam archer's armour against the soldiers' weapons, or the soldiers' skill. Then decide the rule. One option: a soldier on duty who targets a hostile takes up its real weapon. Another: the Military panel says the squad cannot harm what it fights. Write the rule into 16, and add a test where a soldier with only a training weapon meets a raider.

## Done

The cause is named, the rule is in the spec, and a unit test covers it.
