# Measurement: the combat pace

**Task:** T-366 · **Date:** 2026-10-21 · **Commit examined:** master `a5cd51c` · **Kind:** measurement; no constant, formula or content value was changed · **Source:** [unmeasured spec numbers](2026-10-17-unmeasured-spec-numbers.md), rank 3

## The answer

- **The balance model's duel does not happen.** One Novice dwarf (axe, shield, armour use and dodge at 2) in an iron mail shirt with an iron axe and an iron shield, against two unarmoured gloam warriors with copper short swords at the base skill 2: the dwarf is down (unconscious from blood loss) or dead at the end of the fight in **48 of 60** trials and wins **12**. The model expects it to win with 2–3 light cuts and 100 blood lost. Against tier-1 warriors (skill 4, what peril 1 sends) it wins 4 of 60.
- **Why: the model left out hit location.** It reckons every goblin hit against the mail ("7 damage through the mail"). A hit lands by the humanoid plan's weights: torso 35, arms 24, legs 31, head 10. A mail shirt covers the torso and 60% of the arms, so a copper sword does nothing to the torso (210 of the 630 goblin hits did 0 damage), a light cut to an arm, and a **serious cut to the head or a leg**, which a mail shirt leaves bare (41% of hits). The dwarf took per fight 2.6 light cuts (arms), 2.9 serious and 0.6 grievous cuts on the legs and 1.0 serious on the head. A serious cut bleeds 3 a health tick until bandaged, so two of them put a dwarf of 600 blood below 40% within about 300 ticks. The median blood lost at the end is 364, the unconsciousness line.
- **The kills are slower than the model's too.** The dwarf hits 57% (model 50%) for 20.7 damage (model 22), but its hits are spread over six parts, so a goblin rarely dies of a destroyed torso; it dies bleeding. The first goblin falls at the dwarf's **8.4th** swing (model 5), the second at the **12.6th** (model 10, reached in 45 of 60). The goblins together swing 22.6 times in a fight of a median 280 ticks; they hit 46.5% (model 50%) and the shield blocks 12% of the swings that would land (model 14%).
- **A full kit halves the losses, and light cuts then do it.** With a helm and greaves added the dwarf wins **32 of 60**: every wound is a light cut, but it takes **8.2** of them in a fight of 380 ticks (the second goblin falls at swing 16.6), and eight light cuts bleeding 1 a health tick until `CLOT_TICKS` take a median 328 blood. 28 of 60 still go down.
- **"Three hits floor a dwarf" holds for the trollkin.** The same dwarf against one trollkin (slam 28 blunt) goes down after a median of **3** trollkin hits (34 of 61 at exactly 3; 1 to 6), with serious fractures of the torso and grievous ones of the limbs; it wins 10 of 60.
- **A steel warhammer fractures a trollkin limb in one hit, not two.** Of 85 limb fractures, 52 came at the first hit on that limb, 24 at the second, 9 at the third (the model says two; `weapons-and-armor.md`'s worked example says one, and is right). The hammer dwarf, in mail without a shield, still loses: 16 wins of 60, floored after a median 3 hits.
- **A squad of three does not handle a raid of ten.** Three Novice soldiers in iron mail with axes and shields, three civilians behind them, against the content raid of ten at peril 2 (seven warriors and three archers in tier-2 bronze at skill 6, a captain in tier 3 at skill 10) on open ground: the squad is down in **21 of 24** trials, all three soldiers are dead a day later (no medic in the arena) in 24 of 24, and the raid loses 4.4 of its 11. No variant changes this: with helm and greaves (22 of 24 down), at Competent skill 6 (23 of 24), both (23 of 24), or with the raiders' skill per tier halved (a probe what-if, not the game: 22 of 24 and 24 of 24). The soldiers hit 19% of their swings (the raiders' dodge 6 against axe skill 2, and half the raiders carry a shield); the raiders swing 120 times to the squad's 32.
- **A locked gate does.** The same raid against a wall with one locked door, the squad behind it: the raid withdraws in **24 of 24** with no blow struck. In the three-year fortress at peril 2 the gate is what decides it: the fixture locks its gate under the alert, and every party of the [peril-2 and peril-4 sweep](2026-10-18-hostiles-open-doors.md) ends `withdrew` or `looted`, none `repelled`.
- **The marks of the numbers this measures are replaced by this report:** the combat-pace section of `balance.md`, whose figures are now the measured ones, and in 16 `FRACTURE_PERCENT`, `CREATURE_BASE_SKILL`, `HOSTILE_SKILL_PER_TIER`, `CREATURE_ATTRIBUTE_DEFAULT` and the melee formulas (hit, parry, block, damage and Toughness, measured in their outcome shares). `MIN_ATTACK_COOLDOWN` stays *unmeasured*: an axe swings about every 23 ticks in the duels and the floor of 12 was never the limit. `BLUNT_THROUGH_PERCENT` (only the trollkin's slam exercised it, not separately), the ranged formula, `FLEE_BLOOD_PERCENT`, `PERCEPTION_RADIUS` and the training numbers stay *unmeasured* too.
- **The game misses the model's intent, and a number should move:** a mailed soldier is meant to beat two unarmoured goblins and a squad to meet a raid; as measured, a squad is lost to any raid it meets in the open, and the fortress survives raids only by shutting them out. Filed as [combat pace below the model](../../docs/archive/tasks/T-404-combat-pace-below-the-model.md), with the diagnosis above.

## What was run

`reports/data/2026-10-21-combat-pace.probe.ts.txt` (a vitest file under `test/perf`, not committed as a test), at `a5cd51c`: stepped arenas on the `flat-test` map with no embark and no wild animals, through the real tick loop (16's targeting, cooldowns and resolution, 17's wounds, bleeding and consciousness, fleeing, 18's party AI for the raid). Each trial is its own world with its own seed (`t366-<kind>-<i>`).

| Arena | Trials | Set-up |
|---|---:|---|
| `duel2` | 60 | one dwarf soldier (squad of one, active, Novice skill 2) in common iron mail shirt, iron axe, iron shield; two `gloam_warrior` with copper short swords and no armour, at `CREATURE_BASE_SKILL` + 0 (skill 2), targeted on the dwarf |
| `duel4` | 60 | the same, warriors at tier 1 (skill 4) |
| `duel2full` | 60 | `duel2` with an iron helm and iron greaves on the dwarf |
| `troll` | 60 | the `duel2` dwarf against one `trollkin` |
| `hammer` | 60 | a dwarf with a steel warhammer and an iron mail shirt, no shield, against one `trollkin` |
| `squad-open` | 24 | three such soldiers at a station, three civilians eight tiles behind; `arriveParty('raid', 'gloam', size 10, peril 2)` at the north edge, members spawned through 18 (11 with the captain) |
| `squad-open-full`, `-6`, `-full6` | 24 each | with helm and greaves; at skill 6; both |
| `squad-open-h4`, `-full-h4` | 24 each | probe what-if: the raiders' skills set to 4 (captain 7), as if `HOSTILE_SKILL_PER_TIER` were 1 |
| `squad-gate` | 24 | `squad-open` with a granite wall across the map and one locked oak door; the squad behind it |

Each trial runs until one side is down (or the raid ends, at most 3,000 ticks for a duel and 4,800 for a raid) and then a further day with no medic. The data (`…-combat-pace-arenas.json`) holds every trial and the summary made by `…-combat-pace-summary.mjs.txt`: swings and outcomes by side, damage, wounds by type, severity and part, blood lost, the swing at each kill, hostile hits before the dwarf went down, and for the hammer the limb hits to a fracture.

## The duels against the model

| Figure | Model (§ Combat pace) | Measured, `duel2` | `duel2full` |
|---|---|---|---|
| Goblin hit chance / shield block | 50% / 14% | 46.5% of swings hit; 6.8% of swings blocked (12% of those that would hit) | 43.8% / 5.3% |
| Damage of a goblin hit | 7 through the mail, a light cut | 0 on the torso (a third of hits), light on the arms, serious on head and legs; mean 6.8 | mean 2.8; all light |
| Wounds on the dwarf | 2–3 light cuts | 2.6 light, 3.8 serious, 0.6 grievous | 8.2 light |
| Blood lost | about 100 | median 364 at the end of the fight | median 328 |
| Dwarf hit chance / damage | 50% / 22, a serious cut | 57% / 20.7 | 53% / 21.0 |
| First goblin dead | 5 swings | swing 8.4 | swing 9.5 |
| Second goblin dead | 10 swings | swing 12.6 (45 of 60) | swing 16.6 (55 of 60) |
| Fight length | about 200 ticks | median 280 | median 380 |
| Outcome | the dwarf wins | won 12, down 47, dead 1 | won 32, down 28 |

The arena has no medic, so a serious cut bleeds until death: every `duel2` dwarf is dead a day later (57 bled out, 3 killed in the fight), and 29 of the 60 `duel2full` dwarves, those who went down. The model's "a hospital visit" is the right reading of the fight's end only when a medic comes in time; T-367 measures that.

## What this does not measure

- Ranged combat: the raid's archers shoot in the squad arenas, but no arena isolates the ranged formula.
- Traps, bridges and crossbow galleries, the spec's answer to trollkin and raids; only the locked gate.
- A squad that trains: the arenas set skills, they do not grow them.
- Magma wyrms and the Deep.
