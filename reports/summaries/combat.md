# Combat: how deep is the fighting

**Short answer.** The fight simulation is a **detailed one-on-one exchange of rolls**, not a tactical battle. Every swing rolls to hit, then to parry, then to block, then picks a body part, subtracts the armour on that part, and turns the rest into a wound that bleeds. Wounds, blood loss and pain decide who falls. Around it sit squads, traps, war animals and hit-location armour. Missing are formations, morale, surrender, siege engines and anything beyond the single swing.

Terms. A **tick** is the game's smallest time step. A **peril** is the danger rating of the map. A **squad** is a group of up to 6 soldier dwarves. A **raid** is an attacking party of enemies (mostly "gloam", the goblin-like folk). **Hit points (HP)** here belong to each body part, not to the whole creature.

## How one swing works

1. **Hit roll.** `50 + 3 x (attacker skill - defender dodge skill) + (agility gap / 4)`, plus 40 if the defender is asleep or knocked out, plus 10 if fleeing. Kept between 5% and 95%.
2. **Parry.** If the defender wields a weapon: chance is 2% per skill level, at most 30%.
3. **Block.** If the defender holds a shield: `10 + 2 x shield skill`, at most 40% (buckler: `5 + 2 x skill`, at most 30%). A two-handed weapon rules out a shield.
4. **Body part.** One of six, picked by weight. For a dwarf: torso 35, legs 31, arms 24, head 10. The head weight is doubled against a sleeper or a knocked-out target.
5. **Damage.** `weapon damage x metal x quality x (50 + strength) / 100`, then **minus** the armour on that part, then up to 10% off for toughness. Blunt hits always keep at least 30% of their damage.
6. **Wound.** The damage becomes a cut (edge), puncture (pierce), bruise or fracture (blunt), light, serious or grievous by share of the part's HP.

## The seventeen questions

| Question | Answer | How it works | Code |
|---|---|---|---|
| Melee and ranged shooting | **Yes** | Melee swings as above. Bows, crossbows and slings fire real projectiles that fly 3 tiles a tick, need a clear line of sight, can hit someone in the way, and break 20% of the time. Range hit chance falls 2% a tile. | `src/systems/combat/melee.ts`, `ranged.ts` |
| Dodging and parrying | **Partly** | Dodge is a skill that lowers the attacker's chance to hit, 3% a level; there is no separate dodge roll. Parry is a real roll with a weapon. Nothing parries an arrow. | `melee.ts` |
| Blocking with shields | **Yes** | A real roll that stops the hit entirely, also against arrows (a bit weaker for bucklers). Only the shield skill matters: the shield's metal and quality do not. | `melee.ts`, `ranged.ts` |
| Tanking, drawing attacks | **No** | There is no taunt or threat. Enemies pick the nearest target, and archers prefer soldiers. A soldier in a doorway "tanks" only by being closest. | `src/systems/threats/ai.ts`, `combat/index.ts` |
| Ambush and surprise | **Partly** | Ambush raids arrive hidden and stay unseen until a dwarf or a trap spots them, then everyone is revealed at once with an alert. A spotted ambush gets no free hit. Sleepers and knocked-out targets are hit much more easily. Traps strike with the victim's dodge set to 0. | `threats/ai.ts`, `defense/traps.ts` |
| Stealth | **Partly** | Only some enemies are hidden (thieves, blind stalkers, ambush parties). Dwarves spot them within 6 tiles, trained war and hunting animals within 10. Dwarves cannot sneak. | `threats/ai.ts` |
| Blunt vs edge vs pierce | **Yes** | Each armour layer soaks a different amount of each type (table below). Edge cuts, pierce punctures, blunt bruises or breaks bones. | `melee.ts`, `src/systems/health/wounds.ts` |
| Heavy vs light armour | **Yes** | Four layers: padding, leather, mail, plate. Heavy pieces soak more but slow the wearer by weight/4 percent (a full steel kit about 11%), eased by armour skill. No tiring. | `melee.ts`, `combat/equipment.ts` |
| Body parts and hit location | **Yes** | Six parts, each with its own HP and armour cover. A shirt that covers the torso leaves the head and legs open. No aimed shots. | `melee.ts`, `src/content/bodyPlans.json` |
| Wounds, bleeding and fractures | **Yes** | Cuts and punctures bleed (light 1, serious 3, grievous 6 blood a health tick; punctures more). Light wounds clot after 150 ticks; others bleed until bandaged. A blunt hit of 30% of a part's HP breaks it. Wounds can infect. A part at 0 HP is lost; the head or torso at 0 kills. | `health/wounds.ts`, `health/tick.ts` |
| Knockout | **Yes** | A creature drops when pain reaches 80 or blood falls below 40%, and dies below 20%. Willpower lowers pain. It wakes when it recovers. Knocked-out targets are easy to hit. | `health/tick.ts` |
| Skill levels | **Yes, but narrow** | Levels 0 to 20. Skill raises hit, dodge, parry and block chances, and the smith's skill raises item quality. It does not raise damage. Sparring in a barracks trains it. | `src/systems/dwarves/skills.ts`, `combat/training.ts` |
| Morale, fleeing and surrender | **Fleeing only** | Wild animals and raiders flee when blood drops below a share set per species (25% to 50%). A raid retreats when half its members are down. Civilians run from enemies; soldiers on duty never run. No fear, rout or surrender exists. | `combat/index.ts`, `threats/ai.ts` |
| Squads, formations, crowding | **Squads yes, formations no, crowding no** | Up to 6 squads of 6. Modes off, train and active. Orders: kill, station, patrol, follow. Alert levels calm, watchful, hearth. A creature standing in a doorway blocks it. | `combat/squads.ts` |
| Traps | **Yes** | Four traps: stone-fall, spike, cage and weapon. A drawbridge also crushes. Levers and pressure plates link to them. Weapon traps jam as corpses pile up. | `src/systems/defense/traps.ts`, `buildings/build.ts` |
| War animals | **Yes, limited** | Dogs, wolves, bears and mole hounds can be trained at a kennel: +50% damage and +1 armour. They attack enemies within 8 tiles of their post or their dwarf. | `src/systems/animals/tame.ts` |
| Siege engines | **No** | No catapults, ballistae or rams. A "siege" is just a larger raid with trollkin who break doors. Dwarves cannot build engines. | `threats/parties.ts` |

