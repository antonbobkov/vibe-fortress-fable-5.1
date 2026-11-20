# T-654 — The armed line counts wooden weapons as arms

**Source:** T-647's probe of seed `three-years-p4-6` at shift 150 (`test/perf/t647_drill_probe.test.ts`) · **Size:** S · **Needs:** — · **Status:** open

## Why

At tick 232,200 of that timeline the Gate Guard, six soldiers in steel helms, mail and greaves, each held a wooden training sword. The Military panel's armed line read `Armed 6 of 6`, in the normal colour, the whole time. The squad prefers swords, and a training sword of the preferred class scores above a real weapon of another class (16 § Equipment), so a squad drills with wood by design. But every iron sword, spear, axe and pick in the fortress was held by another dwarf, so the squad had nothing to fight with. Since T-647 the armed line says `wooden weapon, no harm done` once a raider is in the barracks. Before that, nothing tells the player that the squad has no real weapons.

## What to do

The armed line counts a training weapon apart from a real one at all times, for example `Armed 6 of 6 (6 wooden)`. Show this in the alert colour only when no real weapon is free for the members who hold wood, since that is when the squad could not take one up in a fight (16 § Training). The stock line under it then says what to order. Its weapon count should leave out free training weapons: today `weaponStock` counts them, so a spare wooden sword hides `No sword in stock`.

Spec: `ui-screens/panels.md` § Military (the armed line); 16 § Training.

## Done

A UI test: a squad whose members all hold training swords, with no real weapon free, shows the wooden count in the alert colour and the stock line. With an iron spear free, the line is in the normal colour.

- [x] **Wooden count and colour**, `test/unit/ui/t654-armed-line-wood.test.ts`: a squad of three preferring swords, each member holding an oak training sword, with a spare one in stock and the embark's axe and picks (claimed first by the workers lacking them) and crossbow (a launcher) the only real weapons, reads `Armed 3 of 3 (3 wooden)` in the alert colour, with "No sword in stock: order one at a craftsdwarf's workshop or a forge [o] or buy one." under it: the spare training sword no longer counts. With an iron spear in stock the line keeps the count in the normal colour and the stock line goes. The panel's "real weapon free" (`realWeaponFree` in `src/ui/panels/gear.ts`) reads 16 § Training's rule over the readers, as the combat system's own check does.
- [x] T-647's test `test/unit/combat/t647-drill-weapons.test.ts` now expects the wooden count on the line (`Armed 1 of 1 (1 wooden)`, and with the harmless note after it).
- [x] Spec: `panels.md` § Military (the armed line and its colour, the stock line's count); 16 § Training.
