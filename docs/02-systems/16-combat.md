# 16 Combat

**Owner:** `systems/combat` · **Depends on:** [10-dwarves.md](10-dwarves.md), [17-health-and-medicine.md](17-health-and-medicine.md), [13-items-and-storage.md](13-items-and-storage.md), [14-buildings-and-rooms.md](14-buildings-and-rooms.md), [18-threats-monsters-and-raids.md](18-threats-monsters-and-raids.md), [22-pathfinding-and-spatial.md](22-pathfinding-and-spatial.md)

## Purpose

Resolve violence between creatures with rules the player can read: six body parts, three damage types, one hit roll, armor that covers parts, and weapons whose numbers are on the item. Own squads, training, equipment, alerts and orders.

## Concepts

- **Faction**: `fortress`, `wild`, `hostile:<civ>`, `trader:<civ>`, `deep`. Hostility is between factions: `fortress` vs `hostile:*` and `deep` always; `wild` vs anyone only while the animal is in `attack` (08); `trader` vs `hostile` always; the player can order attacks on `wild` and `trader` creatures (with consequences in 20).
- **Body part**: from the creature's body plan: for the standard plan `head`, `torso`, `left_arm`, `right_arm`, `left_leg`, `right_leg` with hit weights; other plans (quadrupeds, crawlers, wyrms) map their parts onto the same six slots with different weights and functions (a quadruped's arms are forelegs; a wyrm has no arms, so its plan gives the torso the arm weight).
- **Damage type**: `edge`, `blunt`, `pierce`.
- **Weapon**: an item with `WeaponDef`: class (`dagger`, `sword`, `axe`, `mace`, `hammer`, `spear`, `pick`, `crossbow`, `bow`, `sling`), skill, damage type, base damage, size, hands, range and ammunition type for launchers.
- **Armor**: an item with `ArmorDef`: slot (`head`, `body`, `arms`, `legs`, `feet`, `shield`), covered parts with coverage percent, layer (`padding`, `leather`, `mail`, `plate`), base armor value.
- **Squad**: up to `SQUAD_MAX_SIZE` dwarves with a mode, equipment preferences and orders.
- **Alert**: `calm`, `watchful`, `hearth`.

## Rules

### Targeting

A creature attacks when it has a `targetId` (set by 08 for animals, 18 for hostiles, this system for soldiers under orders or on duty, and 10 for civilians only when cornered: a civilian who cannot flee fights back with whatever they carry). Each tick a creature with a target: if adjacent (8-neighborhood, same level), perform a melee attack if its attack cooldown has elapsed; else if it has a ranged weapon with ammunition, range ≥ distance and line of sight, perform a ranged attack; else path toward the target (movement helper). Targets that die, leave perception (`PERCEPTION_RADIUS`), or become unreachable for `TARGET_LOSE_TICKS` are dropped. A target is not dropped for being out of sight: this system alone ends an acquired target, and 18's party AI leaves a held target alone. The `TARGET_LOSE_TICKS` count starts at the first failed approach and is not reset by a pending path retry, only by an actual step or an attack opportunity; the start tick is saved (`CombatState.unreachableSince`).

Soldiers on duty with no order pick the nearest hostile within perception. Ranged soldiers keep `RANGED_KEEP_DISTANCE` tiles away from melee threats when possible (kiting is limited: they move only when a threat is within 2 tiles).

### Attack cooldown

`cooldownTicks = weapon.size × 3 + 10 − Agility / 10`, minimum `MIN_ATTACK_COOLDOWN`. Natural attacks use the species' attack size.

### Melee resolution

