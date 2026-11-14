# 25 Runecraft

**Owner:** `systems/magic` · **Depends on:** [07-plants-and-farming.md](07-plants-and-farming.md), [10-dwarves.md](10-dwarves.md), [11-jobs-and-labor.md](11-jobs-and-labor.md), [12-workshops-and-professions.md](12-workshops-and-professions.md), [13-items-and-storage.md](13-items-and-storage.md), [14-buildings-and-rooms.md](14-buildings-and-rooms.md), [15-happiness-and-morale.md](15-happiness-and-morale.md), [16-combat.md](16-combat.md), [17-health-and-medicine.md](17-health-and-medicine.md), [18-threats-monsters-and-raids.md](18-threats-monsters-and-raids.md), [20-trade-and-caravans.md](20-trade-and-caravans.md)

## Purpose

Treat magic the way the game treats metal. Rune is a substance. It grows in a fungus, is distilled at a workshop, is carried in vials and is spent. A staff is a stone on a stick. A runecaster is a dwarf who sat in a stone room with a sack of mushrooms and came out able to hold a little rune.

Three limits hold everywhere:

- **The player never casts.** They choose the stone on the staff, who sits in the sanctum and what a squad carries. The dwarf casts by rules the player can read.
- **Nothing is necromancy.** No raising, no undead, no curses, no vampires, no werebeasts, no mind control. A summon is a light, a stone or a shadow, and it fades.
- **Magic trails steel.** A deepsilver axe out-damages the best staff. Runecraft's worth is reach and utility.

A fortress that never touches runecraft plays as before (§ What no runecraft means).

## Concepts

| Term | Meaning |
|---|---|
| **Rune** | The game's mana. Only a dwarf's own rune is ever spent on a spell. Stored in milli-rune (integers). |
| **Glowcap** | A cave crop that grows only in the dark under a glowstone lamp. |
| **Rune vial** | A stackable item. Spent at the runeforge and the laboratory, or drunk by a runecaster. |
| **Stone** | What is set in an item. It fixes the spell or the enchantment. Usually a cut gem. |
| **Channel** | A wand or a staff: a launcher with no ammunition. |
| **Runecaster** | A dwarf with `runecraft` at 1 or more. Holds a `Rune` component. |
| **Sanctum** | A room type. Apprentices attune at its rune circle. |
| **Runesmith** | Works the runeforge. Skill `runesmithing`, labor `smithing`. |
| **Alchemist** | Works the laboratory. Skill and labor `alchemy`. |
| **Draught** | A potion with a timed effect. One, then a rest. |
| **Effect** | A timed entry on a creature's `Spellbound` component: ward, slow, haste, stun, flee, and the draughts' effects. |

## What no runecraft means

These hold for every runecraft rule.

- **No new rng draw on any existing stream** unless a channel, an enchanted item, a draught or a hexer is in play. All casting rolls that are not 16's ordinary hit, block and part rolls draw on system 25's stream, `world.rngFor('25')`. Streams are named by system id. 25 takes its stream at init, so the save's `rng` section always holds the key `25`; an older save without it starts the stream from the seed. With no sanctum session, nothing but 20's caravan extras draws on it; a Call draws only for a species that `turns`, and a weapon hit only for an `ignite` effect (`blaze`).
- **No existing number moves.** The wyrm's breath keeps the damage type `burn`, which has no row in the layer table and so multiplies by 1.0. Spells and enchantments use the new types `ember` and `frost` (§ Damage types).
- **New rows do not renumber old rows** (§ Row numbering). A world hash may move because `Skills.level` grew by a byte, never because anything played differently: the annual instrument's row stays as it was, apart from the deliberate moves below.
- **Caravans.** Runecraft goods are drawn outside the weighted pool (§ Trade and value), so the ordinary goods of a caravan do not change.
- **Wild patches.** A separate pass with its own stream converts some cave shrubs (§ Glowcap). The main terrain stream draws the same numbers. Only a tile that was already a cave shrub changes.
- **Deliberate moves.** Three changes do move numbers with no runecraft in play:
  - **Hexers** move raid outcomes at peril 3 from year 3 and at peril 4 from year 2 (§ Hexers, measured there). Peril 2 and below see none, and nothing new is drawn for them: a hexer's kit is fixed.
  - **Converted shrubs** take 10–25% of cave shrubs from their forage. The annual instrument gathers no cave shrub and plays one year, before the first Mountainhome caravan, so it shows neither this nor the extra goods: its row stayed 12.5/7/11/149/7/0/0.
  - **Remains** put wyrmscale, ichor, venom and a gland on a dead wyrm's, stalker's, Maw's, giant cave spider's or ember newt's corpse, so a `strip_corpse` job appears and the recovered items add wealth and renown (§ Rare materials). None of these dies in the annual instrument's year, so its row stayed 13/7/10/149/7/0/0, every figure of every seed the same; `pp_defence` draws the same numbers and emits the same events. No golden moved.

## Rules

### Row numbering

The loader numbers rows sorted by id (`content-pipeline.md` § Loading step 4, `makeTable` in `core/registry.ts`). Numeric indices are saved in places that the id conversion does not reach: the `map.material` grid, `Skills.level` and `xp` (positional), `Labors.enabled` (bit position), `JobsState.laborPriorities`, job input filters, zone crop settings and other system states. A new material or skill that sorts into the middle of its table shifts all of them. An old save then loads under the soft match with its rock, skills and labors silently wrong.

The rule: **rows added after version 1 number after every older row.** Without it, the first new row would corrupt every older save.

- Table `rowOrder` in `03-content/row-order.md`: columns `table`, `id`. Rows named there number after all unnamed rows of their table, in the order listed. Unnamed rows keep sorted order, numbered from 1. The rows of a new table are listed too, so a later row of it cannot shift them.
- `src/content/loader.ts` step 4 passes each table's list to `makeTable(name, rows, appended)`. `ids()`, `where()` and `rows` follow the same order, so a pick from an old list stays as it was, as long as the new row stays out of that list. `metal()` in `terrain/generate/traits.ts` picks from every weapon and armor row whose materials include `metal`; it skips rows with a launcher and no `ammo`, and rows with a `rune` property, so `old_battlefield` maps keep their arms.
- Schema: `list({ table: nonEmptyStr, id: nonEmptyStr })`; a listed id must exist in its table after `applyGenerated`, so a generated plant material (`glowcap`) is listed in `materials` too. New `exportRowOrder` in `scripts/lib/export/`.
- `test/fixtures/content-row-baseline.json` holds every table's ids as they stood when this rule began, and is never edited. A test asserts that each keeps its index for good. A new row not in `rowOrder` fails it, and fails `content:check` (`scripts/lib/row-baseline.mjs`), with the line to add. `rowOrder` is not in the content hash, because the index order already is.
- On load, positional arrays shorter than the table are grown with zeros: `Skills.level` and `xp` in `restoreEntities` (`app/game-save.ts`), `Labors.enabled` likewise. `combat/melee.ts` `getSkill` otherwise reads `undefined` and returns `CREATURE_BASE_SKILL`. `laborPriorities` needs no growing: `JobBoard` starts every labor at the default priority and its `deserialize` overwrites only the saved length.
- New labors stay off for the dwarves of an older save, except as § The sanctum says. New dwarves get them on (`CoreSpawn.labors`).

**Save format.** `formatVersion` stays 1 and every `stateVersion` stays 1. New component fields and new state fields are optional; absent means none, as `threatThrottles` and `Hostile.retreat` do. System 25 with no saved entry keeps its initial state (`World.deserializeSystems` already skips it). Components are saved by table, so they need no code. Nothing needs a migration: an older save loads with every new field absent, and its old-save tests (`Item`, `Rune`) pin that.

### Damage types

