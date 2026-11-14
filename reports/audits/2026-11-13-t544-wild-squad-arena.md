# T-544: a strong squad against wolves and bears

**Task:** T-544 · **Date:** 2026-11-13 · **Branch:** `t544-wild-squad` on master `71484494`, then merged with T-545 · **Kind:** an arena and its set rule, then a script change measured on GitHub; no game rule and no content row changed · **Source:** [the T-544 work file](../../docs/archive/tasks/T-544-bear-mauls-unanswered.md), [T-543](2026-11-10-t543-sweep-deaths-drift.md), [T-539](2026-11-10-t539-wolves-and-the-hearth-alert.md)

## The answer

- **The owner's squad already has no problem with wolves and bears.** Five Proficient soldiers, three Proficient marksdwarves and a Proficient runecaster, all in steel, win every fight in the arena against a hungry pack of six, a bear, and `beastwood`'s doubled groups (twelve wolves, two bears): 48 of 48 each. No wolf ever kills a fighter: its bite (10 edge) does nothing through a steel helm, mail shirt or greaves.
- **What dead there are, the squad does to itself, or its caster draws.** Against twelve wolves a crossbow bolt (or once an ember bolt) that misses a wolf flies on into the soldiers fighting it and kills one in 5 fights of 48 (16 § Ranged resolution: a miss flies on; a Proficient shooter holds only while an ally stands *before* its target). A bear charges whoever struck it first (08 § Struck), usually the caster, whose bolt reaches it before the soldiers do; one serious cut with no medic kills it in 2 fights of 48. A caster in a tunic, as earlier caster arenas field one, dies in 5 bear fights of 48 and 8 against two bears.
- **The set rule is met with no rule fix and no softening.** No rule examined was wrong: armour stops a bite as 16's formula says, the squad fights together under its kill orders, the marksdwarves shoot about ten bolts a fight and the caster casts three to seven bolts. Friendly fire after the shot is a rule 16 keeps on purpose, and a bear's charge at the striker is T-538's. Wolves and bears are unchanged.
- **Weaker squads still find them dangerous.** The same squad at Novice in copper wins every fight but loses a fighter in 14 of 24 against six wolves and 19 of 24 against a bear. The three-year script's squad (three Novice swordsdwarves in iron mail shirts) loses 2.54 of its 3 a fight to six wolves and is down in 6 of 24; with iron helms and greaves, which its forge makes after the kit, it wins every fight and loses 0.25 a fight to six wolves or a bear.
- **The three-year script** now hunts a wolf or a bear with its mustered squad once three members are armed in metal (a metal weapon, helm, body armour and greaves), and shelters as before until then. Its forge now makes the squad greaves and a helm each right after its kit: left to the standing armour orders, the squads of two seeds run locally had no greaves in a year. Even so a squad is armed in metal late and seldom: it set out 4 times in 80 timelines on its own and 7 with T-545. The sweep passes and the change is harmless (148.75 deaths against master's 147, inside the noise), so the hunt stays. Bear kills fell from 8 to 5.75 a sweep, wolf kills held at 11.5. With T-545's quiet season the merged sweep pools 1024.25 living and 130.75 deaths, with 4.5 wolf and 2.25 bear kills a sweep, and the sweep and instrument references are refreshed to it.

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

The script now hunts a wolf or a bear with its squad, mustered at the gatehouse stair as T-539 musters it for a boar, once three members are armed in metal: a metal weapon, helm, body armour and greaves. Only those members set out. Until then it shelters, as before. A wolf or a bear attacking a dwarf is answered at once, as before. The arena's last two rows are why the bar is helm, mail and greaves and not mail alone.

The forge did not make greaves in time. In local runs at shift 0, with only the 'iron goods' standing orders, the squad on seed p2-5 had mail by day 61 and no helm or greaves in the year. With a helm and then greaves ordered right after the kit, the squad on seed p2-1 had its first helm by day 191 and still no greaves: the forge takes the first runnable order, and the kit's own standing orders (mail, shields, swords, three of each in stock) refill as soldiers die and are replaced. So where the anvil comes in the wagon (perils 2 and 4) the forge is now ordered greaves first, then a helm, for each of the three, right after the kit, at routine priority (`HUNT_KIT`); greaves first because a bite lands on a leg three times as often as on the head. The kit still comes first.

Runs on GitHub ([the deaths by killer](../data/2026-11-13-t544-sweep-deaths.txt), [the merged verdict](../data/2026-11-13-t544-sweep-verdict.md)):

| Run | Commit | Living / deaths | Verdict | Deaths to raiders / none named / wolves / bears, a sweep | Hunts in 80 timelines |
|---|---|---|---|---|---|
| master, before (T-545's baseline) | `71484494`, 43561424594 | 886 / 147 | pass | 96 / 29 / 11.75 / 8 | — |
| T-544 alone | `5698da35`, 43568577943 | 889.5 / 148.75 | pass | 95 / 34.5 / 11.5 / 5.75 | 4 (2 wolf, 2 bear) |
| T-544 and T-545, shifts 0 to 150 | `4ab37734`, 43573320107 | 1024.25 / 130.75 | pass | 94.75 / 26.75 / 4.5 / 2.25 | 7 (3 wolf, 4 bear) |
| T-544 and T-545, shifts 200 to 350 | `4ab37734`, 43573322208 | 972.25 / 96.75 | (other shifts) | 83.75 / 10.75 / 0.75 / 1 | 3 (wolf) |

On its own the change is within the noise of one 4-shift sweep (about 9 deaths, T-543): its squad is rarely armed in metal before a fortress's wolves and bears do their harm, which is mostly in the first year. The script's answer stays the hunt, on the sweep's evidence that it costs nothing, and on the arena's that a squad in helm, mail and greaves wins. The instrument does not play this script; it passes on both commits (runs 43563647188 and 43573353421). `defence_seeds`, which plays the script's forge orders, passes on `5698da35` (run 43568581706): 6.75 raids of 8 turned back a cadence, against 6.50 in T-506's run.

**The references.** Both verdicts on the merged head pass, so, the T-543 way, `SWEEP_REFERENCE` is now its shifts 0 to 150 (20 / 7 / 0 / 1024.25 / 130.75, with 0.5 extinct and 3 need deaths) and `SWEEP_MEASURED` its eight-shift means (998.25 living, 113.75 deaths), giving bounds of 898.25 living and 143.75 deaths. `WILDLIFE_REFERENCE` and `WILDLIFE_MEASURED` are run 43573353421's pooled row (12.94 / 9.63 / 10.5 / 151.88 / 9.38), the row T-545's data file proposed.