```
attackSkill  = skill(attacker, weapon.skill)            // or the species' natural attack skill for animals
dodgeSkill   = skill(defender, 'dodge')
hit = 50 + (attackSkill − dodgeSkill) × 3 + (Agility(att) − Agility(def)) / 4
    + (defender unconscious or asleep ? 40 : 0) + (defender fleeing ? 10 : 0) + (defender in deep water ? 20 : 0)
hit = clamp(5, 95, hit)
if rng.int(0, 99) ≥ hit: miss → AttackResolved { outcome: miss }; return

// parry and block (defenders that can act: conscious, not fleeing)
if defender wields a weapon with a melee skill: parryChance = min(30, skill(defender, weaponSkill) × 2); if rng < parryChance: outcome parried; return
if defender has a shield: blockChance = min(40, 10 + skill(defender, 'shield') × 2); if rng < blockChance: outcome blocked; return

part = weighted pick from defender.bodyPlan hit weights (attacks from unconscious targets: head weight doubled)
raw  = weapon.baseDamage × metalTierMultiplier(weapon.material) × qualityMultiplier(weapon) × (50 + Strength(att)) / 100
       // natural attacks: species attack damage × (50 + Strength)/100; war-trained animals +50%
armorReduction = Σ over armor pieces covering `part` (outer layer first): piece.armorValue × metalTierArmor(piece.material) × coverage / 100 × qualityArmorMultiplier
                 × damageTypeVsLayer(damageType, piece.layer)
damage = max(0, raw − armorReduction)
if damageType == blunt and armorReduction > 0: damage = max(damage, raw × BLUNT_THROUGH_PERCENT / 100)    // blunt bruises through armor
emit DamageDealt { defender, part, damageType, amount: damage, attackerId, weaponId }
emit AttackResolved { attacker, defender, part, damageType, amount, outcome: hit }
grant xp: attacker weapon skill; defender dodge (on miss), weapon skill (on parry), shield (on block), armor_use (on hit reduced by armor)
```

`damageTypeVsLayer` (content, Wave 3): edge is reduced well by mail and plate, poorly by leather; pierce is reduced moderately by mail, well by plate, poorly by padding; blunt is reduced well by padding and leather, poorly by mail, moderately by plate. `metalTierMultiplier` for weapons and `metalTierArmor` for armor are in the metals table (copper 1, bronze 2, iron 3, steel 4, deepsilver 5 with multipliers 0.8, 0.9, 1.0, 1.25, 1.6; silver is a blunt weapon material with a bonus; wood and bone weapons are tier 0 at 0.4 and 0.5).

Wound type from damage type (17): edge → `cut`; pierce → `puncture`; blunt → `bruise`, or `fracture` when `damage ≥ partMaxHp × FRACTURE_PERCENT / 100`.

Two-handed weapons (`hands: 2`) cannot be used with a shield; the squad equipment logic respects this.

Creatures without `Attributes` use `CREATURE_ATTRIBUTE_DEFAULT` (50) for every attribute, so natural attacks deal their listed damage. Creatures without `Skills` use `CREATURE_BASE_SKILL` (2) for every combat skill (natural attacks, weapon skills, `dodge`, `shield`). Hostile party members spawned by 18 receive `Skills` with every combat skill at `2 + HOSTILE_SKILL_PER_TIER × gearTier` (`HOSTILE_SKILL_PER_TIER` = 2), plus 2 for captains.

### Ranged resolution

```
if not lineOfSight(shooter, target): cannot fire (the brain moves instead)
distance = Chebyshev(shooter, target) + z difference × 2
hit = 40 + skill(shooter, launcherSkill) × 3 − distance × 2 + (size(target) − 60) / 4 − skill(target, 'dodge') × 2 + (target unconscious ? 40 : 0)
hit = clamp(3, 95, hit)
spawn Projectile { itemId: one unit of ammunition (13 split), from, to, speed: PROJECTILE_SPEED, shooterId, hitRoll }
```

The projectile advances along a Bresenham line each tick by `PROJECTILE_SPEED` tiles. On entering the target's tile: if `hitRoll` succeeds, resolve as a melee hit with `raw = ammo.baseDamage × launcher.powerMultiplier × metalTier(ammo)`, no parry, block allowed, then the ammunition item drops on the tile with `AMMO_BREAK_PERMILLE` chance to be destroyed. On a miss the projectile continues to `launcher.range` and drops. A projectile entering a tile with a wall, closed door, raised bridge or (from the far side) a fortification stops and drops. A creature other than the target in the path is hit with half the hit chance.

Line of sight (22): a Bresenham line on the same z-level with no wall, door, tree, raised bridge or closed floodgate in between; fortifications pass projectiles only if the shooter is adjacent to the fortification (a defender at the wall) or the target is adjacent to it (shooting in). Ranged creatures cannot shoot across z-levels except from a fortification one level up (an overlook) to a target on the level below within range.

### Fleeing and morale in combat

- Civilians flee from any hostile within `THREAT_RADIUS` (10), including escape through stairs and ramps. A cornered civilian (no flee tile) fights until a critical need or the civilian combat timeout in 10 interrupts it.
- Squad members on duty do not flee.
- Animals and hostiles flee at `FLEE_BLOOD_PERCENT` of blood (species value; `aggressive` species and `deep` faction never flee) or when 18 orders a retreat.
- Fleeing creatures move away from all visible enemies; hostiles fleeing head for their arrival edge.

