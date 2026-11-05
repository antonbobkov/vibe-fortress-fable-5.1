# Combat: how deep is the fighting

**Short answer.** The fight simulation is a **detailed one-on-one exchange of rolls**, not a tactical battle. Every swing rolls to hit, then to parry, then to block, then picks a body part, subtracts the armour on that part, and turns the rest into a wound that bleeds. Wounds, blood loss and pain decide who falls. Around it sit squads, traps, war animals, hit-location armour and **runecraft**: casters with staffs, stones set in weapons and armour, and potions ([runecraft summary](runecraft.md)). A raid holds together while its captain stands. Missing are formations, surrender, siege engines and anything beyond the single swing.

Terms. A **tick** is the game's smallest time step. A **peril** is the danger rating of the map. A **squad** is a group of up to 6 soldier dwarves. A **raid** is an attacking party of enemies (mostly "gloam", the goblin-like folk). **Hit points (HP)** here belong to each body part, not to the whole creature.

## How one swing works

1. **Hit roll.** `50 + 3 x (attacker skill - defender dodge skill) + (agility gap / 4)`, plus 40 if the defender is asleep or knocked out, plus 10 if fleeing. Kept between 5% and 95%.
2. **Parry.** If the defender wields a weapon: chance is 2% per skill level, at most 30%.
3. **Block.** If the defender holds a shield: `10 + 2 x shield skill`, at most 40% (buckler: `5 + 2 x skill`, at most 30%). A two-handed weapon rules out a shield.
4. **Body part.** One of six, picked by weight. For a dwarf: torso 35, legs 31, arms 24, head 10. The head weight is doubled against a sleeper or a knocked-out target.
5. **Damage.** `weapon damage x metal x quality x (50 + strength) / 100`, plus any enchantment's share, then **minus** the armour on that part (a ward adds armour on every part), then up to 10% off for toughness. Blunt hits always keep at least 30% of their damage.
6. **Wound.** The damage becomes a cut (edge), puncture (pierce), bruise or fracture (blunt), light, serious or grievous by share of the part's HP.

## The questions

