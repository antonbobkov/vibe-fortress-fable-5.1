# T-539: wolves and the three-year script's hearth alert

**Date:** 2026-11-10 · **Branch:** `t539-hold` · **Data:** [the deaths by killer and alert](../data/2026-11-10-t539-wild-deaths.txt)

## Why wolves raised the alert so often

On `three-years-p2-6` at shift 150 the game rules held: wolves stay their 42 days (`WILD_LIFETIME_DAYS`) and leave, the alert lowers when nothing is near, and no door lets a wolf in. The script was the problem.

- **Fights one soldier at a time.** The script sent the squad's kill order at the first sight of a wolf. Each soldier walked out from wherever the alert found it, so the first to arrive fought the pack alone. One of them carried no weapon. Since T-538 a struck wolf fights until it is down to 45% blood, so three soldiers died in nine days.
- **A flickering alert.** With two spears left and a recruit who never got a weapon (the fallen soldiers' spears were not claimed again for 40 days), the squad was "unarmed" and hunted nothing. Two hungry wolves then wandered in and out of the 14-tile box around the gate, which covers most of the 48-tile map. That raised 46 short alerts. Each one ended before T-387's half day, so T-387 never lifted the alert. The civilians sheltered again and again, and the dining hall was never dug.

## What changed (the script only)

1. T-387's half day now counts across an **episode**: alerts raised again within half a day of the last one lowered count as one.
2. An armed squad **musters** at the gatehouse stair before it hunts a wild animal. It sets out only when three armed members stand there, and leaves its unarmed members behind.
3. The script **does not hunt an aggressive animal** (a wolf or a bear). The fortress shelters behind its doors and the squad waits below.
4. A wild animal **attacking a dwarf** is answered at once, even during the quiet day after a lifted alert. Without this, a hungry wolf killed two dwarves at the gate during one.

Wolves are no weaker. No game rule changed.

## Outcome

The sweep's verdict passes (run 42782003867: pooled 19.75/7/0.25/936.75/150.75), and the seed witnesses pass at all four shifts. Deaths to wild animals fell from 162 to 131 over the 80 timelines, against 102 before T-538.

Pooled deaths did not come back toward T-535's 132.75. Raid deaths rose by 44 (410 against 366), and no raid code changed. Two things explain why it stopped there:

- **Sheltering keeps the wolves around.** A pack that is not hunted stays its 42 days, and wild alerts rose from 604 to 1155.
- **Lone fights remain.** Soldiers who answer an attack still reach the fight one at a time. Before T-538 that cost little, because the wolf fled at the first swing.

To cut wild deaths further, the squad would need to fight as one, or keep its weapons after a death (follow-up: [T-541-fallen-soldiers-weapons](../../docs/work/T-541-fallen-soldiers-weapons.md)).