### Threat detection

Each tick, for each hostile-to-fortress creature that is not stealthed (18), any fortress creature within `THREAT_RADIUS` is sent `ThreatNearby { id, hostileId }` (throttled to one per creature per `THREAT_THROTTLE_TICKS`). 10 reacts for civilians; war animals (08) react by attacking. Save the last scan tick per fortress creature so loading preserves the throttle and civilian fighting deadline; omit the list when empty. Older saves without it have no scan throttle.

### Squads

```
Squad { name, leaderId, members: EntityId[], mode: off | train | active, station: TileIndex | null, patrol: TileIndex[] | null,
        equipment: { weaponClass: preferred | any, armor: metal | leather | any, ranged: boolean }, orders: Order[] }
Order = kill { targetId } | station { tile } | patrol { tiles } | follow { dwarfId } | cancel
```

- `off`: members are civilians (do their labors), keep their gear, respond to `hearth` alert by going active.
- `train`: members go to the barracks zone assigned to the squad (`SetZoneSetting { barracks, squadId }`) and train (below); if the squad has a station they take turns: half train, half stand at the station, swapping every `TRAIN_SHIFT_HOURS`.
- `active`: members go to the station (or patrol route) and attack hostiles on sight; without a station they gather at the barracks.
- On `watchful` alert every squad is treated as `active`; on `hearth` alert the same, plus civilians retreat (10).
- Orders are executed in order; `kill` targets a creature (any faction; killing traders or peaceful wild animals has consequences in 20 and 08); `station` and `patrol` set the squad's position; `follow` follows a dwarf (an escort); `cancel` clears.
- The Warden, if any, is the leader of the first squad by default; leaders are chosen by the player otherwise. A squad without a leader still works.

### Training

- Barracks zone with `squadId` setting; sparring: pairs of present members, `SPAR_TICKS` per session, grant `TRAIN_XP` to the weapon skill, `dodge`, `shield` (if held) and `armor_use` (if armored); solo drills grant half. Sparring uses the members' real weapons; each session has `SPAR_INJURY_PERMILLE` chance of a `light` bruise (never with training weapons, which are wooden items of the weapon class with `training: true` and 0 damage).
- Archery range: a zone with an `archery_target` building at one end; ranged members shoot `TRAIN_SHOTS` bolts or arrows per session at the target (ammunition drops and is recovered by hauling; training uses the cheapest ammunition available).
- `WARDEN_TRAINING_BONUS_PERCENT` (10) applies when a Warden exists. Barracks room tier gives a thought per session.

An explicit barracks zone setting takes precedence over a cached training zone. On `ZoneChanged` when a barracks setting changes, refresh each squad’s saved `barracksZoneId` from current assignments, or the first barracks when none is assigned. A squad that has already trained moves its training to a newly assigned zone; its next sessions require members to be present there.

### Equipment

- On joining a squad, and every `REEQUIP_CHECK_DAYS`, each member claims from stockpiles the best available items matching the squad's preferences: weapon (highest `metalTier × qualityMultiplier` of the preferred class, then any melee class), shield (if the weapon is one-handed and `armor != none`), one armor piece per slot (highest armor value matching the material preference), and, for ranged members, a launcher, a quiver and `SOLDIER_AMMO` ammunition. Claimed items are `owned` (13). Better items replace worse ones, which are dropped at the barracks. All squads are refreshed once on a dispatch tick that carries `ItemCreated`, however many items the tick created.
- Soldiers wear their armor at all times (no armor-off in version 1). Armor slows: movement × `(100 − Σ armor.weight / 4)%` minimum `ARMOR_MIN_SPEED_PERCENT`, reduced by `armor_use` skill (each level restores 1%).
- Civilian tools (picks, axes) are weapons of their class; a miner attacked fights with the pick.

### Alerts

`SetAlert { level }`. `AlertChanged { from, to }` on change. `hearth` additionally locks `lock_on_alert` doors (14), sends war animals to their chains or stations (08), and makes 10 retreat civilians. There is no automatic alert change; `ThreatWarning` and `RaidArrived` are `danger` announcements that pause the game so the player can choose.

### Kills and loot