| Question | Answer | How it works | Code |
|---|---|---|---|
| Melee and ranged shooting | **Yes** | Melee swings as above. Bows, crossbows and slings fire real projectiles that fly 3 tiles a tick, need a clear line of sight, can hit someone in the way, and break 20% of the time. Range hit chance falls 2% a tile. A shooter with a friend on its line holds the shot or picks another target, unless it is careless this time: half the time at skill 0, less each level, never from Proficient (10). So raid archers pepper their own front and Novice marksdwarves hit their own squad. | `src/systems/combat/melee.ts`, `ranged.ts`, `clear-shot.ts` |
| Dodging and parrying | **Partly** | Dodge is a skill that lowers the attacker's chance to hit, 3% a level; there is no separate dodge roll. Parry is a real roll with a weapon. Nothing parries an arrow. | `melee.ts` |
| Blocking with shields | **Yes** | A real roll that stops the hit entirely, by the same chance against arrows. A lost arm rules out a shield. Only the shield skill matters: the shield's metal and quality do not. | `melee.ts`, `ranged.ts` |
| Tanking, drawing attacks | **No** | There is no taunt or threat. Enemies pick the nearest target, and archers prefer soldiers. A soldier in a doorway "tanks" only by being closest. | `src/systems/threats/ai.ts`, `combat/index.ts` |
| Ambush and surprise | **Partly** | Ambush raids arrive hidden and stay unseen until a dwarf or a trap spots them, then everyone is revealed at once with an alert. A spotted ambush gets no free hit. Sleepers and knocked-out targets are hit much more easily. Traps strike with the victim's dodge set to 0. | `threats/ai.ts`, `defense/traps.ts` |
| Stealth | **Partly** | Only some enemies are hidden (thieves, blind stalkers, ambush parties). Dwarves spot them within 6 tiles, trained war and hunting animals within 10. Dwarves cannot sneak. | `threats/ai.ts` |
| Blunt vs edge vs pierce | **Yes** | Each armour layer soaks a different amount of each type (table below). Edge cuts, pierce punctures, blunt bruises or breaks bones. | `melee.ts`, `src/systems/health/wounds.ts` |
| Heavy vs light armour | **Yes** | Four layers: padding, leather, mail, plate. Heavy pieces soak more but slow the wearer by weight/4 percent (a full steel kit about 11%), eased by armour skill. No tiring. | `melee.ts`, `combat/equipment.ts` |
| Body parts and hit location | **Yes** | Six parts, each with its own HP and armour cover. A shirt that covers the torso leaves the head and legs open. No aimed shots. | `melee.ts`, `src/content/bodyPlans.json` |
| Wounds, bleeding and fractures | **Yes** | Cuts and punctures bleed (light 1, serious 3, grievous 6 blood a health tick; punctures more). Light wounds clot after 150 ticks; others bleed until bandaged. A blunt hit of 30% of a part's HP breaks it. Wounds can infect. A part at 0 HP is lost; the head or torso at 0 kills. | `health/wounds.ts`, `health/tick.ts` |
| Knockout | **Yes** | A creature drops when pain reaches 80 or blood falls below 40%, and dies below 20%. Willpower lowers pain. It wakes when it recovers. Knocked-out targets are easy to hit. | `health/tick.ts` |
| Skill levels | **Yes, but narrow** | Levels 0 to 20. Skill raises hit, dodge, parry and block chances, and the smith's skill raises item quality. It does not raise damage. Sparring in a barracks trains it. | `src/systems/dwarves/skills.ts`, `combat/training.ts` |
| Morale, fleeing and surrender | **Fleeing, the captain, and fear** | Wild animals and raiders flee when blood drops below a share set per species (25% to 50%). Wolves, bears and trolls flee too; only the magma wyrm and the Deep never do. A raid retreats when half its members are dead, knocked out or caged, and a raid or siege that has lost every captain it came with goes home as soon as it is out of a fight. Civilians run from enemies. Fear comes only from magic: the Dread spell, a fearsome blade and a dread hexer send up to four running for a while, soldiers on duty too, and they come back; a calm helm prevents it. No rout or surrender exists. | `combat/index.ts`, `combat/fled.ts`, `threats/ai.ts` |
| Squads, formations, crowding | **Squads yes, formations no, crowding yes** | Up to 6 squads of 6. Modes off, train and active. Orders: kill, station, patrol, follow. Alert levels calm, watchful, hearth. Creatures never block each other, but a tile with more than two standing creatures slows everything on it, steps and swings alike, by 25% for each one more, up to twice the time; a squad spreads round its station. | `combat/squads.ts`, `core/movement.ts` |
| Traps | **Yes** | Four traps: stone-fall, spike, cage and weapon. A drawbridge also crushes. Levers and pressure plates link to them. Weapon traps jam as corpses pile up. | `src/systems/defense/traps.ts`, `buildings/build.ts` |
| War animals | **Yes, limited** | Dogs, wolves, bears and mole hounds can be trained at a kennel: +50% damage and +1 armour. They attack enemies within 8 tiles of their post or their dwarf. | `src/systems/animals/tame.ts` |
| Siege engines | **No** | No catapults, ballistae or rams. A "siege" is just a larger raid with trollkin who break doors. Dwarves cannot build engines. | `threats/parties.ts` |
| Magic | **Yes, as gear** | A runecaster in a squad takes a staff by itself and casts by rule: bolts of fire or frost, a ward, mending, Dread, a fire burst, Daze, a summon. The player chooses the stone, not the moment. Gloam hexers cast frost or Dread at peril 3 and 4. | `src/systems/magic/cast.ts` |
| Enchanted gear and potions | **Yes** | A gem set in a weapon adds fire, frost, venom, damage or fear to a hit; in armour, armour, warding or calm. Draughts heal, halve pain or speed a soldier: one, then three days' rest. | `magic/enchant.ts`, `magic/draughts.ts` |
| Poison | **Partly** | A venomed blade (from a giant cave spider's venom) pains the target by 20 for 300 ticks; the spider's own bite does the same. It neither bleeds nor kills by itself. | `magic/cast.ts`, `health/tick.ts` |

Damage type against armour layer (a bigger number means the layer protects more):

| Damage \ Layer | Padding | Leather | Mail | Plate | Ward |
|---|---|---|---|---|---|
| Edge | 0.6 | 0.8 | 1.2 | 1.1 | 1.0 |
| Pierce | 0.4 | 0.6 | 0.8 | 1.2 | 1.0 |
| Blunt | 1.2 | 1.0 | 0.5 | 0.9 | 1.0 |
| Ember (rune fire) | 0.3 | 0.6 | 0.4 | 0.8 | 2.0 |
| Frost | 1.0 | 0.8 | 0.3 | 0.5 | 2.0 |

Mail is a poor answer to rune, plate a fair one, a ward the best. The magma wyrm's breath is plain fire (`burn`) and has no row: it multiplies by 1.0 against every layer.

## What is NOT simulated

- Formations, flanking, facing, or any tactical positioning bonus.
- Taunting, threat, or "holding the line".
- Panic, rout, surrender or taking prisoners (caging a creature in a cage trap is the only capture). Fear exists only through magic.
- Siege engines, ladders, rams, or enemies digging in.
- Wrestling, grappling, mounted fighting, throwing, called shots.
- Weapon or armour wear, breakage or dulling. Gear lasts forever.
- Stamina and tiring.
- Disease from weapons. Poison exists only as pain (venom).
- A broken bone does not stop a dwarf from swinging. A lost arm rules out a two-handed weapon and a shield, and with no arms a dwarf holds no weapon.

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

With magic, from the [runecraft measurements](runecraft.md#in-a-fight-measured): five soldiers and a Proficient caster warding them turn a peril-2 raid of ten back in 24 of 24 fights, where six soldiers manage 20; a draught of mending does the same for six soldiers. A dread hexer at peril 4 sends 2.6 soldiers running a fight, and a calm helm on each stops it entirely.
