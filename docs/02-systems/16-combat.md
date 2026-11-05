# 16 Combat

**Owner:** `systems/combat` · **Depends on:** [10-dwarves.md](10-dwarves.md), [17-health-and-medicine.md](17-health-and-medicine.md), [13-items-and-storage.md](13-items-and-storage.md), [14-buildings-and-rooms.md](14-buildings-and-rooms.md), [18-threats-monsters-and-raids.md](18-threats-monsters-and-raids.md), [22-pathfinding-and-spatial.md](22-pathfinding-and-spatial.md)

## Purpose

Resolve violence between creatures with rules the player can read: six body parts, three damage types, one hit roll, armor that covers parts, and weapons whose numbers are on the item. Own squads, training, equipment, alerts and orders.

## Concepts

- **Faction**: `fortress`, `wild`, `hostile:<civ>`, `trader:<civ>`, `deep`. Hostility is between factions: `fortress` vs `hostile:*` and `deep` always; `wild` vs anyone only while the animal is in `attack` (08); `trader` vs `hostile` always; the player can order attacks on `wild` and `trader` creatures (with consequences in 20).
- **Body part**: from the creature's body plan: for the standard plan `head`, `torso`, `left_arm`, `right_arm`, `left_leg`, `right_leg` with hit weights; other plans (quadrupeds, crawlers, wyrms) map their parts onto the same six slots with different weights and functions (a quadruped's arms are forelegs; a wyrm has no arms, so its plan gives the torso the arm weight).
- **Damage type**: `edge`, `blunt`, `pierce`; and rune's `ember` and `frost` ([25](25-runecraft.md) § Damage types). The magma wyrm's breath is `burn`, which has no row in the layer table.
- **Weapon**: an item with `WeaponDef`: class (`dagger`, `sword`, `axe`, `mace`, `hammer`, `spear`, `pick`, `crossbow`, `bow`, `sling`, `staff`), skill, damage type, base damage, size, hands, range and ammunition type for launchers. A launcher with no ammunition type is a channel, a wand or a staff, which casts (25 § Channels).
- **Armor**: an item with `ArmorDef`: slot (`head`, `body`, `arms`, `legs`, `feet`, `shield`), covered parts with coverage percent, layer (`padding`, `leather`, `mail`, `plate`), base armor value.
- **Squad**: up to `SQUAD_MAX_SIZE` dwarves with a mode, equipment preferences and orders.
- **Alert**: `calm`, `watchful`, `hearth`.

## Rules

### Targeting