`DamageType` in `core/types.ts`, `DAMAGE_TYPES` in `content/schema.ts` and the separate `DAMAGE_TYPES` in `scripts/lib/export/creatures.mjs` hold `ember` and `frost` beside the three steel types. The last matters: `parseAttacks` silently drops an attack it cannot parse, and `content:check` still passes. `ember` is rune fire; its wound is a `burn` (`health/wounds.ts` `woundTypeFor`). `frost` is a wound type of its own. Natural melee attacks in `resolveMelee` accept `ember` and `frost` alongside the three steel types (other strings still fall to `blunt`, as the wyrm's adjacent breath does).

The layer table, with its `ember` and `frost` rows and its `ward` column, is in [weapons-and-armor.md](../03-content/weapons-and-armor.md) § Damage type versus layer; the `DAMAGE_VS_LAYER` constant in `combat/melee.ts` holds the same numbers, and a test compares the two. Mail is a poor answer to rune, plate a fair one, a ward the best. A burn bleeds little (`BLEED_TABLE`), so an ember bolt wins by pain and by part damage, not by blood.

**`armorReduction(entities, registry, defenderId, part, type, tick, armorPercent?)`** in `combat/melee.ts` is the one place the armour sum is written (16 § Melee resolution): `resolveMelee`, `resolveProjectileHit`, `applyEnchantOnHit` and `combat/reader.ts` `armorValue` all call it. Natural armour belongs to a species, so a defender with no `Creature` has none. A `ward` effect is added there, on every part (§ Effects). `armorPercent`, a sundering weapon's share (§ Enchantments in combat), multiplies the whole sum, the ward and natural armour included; absent, all of it counts.

### Glowcap

Glowcap's rows are in `plants.md` (the crop, and `glowcap_patch` under § Rare cave patches), `items.md` § Medical and herbs (`glowcap`, `rune_vial`), `materials.md` § Rune and `glyphs-and-colors.md` (`rune_cyan`). The light rule and the `glow` plot are in 07 § Growth and § Farm plots, and the lamp is in 14 § Special buildings.

**Glowcap is its own item**, not `plant_food`. The `edible` and `cookable` columns of a plant are not read: `plant_food` is edible by its item row and is an `ingredient` by its tag, of any material. A glowcap in `plant_food` would be eaten and cooked. A separate item follows `fiber` and `brightleaf`.

### Workshops

A workshop needs a row in `workshops-and-recipes.md` § Workshops (the export makes its `buildings` row, category `workshop`; the `tags` column holds `rune_work`), a block in `glyphs-and-colors.md` § Workshop patterns, and for authored recipes a `RECIPE_SECTIONS` line in `scripts/lib/export/rules.mjs`. Labor comes from the recipe's skill.

The runeforge's row is in `workshops-and-recipes.md` (1 `anvil` + 3 `stone_block` + 1 `cut_gem`, masonry, 300 ticks, no fuel, tag `rune_work`, corners impassable like a forge), with its § Runeforge, and its skill `runesmithing` (labor `smithing`, profession Runesmith) in `skills-and-professions.md`. Its authored recipes, the runed robe and the circlet, are in its table there, with the `RECIPE_SECTIONS` line `['Runeforge', 'runeforge', 'runesmithing', false, true]` in `scripts/lib/export/rules.mjs`; the wands, staffs and settings are generated (§ Channels, § Setting stones).

`runecraft` and its labor `attunement` (default on, not for children) are in `skills-and-professions.md`. These skills and `runesmithing`, like `alchemy`, have `no` in the `embark` column there, so the embark screen hides them and `SetSkill` refuses them. Immigrants cannot arrive with them: `immigration/waves.ts` draws from its professions table, which names none of them. Profession colors: runecraft and runesmithing with Metal (`prof_steel`).

The laboratory's recipes are in `workshops-and-recipes.md` § Laboratory, the draughts in its § Draughts. Besides distilling glowcap, it grinds glowstone, quenches a deepsilver bar into 12 vials (which wakes the Hollow, § Deepsilver) and renders a hollow ichor into 6.

One apprentice eats 2 glowcap a day, which is 2.4 lamps while attuning (one lamp grows 0.83 a day).

### Rune of one's own

`Rune` component (§ State). A dwarf gets it when `runecraft` first reaches 1 (`SkillLevelUp`), with `current` 0. `max` and `regen` are never stored.

```
level    = skill(id, 'runecraft')
max      = level × RUNE_PER_LEVEL + circlet bonus                    // level 10: 50; level 20: 100; with a circlet, +10
regen    = level × RUNE_REGEN_PER_LEVEL × robe percent × metal percent   // per hour; level 10: 1 an hour; in a robe, 1.5
metal percent = max(METAL_RUNE_FLOOR_PERCENT, 100 − METAL_RUNE_PENALTY_PERCENT × n)
                // n = worn pieces of layer mail or plate whose material is class metal, except a piece with a rune property
```

The robe percent and the circlet bonus come from the worn armor's `rune` property ([weapons-and-armor.md](../03-content/weapons-and-armor.md) § Armor): the runed robe's `regen ×1.5` makes the robe percent 150, the circlet's `max +10` adds 10 rune; with neither they are 100 and 0, and several multiply and add. The pieces counted are the `Equipment.armor` slots; clothing is padding and never counts, and a piece with a `rune` property never counts toward the metal penalty, so a silver circlet costs no regen. Only a soldier wears armor, so a robe and a circlet serve a runecaster in a squad (16 § Equipment).

Integers: `current` is in milli-rune; `regen` truncates to milli-rune. On `HourPassed`, 25 adds `regen` to every `Rune` on a creature without `Hostile`, capped at `max`; a hostile creature's rune never comes back. A Proficient runecaster fills from 0 in 50 hours in a tunic (measured), 34 in a robe (measured: 1,500 milli-rune an hour), 84 in an iron helm and mail (measured: 600 milli-rune an hour).

### The sanctum

- Zone type `sanctum` ([buildings-and-furniture.md](../03-content/buildings-and-furniture.md) § Zone types: a room, setting `apprentices`, consumer 25). 14 counts it as a room when a built building tagged `rune_circle` lies inside, and its inspector names a missing circle.
- Building `rune_circle` (§ Special of the same file): 1×1 on a floor, 3 `stone_block` + 1 `rune_vial`, masonry, 200 ticks, impassable, value 20, `○` in `rune_cyan`. A sanctum with several circles uses the built one with the lowest id.
- `SetSanctumApprentices { zoneId, dwarfIds }`, owned by 25. At most `SANCTUM_APPRENTICES` living adult dwarves of the fortress, none twice (`not_found` for a zone that is not a sanctum or an id that is no living fortress dwarf, `not_adult`, `member_limit`). It stores the ids, ascending, as `settings.apprentices` on 14's zone, as `SetHospitalSupplies` stores its setting in `health/index.ts`, and turns the `attunement` labor on for each through 11's `jobs.setLabor`. A dead dwarf, or one no longer an adult of the fortress, is filtered at use. A dwarf named in two sanctums sits in the one with the lower zone id.
- There is no sanctum chest. An `attune` job's input is found like any job input, in any stockpile.
- Room tier: 14's ordinary tier (0 to 5), from `buildings.room(zoneId)`.

**The `attune` job.** Job type row in [jobs.md](../03-content/jobs.md) § Magic: labor `attunement`, skill `runecraft`, target building, workTile `adjacent`, baseTicks `ATTUNE_TICKS`, tool none, xp 0, producer `magic`, interruptible yes. Producer `src/systems/magic/producer.ts`, registered with `ctx.register.jobProducer`.

For each sanctum with a built circle, in zone order, each apprentice with `runecraft` below 20 and `sessionsToday < ATTUNE_SESSIONS_PER_DAY`, while a glowcap is available (each new job counts one off the available stock) and no job is under the key: `sink.create('attune:<dwarfId>', { type: 'attune', target: { kind: 'building', ref: circle }, workTile: 'adjacent', priority: 5, inputs: [{ filter: { type: glowcap }, count: 1 }], data: { assignedWorker: dwarfId, labor: 'attunement', skill: 'runecraft', inputUnits: true, anchorTile, zoneId } })`. `assignedWorker` is the field that restricts a job to one worker (`jobs/board.ts`). A job whose dwarf is no longer wanted there (removed, dead, done for the day, at 20) or whose circle changed or went is cancelled with `target_invalid`; the producer looks over the board's own `attune:` keys (11's `keysWithPrefix`), so a dwarf whose entity is already gone is covered, every hour and after each apprentice change, zone change, death and scorched circle. `onComplete` consumes the glowcap, grants `jobXp(ATTUNE_XP × (100 + 5 × tier) / 100, wits)` (the row's xp is 0, because `dwarves/index.ts` already grants a row's xp on every `JobCompleted`), counts the session, rolls the mishap and emits `AttuneSession { id, xp, mishap }` (`mishap` is the kind, or `''`). `DayPassed` clears the counts.

At Wits 50 and two sessions a day: Dabbling in 2 days, Novice in 6, Proficient (3,700 xp) in 74 days and 148 glowcap, Legendary in 268 days and 536 glowcap. Measured through the job in a bare sanctum (tier 0) from Wits 50: Proficient on day 73 after 145 sessions and 145 glowcap, one day early because each level-up adds `ATTRIBUTE_DRIFT` to Wits and a session gives 26 xp from Wits 56.

The thought `attuned` ends a session with no mishap. The first dwarf to reach `runecraft` 10 emits `FirstRunecaster` (`firstRunecasterDone` is saved).

**Mishaps.** One roll per session on stream 25, at the dwarf's level before the session's xp: `max(MISHAP_FLOOR, MISHAP_BASE − 2 × level − tier)` per mille, then a second draw picks the kind by weight among the rows that have landed. Measured over 1,000 level-0 sessions in a bare sanctum: 62 (25 singed, 11 blackouts, 10 scorched circles, 6 fires with nothing to burn, 3 surges, 7 loose wisps). None kills a dwarf, takes a limb or touches a stockpile. A light burn is 1 point on a random arm (a draw on stream 25); an arm at 1 hp or lost is spared for the other arm, and with neither the burn does nothing. Its `DamageDealt` carries `clean: true`, so 17 makes the burn already `cleaned`: it cannot take infection, and it heals on its own with or without a medic (one may still dress it). So no mishap kills a dwarf, now or later; the worst is the price of a chair. (A surge burns a loose wisp as it burns anyone, and so small a body can bleed out of it.) The last mishap of each sanctum is kept for its panel.