Damage type against armour layer (a bigger number means the layer protects more):

| Damage \ Layer | Padding | Leather | Mail | Plate |
|---|---|---|---|---|
| Edge | 0.6 | 0.8 | 1.2 | 1.1 |
| Pierce | 0.4 | 0.6 | 0.8 | 1.2 |
| Blunt | 1.2 | 1.0 | 0.5 | 0.9 |

Squad and crowding note: a change that removes door blocking and adds crowding slowdowns (T-457) is in progress and not merged. This page describes master.

## What is NOT simulated

- Formations, flanking, facing, or any tactical positioning bonus.
- Taunting, threat, or "holding the line".
- Morale, fear, panic, rout, surrender or taking prisoners (caging a creature in a cage trap is the only capture).
- Siege engines, ladders, rams, or enemies digging in.
- Wrestling, grappling, mounted fighting, throwing, called shots.
- Weapon or armour wear, breakage or dulling. Gear lasts forever.
- Stamina and tiring.
- Poison, disease from weapons, or magic.
- A broken bone or lost arm does not stop a dwarf from swinging (see below).

## An example duel, measured

One Novice dwarf (all skills at 2) with an iron axe, iron shield and iron mail shirt, against two unarmoured goblins with copper short swords, skill 2. From [the combat pace measurement](../audits/2026-10-21-combat-pace.md), 60 duels:

| Figure | Result |
|---|---|
| Dwarf hit chance and damage | 57% for about 21 |
| Goblin hit chance | 46.5% of swings; the shield stops 12% of those that would hit |
| Where goblin hits land | 41% on the bare head or legs; a third do 0 on the mailed torso |
| First goblin dead | on the dwarf's 8th swing; second on the 13th |
| Fight length | about 280 ticks |
| Mail shirt only | dwarf wins **12**, goes down or dies in 48 |
| With helm and greaves added | dwarf wins **32** |
| Same, after a fix that makes light wounds clot in 150 ticks instead of 300 | dwarf wins **55** ([tune](../audits/2026-10-21-combat-pace-tune.md)) |

Other measured rows: one trollkin floors that dwarf after a median 3 hits, and the dwarf wins 10 of 60. A steel warhammer breaks a trollkin limb in one hit in 52 of 85 fractures. A squad of three Novices in iron mail loses to a raid of ten in the open in 21 of 24 trials, but the same raid **withdraws in 24 of 24** against a locked gate. Against an ambush of four, a squad of three in full kit wins 24 of 24.

## Spec vs code

- **Lost arms and broken bones do not hamper fighting.** The health spec says combat reads `canWield` so a dwarf with a lost arm cannot use a two-handed weapon or shield. The function exists in `src/systems/health/reader.ts` but nothing in combat calls it. A fracture only adds pain and slow healing.
- **Aggressive creatures can flee.** The spec says aggressive species never flee. The code uses a per-species `fleeBloodPercent` first, and wolves (45), bears (35) and trolls (30) have one. Only the magma wyrm and the creatures of the Deep never flee.
- **Civilian flee radius.** The spec text says 10 tiles in one place and 8 in the tuning table. The code uses 8.
- **Arrow vs buckler.** In melee a buckler blocks `5 + 2 x skill` as the spec says. Against arrows the code uses 70% of the full-shield formula instead.
- **Deepsilver armour weight.** Spec and data say half weight; the code ignores it (see the [metals summary](materials-and-metals.md)).
