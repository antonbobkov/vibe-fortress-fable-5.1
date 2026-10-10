# Wild animals and civilians after the fixes

**Date:** 2026-10-10 · **Task:** T-196 · **Follows:** [`2026-10-10-wild-animals-and-civilians.md`](2026-10-10-wild-animals-and-civilians.md) (the audit at `26b6b86`) · **Code measured:** branch `cloud/T-196`, the working tree of the commit that lands these fixes · **By:** Claude (Opus)

## The answer

One wild animal no longer kills a group. With seven civilians crossing an animal's ground for three days, ten seeds each:

- **Nobody answers, no medic:** a badger killed 9 of 70 (it was 18 of 35 on five seeds before), a boar 17 of 70 (24 of 35), a fed wolf 13 of 70 (18 of 35). No run lost more than four; before, runs lost all seven.
- **A medic with cloth:** badger 0 of 70, boar 7 of 70, wolf 1 of 70 (before: 13, 19 and 13 of 35).
- **A medic, and a squad given a kill order at the first bite:** **no civilian lost to a badger (0 of 70)**, boar 2 of 70, wolf 0 of 70. Unarmoured soldiers died: 1 of 10 runs against a badger, 3 against a boar, 2 against a wolf.
- **A hungry wolf** still kills the dwarf it hunts, in every run, because a hunter keeps its prey (08) and a civilian in the open does not fight back (10): 17 of 70 with nobody answering (29 of 35 before). That decision is filed as T-212.

The figure written into `balance.md` § Wild animals: a careless fortress loses about one dwarf per animal whose ground it keeps crossing, never the group; a fortress with a medic and a squad that answers loses no civilian to a badger.

## What changed

| Link | Change | Where |
|---|---|---|
| The animal takes the next dwarf after a kill | An attack ends when the target dies; only `idle` starts a new one. A kill ends a hungry predator's hunger (on `CreatureDied` with it as the killer). | 08 § Wild behavior; `animals/brain.ts`, `animals/index.ts` |
| The animal chases a fleeing dwarf without end | A *defending* attack (started because a dwarf came within `TERRITORY_RADIUS` or `APPROACH_RADIUS`) remembers the tile it began on. When the target is farther than that radius from the tile, on another level, or unconscious, the animal drops it and wanders (a wander ignores dwarves). A hunting attack is not limited. | 08 § Wild behavior, § State; `Wild.defendFrom` |
| A kill order beyond 14 tiles does nothing | A soldier whose kill target is out of perception walks toward it, and takes it as its target once in perception. | 16 § Squads; `combat/squads.ts` |
| One `stop_bleeding` bandaged one wound | It bandages every bleeding wound and sets their bleed to 0, as 17 already said. Found in a trace of this task; it changed no figure above. | `health/producer.ts` |
| A light wound bled until healed | A light wound stops bleeding `CLOT_TICKS` (300) after it was made. Serious and grievous wounds still need a bandage. | 17 § Bleeding, § Tuning constants; `health/tick.ts` |

## How it was measured

The chain probe of the first report, extended with `T196_HUNGRY=1` (the animal is hungry when it appears) and run on seeds `s1` … `s10`: [source](../data/2026-10-10-t196-probe-chain-v2.test.ts.txt), [after the fixes](../data/2026-10-10-t196-probe-final.json), [hungry wolf after](../data/2026-10-10-t196-probe-final-hungry.json), [hungry wolf before](../data/2026-10-10-t196-probe-before-hungry.json) (five seeds, run on the code of `26b6b86` with the same probe). The "before" figures are the first report's five-seed baseline ([data](../data/2026-10-10-t196-probe-before.json)).

Measurement rounds, as the time box counts them:

1. Round 1 ([data](../data/2026-10-10-t196-probe-after1.json), five seeds): the 08 and 16 fixes and `CLOT_TICKS` = 300.
2. Round 2, the only tuning ([150](../data/2026-10-10-t196-probe-clot150.json), [600](../data/2026-10-10-t196-probe-clot600.json); `lone`, `haul` and `hospital`, five seeds). Civilians lost in `haul`: badger 5 / 6 / 8 of 35 at 150 / 300 / 600 ticks; boar 9 and wolf 8 at all three. The value hardly matters: the deaths that remain are from serious wounds, which never clot. 300 was kept (a light cut loses 60 blood, a light puncture 120, of 600).
3. Round 3: the `stop_bleeding` fix, five seeds; every figure equal to round 1.
4. Confirmation on ten seeds with no change of constant (the tables below).

## After the fixes, ten seeds