| kind | weight | what happens | how | severity |
|---|---|---|---|---|
| `singed` | 40 | a light burn on a random arm, already cleaned; thought `singed` | `DamageDealt { damageType: 'burn', amount: 1, attackerId: 0, clean: true }` | note |
| `blackout` | 25 | unconscious for `MISHAP_BLACKOUT_TICKS` | `CreatureStunned` (§ Effects) | note |
| `scorched_circle` | 15 | the circle is destroyed, no item back | `Mishap` carries `buildingId`; 14 handles it and removes the building with no yield | alert |
| `fire` | 7 | the first tile cardinal to the circle, north, east, south then west, that can burn (05's `burnableTile`) ignites; else nothing | `Mishap` carries `tile`; 05 queues it for its next tick, as lightning | alert |
| `surge` | 3 | every creature with a body within `MISHAP_SURGE_RADIUS` of the circle on its level (the larger of the two axis distances), in id order, takes a light burn; the session's xp is granted twice | as `singed` | note |
| `wisp_loose` | 10 | the `call` spell's own summon, a wisp, appears wild beside the circle and fades in a day; the apprentice gets no thought of the mishap, only `saw_wisp` as any dwarf who sees it | `looseWisp` in `magic/summon.ts` (§ Summons) | note |

### Channels

The wand and the staff are in [weapons-and-armor.md](../03-content/weapons-and-armor.md) § Channels, with their item rows (`category: weapon/ranged`, stack 1, quality-bearing, slot weapon, no `weapon` tag; wand `'`, staff `⌠`, both `rune_cyan`).

A channel's row has `launcher: { range, power }` with **no `ammo`**: `ammo` is optional in the schema and in the `WeaponRow`, `WeaponDefRow` and `LauncherDef` types, and the export writes it only for a launcher that has one. "A launcher with no ammo" is what a channel is, and code tests that (`isChannelRow` in `magic/cast.ts`), never an id. A hunter's launcher is never a channel: 11's ranged kit takes only a launcher with ammunition.

**A staff's material is its shoe.** `Item.material` is the metal of the bar. There is no `Item.shoe`. So the ordinary material filter on a work order picks the shoe, value and melting work as for any metal item. A staff holds one bar, so like a dagger it melts to nothing: `workshops/operate.ts` computes `floor(1 × 60 / 100) = 0`. Do not change the melt formula. A wand's material is its wood.

`runeMult` is a metals column ([minerals-and-metals.md](../03-content/minerals-and-metals.md) § Metals): silver 1.3, deepsilver 1.6, steel 1.1, iron 1.0, bronze 0.9, copper 0.8, every other metal 0.7. A wooden item counts 1.0.

**`Item.stone`** (`Idx<'MaterialDef'>`, optional; absent is none) names the gem on a channel. `items/api.ts` `canMerge` compares it (and `Item.enchant`), and `split` keeps both. A channel whose stone carries no spell row casts nothing. The runeforge always sets one. A channel is also found: an `old_battlefield` map sometimes holds a dead runecaster's wand with its stone, or an iron staff whose stone is gone (03 § Local map generation, stage 10, `BATTLEFIELD_CHANNEL_PERMILLE`). It is stock like any other found item, quality 0; arrival sets the spawn entry's `stone` on the item. Only a runecaster gets more than a stick from the wand, and no one claims the staff.

```
power(item) = launcher.power × runeMult(item.material) × QUALITY_COMBAT_MULT[item.quality]
```

Wand 0.7. Iron staff 1.2. Silver fine staff `1.2 × 1.3 × 1.1 = 1.716`. Deepsilver masterwork staff `1.2 × 1.6 × 1.5 = 2.88`.

**Recipes.** One wand and one staff recipe per row of `spells`, generated in `generatedRecipes` (`content/generate.ts`) as `smelt_`, `alloy_` and `melt_metal_item` are (`forge_*` are authored rows, not generated); [workshops-and-recipes.md](../03-content/workshops-and-recipes.md) § Runeforge gives `make_wand_<stone>` and `make_staff_<stone>`. Every generated row names workshop `runeforge` and skill `runesmithing`, here and for the `set_*` rows. A generated row numbers last like any other: its id is a line of `row-order.md`.

`RecipeOutput` has `stone?: { from: 'input'; index: number }`. `WorkshopOperator.complete` in `workshops/operate.ts` reads that input's material before the inputs are consumed and writes it after `spawn.item`, as it writes `memorialDwarfId`. `inputFilter` already points the order's material filter at the input the first output's material comes from, so the player picks the metal of a staff and the wood of a wand. No new order field.

**Who claims.** In `combat/equipment.ts` `reequipSoldier`, before the weapon loop: a member with `runecraft ≥ 1` claims the available channel with the highest `power(item)` among those that cast a spell (a channel with no stone, or a stone with no spell row, is never claimed), whatever the squad's preference, and drops the weapon it held at the barracks. Holding a channel, the weapon loop is skipped for them. With none held or in stock they fall through to the ordinary rule. `scoreWeapon` returns −1 for a channel, so no one else ever holds one. A two-handed staff takes the shield rule of any two-handed weapon; a one-handed wand keeps a shield. `kitTypes` already includes weapons. A channel's class is no squad preference: `SetSquadEquipment` refuses it (`bad_setting`) and the military panel does not offer it.

**Training.** `combat/training.ts` sends launcher holders with ammunition to the archery path. A channel holder takes the solo drill instead, never a sparring pair: half `TRAIN_XP` to its weapon skill, `runecraft`, with the solo drill's dodge, shield and armour xp, and no rune spent.

**In melee** a channel is a club at half damage with `hammer`. `resolveMelee` already does this for `damageType === null` launchers.

### Casting

`src/systems/magic/cast.ts`, imported by `combat/index.ts` and `combat/ranged.ts`. Casting rides in 16's creature loop. 25 has no casting loop of its own.

In `CombatSystem.tick`, after `w`, `launcher` and the distances are known:

```
channel  = launcher !== undefined && launcher.ammo === undefined
if channel and cooldown elapsed and drinkVial(ctx, id, w): continue      // § Vials; the drink sets the cooldown
hasAmmo  = channel ? canCastBolt(ctx, id, w, target) : (as today)
// kiting as today, with hasAmmo as above: a caster with rune keeps its distance
if channel and cooldown elapsed and castSupport(ctx, id, w, target):
    engagements.set(id, tick); continue                         // castSupport sets the cooldown by 16's rule
if isAdjacent: melee as today                                   // the club
else if isRanged in range with line of sight: fireAt as today   // the bolt (held while an ally is on its line, below), the burst or the single
else:
    a civilian does not chase, as today
    if channel and the spell is a burst or a single and cooldown elapsed and another target qualifies: fireAt it; continue
    if channel and the spell is no bolt and rune ≥ cost and dist ≤ CASTER_HOLD_DISTANCE: stop walking; continue
    approach as today
```

`canCastBolt`: the holder has a `Rune`, the staff's spell is of kind `bolt`, `burst` or `single`, `current ≥ cost`, and the target is within the spell's range; a burst and a single have their own conditions besides (§ Spells). `fireRanged` passes a `burst` or a `single` to `castAtTarget` in `magic/cast.ts` before it spawns anything: no hit roll, no projectile. For a `bolt` it has a third branch beside `naturalRanged` and the ammunition branch, `castBolt`: `projectileItemId = 0`, `rawDamage = round(spell.base × power(item))`, `damageType = spell.type`, `weaponSkill = 'runecraft'`, `weaponSize = launcher size`; it spends the rune and emits `SpellCast { casterId, spellId, targetId, tile, burned: false }`. Everything after that line is the shared path. So the hit roll, cooldown, crowding (`crowdTicks`), projectile, bystander half chance and xp (+3 a hit, +1 a miss, through `grantXp` on `weaponDef.skill`) all come from 16, and the hit roll draws on 16's stream. A bystander can be an ally: friendly fire is real by construction.

**Cast when** (a bolt, as Firebloom has its own): a bolt is a launcher's shot and is held by 16's rule for every shot (16 § Ranged resolution, Held shot). The caster holds the bolt while a creature of its own faction (for a fortress caster, any fortress creature) stands on a tile the bolt would cross before its target, the tiles of 16's projectile ray, unless it is careless this time: below `CARELESS_SAFE_SKILL` in `runecraft` it makes 16's one draw for it, on stream 25, and a careless caster casts at its held target through the ally (an apprentice of runecraft 2 does in two weighings of five). A careful caster throws at another target: the nearest creature hostile to it (distance, then id) that `canCastBolt` allows, in line of sight, with no ally on the line (`otherBoltTarget` in `magic/cast.ts`, which hands 16's `nearestClearTarget` the spell's range and `canCastBolt`). With none, it waits where it stands and spends nothing, and if it drew it takes its attack cooldown before it weighs again. The line check draws nothing, so friendly fire after the cast stays real: an ally can step into the bolt's path after the cast, and a missed bolt flies on and can land on someone beyond its target. A burst or a single whose held target does not qualify throws, by the same search without the line, at the nearest other hostile that qualifies.

**Where a caster stands.** A caster whose spell is no bolt, with the rune for it, stops `CASTER_HOLD_DISTANCE` from its target instead of closing to club it. It still clubs a target that reaches it.

Cooldown is 16's rule for every cast: `size × 3 + 10 − Agility / 10`, at least `MIN_ATTACK_COOLDOWN`, slowed by a crowd. At Agility 50 a staff is 26 ticks, a wand 14.

A bolt's `Projectile` carries `spell?: Idx<'SpellDef'>` and `spellPower?` (the channel's power in thousandths at the cast, so the hit does not depend on what the caster holds by then). `resolveProjectileHit` returns the damage it dealt. In `advanceSingleProjectile`, a hit with damage above 0, on the target or on a bystander, calls `applySpellOnHit` in `magic/cast.ts` (Frostbind's slow).

Below cost the caster drinks a vial if it can (§ Vials); otherwise the channel is a club.

The rune is spent at the cast, in every spell. Every cast emits `SpellCast`: for a bolt, a burst or a single its `targetId` is the target; for a ward and a call the caster; for a mend the patient; for a dread the held target.

### Spells

Content table `spells` ([weapons-and-armor.md](../03-content/weapons-and-armor.md) § Spells, `SCHEMAS` entry, `exportSpells`), which holds `emberbolt` (garnet), `frostbind` (amethyst), `ward` (quartz), `mend` (emerald), `dread` (sapphire), `firebloom` (ruby), `daze` (diamond) and `call` (glowstone, cost 3). A blank `range` there is the channel's own; `call` reaches no one, and its `summon` column names the species a wand or an unlisted metal brings (§ Summons).

Power scales `base` and `ticks`: `round(base × power)`, `round(ticks × power)`. Rune cost does not scale. A Call's summon does not scale with power.

Frostbind's hit, with damage above 0, adds a `slow` effect of `FROSTBIND_SLOW_PERCENT` for `round(300 × power)` ticks. A creature that wears a piece with `slow_immune` (`rimeward`) is not slowed: `addEffect` refuses a `slow` for it, so spells and enchantments both respect it (§ Enchantments in combat).

When each support spell casts (`castSupport` evaluates these for a held target with the cooldown elapsed; a bolt, burst or single goes by 16's ranged branch). Distance is the casting distance (Chebyshev, each level between counting two) and line of sight is 16's:

| Spell | Cast when | Does |
|---|---|---|
| Ward | caster has no unexpired `ward` effect | `ward` effect with `round(4 × power)` for `round(600 × power)` ticks on every creature of the caster's faction within 3 on its level, the caster too, `sourceId` the caster. One `Warded { id }` each. A wand's ward is 3 for 420 ticks, an iron staff's 5 for 720 |
| Mend | a creature of the caster's faction within 4, in line of sight, has a bleeding unbandaged wound, or is unconscious from wounds (pain or blood, not a stun) with a light wound to close. Nearest, then lowest id | `Mended { id, casterId }`. 17 handles it: every bleeding wound `bandaged`, light wounds removed with their hp back, the rest `cleaned` |
| Dread | two or more creatures hostile to the caster within 4 in line of sight, conscious, not fearless (`fearless`: immune, or wearing a `calm` piece, § Enchantments in combat) and not already under a `flee` effect, and `tick ≥ Rune.nextDreadTick` | up to `DREAD_MAX_TARGETS` of them, nearest first then id, each after the resist roll: a `flee` effect for `round(400 × power)` ticks, `sourceId` the caster, and `PutToFlight { id, sourceId }`. Sets `nextDreadTick` to the tick the effect ends. A dwarf runs by 10's brain (§ Effects, `flee`) |
| Call | the caster has fewer than `MAX_SUMMONS_PER_CASTER` summons alive, the creature count is under `MAX_CREATURES`, and a tile beside the caster is free | the summon stands on that tile (§ Summons); `SpellCast`'s `targetId` is the caster |

By 16's ranged branch, with `canCastBolt` also true only when:

| Spell | Condition | Does |
|---|---|---|
| Firebloom | no creature of the caster's faction (for a fortress caster, no fortress creature) stands in the 3×3 around the target, on its level, at the cast | adds `{ tile, at: tick + FIREBLOOM_DELAY_TICKS, casterId, raw }` to `pendingBlooms`, through `ctx.world.services.magic` (the `CoreServices` entry `MagicApi`, installed by 25, like `combat`). At `at`, 25's tick calls `resolveProjectileHit` with `raw` and `ember` for every creature with a body in the 3×3 on that level, in id order, whatever its faction, with skill `runecraft`, drawing on stream 25. So shields block and armor counts. No hit roll. The delay is what makes friendly fire real: soldiers walk in while it blooms |
| Daze | target has `Hostile.role` `captain`, or species size ≥ 100, is conscious (a stunned creature is not) and is not immune | after the resist roll, `CreatureStunned { id, until: tick + round(150 × power) }`. No hit roll, no projectile |

**How strong.** Measured in the combat-pace arena against a peril-2 raid of ten ([ward and Daze](../../reports/audits/2026-11-05-t477-ward-and-daze.md)): five Novice soldiers alone turn it back in 3 fights of 24, with one more axedwarf 11, with two more 36 of 48. A Proficient caster in place of the two, warding with an iron staff, turns it back in 36 of 48: the ward's armour is set there, at one caster worth about two soldiers. A Daze caster ordered to kill the captain turns it back in 44 of 48. It dazes the captain once, at the head of the raid, and the soldiers kill the captain while it lies stunned, which costs the raid its captain early (18 § Morale); in 120 fights no captain woke to be dazed again. A strong choice that costs a diamond, a Proficient caster and the player's order.

**Resist** (Dread, Daze): `Willpower / 2` percent, `RESIST_NO_ATTRIBUTES_PERCENT` without attributes, drawn on stream 25 (`ctx.world.rngFor('25')`); against Daze the target adds the `daze_resist` of the pieces it wears (`wornDazeResist`, summed). Creatures of size at least `MENTAL_IMMUNE_SIZE` and every `deep` creature are immune: such a target does not qualify. A dread hexer holds a sapphire (§ Hexers), so Dread strikes dwarves; only fortress casters hold a diamond, so no dwarf is ever dazed.

Announcements: `RuneSpent { id }` once a caster falls below its spell's cost, at the cast, until regen lifts it over the cost again (`Rune.outAnnounced`; a vial does not lift it). A caster with `Hostile` (a hexer) never emits it. A bloom that catches a creature of the caster's faction emits `SpellCast { casterId, spellId, targetId: the lowest such id, tile, burned: true }`, announced as an alert, once per caster per day (`bloomAlertsToday`).

Worked numbers, at Toughness 50 (5%). All round as 16 rounds. Every row is pinned by a test (`test/unit/runecraft/t470-runeforge-channels.test.ts`; the ward's by `t473-remaining-spells.test.ts`; the enchanted weapons' by `t472-enchants-in-combat.test.ts`). Steel keeps the top of the table: a stone is set in a weapon, never in a channel, so an enchanted axe only widens its lead over the best staff.

| Attack | raw | Target | damage |
|---|---|---|---|
| Emberbolt, wand | 13 | leather jerkin, torso | 10 |
| Emberbolt, wand | 13 | iron mail and tunic, torso | 8 |
| Emberbolt, wand | 13 | steel breastplate and tunic, torso | 0 |
| Emberbolt, iron staff | 22 | leather jerkin, torso | 18 |
| Emberbolt, iron staff | 22 | iron mail and tunic, torso | 16 |
| Emberbolt, iron staff | 22 | steel breastplate and tunic, torso | 4 |
| Emberbolt, iron staff | 22 | bare leg under a ward of 6 | 10 |
| Emberbolt, silver fine staff | 31 | bare part | 29 |
| Emberbolt, deepsilver masterwork staff | 52 | bare part | 49 |
| Deepsilver masterwork great axe, for comparison | 72 | bare part | 68 |
| Iron battle axe of embers, common | 22 + 8 ember | bare part | 21 + 8 |
| Keen deepsilver masterwork great axe (+15%) | 82.8 | bare part | 79 |
| Deepsilver masterwork great axe of blaze | 72 + 21 ember | bare part | 68 + 20 |

### Effects

Every kind is read where the table says.

`Spellbound` component (§ State). `src/core/effects.ts`: `effectValue(entities, id, kind, tick)`, the largest value among unexpired entries of a kind, 0 if none; `effortUnderEffects`, the step's effort below; `hastedTicks`, a wait under `haste`; and `immuneToBurn`. 25 adds entries through `addEffect` in `magic/cast.ts` (and a draught through `drinkDraught`, § Draughts) and, on `HourPassed`, drops expired entries and the draught rests that have run out, and the component when nothing is left. Readers compare `until` with the tick, so expiry needs no tick of its own.

| kind | value | read at |
|---|---|---|
| `slow` | percent | `core/movement.ts` `moveAlongPath`, on the step's effort after crowding: `× (100 − slow + haste) / 100`, truncated, at least 1; a game with no `Spellbound` (the store is empty) does no lookup per mover. Every creature, one place. 17's `speedModifier` is not touched |
| `ward` | armor | `armorReduction`: `+ ward × damageTypeVsLayer(type, ward)` on every part, while it lasts at the tick of the hit |
| `flee` | 1 | `CombatSystem.tick`, after the conscious check (`stepFled` in `combat/fled.ts`): while it lasts the creature keeps its target, does not attack, and walks to the tile `FLEE_EFFECT_TILES` from the source of its latest `flee` entry, through itself, clamped to the map and stepped back toward it to a tile a walker can stand on; with no such tile or no path, to the nearest tile of its party's arrival edge (`getNearestEdgeTile`); a creature of no party then stands. A source with no position counts as the held target. `isFleeing(entities, id, tick)` counts it (+10 to hit, no parry, no block). 18's member step needs no change: it holds a target and returns. Nothing leaves the map, so the party's losses and retreat do not move, and when the effect ends the creature still holds its target and comes back. A dwarf, a soldier on duty too, runs by 10's brain, which calls the same `stepFled` with no target (10 § Behavior selection, Dread): with a source that has no position it stands where it is |
| `heal_rate` | percent | `health/tick.ts` healing: each wound's `healRemaining` decrement (after its own rate and suture) `× value / 100` while it lasts |
| `pain_half` | 1 | `health/tick.ts` pain sum: the raw sum halved, rounded down, before Willpower |
| `pain` | pain | `health/tick.ts` pain sum: added to the wounds' raw sum, before `pain_half` halves it and before Willpower. A creature under it stays in 17's `wounded` list until it ends, so its pain is summed once more without it. Several do not add: the largest counts. A `venomed` blow brings it (§ Enchantments in combat), and so does a giant cave spider's bite that does damage, its natural attack's `onHit` (creatures.md § Cavern monsters; 16 § Melee resolution) |
| `haste` | percent | the step above; and every wait of an attack, after crowding: `resolveMelee`, `fireRanged`, a cast's cooldown (`setCastCooldown` in `magic/cast.ts`) and a vial's `DRINK_TICKS`: `× 100 / (100 + value)`, rounded down, at least 1 (`hastedTicks`) |
| `fire_immune` | 1 | `resolveMelee`, `resolveProjectileHit` and the second hit of `extra_damage` (`applyEnchantOnHit`), after Toughness: a hit whose wound type is `burn` (`ember`, or the wyrm's `burn`) does 0 (`immuneToBurn`) |
| `spot_radius` | tiles | `threats/ai.ts` `fortressTargets`, where a fortress creature's `spotRadius` is set: the larger of its own and the effect's |

**Stun** is not an effect. Daze and `blackout` emit `CreatureStunned { id, until }`. 17 handles it (17 § Bleeding, pain, consciousness): it adds the creature to `wounded`, where it stays until the stun ends, saves `stunnedUntil` (a map in `HealthState`, optional), knocks a conscious body down at once with `CreatureUnconscious`, and its consciousness line becomes `conscious = pain < PAIN_UNCONSCIOUS && blood ≥ threshold && tick ≥ stunnedUntil`. So everything that respects `Body.conscious` holds: 16 skips the creature and hits it at +40, brains stop, and `CreatureUnconscious` and `CreatureConscious` fire. The patient check in `health/tick.ts` counts only unconsciousness from pain or blood, so a blackout admits no one. A stunned raider counts toward 18's retreat losses while it lies there. That is accepted: it is 150 ticks. A Daze caster may daze the same creature again once it wakes.

### Vials

A caster carries `CASTER_VIALS`. In `reequipSoldier`, after the weapon: a member holding a channel tops up by the ammunition logic, through `claimItemForSoldier`, taking available stacks with tag `rune_fuel` in the kit pool's order and splitting a larger stack so that only the missing vials are taken. `kitTypes` adds items with tag `rune_fuel`. `findAmmoForShooter` finds a carried vial by its item id, the item row with that tag.

`drinkVial` in `magic/cast.ts`, called by 16's loop for a channel holder with its cooldown elapsed and a hostile target held (every target the loop keeps is hostile), before `castSupport` and `canCastBolt`: when `current < cost`, a vial is carried and `vialsToday < VIALS_PER_DAY`, it consumes one, adds `VIAL_RUNE` capped at `max`, the circlet's bonus included (§ Rune of one's own; never lowering the rune), counts `vialsToday`, emits `VialDrunk { id }` and sets the cooldown to `tick + DRINK_TICKS` (shortened by `haste`, § Effects). `DayPassed` clears `vialsToday`. A Proficient runecaster has 50 rune and 15 more in the pouch for a day.

**A desperate fourth.** With `VIALS_PER_DAY` drunk today and the foe it holds beside it (on its level, the larger axis distance 1; its target is 16's, `combat.targetOf`), a caster below cost drinks a fourth vial: it gives `SICK_VIAL_PERCENT` of `VIAL_RUNE` (2.5 rune), still capped, counts `vialsToday` to 4, and emits `VialDrunk { id, sick: true }`, which gives the thought `rune_sick` (§ Morale). Every other vial emits `sick: false`. There is never a fifth. The look panel then reads "4 of 3 drunk today".

### Setting stones

The enchantments are rows of `enchants` ([weapons-and-armor.md](../03-content/weapons-and-armor.md) § Enchantments), the settings are generated runeforge recipes ([workshops-and-recipes.md](../03-content/workshops-and-recipes.md) § Runeforge), and the runed robe and the circlet are armor rows with a `rune` property (weapons-and-armor.md § Armor), made at the runeforge.

`Item.enchant { id: Idx<'EnchantDef'>, tier: Quality }`, optional; absent is none. One per item, permanent. `tier` is the runesmith's quality roll, and `QUALITY_COMBAT_MULT[tier]`, rounded, scales what the row's `scales` names: its `value` or its `ticks`.

**Settings.** `applyGenerated` (`settingRecipes` in `content/generate.ts`) makes one recipe `set_<slot>_<enchant>` per row of `enchants`: input 0, kept, is 1 of every melee weapon type (`weapons` rows with no launcher and no `training`), 1 of every `armor` row with a layer (of the row's `only` slot when it has one) or 25 units of `bolt|arrow`, as one alternation; then the stone (a gem stone is 1 `cut_gem` of its material, another stone 1 of its item) and the row's vials in `rune_vial`. Weapon and armor 300 ticks, xp 15; ammunition 200 ticks, xp 10; quality yes, no fuel. A set of ammunition is exactly 25 units: the job search splits a larger stack.

`RecipeDef` has `transform: true` and `enchant` (the row it sets), and such a recipe has no outputs (content check: a transform recipe has none and names its row; every other recipe has at least one output). 12 runs it (12 § Operation, § Work orders): input 0 is not consumed; its delivered items get `enchant` through 13's `items.setEnchant(id, enchant)`, which re-accounts value as every mutation does; they are left at the output tile and released with the job; `StoneSet { itemId, enchantId, tier, smithId }` is emitted per item, and `ItemCrafted` is not. An order for it is `once` only, since there is no output to count.

Filters: `ItemFilter.noEnchant` (`items/search.ts` `matches`, `jobs/state.ts`), set by `WorkshopOperator.inputFilter` on a transform recipe's input 0, so an enchanted item is never set again. The order's material filter applies to input 0, since there is no first output. `WorkOrder.targetType?: Idx<'ItemTypeDef'>` narrows input 0's alternatives to one type; the orders panel offers it for a transform recipe, as it offers a material. There is no "this exact item" order: the search takes the nearest match.

A soldier's gear is owned and so is never a target. The runesmith sets stones in stock, and the squad's next re-equip takes the better item: `scoreWeapon` and `scoreArmorPiece` add `ENCHANT_CLAIM_BONUS` for an enchanted item (16 § Equipment). A member holding a channel claims a piece with a `rune` property for its slot first, past the squad's armor preference. Melting and `destroy` are unchanged, so an enchanted item melts to bars only and the stone is lost.

**Value.** 13 § Value: `+ stone value × ENCHANT_STONE_VALUE_MULT + vials × ENCHANT_VIAL_VALUE`, added in `ItemCore.value`; a gem stone's value is its material's; enchanted ammunition carries `round(value / 25)` a unit, so a set of 25 bolts of embers carries 100 and a split or a merge never changes wealth. Wealth follows through `account`. A masterwork steel breastplate of adamant is 4,000 + 90 × 3 + 12 × 15 = 4,450; an iron axe of embers gains 12 × 3 + 6 × 15 = 126.

**Names.** `magic.enchantOf(itemId)` gives the row, its suffix and its effects at the item's tier. The stocks panel, the look cursor and the `StoneSet` announcement name the item with the suffix (`enchantedName` in `ui/messages.ts`): a suffix that begins with "of" follows the name, "iron battle axe of embers (fine)"; any other goes before it, "keen iron short sword". The look cursor adds a dim line with the effects at the tier: "+9 ember on a hit."

### Enchantments in combat

**`fearsome` is a trade-off, by the owner's decision.** A fled raider is out of the fight for a while, but soldiers who chase it swing less: in the [enchant arena](../../reports/audits/2026-11-02-t472-enchant-arena.md) six soldiers with fearsome axes held a raid of ten in 16 of 24 fights against 20 with plain axes. Not every enchantment is a strict improvement. The look line says so: "A fleeing foe is hard to catch."

Content table `enchants` ([weapons-and-armor.md](../03-content/weapons-and-armor.md) § Enchantments) holds them: on weapons `keen`, `ember` (a garnet, or an ember newt's gland at 4 vials in place of 6: the row `ember_gland`, with the same effect and name), `rime`, `sure`, `fearsome`, `blaze`, `sunder`, `deep` (a deepsilver bar: +25% damage, +50% more against the Hollow-born), `hollowbane` (a hollow ichor: +100% against the Hollow-born) and `venomed` (a giant cave spider's venom: a hit pains the target by 20 for 300 ticks, the numbers of the spider's own bite in [creatures.md](../03-content/creatures.md)); on armor `stout`, `emberward`, `rimeward`, `adamant`, `glowing`, `wyrmhide` (a wyrmscale: no fire through the piece), `hollowsight` (a hollow ichor, head pieces only: +4 to the spot radius, so a dwarf spots within 10) and `calm` (a sapphire: never put to flight, and Daze resisted by 25 more in a hundred); on ammunition `ember_ammo`, `rime_ammo`, `seeking`. A hollowsight helm and a draught of hollowsight give the same 10 tiles.

The resolution reads rows, never ids. A row: `{ id, slot, stone, vials, suffix, effects: { kind, value, type?, chance?, ticks?, scales }[], only? }`; `scales` is `value`, `ticks` or `none`. `magic/enchant.ts` `effectAtTier` gives an effect's numbers at a tier, `enchantOfItem` an item's, and for combat `itemEnchantEffects` (an item's effects at its tier, empty for none) and `wornEnchantEffects` (those of the pieces in a creature's five armor slots, head to feet). Effects of one kind on one item add up.

Where each kind is read. Every seam reads `Item.enchant` first, so an unenchanted fight does the same arithmetic, in the same order, and draws the same numbers. Only `flee` and `ignite` draw, and only for an item that carries them.

| kind | seam |
|---|---|
| `to_hit` | `resolveMelee`, the `hit` sum before the clamp, from the weapon. `fireRanged`, the `hit` before the clamp and the roll, from the unit of ammunition taken (`calculateRangedHit`'s `bonus`); a bystander's half chance has none |
| `damage_percent`, `vs_deep_percent` | `resolveMelee`, on `raw`, before armor: `raw × (100 + damage_percent + vs_deep_percent) / 100`, the second only when the target's `Creature.faction` is `deep` |
| `armor_percent` | `resolveMelee` passes it to `armorReduction` as `armorPercent`: that share of the target's whole armour sum counts. Several on one item: the smallest |
| `armor` | `armorCovering`: `piece.armor + value` where the piece has it, before the piece's metal, coverage, quality and layer multipliers, so the inspector's armour value follows |
| `fire_percent`, `frost_percent` | `throughEnchantedArmor` in `combat/melee.ts`, after the blunt-through rule and before Toughness, in `resolveMelee`, `resolveProjectileHit` (missiles, breath and blooms) and the extra hit below: each piece covering the part that has the kind lets that percent of the damage through, so two such pieces on a part multiply. Fire is a hit whose wound type is `burn` (`woundTypeFor`: `ember`, and the wyrm's `burn` breath); frost one whose wound type is `frost` |
| `extra_damage` | after a hit with damage above 0: `applyEnchantOnHit` in `magic/cast.ts`, called from `resolveMelee` and `advanceSingleProjectile` (on the target and on a bystander alike). A second hit of the effect's `type` on the same part: `value` less its own `armorReduction`, through `throughEnchantedArmor`, then Toughness, and 0 under `fire_immune` for an `ember` (§ Effects). It emits one more `DamageDealt` (the same `attackerId` and `weaponId`) when that is above 0, no `AttackResolved` and no xp |
| `slow` | `applyEnchantOnHit`: `addEffect` of a `slow` of `value` for `ticks`, `sourceId` the attacker |
| `pain` | `applyEnchantOnHit`: `addEffect` of a `pain` of `value` for `ticks`, `sourceId` the attacker, which 17's pain sum reads (§ Effects). Nothing is drawn |
| `slow_immune` | `addEffect`: a `slow` is not added to a creature that wears a piece with it, whether a spell or an enchantment brings it. `addEffect` takes the registry for this; every caller adding a `slow` passes it |
| `flee` | `applyEnchantOnHit`: a creature Dread cannot take (`fearless`: the `deep` faction, size `MENTAL_IMMUNE_SIZE` or more, or a wearer of `flee_immune`) is never sent running, and nothing is drawn for it. Otherwise roll `chance` on stream 25 (a `chance` of 0 always applies), then the resist roll (§ Spells), and add a `flee` effect for `ticks`, `sourceId` the attacker, which 16's `stepFled` reads as Dread's, and emit `PutToFlight { id, sourceId }` |
| `flee_immune` | `addEffect`: a `flee` is not added to a creature that wears a piece with it, and `fearless` holds for it, so Dread does not count it among its targets and a fearsome blow draws nothing for it |
| `daze_resist` | Daze's resist roll (§ Spells): the wearer's pieces add their values, in percent |
| `spot_radius` | `threats/ai.ts`, where fortress targets get `spotRadius`: a dwarf's `SPOT_RADIUS` plus the largest `spot_radius` among the pieces it wears (`wornSpotRadius`); pieces do not add to each other |
| `ignite` | `applyEnchantOnHit` (`igniteOnHit`), after a hit with damage above 0: one draw on stream 25 at `chance` percent (`blaze`: 2). When it lands and the struck creature's tile can burn (05's `burnableTile`: grass, a shrub, a wooden floor, your own too), it emits `Mishap { id: attacker, kind: 'blaze', tile }`, and 05 lights the tile at its next tick as it lights a sanctum's fire. Announced as an alert: "Urist's blow of blaze set the ground alight." |
| `light` | 07's growth, `plants/index.ts` `grow`: a `glow` crop on a dark tile with no lamp grows when a creature on that tile's 3×3, on its level, wears a piece with it (`wornLightAt` in `magic/enchant.ts`, through the spatial index). It is asked for no other crop, so with no such crop nothing is looked up. It is not a lamp: no `lit` flag, no coverage in 14, no glow plot |

Enchanted ammunition stays enchanted through `split`, and `canMerge` keeps it apart. The unit split off for a shot carries the stone in flight; its effects are read from `proj.itemId` at the hit, before the unit drops or breaks. A bolt that drops keeps its stone; one that breaks is gone with it.

### Draughts

The draught items are in [items.md](../03-content/items.md) § Medical and herbs (category `medical/draught`, stack 5, bag, glyph `!` in the color of the row, tag `draught`, not `drinkable`), what each does in its § Draughts, and the laboratory recipes in [workshops-and-recipes.md](../03-content/workshops-and-recipes.md) § Laboratory › Draughts (150 ticks, xp 8, quality, `spoilable`, two draughts from the inputs). Content table `draughts`: `{ id, effects: { kind, value }[], trigger }`, its id the draught's item id. A brewed draught bears quality, and its timed effects last `round(DRAUGHT_TICKS × QUALITY_COMBAT_MULT[item.quality])` ticks. The draughts of hollowsight (a hollow ichor; spots within 10) and of wyrmblood (a wyrmscale; proof against fire) are brewed from the rare materials (§ Rare materials).

**Effects.** A kind with a number is a timed effect (§ Effects) on the drinker, `sourceId` the drinker. `mend` emits `Mended { id, casterId }` (the medic who gave it, or 0), which 17 handles as the spell's. `ease` gives the thought `eased`. A calming draught drunk within `CALM_REST_DAYS` of the dwarf's last (`lastCalmTick`) is drunk `again`: `DraughtDrunk` carries `again: true`, `eased` gives half its value, and the dwarf also gets `dosed_again`. A medic waits only the ordinary draught rest, so a Miserable dwarf may be dosed again on the fourth day. The mood floor (15 § Mood) holds as for any thought.

**Triggers.** The `trigger` column: `wounded`, a soldier on duty is hit (`AttackResolved` with outcome `hit`) while its blood is below half its maximum, or `give_draught` for a patient; `raid`, `RaidArrived` (any kind) or `AmbushSprung`, every soldier on duty; `deep`, `DeepStirred` or `MonsterEmerged` while the Deep's level (`fortress.deepLevel`) is at least `DEEP_DRAUGHT_LEVEL`, every soldier on duty; `fire`, `ThreatNearby` for a soldier on duty from a creature whose species has a ranged natural attack that burns (`burn`, the magma wyrm's breath, or `ember`), that soldier; `miserable`, `give_draught` to a Miserable dwarf; `never`, the spoiled batch, never drunk.

**One draught, then rest.** The rest lives on `Spellbound` (`lastDraughtTick`, `lastCalmTick`), since most soldiers have no `Rune`. A creature that drank any draught drinks none for `DRAUGHT_REST_DAYS`: no trigger makes it drink and no medic gives it one. `lastCalmTick` is its last calming draught, kept for `CALM_REST_DAYS`. `HourPassed` drops a rest that has run out, and the component stays while either lasts. A plain vial is not a draught and starts no rest.

**Who carries.** `Squad.equipment.draughts` (item ids, ordered, absent by default) is set through 16's `SetSquadEquipment`: distinct ids of draughts whose trigger is `wounded`, `raid`, `deep` or `fire` (a soldier's triggers), else `bad_setting`; an empty list clears it. `reequipSoldier` gives every member one of each listed draught by the ammunition logic, splitting a stack so that only one is taken. `kitTypes` adds tag `draught`.

**Triggers are events, not scans.** 25 subscribes to `RaidArrived`, `AmbushSprung`, `AttackResolved`, `DeepStirred`, `MonsterEmerged` and `ThreatNearby`. For a raid or the Deep it walks the squads in id order and their members on duty; for a hit, the struck soldier; for a threat, the soldier it names. A threshold crossing emits both `DeepStirred` and `MonsterEmerged`, and the rest keeps a soldier to one draught. Each, if its rest allows, drinks the first draught of its squad's list whose trigger fired and which it carries (`soldierDrinks` in `magic/draughts.ts`): one unit is consumed through `items.consume`, the effects land, the rests start and `DraughtDrunk { id, draughtId, calm }` is emitted (`calm`: the draught eases). There is no drinking time. With nothing listed, no draught is drunk.

**`give_draught`.** Job type row in [jobs.md](../03-content/jobs.md) § Magic: labor and skill `medicine`, target entity (the patient's tile is a stand tile too), baseTicks 30, priority 2, producer `magic`, key `give_draught:<patientId>`, one input of the draught's item type, `excludeWorker` the patient. Produced on each pass of the job board for an admitted patient (17's `Patient`) with a serious or grievous wound, while an available draught with trigger `wounded` is in stock (each job counts one off) and the rest allows; and once on each `DayPassed` for each Miserable dwarf (15's tier) while an available draught with trigger `miserable` is in stock and the draught rest allows. A job whose patient died or no longer qualifies, or whose rest no longer allows, is cancelled with `target_invalid`. At completion the patient drinks the delivered draught as above, the medic named in `Mended`; if the rest no longer allows, nothing is drunk and the draught stays where it was brought.

**Spoiled batch.** In `WorkshopOperator.complete`, for a recipe with `spoilable: true`, after the quality roll: one draw on 12's stream, `chance(max(0, ALCHEMY_MISHAP_PERMILLE − 10 × skill))`, and when it lands every output is the draught whose trigger is `never` (`murky_draught`: no effect, worth 1, bears no quality). Only a spoilable recipe draws. There is no miasma: instead the laboratory stinks for the rest of the day. 15 sees the `ItemCrafted` of the spoiled draught and marks the workshop's footprint until the day ends; a dwarf of the fortress who steps within `LAB_STINK_TILES` of it (15's tuning) gets `lab_stink` while it does not hold it. No rot pass, no draw.

### Summons

A summon is a **war-trained tame animal assigned to its caster**. 08's tame brain does the rest (08 § Summons): it takes targets within `WAR_ANIMAL_RADIUS` of its dwarf, follows within 1 tile, and 16's targeting fights. 25 adds no brain. The code is `magic/summon.ts`.

**The call.** `castSupport`'s `call` branch (§ Spells) plans the call (`planCall`) and, once the rune is spent, answers it (`answerCall`): `spawn.creature(species, tile, 'fortress')`, then `Tame { trained: 'war', assignedTo: casterId, noBreed: true, condition: 0, pastureId: 0, petOf: 0, slaughter: false, juvenileUntil: 0, pregnantUntil: 0, lastProductTick: {} }` and `Summoned { summonerId: casterId, fadesAt: tick + SUMMON_TICKS }`, and `SummonCalled { id, casterId }`. The tile is the first free tile beside the caster on its level, in the order north, east, south, west, then north-east, south-east, south-west, north-west: one a creature of the species can stand on and no living creature holds. With none free the Call is not cast. Summons count toward `MAX_CREATURES` like any creature, and a summon is of the fortress faction, so a ward and a mend reach it.

War training adds +50% damage and +1 natural armor (`isWarTrained`), so the rows hold the lower numbers.

**The species.** The staff's metal picks the row, through the metals column `summon` ([minerals-and-metals.md](../03-content/minerals-and-metals.md) § Metals): steel and silver `stone_warden`, deepsilver `deep_shade`. A wand, or any metal with no `summon`, gets the `call` spell row's own `summon`, `wisp`. The three rows are in [creatures.md](../03-content/creatures.md) § Summons: a wisp is 6 `ember` as fought, a warden 22 `blunt` with armor 8, a shade 18 `edge` with armor 2. A summon has no stealth; a shade that turns comes through hidden (below).

Rows carry `flags.summoned: true` (the word `summoned` in the flags column), and code reads the flag, never an id. A summoned species:

- leaves no corpse: `items/index.ts`, the `CreatureDied` branch, skips `createCorpse` when the species has the flag;
- is never slaughtered, named, assigned, pastured or trained: 08's animal commands reject it `not_found`, and 08's `tameList`, `wildList` and `bySpecies` leave it out, so the animals panel and the hunters do not see it;
- gives no grief: it is no one's pet, and 15's `saw_death` passes over its death (15's other death thoughts read dwarves and pets only);
- is never butchered: no `butcherable` flag;
- is never bandaged by a medic (17's `bandage_animal` passes over a creature with `Summoned`), never carried off by a thief (18), and never caught by a cage trap (19), since it would fade in the cage;
- is no name in the legend: 24's kill tally leaves out a killer with `Summoned`, though a summon's kill still awards its milestone;
- has no `Hostile` while it is the fortress's, so no party counts it. It is no dwarf: it has no `Brain` or `Labors`, so the population, immigration, burial and the end of the fortress never count it, and it carries nothing, so it adds no wealth.

**Fading.** On `HourPassed`, 25 emits `SummonFaded { id }` for every living `Summoned` with `fadesAt ≤ tick`, ascending, and 17 kills it with cause `faded` (17 § Bleeding, pain, consciousness). The log reads "A stone warden fades." On a creature's `CreatureDied`, every summon it called gets `fadesAt = tick`, so it fades on the next `HourPassed`. Death at 0 hp is ordinary and leaves nothing.

**Turning.** A species whose row has `flags.turns` (the deep shade; the word `turns` in the flags column) comes through turned with `SHADE_TURN_PERMILLE`, one draw on stream 25 at each Call of it; no other species draws. A turned summon spawns with faction `deep`, no `Tame` and `Summoned { summonerId: 0, fadesAt: tick + SUMMON_TICKS, turnedFrom: casterId }`, so it does not count toward its caster's summons, does not fade when its caster dies, and fades at its day's end like any summon; 25 emits `SummonTurned { id }` and no `SummonCalled`. 18 handles `SummonTurned` (18 § The Deep): `spawnedHollowBorn(ctx, id, tile, hollowBorn, hidden)`, the same function the emergence uses, adds `Hostile { role: 'hollow', behaviorState: 'attack', stealthed: true, … }`, puts it in `hollowBorn`, and sets the nearest fortress target. It comes through hidden, like a hollow stalker: not drawn, not targeted by soldiers, and seen by no one until 18's spotting finds it (a fortress creature within its spot radius, with a line to it). Its own caster never spots it: the dwarf whose call it came through is looking at the fight, not behind it, so the shade stays hidden beside its caster until another dwarf or a war animal comes within its spot radius, or a trap springs on it. Announcement `SummonTurned`, danger: "Something came through the call that was not called: a deep shade turns on the fortress." Thought `summon_turned`, everyone. Measured: 50 turned in 1,000 castings of a deepsilver staff (`t475-summons.test.ts`); a squad of three in iron axes, shields, helms and mail killed a turned shade in 87 ticks, taking no wound.

**A wisp is seen.** Whenever a wisp appears, a called one (a Call whose species is the `call` row's own summon) or a loose one, 25 emits `WispAppeared { id, tile }`, and 15 gives `saw_wisp` ("Saw a light that was not a lamp.") to every dwarf within 8 tiles in line of sight, at most once a day (§ Morale). No scan.

**Wisp mishap.** `wisp_loose` (§ The sanctum) spawns the `call` row's `summon` beside the circle (the same free-tile order, around the circle's tile) with faction `wild` and `Summoned { summonerId: 0, fadesAt: tick + SUMMON_TICKS }`, so 08's wild brain wanders it; nothing spawns with no tile free or at `MAX_CREATURES`. The wisp is `neutral`: a `timid` one would run from the apprentice and, from a sanctum with no way to the map's edge, leave the map at once. 08's daily lifetime and cap check passes over it. The apprentice gets no thought of the mishap; it sees the wisp like anyone (`saw_wisp`).

**Inspector.** In the creature tab, under the effects line: a caster's "Summons: stone warden (fades in 9 hours), wisp (fades in 3 hours)."; a summon's "Called by Urist Ironvein; fades in 9 hours.", or "Fades in 9 hours." for one with no caster. A Call channel's line reads "Call: brings a stone warden for a day, 2 at a time."

### Rare materials

Nothing new is placed in the rock. Four stones come from creatures: `wyrmscale` (4 from a dead magma wyrm, worth 80 each), `hollow_ichor` (1 from a dead hollow stalker or the Hollow Maw, worth 60), `spider_venom` (1 from a dead giant cave spider, worth 20) and `ember_gland` (1 from a dead ember newt, worth 25). A hollow crawler leaves none. The items are in [items.md](../03-content/items.md) § Medical and herbs (`medical/wyrmscale`, stack 10; `medical/ichor`, stack 5; `medical/venom`, stack 5; `medical/gland`, stack 10; all in bags), and each is made of the material that shares its id ([materials.md](../03-content/materials.md) § Rune).

A species row has an optional `remains: { item, count }[]` ([creatures.md](../03-content/creatures.md) § Remains). In `items/index.ts`, the `CreatureDied` branch (a summoned species leaves no corpse, and so no remains), after the carried items: each is spawned at the death tile, in the material of its own id, with `ItemFlag.Foreign`, and added to the corpse's `wornItems` (13 § Corpses). The `strip_corpse` job recovers them as it recovers worn gear, since it runs on any non-dwarf corpse with worn items, and that clears `foreign`; until then they count for nothing. A corpse that rots first drops them on its tile, still foreign, as it drops worn gear. No rng. The content check fails a remains item with no material of its id.

Each feeds the laboratory or the runeforge: a wyrmscale makes 2 draughts of wyrmblood or a `wyrmhide` piece; an ichor renders to 6 vials, makes 2 draughts of hollowsight, a `hollowbane` weapon or a `hollowsight` helm; a venom makes a `venomed` weapon; a gland makes a weapon of embers for 4 vials. The hardest fights leave the stone for the next one.

### Deepsilver

Working deepsilver wakes the Hollow as mining it does. In `WorkshopOperator.complete`, at a building tagged `rune_work`, every consumed input whose metal has a positive `runePressure` ([minerals-and-metals.md](../03-content/minerals-and-metals.md) § Metals; deepsilver 10, the same as one mined tile, *unmeasured*) emits `DeepsilverWorked { amount: units × runePressure, tile }`, `tile` the building's origin; its material is read before it is consumed. A quench, a `deep` setting, a staff shod in deepsilver and a deepsilver circlet each raise the pressure by 10. A forge, a smelter or any other building raises nothing: melting a deepsilver item or forging a deepsilver axe wakes nothing more.

18 handles it (18 § The Deep): the pressure rises by `amount` through `addDeepPressure`, which `DeepsilverMined` also goes through, so the thresholds, `DeepStirred` and the emergences act as for mining. With no deepsilver tile mined yet (the bar was bought), the building's tile becomes the emergence base, so the Hollow comes up beside the workshop.

The deepsilver confirmation (`c_deepsilver`) says so: "Working it at the runeforge or the laboratory wakes the Hollow too."

### Hexers

`gloam_hexer` ([creatures.md](../03-content/creatures.md) § Gloam): humanoid, size 50, speed 0.165, punch `blunt` 5 size 3, faction `hostile:gloam`, opens doors, flees below 50% blood, `G` in `hostile`. Role `hexer`.

- **Who comes** (`threats/parties.ts`). On top of a party's size, like the captain: one hexer in a raid and two in a siege (`HEXERS_PER_RAID`, `HEXERS_PER_SIEGE`), at peril 3 from year 3 and at peril 4 from year 2 (`HEXER_FIRST_YEAR`; 18 § Tuning constants). `hexerCount(kind, peril, year)` gives the number and `calculatePartyComposition` takes the `year` (`arriveParty` passes the year of its tick). Hexers are planned after every other member, so the others arrive on the tiles and draw the gear they would have without them. At peril 2 and below, in an ambush or before the year, none come and nothing new is drawn.
- **Kit** (`threats/gear.ts`). The tier's `hexer` kit ([threat-schedules.md](../03-content/threat-schedules.md) § Hostile gear by tier): a wand set with amethyst, a dagger, a cap and a leather jerkin. A hexer whose entity id is a multiple of `DREAD_HEXER_EVERY` (`carriesDread`; 18 § Tuning constants) takes the `hexerDread` kit instead, the same with a sapphire: a dread hexer. The choice reads the id and draws nothing. The kit is fixed: every row is taken and nothing is drawn for it, so 18's stream runs as it would with no hexer. A kit row may name a `stone`, written on the item after it is spawned, as a runeforge writes a channel's. A wand is of oak, by the branch that bows and clubs use. Skills are any member's, `2 + HOSTILE_SKILL_PER_TIER × gear tier`, `runecraft` too: 8 in a raid at peril 3 or 4, 10 in a siege.
- **Rune** (`threats/parties.ts`, after the equipment): `Rune { current: HEXER_RUNE × 1000 }`. It carries no vials, so `drinkVial` does nothing for it, and its rune never comes back (§ Rune of one's own); `magic.rune` gives it a regen of 0, so the look panel reads "+0 an hour; never full".
- **Targets** (`threats/ai.ts` `shootsFromRange`): the `hexer` role counts as an archer. It prefers a soldier, and while its party loiters it shoots at what it can see but not reach.

Casting is the ordinary loop: `canCastBolt` holds for any holder of a `Rune`. An oak wand of frost has power 0.7: twenty bolts of 6 `frost`, range 8, each that wounds slowing by 50% for 210 ticks; then the wand is a club. A hexer holds its bolt while a creature of its own faction stands on the line, an archer or a warrior, and throws at another target or waits, unless it is careless this time (runecraft 8 in a raid: one weighing in ten; 10 in a siege: never; § Casting); where its line of sight is blocked it walks on toward its target, as an archer does. Hexers hold only `amethyst` and `sapphire`: never a glowstone, since a Call always brings a fortress summon.

**A dread hexer.** An oak wand of dread has power 0.7: Dread for 280 ticks, range 4, 2 rune a cast. It holds `CASTER_HOLD_DISTANCE` from its target, as any caster whose spell is no bolt (§ Casting), and casts when two of the fortress's creatures stand within 4 in its line of sight, at most once while its last Dread lasts; between casts it stands, and it clubs what reaches it. Its rune lasts ten casts. Up to `DREAD_MAX_TARGETS` dwarves, soldiers on duty or civilians, run from it for 280 ticks and come back (10 § Behavior selection, Dread). A fled soldier is out of the fight for a while and is hit at +10 with no parry or block (16's `isFleeing`); a `calm` piece (§ Enchantments in combat) keeps its wearer in the fight. A hexer's `RuneSpent` is not emitted (§ Spells): its rune never comes back, and the moment it closes to club is plain on the map.

The wand is `foreign`, as all hostile kit is, and becomes fortress stock only through `strip_corpse`. `scoreWeapon` gives a channel −1, so only a squad member with `runecraft` claims it: a common oak wand of frost.

Measured ([hexers measured](../../reports/audits/2026-11-04-t479-hexers.md)): against six Novice soldiers in full iron kit in the open, a peril-4 raid of ten wins 23 of 24 fights with no hexer and 21 with one or two; a hexer casts in 9 fights of 24, 3.3 bolts a fight, mostly waiting while a warrior stands on its line, and never hits its own side. In five seeds of the three-year file at peril 4, the same code with and without hexers: 86 dwarf deaths and 132 living at year 3 with them, 77 and 191 without; 29 hexers cast 50 bolts and killed one dwarf, and one fortress more fell, two days after a year-2 siege with two hexers. In the fortress a hexer casts as rarely as the archers shoot: most raids loot outside a locked gate.

### Trade and value

The Mountainhome's extra goods (`caravan-goods.md`) include rune vials, 5 to a good, permille 400 (*unmeasured*), at reputation ≥ 50; the extra goods are drawn outside the weighted pool on stream 25 (20 § Caravans), so the ordinary goods do not change, and a request finds the row only at the reputation it needs. The Mountainhome values `medical/vial` and `medical/draught` at 150 (`caravan-goods.md` § Preferences). The Wildwood count a channel, a wand or a staff, as a wooden item whatever its shoe (20 § The session, `tradeClass` in `trade/valuation.ts`): it takes their offence, −2 reputation for each offered, and their wood price, 20%. No civilization values "enchanted" separately: `preferencePercent` reads category and material, and an enchanted item's value is already higher.

### Morale

The thoughts are rows of `personality-and-thoughts.md`, each with a case in `morale/thoughts.ts` `eventPredicate` and `eventTargets`. `attuned`, `singed`, `first_runecaster`, `warded`, `mended_by_rune`, `eased`, `summon_turned`, `rune_sick`, `dosed_again`, `saw_wisp`, `lab_stink` and `put_to_flight` are there (Work and skill; Pride and relief; Social and comfort; Loss and fear): `attuned` matches an `AttuneSession` whose `mishap` is empty, `first_runecaster` and `summon_turned` go to everyone (each event has its own announcement), `eased` matches a `DraughtDrunk` with `calm` (half its value with `again`), `dosed_again` one with `again`, `rune_sick` a `VialDrunk` with `sick`, and `warded`, `mended_by_rune`, `eased`, `dosed_again` and `rune_sick` go to the dwarf the event names. `put_to_flight` ("Fear took my legs, and I ran.", −2 for 12 hours) matches every `PutToFlight` and goes to the dwarf put to flight. `saw_wisp` matches `WispAppeared` for every dwarf within 8 tiles of its `tile` in line of sight, as `saw_death` does, at most once a day; `lab_stink` is given on a move (§ Draughts, Spoiled batch).

Every value sits inside the caps. Nothing here can take a fed, rested dwarf below 20.

## State

The rows are in `schemas/components.md` and its ownership table, from which `id-fields.ts` is generated (an optional `Idx` field, `stone?`, is named without its mark). `Rune`, `Spellbound` (with `effects` and the draught rests), `Squad.equipment.draughts`, `Item.stone`, `Item.enchant` (with its `ItemEnchant` record), `WorkOrder.targetType`, `Projectile.spell` and `spellPower`, `MagicState` (in `schemas/system-state.md`, with `lastMishaps`, the last mishap of each sanctum for its panel, `pendingBlooms` and `bloomAlertsToday`), `HealthState.stunnedUntil` and `Summoned` are there.

```ts
interface Rune {                 // owner 25; also written by 18 for hexers
  current: number;               // milli-rune
  vialsToday?: number;           // vials drunk today; DayPassed clears it
  nextDreadTick?: Tick;          // Dread waits until this tick
  outAnnounced?: boolean;        // RuneSpent given; regen over the cost clears it
}
interface ActiveEffect { kind: string; value: number; until: Tick; sourceId: EntityId }
interface Spellbound {           // owner 25
  effects: ActiveEffect[];
  lastDraughtTick?: Tick;        // the last draught, kept while DRAUGHT_REST_DAYS last
  lastCalmTick?: Tick;           // the last calming draught, kept while CALM_REST_DAYS last
}
interface Summoned { summonerId: EntityId; fadesAt: Tick; turnedFrom?: EntityId }   // owner 25; summonerId 0 for a loose wisp or a turned shade; turnedFrom a turned shade's caster

// additions to existing components
Item.stone?: Idx<'MaterialDef'>
Item.enchant?: { id: Idx<'EnchantDef'>; tier: Quality }
Projectile.spell?: Idx<'SpellDef'>
Projectile.spellPower?: number                                // the channel's power in thousandths
WorkOrder.targetType?: Idx<'ItemTypeDef'>
Squad.equipment.draughts?: string[]                           // draught item ids, in the order drunk

interface MagicState {           // system 25's serialize(); schemas/system-state.md
  stateVersion: 1;
  sessionsToday?: [EntityId, number][];
  firstRunecasterDone?: boolean;
  lastMishaps?: [EntityId, { kind: string; dwarfId: EntityId; tick: Tick }][];
  pendingBlooms?: { tile: TileIndex; at: Tick; casterId: EntityId; raw: number }[];  // in cast order
  bloomAlertsToday?: EntityId[];  // casters whose bloom caught one of their own today, ascending
}
HealthState.stunnedUntil?: [EntityId, Tick][]
```

The system: `MagicSystem` in `src/systems/magic/index.ts`, `id '25'`, `order 25`, cadence 1, phase 0, added to `HeadlessGame.standardSystems` last. It implements `MagicApi` (`addBloom`) and installs itself as `world.services.magic` at `init`. Its tick does nothing unless a bloom of `pendingBlooms` is due, and returns at once when it is empty; due blooms bloom in cast order. Rng: `ctx.rng` is `world.rngFor('25')` in its own hooks; `magic/cast.ts`, called from 16's tick, uses `ctx.world.rngFor('25')` by name. The stream is saved in the `rng` section, not in `MagicState`, since 20 draws on it too.

## Interfaces

The `interface:check` script compares this section with the code.

### Reader

- `magic.rune(id)` — current, max and regen in milli-rune, the metal percent and the pieces that lower it, the robe percent and the circlet bonus, whole hours to full (0 full, −1 never), the vials carried and the vials drunk today; undefined without a `Rune`
- `magic.sanctums()` — sanctum zones, ascending; `magic.apprentices(zoneId)` — its living adult apprentices, ascending; `magic.sessionsToday(id)`
- `magic.mishapPermille(zoneId, id)` — the mishap chance of this dwarf's next session there; `magic.lastMishap(zoneId)` — kind, dwarf and tick of the sanctum's last mishap, or undefined
- `magic.canCast(id)` — the creature holds a channel whose spell its rune pays for now; `magic.spellOf(itemId)` — the spell in a channel and its numbers (cost, range, damage, type, ticks, power, suffix), or undefined
- `magic.effects(id)` — the creature's unexpired timed effects
- `magic.summonsOf(id)` — the living summons this caster called, ascending
- `magic.enchantOf(itemId)` — an item's enchantment: its row, suffix, tier and effects at the tier; undefined for none
- `magic.draughtRest(id)` — ticks until the creature may take a draught again, 0 when it may now

### Commands

`SetSanctumApprentices { zoneId, dwarfIds }`.

### Events consumed

`HourPassed` (regen, which also ends a caster's `RuneSpent` silence; expired effects and draught rests; fading summons; the producer's hourly look), `DayPassed` (sessions, `vialsToday`, the day's bloom alerts, the calming draughts' look), `SkillLevelUp` (the `Rune`, `FirstRunecaster`), `CreatureDied` (a caster's summons fade), `ZoneChanged` (sanctums), `RaidArrived` and `AmbushSprung` (the `raid` draughts), `AttackResolved` (the `wounded` draughts), `DeepStirred` and `MonsterEmerged` (the `deep` draughts), `ThreatNearby` (the `fire` draughts).

### Events emitted

`AttuneSession { id, xp, mishap }`, `Mishap { id, kind, buildingId?, tile? }` (also a `blaze` hit's fire, with the attacker as `id`), `CreatureStunned { id, until }` (a blackout; a Daze), `FirstRunecaster { id }`, `SpellCast { casterId, spellId, targetId, tile, burned }` (every cast, from 16's loop through `cast.ts`, with `burned: false`; a bloom that caught one of the caster's own, with `burned: true`), `RuneSpent { id }`, `VialDrunk { id, sick }` (a desperate fourth vial: 15's `rune_sick`), `Warded { id }`, `Mended { id, casterId }` (a Mend; a draught of mending, its giver or 0), `DraughtDrunk { id, draughtId, calm, again }`, `SummonCalled { id, casterId }` (24's milestone), `SummonTurned { id }` (18, 15), `SummonFaded { id }` (17), `WispAppeared { id, tile }` (15's `saw_wisp`), `PutToFlight { id, sourceId }` (a Dread or a fearsome blow that sent a creature running: 15's `put_to_flight`), `SpellBloomed { casterId, tile }` (the compositor's flash), and 16's `DamageDealt` (a mishap's light burn, `attackerId` 0; a bloom, through `resolveProjectileHit`).

### Registrations

Job producer `magic` (`attune`, `give_draught`); inspector sections `creature › rune` (with the channel line), `zone › sanctum` (the sanctum panel, in 14's zones panel) and `item › stone`; announcements: `Mishap` (note for `singed`, `blackout`, `surge`, `wisp_loose`; alert for `scorched_circle`, `fire`, `blaze`), `FirstRunecaster` (note), `SummonTurned` (danger), `StoneSet` (note, a masterwork setting only; 12 emits it), `RuneSpent` (note; a fortress caster's only), `SpellCast` with `burned: true` (alert: "Urist's firebloom caught Tova."). Service `world.services.magic` (`MagicApi.addBloom`).

## Player-facing behavior

- **Glyphs.** Wand `'`, staff `⌠`, vial `¡`, rune circle `○`, all `rune_cyan`. Draught `!`, in the color of its row. Wisp `*`, warden `Φ`, shade `δ`. A hexer is `G`. All are in CP437, so `font-additions.json` holds none of them. A warded creature's glyph has a dimmed `ward_cyan` background (`render/compositor.ts`, step 6), unless the attack flash is showing.
- **Firebloom flash.** When a bloom blooms, 25 emits `SpellBloomed { casterId, tile }`, and the compositor shows the 3×3 around the tile in `ember_orange` for the animation frame it arrives in, over light and dark (after step 9). Render only: nothing is saved.
- **Glowing light.** A creature that wears a piece with a `light` effect (a `glowing` stone), and is not a hidden hostile, lights the 3×3 around it on its level in the view: the background of its own tile is `glow_core`, of its eight neighbours `glow_halo` (dim shades of `rune_cyan`; `glyphs-and-colors.md` § Palette). The compositor gathers the wearers once a frame and tints the cells beneath step 6, so the creature's glyph, the attack flash and a ward still show on top, the step 8 overlays still tint over it, and step 9 dims it on the surface at night like any ground. Render only: nothing is saved, and with no wearer no cell changes.
- **Sanctum panel**: the selected sanctum's inspector in the zones panel (zone type key `[S-c]`, `ui-screens/panels.md` § Zones). The room's tier, score and missing circle; the glowcap in stock; the mishap chance in words for a new apprentice ("one session in 17"); each apprentice with level, rune and sessions left today, and its own chance; the last mishap. `[S-o]` opens the apprentice picker, which adds or removes one adult dwarf at a time through `SetSanctumApprentices`.
- **Inspector, `creature › rune`**, in the look panel's creature tab (each of these lines, and a channel's or an enchanted item's line on the Tile and Items tabs, wraps under its prefix in the panel's width, so it is read to its end): "Rune 31/50, +0.6 an hour (iron helm -20%, iron mail shirt -20%); full tomorrow", and under it the held channel: "Channel: iron staff of embers (fine). Emberbolt: 24 ember, range 12." A Frostbind adds ", slows by 50% for 360 ticks"; the other spells read by their kind ("Ward: 5 armour on every part for 720 ticks, range 3."). Under them, for a caster with vials or one that drank today, "Vials: 2 carried, 1 of 3 drunk today.", and for any creature under timed effects, "Under: ward 5 (340 ticks), slowed 50% (120 ticks)." (each kind has a key `ui.look.effect.<kind>`), and while a draught rest lasts "Can take a draught again in 2 days." (whole days begun; "tomorrow" for the last). A caster's summons and a summon's caster are named under them (§ Summons, Inspector).
- **Look cursor**: a channel is named with its spell's suffix, "1 iron staff of embers (fine)", then its value, and the line under it reads "Emberbolt: 24 ember, range 12. Needs a runecaster." An enchanted item carries its suffix, "1 steel axe of embers (fine)", and a dim line gives its effects at its tier: "+9 ember on a hit.", or for a venomed blade "A hit stings for 20 pain for 300 ticks."; a creature under the venom reads "Under: venom, pain +20 (240 ticks)."
- **Squad panel**: under the gear, "[S-d] draughts: draught of stoutness, draught of quickness"; `[S-d]` opens the checklist of every draught a soldier drinks, each with its place in the list, and under it the selected draught's trigger in words ("Drunk when a raid or an ambush arrives.", "Drunk when hit while below half blood."), and `Enter` adds the row at the end of the list or takes it out (`SetSquadEquipment`). The draughts line wraps under its caption. A member who can use the channel it holds (`runecraft` 1 or more) has the channel's glyph after its name in the members line: "Tova E. ⌠".
- **Orders panel**: a transform recipe offers the target type (`set in: any`, stepped by a click) and the material, and is `once` only.
- **Hints** (`hints` rows in [ui-keymap-and-screens.md](../03-content/ui-keymap-and-screens.md) § Hints, each shown once when its stock or building first appears: glowcap seeds, a runeforge placed, a runeforge built, a wand or a staff, a sanctum, a dwarf with rune of its own, a draught; and once a hungry dwarf eats a raw plant while a draught brewed from plants is ordered, how to keep the next harvest for the laboratory): "Glowcap grows in the dark under a glowstone lamp." "A staff is a stone on a stick: the stone is the spell, the dwarf is the fuel." "A wand is quick and soft; a shod staff is slow and hard." "Build the sanctum in stone." "Iron drinks the rune: a runecaster in mail recovers slowly." "The runeforge burns vials, not coal." "One draught, then three days' rest." "Hungry dwarves ate the plants a draught was waiting for. Order the draught before the crop ripens, and its job takes the first of the harvest."
- **Legend milestones** (`milestones` rows and `legend/index.ts`), each awarded once ([ui-keymap-and-screens.md](../03-content/ui-keymap-and-screens.md) § Milestones): `m_stone_set` on the first `StoneSet`, `m_runecaster` on `FirstRunecaster`, and `m_summon`, "A summoning was answered.", on the first `SummonCalled`; a shade that comes through turned answers nothing.

## Tuning constants

All *unmeasured* unless the row says what was measured. They are in `src/systems/magic/constants.ts`.

| Name | Value | Meaning |
|---|---|---|
| `RUNE_PER_LEVEL` | 5 | Rune maximum per level |
| `RUNE_REGEN_PER_LEVEL` | 0.1 | Rune per hour per level; measured: a level-10 runecaster fills in 50 hours in a tunic and 84 in an iron helm and mail |
| `METAL_RUNE_PENALTY_PERCENT` / `METAL_RUNE_FLOOR_PERCENT` | 20 / 20 | Per worn metal piece; floor |
| `SANCTUM_APPRENTICES` | 4 | |
| `ATTUNE_TICKS` / `ATTUNE_XP` / `ATTUNE_SESSIONS_PER_DAY` | 300 / 25 / 2 | Measured: Proficient at two sessions a day from Wits 50 in 73 days and 145 glowcap |
| `MISHAP_BASE` / `MISHAP_FLOOR` | 60 / 10 | Per mille a session, less 2 per level and 1 per tier; measured: 61 mishaps in 1,000 level-0 sessions in a bare sanctum |
| `MISHAP_BLACKOUT_TICKS` / `MISHAP_SURGE_RADIUS` | 200 / 3 | |
| `FROSTBIND_SLOW_PERCENT` | 50 | |
| `CASTER_HOLD_DISTANCE` | 4 | A caster whose spell is no bolt, with the rune for it, stands this far from its target |
| `CASTER_VIALS` / `VIAL_RUNE` / `VIALS_PER_DAY` / `DRINK_TICKS` | 3 / 5 / 3 / 30 | |
| `SICK_VIAL_PERCENT` | 50 | A desperate fourth vial's share of `VIAL_RUNE` (§ Vials) |
| `FIREBLOOM_DELAY_TICKS` | 20 | Between the cast and the bloom |
| `DREAD_MAX_TARGETS` | 4 | |
| `RESIST_NO_ATTRIBUTES_PERCENT` | 25 | |
| `MENTAL_IMMUNE_SIZE` | 180 | |
| `ENCHANT_CLAIM_BONUS` | 0.5 | Added to a claim score |
| `DRAUGHT_TICKS` | 1200 | One day, times the quality multiplier |
| `DRAUGHT_REST_DAYS` / `CALM_REST_DAYS` | 3 / 7 | Any draught's rest; a calming draught within the second of the last eases by half and gives `dosed_again` |
| `ALCHEMY_MISHAP_PERMILLE` | 100 | Per job, less 10 per level |
| `SUMMON_TICKS` / `MAX_SUMMONS_PER_CASTER` / `SHADE_TURN_PERMILLE` | 1200 / 2 / 50 | A summon's day; summons a caster holds; turning per mille. Measured: 50 turned in 1,000 castings of a deepsilver staff |
| `DEEP_DRAUGHT_LEVEL` | 2 | The Deep's level from which its stirring and emergences make soldiers drink the `deep` draughts |
| `HEXER_RUNE` | 20 | A hexer's rune at arrival; measured: in the open it never spent it, at peril 4 its party wins as often with it as without, within noise ([hexers measured](../../reports/audits/2026-11-04-t479-hexers.md)) |

## Acceptance

The rules above are pinned by the tests named beside them, and together by these:

- The scripted fortress `pp_runecraft` plays the whole loop by commands from a Miner's Guild embark: two glowstone lamps over a glow plot of glowcap, a laboratory distilling vials and brewing draughts of stoutness, a sanctum where one apprentice attunes to Dabbling, a runeforge that makes an iron staff of embers and sets a garnet in an iron axe, and a squad of the two carrying the draught. At a raid the apprentice throws an emberbolt from the staff it made and a soldier drinks the draught, on both of its seeds.
- A glowcap on a dark tile under a lamp grows. With the lamp removed, or on a lit tile, it does not. No dwarf eats or cooks one.
- A glowcap on a dark tile with no lamp grows while a creature wearing a `glowing` piece stands on its 3×3, and stops when the wearer walks on; the tile keeps its `lit` bit, has no lamp coverage, and a cave plot under the wearer stays a cave plot.
- Two glowcap make one vial. A dwarf with no `runecraft` never claims a channel and casts nothing.
- A Dabbling apprentice with 5 rune and a wand of embers casts five bolts, then clubs.
- The worked numbers above hold exactly.
- A Proficient runecaster at 0 rune reaches 50 in 50 ± 2 hours in a tunic, 34 in a robe, 84 in an iron helm and mail.
- Level 10 at two sessions a day takes 74 ± 3 days and 148 ± 6 glowcap at Wits 50. Over 1,000 level-0 sessions in a bare sanctum, mishaps number 60 ± 15, and none is a death, a lost limb or a stockpile item.
- A ward lapses at 420 ticks from a wand and 720 from an iron staff. A warded squad of six at the measured peril-2 raid loses less blood than an unwarded one.
- Dread sends at most four running and they come back. The party's retreat counter does not move. A dread hexer's Dread sends at most four dwarves running, and they come back; a dwarf in a `calm` piece is never sent; a dwarf of Willpower 0 never resists, one of Willpower 100 half the time.
- Firebloom is never thrown while a fortress creature stands in the square.
- A soldier who drank stoutness drinks nothing else for 3 days, and a medic gives them none.
- An enchanted axe keeps its stone through drop, haul, claim and save. A staff keeps its stone through the same. Melting follows the ordinary formula and returns bars or nothing, never a stone.
- 50 ± 15 shades turn in 1,000 castings.
- A hexer casts until its rune is gone, then closes to melee.
- The same seed and command log give the same mishaps, resistances and shades. An older save loads with no rune, no enchantments and no sanctums, and every skill and material it had is still right.
- `pp_defence` on one seed gives the same result, with the same draws, with this code and no runecraft in play.

## Extension points

- More stones: a row in `spells` and `enchants`.
- A sanctum chest: the zone setting and 13's hospital rule, if attunement ever needs to be supplied in place.

## Planned: Making Do

Not yet in the game. The block below names the task that builds it; that task moves it into the sections above and deletes it here, and this section with it.

### Settings at another workshop (T-NEW (scale))

The `enchants` table gains an optional `workshop` column (`weapons-and-armor.md` § Enchantments). A row that names one has its `set_<slot>_<id>` recipe generated at that workshop with that workshop's skill, not at the runeforge with `runesmithing` (12 § Planned, Fletching at the bowyer). `fletched` (ammo, stone `feather`, 0 vials, `to_hit` 5, workshop `bowyer`) is the one such row. "seeking" (emerald, +10) stays the rune version. Every rule of § Setting stones holds: one enchantment per item, transform, `once` orders, value by the stone and the vials.