On `CreatureDied` with a killer: `killed_hostile` thought for a fortress killer; `KillRecorded { killerId, victimId }` for the legend. Hostile equipment stays on the corpse (13 `strip_corpse`).

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

`combat.setTarget(id, targetId | 0)` (08, 18), `combat.fireAt(shooterId, targetId)` (09 hunting).

### Commands

`CreateSquad { name }`, `DisbandSquad`, `SetSquadMembers { squadId, members }`, `SetSquadLeader`, `SetSquadMode { squadId, mode }`, `SetSquadEquipment`, `SetSquadStation { squadId, tile | null }`, `SetSquadPatrol`, `SquadOrder { squadId, order }`, `SetAlert { level }`, `RenameSquad { squadId, name }`.

### Events consumed

`CreatureDied`, `CreatureUnconscious`, `DayPassed` (re-equip), `HourPassed` (shifts), `ZoneChanged` (barracks), `ItemCreated` (better gear; every squad once per tick), `AlertChanged` (own), `HostileSpawned`, `RaidArrived`.

### Events emitted

`AttackResolved { attackerId, defenderId, part, damageType, amount, outcome }`, `DamageDealt { defenderId, part, damageType, amount, attackerId, weaponId }`, `ProjectileFired { shooterId, targetId, itemId }`, `CreatureFled { id, from }`, `ThreatNearby { id, hostileId }`, `SquadOrderIssued { squadId, order }`, `AlertChanged { from, to }`, `KillRecorded { killerId, victimId }`, `TrainingSession { squadId, members }`.

### Registrations

Panel `military`; inspector section `creature › combat` (weapon, armor per part with values, skills, squad, target); overlay `squad stations`; announcements: first attack of an attacker and defender pair (alert), `AlertChanged` (note), `KillRecorded` for hostiles (note).

## Player-facing behavior

- Military panel: squads list; per squad: members (add several at once from a multi-select list, or from the marked dwarves of the units panel), leader, name, barracks zone, mode, equipment preferences, station and patrol placement on the map, orders (kill: click a creature; station: click a tile; patrol: click several tiles), alert selector at the top.
- Combat log tab.
- Glyphs: soldiers on duty are `☺` in green; projectiles `-`, `|`, `/`, `\` by direction.
- Hints: "Make a squad and give it a station at the gate", "Training weapons let recruits spar safely", "Fortifications let crossbows shoot without being reached".

## Tuning constants

| Name | Value | Meaning |
|---|---|---|
| `PERCEPTION_RADIUS` | 14 | |
| `TARGET_LOSE_TICKS` | 200 | |
| `RANGED_KEEP_DISTANCE` | 3 | |
| `MIN_ATTACK_COOLDOWN` | 12 | Ticks |
| `BLUNT_THROUGH_PERCENT` | 30 | |
| `FRACTURE_PERCENT` | 30 | Of part max hp in one blunt hit |
| `PROJECTILE_SPEED` | 3 | Tiles per tick |
| `AMMO_BREAK_PERMILLE` | 200 | |
| `FLEE_BLOOD_PERCENT` | 50 | Default; species override |
| `THREAT_RADIUS` | 8 | Shared with 10; defined in 10 |
| `THREAT_THROTTLE_TICKS` | 50 | |
| `TRAIN_SHIFT_HOURS` | 6 | |
| `SPAR_TICKS` | 300 | |
| `TRAIN_XP` | 12 | Per session per skill |
| `SPAR_INJURY_PERMILLE` | 20 | |
| `TRAIN_SHOTS` | 5 | |
| `REEQUIP_CHECK_DAYS` | 3 | |
| `SOLDIER_AMMO` | 25 | |
| `ARMOR_MIN_SPEED_PERCENT` | 60 | |
| `CREATURE_ATTRIBUTE_DEFAULT` | 50 | Baseline attribute value when Attributes component is absent |
| `CREATURE_BASE_SKILL` | 2 | Baseline combat skill level when Skills component is absent |
| `HOSTILE_SKILL_PER_TIER` | 2 | Combat skill per gear tier for spawned hostile party members |

Weapon and armor values, hit weights per body plan, and the damage-type-versus-layer table are content.

## Extension points

- Formations and squad-level tactics: a `formation` field and a position offset per member.
- Mounted combat, wrestling, grappling: new attack kinds in the resolution switch.
- Morale for hostiles as a party stat is in 18; individual morale for dwarves (routing) is deliberately absent by pillar 2.
- Siege weapons: a `siege` building with a fire job and the projectile path.
