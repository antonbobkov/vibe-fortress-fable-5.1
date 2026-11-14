# T-544: a strong squad against wolves and bears

**Task:** T-544 · **Date:** 2026-11-13 · **Branch:** `t544-wild-squad` on master `71484494` · **Kind:** an arena and its set rule, then a script change measured on GitHub; no game rule and no content row changed · **Source:** [the T-544 work file](../../docs/work/T-544-bear-mauls-unanswered.md), [T-543](2026-11-10-t543-sweep-deaths-drift.md), [T-539](2026-11-10-t539-wolves-and-the-hearth-alert.md)

## The answer

- **The owner's squad already has no problem with wolves and bears.** Five Proficient soldiers, three Proficient marksdwarves and a Proficient runecaster, all in steel, win every fight in the arena against a hungry pack of six, a bear, and `beastwood`'s doubled groups (twelve wolves, two bears): 48 of 48 each. No wolf ever kills a fighter: its bite (10 edge) does nothing through a steel helm, mail shirt or greaves.
- **What dead there are, the squad does to itself, or its caster draws.** Against twelve wolves a crossbow bolt (or once an ember bolt) that misses a wolf flies on into the soldiers fighting it and kills one in 5 fights of 48 (16 § Ranged resolution: a miss flies on; a Proficient shooter holds only while an ally stands *before* its target). A bear charges whoever struck it first (08 § Struck), usually the caster, whose bolt reaches it before the soldiers do; one serious cut with no medic kills it in 2 fights of 48. A caster in a tunic, as earlier caster arenas field one, dies in 5 bear fights of 48 and 8 against two bears.
- **The set rule is met with no rule fix and no softening.** No rule examined was wrong: armour stops a bite as 16's formula says, the squad fights together under its kill orders, the marksdwarves shoot about ten bolts a fight and the caster casts three to seven bolts. Friendly fire after the shot is a rule 16 keeps on purpose, and a bear's charge at the striker is T-538's. Wolves and bears are unchanged.
- **Weaker squads still find them dangerous.** The same squad at Novice in copper wins every fight but loses a fighter in 14 of 24 against six wolves and 19 of 24 against a bear. The three-year script's squad (three Novice swordsdwarves in iron mail shirts) loses 2.54 of its 3 a fight to six wolves and is down in 6 of 24; with iron helms and greaves, which its forge makes after the kit, it wins every fight and loses 0.25 a fight to six wolves or a bear.
- **The three-year script** now hunts a wolf or a bear with its mustered squad once three members are armed in metal (a metal weapon, helm, body armour and greaves), and shelters as before until then. SWEEP_RESULT

## The arena

`test/scenarios/wild-squad-arena.ts` on `flat-test`, through the real tick loop. The squad stands at its station; the wild group arrives together 18 tiles north, so its members are one pack (08), wolves hungry; both squads are sent after every animal, the nearest first, as the three-year script sends its squad. A fight ends when no animal of the group is on the map or no fighter stands, at most two days; then a day passes with no medic and the dead are counted. Seeds `t544-arena-<i>`. The probe that ran the rows is filed as [2026-11-13-t544-arena.probe.ts.txt](../data/2026-11-13-t544-arena.probe.ts.txt), the rows in [2026-11-13-t544-wild-arena.jsonl](../data/2026-11-13-t544-wild-arena.jsonl), summarised by [2026-11-13-t544-arena-summary.cjs.txt](../data/2026-11-13-t544-arena-summary.cjs.txt).

| Squad | Group | Fights | Won | Fighters dead a day later | Fights with a death | By the animals / by the squad | Animal blows that landed, a fight | Bolts, casts a fight | Ticks |
|---|---|---|---|---|---|---|---|---|---|
| owner's, steel | pack of 6 | 48 | **48** | **1** | 1 | 0 / 1 | 1.3 | 10.5, 3.6 | 214 |
| owner's, steel | bear | 48 | **48** | **2** | 2 | 2 (caster) / 0 | 0.2 | 4.4, 1.9 | 149 |
| owner's, steel | 12 wolves (`beastwood`) | 48 | **48** | **5** | 5 | 0 / 5 | 6.6 | 20.7, 6.9 | 357 |
| owner's, steel | 2 bears (`beastwood`) | 48 | **48** | **2** | 2 | 2 (caster) / 0 | 0.4 | 9.2, 3.3 | 239 |
| caster in a tunic | pack of 6 | 48 | 48 | 0 | 0 | — | 1.3 | 10.8, 3.8 | 218 |
| caster in a tunic | bear | 48 | 48 | 5 | 5 | 5 (caster) / 0 | 0.2 | 4.4, 1.9 | 149 |
| caster in a tunic | 12 wolves | 48 | 48 | 6 | 5 | 0 / 6 | 6.6 | 21.1, 6.9 | 359 |
| caster in a tunic | 2 bears | 48 | 48 | 8 | 8 | 8 (caster) / 0 | 0.4 | 9.1, 3.2 | 240 |
| Novices in copper | pack of 6 | 24 | 24 | 16 | 14 | 5 / 11 | 12.7 | 18.8, 5.6 | 381 |
| Novices in copper | bear | 24 | 24 | 20 | 19 | 15 / 5 | 1.3 | 4.8, 1.8 | 241 |
| Novices in copper | 12 wolves | 24 | 24 | 43 | 23 | 31 / 12 | 51.0 | 40.5, 11.8 | 870 |
| Novices in copper | 2 bears | 24 | 24 | 30 | 20 | 25 / 5 | 2.5 | 9.1, 2.8 | 444 |
| script's three, iron mail | pack of 6 | 24 | 18 | 61 of 72 | 24 | 61 / 0 | 31.7 | — | 858 |
| script's three, iron mail | bear | 24 | 24 | 16 of 72 | 16 | 16 / 0 | 2.2 | — | 331 |
| script's three, iron helm, mail, greaves | pack of 6 | 24 | 24 | 6 of 72 | 6 | 6 / 0 | 32.6 | — | 639 |
| script's three, iron helm, mail, greaves | bear | 24 | 24 | 6 of 72 | 6 | 6 / 0 | 2.2 | — | 331 |

The owner's squad killed every animal in every fight. One or two wolves fled off the map in 3 copper fights against twelve and in 9 fights of the script's three in mail against six.

**The set rule** (balance.md § Combat pace; `test/unit/combat/t544-wild-squad-arena.test.ts` on seeds 0 to 23): the owner's squad wins every fight against each of the four groups, and loses under one fighter in ten fights against the pack and the bear, under one in five against `beastwood`'s groups; Novices in copper lose a fighter in at least a third of their fights against the pack and the bear. On seeds 0 to 23 the owner's squad loses 1, 1, 4 and 1.

The work file's example bar was none against a lone bear. It is not met in 48 fights (2), and I chose under one in ten instead: the deaths are the caster when it draws the charge, from one serious cut that a medic bandages (17 § Bleeding). Meeting "none" would need the bear to ignore the caster that struck it, which is T-538's behaviour and the task leaves it alone.

## The three-year script

SWEEP_SECTION