| Mode | Species | Runs with an attack | Civilians dead / at risk | Wounded dwarves who died | Ticks from first wound to death (median, range) | Ticks spent biting unconscious dwarves (sum) | Ticks chasing a fleeing dwarf (median per run) | Dwarf hits / attacks on the animal | Treatments | Animal killed |
|---|---|---|---|---|---|---|---|---|---|---|
| lone | badger | 7/10 | 5/10 | 5/7 | 481 (318–2279) | 2 | 60 | 0 / 0 | 1 | 0/10 |
| lone | boar | 7/10 | 7/10 | 7/7 | 590 (173–2357) | 4 | 27 | 0 / 0 | 1 | 0/10 |
| lone | wolf | 6/10 | 4/10 | 4/6 | 859 (790–2720) | 0 | 9 | 0 / 0 | 2 | 0/10 |
| haul | badger | 7/10 | 9/70 | 9/16 | 949 (277–2409) | 1 | 110 | 0 / 0 | 12 | 0/10 |
| haul | boar | 7/10 | 17/70 | 17/19 | 321 (165–1381) | 3 | 131 | 0 / 0 | 9 | 0/10 |
| haul | wolf | 8/10 | 13/70 | 13/17 | 681 (197–869) | 1 | 28 | 0 / 0 | 14 | 0/10 |
| hospital | badger | 6/10 | 0/70 | 0/7 | — | 0 | 44 | 0 / 0 | 14 | 0/10 |
| hospital | boar | 6/10 | 7/70 | 7/11 | 557 (230–1175) | 0 | 92 | 0 / 0 | 16 | 0/10 |
| hospital | wolf | 6/10 | 1/70 | 1/8 | 696 | 0 | 18 | 0 / 0 | 22 | 0/10 |
| react | badger | 8/10 | 0/70 | 1/10 | 487 | 0 | 27 | 12 / 25 | 18 | 8/10 |
| react | boar | 8/10 | 2/70 | 5/10 | 302 (148–332) | 1 | 26 | 36 / 68 | 14 | 7/10 |
| react | wolf | 6/10 | 0/70 | 2/5 | 316 (259–374) | 0 | 7 | 9 / 17 | 9 | 6/10 |

"Wounded dwarves who died" counts soldiers too: in `react` every death beyond the civilians column is an unarmoured soldier (1 to the badger, 3 to boars, 2 to wolves).

Hungry wolf, ten seeds after and five before:

| Mode | After: civilians dead / at risk | Before | After: ticks from first wound to death (median) |
|---|---|---|---|
| lone | 10/10 | 5/5 | 219 |
| haul | 17/70 (1 to 3 per run) | 29/35 | 234 |
| hospital | 12/70 | 31/35 | 220 |
| react | 10/70 (1 per run) | 24/35 | 229 |

## What the numbers say

- **The defence ends.** A defending animal chased a fleeing dwarf for a median of 7 to 131 ticks per run (720 before), and bit unconscious dwarves for 0 to 4 ticks in total per mode (145 to 715 before).
- **A medic now has time.** With a medic and cloth, a badger's wounded all lived (7 of 7) and 14 treatments finished; before, no treatment finished in 15 runs.
- **What still kills is a serious wound with nobody to bandage it.** A badger's bite of 6 is serious on a dwarf's head (6 / 30 = 0.2, the edge of `LIGHT_MAX`), a boar's gore of 12 is serious on any part but the torso, a wolf's bite of 10 on a limb. A serious cut bleeds 3 a health tick and kills an untreated dwarf in about 800 ticks; two serious punctures in 300. That is what `lone` and `haul` measure: a dwarf crossing the same ground fifty times gets bitten again on later trips (up to 7 separate attacks in one `haul` run). It is the cost the target allows a careless fortress.
- **A boar beats the medic sometimes.** In `hospital` a boar's two gores killed before a bandage 7 times; a treatment took about 300 ticks from the first wound (claim, cloth, walk, `TREAT_TICKS`). Not changed.
- **A hungry wolf is the real danger** (T-212).

## Not established

- Year-long figures. The probe is three days of one animal on a flat map; how many encounters a fortress meets in a year, and how often its dwarves cross an animal's ground, is not measured here. The long fixtures (`year_one`, `homestead_year`, the three-year sweep) will show it; `homestead_year` on branch `t-144` lost four or five dwarves to one badger before these fixes and is the first to re-run.
- Why a skill-0 hauler took a `stop_bleeding` job ahead of the Chief Medic in the trace of `react` badger `s3`: by the labor defaults of 11 every dwarf has `medicine` on, and the job went to the first claimant. Its failure (20% at skill 0) let a soldier bleed out. Not a fault against the specification; not changed.
