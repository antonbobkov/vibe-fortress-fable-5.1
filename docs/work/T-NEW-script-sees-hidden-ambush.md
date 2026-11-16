# T-NEW — The three-year script sees an ambush before it springs

**Source:** [T-575's probe of 36 peril-4 ambushes](../../reports/data/2026-11-16-t575-ambush-answer.md) · **Size:** M · **Needs:** — · **Status:** open

## Why

`checkFortressDefense` (`test/scenarios/three_years_fortress.ts`) raises the hearth alert for any party but a thief from the tick it is on the map. An ambush arrives hidden (18 § Party AI: no `RaidArrived`, every member stealthed until spotted), and the threats panel lists no party all of whose members are hidden (`visibleThreatParties`), so a player cannot see it before `AmbushSprung`. The script can: it sends everybody in while the ambush is still hidden, and in about half the ambushes nobody is ever spotted and nobody dies.

T-575 measured it on its saves, each taken the tick an ambush arrived and played on for four days. Answering an ambush only once it has sprung, the 18 ambushes of seeds p4-1, p4-3 and p4-4 sprang 18 times and killed 53 dwarves with the squad at the gate stair, 28 with it stood down; answering it on arrival as master does, 10 sprang and killed 19 at the stair, 7 and 8 stood down. Over a sweep's six peril-4 seeds that is some twenty to thirty more deaths a sweep, about the sweep's whole tolerance.

## What to do

Decide whether the script answers an ambush only once it has sprung, as it answers a thief only once it is spotted. If it does, the sweep's reference moves with it (its deaths rise by the hidden ambushes' toll), and the instrument and `defence_seeds` are run again. If it does not, say in testing-strategy.md § the three-year fortress that the script knows of an ambush on its arrival, which a player does not.

## Done

The decision in testing-strategy.md, and, if the script changes, the sweep's verdict and the new reference.
