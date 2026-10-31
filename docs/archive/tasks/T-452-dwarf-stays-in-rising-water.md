# T-452 — A dwarf stays put while water rises around it

**Closed:** 2026-10-30, in 3b3906d.

**Source:** T-449, [the bank journal](../../../reports/audits/2026-10-30-drowning-at-the-bank.md) · **Size:** M · **Needs:** — · **Status:** open

## Why

T-449 removed the flood that generation caused, so no generated map now puts dwarves in this position. Any flood a player makes still can: a dammed river, an opened channel, a burst cistern.

In the T-449 journal, a dwarf that had walked on to a tile at level 3 kept standing there when the level moved to 4. Pathing refuses a move into deep water, but nothing tells a dwarf to leave a tile that has become deep. Dwarves went on drinking, sleeping or talking on that tile until `DROWN_DAMAGE` killed them, and 34 died this way in one journal. In the trail below, the level flickers between 3 and 4 while the dwarf stays:

```
332285|14,30,31 k2 l3 need/thirst
332324|14,30,31 k2 l4 need/thirst
332326|14,30,31 k2 l4 need/sleep
332332|14,30,31 k2 l3 need/sleep
```

`water()` also accepts a stand tile that is itself in water, and the need errands that end on a stand tile take no account of its level.

## What to do

Decide the rule and put it in 10 § Behavior selection, with 04 § Creatures and items in fluid and 17 stating their side. The likely shape:

- A dwarf on a tile with water of `FLUID_DEEP_LEVEL` or more leaves for the nearest tile that is not deep, ahead of its needs and its work, as it does for fire.
- A need errand does not sleep or idle on a wet tile.

Check how this meets `19` § The drowning chamber, whose victims are not dwarves, and the case of a dwarf with no dry tile in reach.

## Done

- A stepped test: water rises around a dwarf on a test map, and the dwarf walks out alive.
- The rule is in the owning specs. The gates pass, and the annual instrument holds by the T-308 rule.