A creature attacks when it has a `targetId` (set by 08 for animals, 18 for hostiles, this system for soldiers under orders or on duty, and 10 for civilians only when cornered or caught: a civilian who cannot flee, or who has been caught (§ Fleeing and morale in combat), fights back with whatever they carry). Each tick a creature with a target: if adjacent (8-neighborhood, same level), perform a melee attack if its attack cooldown has elapsed; else if it has a ranged weapon with ammunition (for a channel, the rune to cast its bolt, burst or single and the target within the spell's range: 25 § Casting), range ≥ distance and line of sight, perform a ranged attack (held, or turned on another target, while one of its own stands on the ray, unless the shooter is careless this time: § Ranged resolution); else path toward the target (movement helper). A channel holder first drinks a rune vial when it is below its spell's cost, and a ward, mend, dread or call staff casts for its held target when the spell's rule holds, each with the attack cooldown elapsed; a caster whose spell is no bolt stops `CASTER_HOLD_DISTANCE` (25) from its target instead of closing to club it (25 § Casting). A civilian (a dwarf that is not a soldier on duty) never paths toward its target: it fights only what is in reach. Targets that die, leave perception (`PERCEPTION_RADIUS`; a target more than two levels away is out of perception), or become unreachable for `TARGET_LOSE_TICKS` are dropped. A wild animal in `attack` uses 08's species perception and saved grace instead of this generic cutoff; 08 ends that held attack, including the earlier defended-ground and quarry-eligibility rules. Other creatures retain the generic perception cutoff. For other creatures, a target is not dropped for being out of sight: this system alone ends an acquired target, and 18's party AI leaves a held target alone. The `TARGET_LOSE_TICKS` count starts at the first failed approach and is not reset by a pending path retry, only by an actual step or an attack opportunity; the start tick is saved (`CombatState.unreachableSince`).

Soldiers on duty with no order pick the nearest hostile within perception. An on-duty soldier with a loaded launcher keeps `RANGED_KEEP_DISTANCE` tiles away from melee threats when possible. If a visible, conscious melee threat on the same level is within `RANGED_KITE_TRIGGER_DISTANCE`, choose the nearest one (distance, then entity id), including while another target is held. Step to the first legal adjacent tile by tile index that is at least `RANGED_KEEP_DISTANCE` away and keeps line of sight to that threat. While making that step, retain the target and do not attack. If no such step exists, ordinary attack and approach continue. Launcher and natural-ranged opponents do not cause kiting.

### Attack cooldown

`cooldownTicks = weapon.size × 3 + 10 − Agility / 10`, minimum `MIN_ATTACK_COOLDOWN`. Natural attacks use the species' attack size. On a crowded tile the attacker's cooldown takes longer (22 § Crowding). Under a `haste` effect (a draught of quickness, 25 § Effects) the result, crowd included, is `× 100 / (100 + haste)`, rounded down, at least 1; a missile's and a cast's cooldown likewise.

### Melee resolution

```
attackSkill  = skill(attacker, weapon.skill)            // or the species' natural attack skill for animals; launcher in melee: club at half damage, hammer skill (weapons-and-armor.md)
dodgeSkill   = skill(defender, 'dodge')
hit = 50 + (attackSkill − dodgeSkill) × 3 + (Agility(att) − Agility(def)) / 4
    + (defender unconscious or asleep ? 40 : 0) + (defender fleeing ? 10 : 0) + (defender in deep water ? 20 : 0)
    // fleeing: a brain or wild animal in flight, or a creature under a `flee` effect (25 § Effects)
    + to_hit of the weapon's enchantment                 // 25 § Enchantments in combat; 0 with none, as every enchantment term below
hit = clamp(5, 95, hit)
if rng.int(0, 99) ≥ hit: miss → AttackResolved { outcome: miss }; return

// parry and block (defenders that can act: conscious, not fleeing)
if defender wields a weapon with a melee skill: parryChance = min(30, skill(defender, weaponSkill) × 2); if rng < parryChance: outcome parried; return
if defender has a shield: blockChance = min(40, 10 + skill(defender, 'shield') × 2)    // buckler: min(30, 5 + skill × 2) (weapons-and-armor.md)
if rng < blockChance: outcome blocked; return

part = weighted pick from defender.bodyPlan hit weights (attacks from unconscious targets: head weight doubled)
raw  = weapon.baseDamage × metalTierMultiplier(weapon.material) × qualityMultiplier(weapon) × (50 + Strength(att)) / 100
       // natural attacks: species attack damage × (50 + Strength)/100; war-trained animals +50% (08)
raw  = raw × (100 + damage_percent + (defender of the deep faction ? vs_deep_percent : 0)) / 100    // the weapon's enchantment
armorReduction = Σ over armor pieces covering `part` (outer layer first): piece.armorValue × metalTierArmor(piece.material) × coverage / 100 × qualityArmorMultiplier
                 × damageTypeVsLayer(damageType, piece.layer)
                 // clothing counts as a padding layer of armor value 1 (weapons-and-armor.md)
                 // natural armor: (naturalArmor + (war-trained ? 1 : 0)) × damageTypeVsLayer(damageType, plate) (08); a defender with no species has none
                 // a ward: + ward × damageTypeVsLayer(damageType, ward) on every part while its effect lasts at the hit's tick (25 § Effects)
                 // an enchanted piece's `armor` adds to its armorValue; a sundering weapon's armor_percent is the share of the whole sum that counts
                 // one function, `armorReduction` in combat/melee.ts, for the blow, the missile and the inspector's `armorValue`
damage = max(0, raw − armorReduction)
if damageType == blunt and armorReduction > 0: damage = max(damage, raw × BLUNT_THROUGH_PERCENT / 100)    // blunt bruises through armor
damage = damage × fire_percent / 100 per covering piece that has it, for a hit whose wound is a burn; frost_percent likewise for frost (25)
damage = round(damage × (100 − min(10, Toughness(def) / 10)) / 100)    // Toughness reduction (17)
emit DamageDealt { defender, part, damageType, amount: damage, attackerId, weaponId }
emit AttackResolved { attacker, defender, part, damageType, amount, outcome: hit }
if damage > 0: the weapon's extra_damage, slow and flee (25 § Enchantments in combat: applyEnchantOnHit)
grant xp: attacker weapon skill; defender dodge (on miss), weapon skill (on parry), shield (on block), armor_use (on hit reduced by armor)
```

`damageTypeVsLayer` (content, `03-content/weapons-and-armor.md`): edge is reduced well by mail and plate, poorly by leather; pierce is reduced moderately by mail, well by plate, poorly by padding; blunt is reduced well by padding and leather, poorly by mail, moderately by plate; rune's ember and frost pass mail and are stopped best by a ward (25). A type with no row multiplies by 1.0. `metalTierMultiplier` for weapons and `metalTierArmor` for armor are in the metals table (copper 1, bronze 2, iron 3, steel 4, deepsilver 5 with multipliers 0.8, 0.9, 1.0, 1.25, 1.6; silver is a blunt weapon material with a bonus; wood, bone and obsidian weapons are tier 0 at 0.4, 0.5 and 0.7: the knapped daggers and short swords of a fortress with no metal, below copper).

Wound type from damage type (17): edge → `cut`; pierce → `puncture`; blunt → `bruise`, or `fracture` when `damage ≥ partMaxHp × FRACTURE_PERCENT / 100`; ember → `burn`; frost → `frost`. A natural attack of another type (the wyrm's `burn` breath in melee) is resolved as blunt.

The hit, parry, block, damage and Toughness formulas above are measured in stepped arenas ([combat pace](../../reports/audits/2026-10-21-combat-pace.md)): a Novice dwarf hits two skill-2 goblins 57% of its swings, they hit it 46% and its iron shield blocks one in eight of the rest; a hit lands on the part the body plan's weights pick, so a mail shirt leaves the head and legs bare. The terms of the ranged hit below are *unmeasured*.

Two-handed weapons (`hands: 2`) cannot be used with a shield; the squad equipment logic respects this. A shield blocks a missile by the same chance as a blow.

Creatures without `Attributes` use `CREATURE_ATTRIBUTE_DEFAULT` (50) for every attribute, so natural attacks deal their listed damage. Creatures without `Skills` use `CREATURE_BASE_SKILL` (2) for every combat skill (natural attacks, weapon skills, `dodge`, `shield`). Hostile party members spawned by 18 receive `Skills` with every combat skill at `2 + HOSTILE_SKILL_PER_TIER × gearTier` (`HOSTILE_SKILL_PER_TIER` = 2), plus 2 for captains.

### Ranged resolution

```
if not lineOfSight(shooter, target): cannot fire (the brain moves instead)
distance = Chebyshev(shooter, target) + z difference × 2
hit = 40 + skill(shooter, launcherSkill) × 3 − distance × 2 + (size(target) − 60) / 4 − skill(target, 'dodge') × 2 + (target unconscious ? 40 : 0)
    + to_hit of the ammunition's enchantment            // 25 § Enchantments in combat
hit = clamp(3, 95, hit)
spawn Projectile { itemId: one unit of ammunition (13 split), from, to, speed: PROJECTILE_SPEED, shooterId, hitRoll }
```

The ammunition unit is attached to the projectile through the item API while in flight, so it is not unattended stock on the shooter's tile. A channel fires a bolt instead (25 § Casting): no ammunition item, `raw = round(spell.base × power(channel))` of the spell's damage type, the holder's rune spent at the cast; skill `runecraft`, the channel's size for the cooldown, and everything after it as for a missile. A bolt that hits with damage above 0 may leave an effect (Frostbind's slow).

**Held shot.** A shooter with a launcher, ammunition or a channel's bolt alike, holds its shot while a creature of its own faction (for a fortress shooter, any fortress creature) stands on a tile of the projectile's ray before its target, unless it is careless this time:

```
careless% = CARELESS_SHOT_PERCENT × (CARELESS_SAFE_SKILL − skill) / CARELESS_SAFE_SKILL, rounded down; 0 at skill ≥ CARELESS_SAFE_SKILL
            // skill: the launcher's skill (crossbow, bow; runecraft for a channel). 50% at 0, 40% at Novice 2, 20% at 6, 5% at 9, 0 at Proficient 10
careless  = careless% > 0 and rng.int(0, 99) < careless%    // one draw, only with an ally on the line and its attack cooldown elapsed
```

The draw is on the shooter's own system stream: 16's for a launcher with ammunition, 25's for a caster (`ctx.world.rngFor('25')`). Nothing is drawn while the line is clear, nor at a chance of 0. A careless shooter shoots its held target through the ally, and the projectile meets the ally as any bystander (half the hit chance, below). A careful one holds: it shoots the nearest other creature hostile to it (distance, then id) that it can reach: within the launcher's range (a bolt's: what `canCastBolt` allows, 25 § Casting), in line of sight, with no creature of its own faction on that ray. With none it waits where it stands and spends nothing; if it drew, it takes the attack cooldown as if it had shot (§ Attack cooldown), so it weighs the shot again once a cooldown, not every tick. A shooter at a chance of 0 draws nothing and watches the line every tick. It keeps its held target either way. So a raid's archers (skill `2 + HOSTILE_SKILL_PER_TIER × tier`, 18) sometimes shoot into their own front, an apprentice caster singes its own squad, and a Proficient marksdwarf never fires through its line. The rule holds for every faction's shooters: marksdwarves, hunters, casters, hostile archers and hexers. A shot through `combat.fireAt` (09's hunt) is weighed the same way, on 16's stream, and a careful hunter waits, since the hunt has no other quarry. A natural ranged attack (the wyrm's breath) has no such rule. The line check itself draws nothing, so friendly fire after the shot stays real for every shooter: an ally can step into the path after the shot, and a miss flies on and can land on someone beyond the target. One search serves both kinds of launcher: `allyOnLine`, `nearestClearTarget` and `carelessThisTime` in `combat/clear-shot.ts`.

The projectile advances along a Bresenham line each tick by `PROJECTILE_SPEED` tiles. On entering the target's tile: if `hitRoll` succeeds, resolve as a melee hit with `raw = ammo.baseDamage × launcher.powerMultiplier × metalTier(ammo)`, no parry, block allowed, then the ammunition item drops on the tile with `AMMO_BREAK_PERMILLE` chance to be destroyed. A hit with damage above 0 from enchanted ammunition carries its effects first (25 § Enchantments in combat), read from the unit in flight, which keeps its stone when it drops. On a miss the projectile continues to `launcher.range` and drops. A projectile entering a tile with a wall, closed door, raised bridge or (from the far side) a fortification stops and drops. A creature other than the target in the path is hit with half the hit chance.

Line of sight (22): a Bresenham line on the same z-level with no wall, door, tree, raised bridge or closed floodgate in between; fortifications pass projectiles only if the shooter is adjacent to the fortification (a defender at the wall) or the target is adjacent to it (shooting in). Ranged creatures cannot shoot across z-levels except from a fortification one level up (an overlook) to a target on the level below within range.

### Fleeing and morale in combat

- Civilians flee from any hostile within `THREAT_RADIUS` (8), including escape through stairs and ramps. A cornered civilian (no flee tile) fights until a critical need or the civilian combat timeout in 10 interrupts it. A fleeing civilian hit in melee by a wild animal that is hunting it, or by a cavern monster, that is at least as fast as itself is caught and fights that attacker in the same way (a hit from a defending animal or a hostile of a party does not catch it). A squad member off duty who is hit in melee by anything is caught too, and fights with the gear it carries. Either fights until the attacker breaks off, flees or dies, or a route opens that the attacker cannot follow (10 § Behavior selection).
- Squad members on duty do not flee.
- **What a squad can do against a raid** (measured in the combat-pace arena, the open ground before a station, [balance.md](../03-content/balance.md) § Combat pace): a raid breaks on its morale (18 § Morale), so a squad wins by felling enough of it, its captain first, before it fells the squad. Six Skilled soldiers (8) in iron break a peril-2 raid of ten before it loots in every fight and lose about two; six Proficient in steel lose about one. Six Novices in iron trade most of themselves for it and lose the loot in about half the fights; three Novices lose the squad and the loot in nearly every fight. A peril-4 raid of ten needs more than six Skilled soldiers: it loots in most fights. Marksdwarves of the squad's skill behind it change little in the open.
- Animals and hostiles flee at their species' `fleeBloodPercent` of blood, or at `FLEE_BLOOD_PERCENT` when the species has none, or when 18 orders a retreat, or, for a raider, when its party's morale falls below its nerve (18 § Morale). An `aggressive` species with no value of its own and the `deep` faction never flee.
- Fleeing creatures move away from all visible enemies; hostiles fleeing head for their arrival edge.
- A creature under a `flee` effect (25's Dread, or a fearsome blow) keeps its target and does not attack; it walks to the tile `FLEE_EFFECT_TILES` from the effect's source through itself, clamped to the map, or with no path there to the nearest tile of its party's arrival edge, and comes back when the effect ends. It stays on the map, so its party counts no loss for it. It is fleeing for the hit, parry and block rules. A dwarf, a soldier on duty included, runs the same way by 10's brain (10 § Behavior selection, Dread): it drops its target and its job, its squad does not move it or give it a target while it runs, and has it again when the effect ends.

### Threat detection

Each tick, for each hostile-to-fortress creature that is not stealthed (18), any fortress creature within `THREAT_RADIUS` is sent `ThreatNearby { id, hostileId }` (throttled to one per creature per `THREAT_THROTTLE_TICKS`). 10 reacts for civilians; war animals (08) react by attacking. Save the last scan tick per fortress creature so loading preserves the throttle and civilian fighting deadline; omit the list when empty. Older saves without it have no scan throttle.

### Squads

```
Squad { name, leaderId, members: EntityId[], mode: off | train | active, station: TileIndex | null, patrol: TileIndex[] | null,
        equipment: { weaponClass: preferred | any, armor: metal | leather | any, ranged: boolean }, orders: Order[] }
Order = kill { targetId } | station { tile } | patrol { tiles } | follow { dwarfId } | cancel
```

- `off`: members are civilians (do their labors), keep their gear, respond to `hearth` alert by going active.
- `train`: members go to the barracks zone assigned to the squad (`SetZoneSetting { barracks, squadId }`) and train (below); if the squad has a station they take turns: half train, half stand at the station, swapping every `TRAIN_SHIFT_HOURS * TICKS_PER_HOUR` ticks of the calendar.
- `active`: members go to the station (or patrol route) and attack hostiles on sight; without a station they gather at the barracks.
- A squad does not stand on one tile, where it would slow itself (22 § Crowding). A station or a `station` order is a point: each member, in id order, takes the next of the point's nearest tiles, the point first, then outward step by step on its level through tiles a walker can stand on, ties by tile index. Only the point itself may be a door's tile, and the search does not pass through a door. With more members than tiles the posts repeat in order. A squad gathering at its barracks takes the zone's tiles in the same order.
- On `watchful` alert every squad is treated as `active`; on `hearth` alert the same, plus civilians retreat (10).
- A member of a squad in `train` or `active` mode is on duty; one in `off` mode is on duty only under a `watchful` or `hearth` alert. Being on duty means: no flight, the military title, no interruption by the hearth alert, and attacking a visible hostile within perception. While a soldier's brain behavior is `need` (walking to a bed and sleeping included, in every mode), `flee`, `retreat` or `patient`, squad code does not move the soldier, give it a target (a kill order's target included, also when the order is issued then), assign a training partner, or cancel the soldier's activity plan; the squad resumes control, and a queued kill order applies, only when the soldier returns to `duty`. A critical need always takes precedence over duty in every mode. A want-level need waits only when the squad is treated as active and a hostile is in sight, or when the squad has an explicit station, patrol, follow or kill order during a `watchful` or `hearth` alert, whatever its mode (10 § Behavior selection, step 5). Training, a standing order while the alert is `calm`, and an alert without an order do not hold it: the soldier goes to eat, drink or sleep and returns to duty afterwards, and the standing order resumes.
- `kill` orders queue and execute in the order issued, ahead of the standing order; a target's death completes its kill order at once, wherever the order stands in the queue, and the death of the dwarf a `follow` order escorts ends that order. A soldier on duty whose kill target is out of perception (§ Targeting) walks toward the target's tile, and takes it as its target once it is in perception, so a kill order reaches a creature anywhere on the map. A new `station`, `patrol` or `follow` replaces the previous standing order of those three, preserving queued kills. The standing order resumes when the kill queue is empty. `kill` targets a creature (any faction; killing traders or peaceful wild animals has consequences in 20 and 08); `station` and `patrol` set the squad's position; `follow` follows a dwarf (an escort); `cancel` clears.
- `CreateSquad { leaderId }` adds a nonzero leader as its first member with the same Soldier duty state as any member; a leader already in another squad rejects with `already_in_squad`. `SetSquadLeader` accepts 0 to clear the leader or a living adult member of that squad; a nonmember rejects with `not_found`.
- `SetSquadEquipment` accepts partial preferences: `weaponClass` is `any` or an authored weapon class that is not only a channel's, `armor` is `metal`, `leather` or `any`, `ranged` is a boolean, and `draughts` is an ordered list of distinct draught item ids that soldiers drink (25 § Draughts; an empty list clears it). Invalid values or a non-record reject with `bad_setting` before any preference is stored.
- The Warden, if any, is the leader of the first squad by default; leaders are chosen by the player otherwise. A squad without a leader still works.

### Training

- Barracks zone with `squadId` setting; sparring: pairs of present members who are currently in `duty` behavior (not satisfying a need, fleeing, or hospitalized), `SPAR_TICKS` per session, grant `TRAIN_XP` to the weapon skill, `dodge`, `shield` (if held) and `armor_use` (if armored); solo drills grant half. Sparring uses the members' real weapons; each session has `SPAR_INJURY_PERMILLE` chance of a `light` bruise (never with training weapons, which are wooden items of the weapon class with `training: true` and 0 damage).
- Archery range: a zone with an `archery_target` building at one end; ranged members shoot `TRAIN_SHOTS` bolts or arrows per session at the target (ammunition drops and is recovered by hauling; training uses the cheapest ammunition available).
- A member holding a channel never spars and never shoots at the range: it takes the solo drill, its weapon skill `runecraft`, and spends no rune (25 § Channels).
- `WARDEN_TRAINING_BONUS_PERCENT` (10) applies when a Warden exists. Barracks room tier gives a thought per session.

An explicit barracks zone setting takes precedence over a cached training zone. On `ZoneChanged` when a barracks setting changes, refresh each squad’s saved `barracksZoneId` from current assignments, or the first barracks when none is assigned. A squad that has already trained moves its training to a newly assigned zone; its next sessions require members to be present there.

### Equipment

- On joining a squad, and every `REEQUIP_CHECK_DAYS`, each member claims from stockpiles the best available items matching the squad's preferences: weapon (highest `metalTier × qualityMultiplier` of the preferred class, then any melee class; a channel never, except that a member with `runecraft` 1 or more first claims the channel of highest power and then looks for no other weapon, 25 § Channels; holding a channel, it tops up to `CASTER_VIALS` rune vials, 25 § Vials), shield (if the weapon is one-handed and `armor != none`), one armor piece per slot (highest armor value matching the material preference; a member holding a channel first claims, for each slot, the best piece with a `rune` property, a runed robe or a circlet, past the material preference, 25 § Rune of one's own), and, for ranged members, a launcher, a quiver and `SOLDIER_AMMO` ammunition. Available gear is fortress stock under 13's availability rules: items flagged `merchant`, `at_depot`, `foreign` or `forbidden` cannot be claimed. A squad that lists draughts (`Squad.equipment.draughts`, set through `SetSquadEquipment`) has every member carry one of each, claimed like ammunition (25 § Draughts). Claimed items are `owned` (13). An enchanted weapon or armor piece scores `ENCHANT_CLAIM_BONUS` (25) more than the same piece without, so of two otherwise equal pieces the enchanted one is taken; enchanted ammunition is claimed as plain. A soldier's gear is owned, so a runesmith never sets a stone in it (25 § Setting stones): it is set in stock, and the next look takes it. Better items replace worse ones, which are dropped at the barracks. All squads are refreshed once on a dispatch tick that carries `ItemCreated`, however many items the tick created. A refresh looks only at items whose type a kit can name (weapons, armor pieces and shields, quivers, the ammunition of a launcher, rune vials and draughts), in ascending id order, so that its cost does not grow with the stone, food and cloth of the fortress.
- What a creature holds follows `health.canWield` (17). With one arm it holds no two-handed weapon and no shield; with none, no weapon. On `LimbLost` what it can no longer hold falls where it stands, and a soldier then claims what it can hold. A two-handed launcher counts as a two-handed weapon. A fracture does not change what a creature holds.
- Claiming and dropping equipment, including ammunition, use 13's item API. Take contained gear out before attaching it to the soldier and setting ownership; clear ownership before dropping replaced gear or recovered practice ammunition. Practice consumes units through the item API; the last unit is destroyed or dropped through it. Ammunition is carried separately from the quiver item, with no fabricated container link.
- When an item is destroyed, immediately clear every equipment slot naming it (weapon, shield, armor, clothing and quiver) to 0, preserving other gear. Destruction cleanup runs before a subsequent command or save can observe stale references; `ItemDestroyed` notification repeats that cleanup safely.
- Soldiers wear their armor at all times (no armor-off in version 1). Armor slows: movement × `(100 − Σ armor.weight / 4)%`, each piece's weight scaled by its metal's `armorWeightMult`, minimum `ARMOR_MIN_SPEED_PERCENT`, reduced by `armor_use` skill (each level restores 1%).
- Civilian tools (picks, axes) are weapons of their class; a miner attacked fights with the pick. A squad member does not claim a pick or axe as a weapon while any dwarf has mining or woodcutting labor enabled, respectively, and lacks a held tool of that kind. A tool held through `Worker.toolId` or `Equipment.weapon` satisfies that need; a different kind does not. Once every enabled worker holds that kind, or the labor is disabled, a spare can be claimed normally.

### Alerts

`SetAlert { level }`. `AlertChanged { from, to }` on change. `hearth` additionally locks `lock_on_alert` doors (14), sends war animals to their chains or stations (08), and makes 10 retreat civilians (a civilian whose hunger, thirst or rest is critical still leaves the shelter to serve it, and one that can tend a patient still leaves it for that job, and returns while the alert lasts; 10 § Behavior selection). There is no automatic alert change; `ThreatWarning` and `RaidArrived` are `danger` announcements that pause the game so the player can choose.

### Kills and loot

On `CreatureDied` with a killer: `killed_hostile` thought for a fortress killer; `KillRecorded { killerId, victimId, hostile, hunted, killerName, killerSpecies, victimName, victimSpecies }` for the legend (the victim is gone by then, so the death event's name, species and faction, and a wild victim's state, are copied; `hostile` is true when the killer's faction is hostile to the victim's, or the victim is a wild animal that was in the `attack` state; `hunted` is true when the victim was the quarry of a claimed hunt job, whose kill `HuntKill` announces; a trap, which is a building and not a creature, is named by its building type). Hostile equipment stays on the corpse (13 `strip_corpse`).

### Combat log

Every `AttackResolved` is rendered by the announcement registry into a combat log line from the strings table ("Orm Ashbrow hits the gloam warrior in the torso with his iron axe (18 damage)" or "The wolf bites Brynja Coldhammer in the left leg"). The combat log is a separate tab of the log panel and does not raise alerts except for the first attack of an engagement, which is an alert that centers the view: the first observed attack of an attacker and defender pair is the alert, and later attacks of that pair are notes. A log line is saved with its category, so the combat tab works after a load.

## State

- `Soldier` components (`squadId, onDuty, stance, targetId, cooldownUntil, lastShiftTick`), `Squad` entities, `Equipment` components (all creatures that can carry: dwarves, hostiles, traders), `Projectile` entities, `alert`, `engagements: Map<EntityId, lastAttackTick>` (for "first attack" announcements), `targets: Map<EntityId, EntityId>` for non-dwarf creatures (animals and hostiles set targets through `combat.setTarget`).
- `threatThrottles: Map<EntityId, Tick>` records each fortress creature's last threat notification.
- Rng stream.

## Interfaces

### Reader

- `combat.isHostile(a, b)`, `combat.factionOf(id)`, `combat.targetOf(id)`
- `combat.lastEngagementTick(id)` — the last recorded melee or ranged attack opportunity, or undefined; reads the saved engagement map
- `combat.squads()`, `combat.squad(id)`, `combat.squadOf(dwarfId)`, `combat.onDuty(dwarfId)`
- `combat.alert()`
- `combat.weaponOf(id)`, `combat.armorOf(id)`, `combat.armorValue(id, part, damageType)` (for the inspector)
- `combat.lineOfSight(from, to)` (delegates to 22)
- `combat.armorSpeedModifier(id)` — the percent of movement speed left by the weight of worn armor, after `armor_use`

### Combat API (mutation)

`combat.setTarget(id, targetId | 0)` (08, 18), `combat.fireAt(shooterId, targetId)` (09 hunting): true when it shot; false when it cannot, or holds the shot (§ Ranged resolution, Held shot: a careless shooter shoots).

### Commands

`CreateSquad { name }`, `DisbandSquad`, `SetSquadMembers { squadId, members }`, `SetSquadLeader`, `SetSquadMode { squadId, mode }`, `SetSquadEquipment`, `SetSquadStation { squadId, tile | null }`, `SetSquadPatrol`, `SquadOrder { squadId, order }`, `SetAlert { level }`, `RenameSquad { squadId, name }`.

### Events consumed

`CreatureDied`, `CreatureUnconscious`, `LimbLost` (what the arms left cannot hold), `DayPassed` (re-equip), `HourPassed` (shifts), `ZoneChanged` (barracks), `ItemCreated` (better gear; every squad once per tick), `ItemDestroyed` (clear equipment slots), `AlertChanged` (own), `HostileSpawned`, `RaidArrived`.

### Events emitted

`AttackResolved { attackerId, defenderId, part, damageType, amount, outcome }`, `DamageDealt { defenderId, part, damageType, amount, attackerId, weaponId }`, `ProjectileFired { shooterId, targetId, itemId }`, `CreatureFled { id, from }`, `ThreatNearby { id, hostileId }`, `SquadOrderIssued { squadId, order }`, `AlertChanged { from, to }`, `KillRecorded { killerId, victimId, hostile, hunted, killerName, killerSpecies, victimName, victimSpecies }`, `TrainingSession { squadId, members }`.

### Registrations

Panel `military`; inspector section `creature › combat` (weapon, armor per part with values, skills, squad, target); overlay `squad stations`; announcements: first attack of an attacker and defender pair (alert), `AlertChanged` (note), `KillRecorded` for every kill that is not a hunt's (note).

## Player-facing behavior

- Military panel: squads list; per squad: members (add several at once from a multi-select list, or from the marked dwarves of the units panel), leader, name, barracks zone, mode, equipment preferences, station and patrol placement on the map, orders (kill: click a creature; station: click a tile; patrol: click several tiles), alert selector at the top.
- Combat log tab.
- Glyphs: soldiers on duty are `☺` in green; projectiles `-`, `|`, `/`, `\` by direction.
- Hints: "Make a squad and give it a station at the gate", "Training weapons let recruits spar safely", "Fortifications let crossbows shoot without being reached".

## Tuning constants

| Name | Value | Meaning |
|---|---|---|
| `PERCEPTION_RADIUS` | 14 | *unmeasured* |
| `TARGET_LOSE_TICKS` | 200 | *unmeasured* |
| `RANGED_KEEP_DISTANCE` | 3 | *unmeasured* |
| `RANGED_KITE_TRIGGER_DISTANCE` | 2 | Melee threat distance that triggers a possible adjacent retreat (*unmeasured*) |
| `MIN_ATTACK_COOLDOWN` | 12 | Ticks (*unmeasured*) |
| `BLUNT_THROUGH_PERCENT` | 30 | *unmeasured* |
| `FRACTURE_PERCENT` | 30 | Of part max hp in one blunt hit; measured, a steel warhammer fractures a trollkin limb at the first hit in 52 of 85 fractures and the trollkin's slam fractures a dwarf's limbs ([combat pace](../../reports/audits/2026-10-21-combat-pace.md)) |
| `PROJECTILE_SPEED` | 3 | Tiles per tick (*unmeasured*) |
| `AMMO_BREAK_PERMILLE` | 200 | *unmeasured* |
| `FLEE_BLOOD_PERCENT` | 50 | Default; species override (*unmeasured*) |
| `FLEE_EFFECT_TILES` | 12 | A creature under a `flee` effect runs this far from its source (*unmeasured*) |
| `THREAT_RADIUS` | 8 | Shared with 10; defined in 10 (*unmeasured*) |
| `THREAT_THROTTLE_TICKS` | 50 | *unmeasured* |
| `TRAIN_SHIFT_HOURS` | 6 | *unmeasured* |
| `SPAR_TICKS` | 300 | *unmeasured* |
| `TRAIN_XP` | 12 | Per session per skill (*unmeasured*) |
| `SPAR_INJURY_PERMILLE` | 20 | *unmeasured* |
| `TRAIN_SHOTS` | 5 | *unmeasured* |
| `REEQUIP_CHECK_DAYS` | 3 | *unmeasured* |
| `SOLDIER_AMMO` | 25 | *unmeasured* |
| `ARMOR_MIN_SPEED_PERCENT` | 60 | *unmeasured* |
| `CREATURE_ATTRIBUTE_DEFAULT` | 50 | Baseline attribute value when Attributes component is absent; measured in the goblins and trollkin of the arenas ([combat pace](../../reports/audits/2026-10-21-combat-pace.md)) |
| `CREATURE_BASE_SKILL` | 2 | Baseline combat skill level when Skills component is absent; measured, two goblins at it down a mailed Novice dwarf in 48 of 60 duels ([combat pace](../../reports/audits/2026-10-21-combat-pace.md)) |
| `CARELESS_SHOT_PERCENT` | 50 | Chance at skill 0 that a shooter fires through an ally on its line (§ Ranged resolution, Held shot) (*unmeasured*) |
| `CARELESS_SAFE_SKILL` | 10 | Shooting skill (Proficient) from which a shooter is never careless; the chance falls evenly to it (*unmeasured*) |
| `HOSTILE_SKILL_PER_TIER` | 2 | Combat skill per gear tier for spawned hostile party members; measured, a peril-2 raid of ten (skill 6) downs a squad of three Novices in the open in 21 of 24 trials, and at 1 a tier in 22 of 24 ([combat pace](../../reports/audits/2026-10-21-combat-pace.md)) |

Weapon and armor values, hit weights per body plan, and the damage-type-versus-layer table are content.

## Extension points

- Formations and squad-level tactics: a `formation` field and a position offset per member.
- Mounted combat, wrestling, grappling: new attack kinds in the resolution switch.
- Morale for hostiles as a party stat is in 18; individual morale for dwarves (routing) is deliberately absent by pillar 2.
- Siege weapons: a `siege` building with a fire job and the projectile path.
