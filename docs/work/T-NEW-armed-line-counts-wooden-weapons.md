# T-NEW — The armed line counts wooden weapons as arms

**Source:** T-647's probe of seed `three-years-p4-6` at shift 150 (`test/perf/t647_drill_probe.test.ts`) · **Size:** S · **Needs:** — · **Status:** open

## Why

At tick 232,200 of that timeline the Gate Guard, six soldiers in steel helms, mail and greaves, each held a wooden training sword. The Military panel's armed line read `Armed 6 of 6`, in the normal colour, the whole time. The squad prefers swords, and a training sword of the preferred class scores above a real weapon of another class (16 § Equipment), so a squad drills with wood by design. But every iron sword, spear, axe and pick in the fortress was held by another dwarf, so the squad had nothing to fight with. Since T-647 the armed line says `wooden weapon, no harm done` once a raider is in the barracks. Before that, nothing tells the player that the squad has no real weapons.

## What to do

The armed line counts a training weapon apart from a real one at all times, for example `Armed 6 of 6 (6 wooden)`. Show this in the alert colour only when no real weapon is free for the members who hold wood, since that is when the squad could not take one up in a fight (16 § Training). The stock line under it then says what to order. Its weapon count should leave out free training weapons: today `weaponStock` counts them, so a spare wooden sword hides `No sword in stock`.

Spec: `ui-screens/panels.md` § Military (the armed line); 16 § Training.

## Done

A UI test: a squad whose members all hold training swords, with no real weapon free, shows the wooden count in the alert colour and the stock line. With an iron spear free, the line is in the normal colour.
