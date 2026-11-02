# 25 Runecraft

**Owner:** `systems/magic` · **Depends on:** [07-plants-and-farming.md](07-plants-and-farming.md), [10-dwarves.md](10-dwarves.md), [11-jobs-and-labor.md](11-jobs-and-labor.md), [12-workshops-and-professions.md](12-workshops-and-professions.md), [13-items-and-storage.md](13-items-and-storage.md), [14-buildings-and-rooms.md](14-buildings-and-rooms.md), [15-happiness-and-morale.md](15-happiness-and-morale.md), [16-combat.md](16-combat.md), [17-health-and-medicine.md](17-health-and-medicine.md), [18-threats-monsters-and-raids.md](18-threats-monsters-and-raids.md), [20-trade-and-caravans.md](20-trade-and-caravans.md)

## Purpose

Treat magic the way the game treats metal. Rune is a substance. It grows in a fungus, is distilled at a workshop, is carried in vials and is spent. A staff is a stone on a stick. A runecaster is a dwarf who sat in a stone room with a sack of mushrooms and came out able to hold a little rune.

Three limits hold everywhere:

- **The player never casts.** They choose the stone on the staff, who sits in the sanctum and what a squad carries. The dwarf casts by rules the player can read.
- **Nothing is necromancy.** No raising, no undead, no curses, no vampires, no mind control. A summon is a light, a stone or a shadow, and it fades.
- **Magic trails steel.** A deepsilver axe out-damages the best staff. Runecraft's worth is reach and utility.

A fortress that never touches runecraft plays as before (§ What no runecraft means).

## How to read this document while it is being built

The rules here are the whole design. A later task needs nothing else.

- Every table row and rule block carries the task that brings it in (**Task** column, or `[T-470]` at the head of a rule). Code that belongs to a later task does not land early.
- **Content rows live here until their task.** `content:check` compares `src/content/*.json` byte for byte with an export of the `03-content/` tables, so a row in `03-content/` without its JSON fails. Each task moves its rows to the named `03-content/` file, runs `npm run content:export` and commits both.
- **Schemas live here too.** `schemas/components.md`, `event-catalog.md` and `command-catalog.md` generate code (`scripts/parse-catalogs.mjs --write`, `scripts/parse-id-fields.mjs`) and tests fail on drift. Each task moves its rows there, and into § Interfaces below, in the same commit as the code.
- The last task (T-477) removes these marks and this section, so the document reads as plain specification.
- Every number here is *unmeasured* until a task measures it and says so in the row.

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

These hold for all tasks, and each task's review checks them.

- **No new rng draw on any existing stream** unless a channel, an enchanted item, a draught or a hexer is in play. All casting rolls that are not 16's ordinary hit, block and part rolls draw on system 25's stream, `world.rngFor('25')`. That stream is the design's `magic` stream. Streams are named by system id. 25 takes its stream at init, so the save's `rng` section always holds the key `25`; an older save without it starts the stream from the seed. With no sanctum session, nothing but 20's caravan extras draws on it; a Call draws only for a species that `turns`.
- **No existing number moves.** The wyrm's breath keeps today's damage type `burn`, which has no row in the layer table and so multiplies by 1.0. Spells and enchantments use the new types `ember` and `frost` (§ Damage types).
- **New rows do not renumber old rows** (§ Row numbering). A world hash may move because `Skills.level` grew by a byte. It does not move because anything played differently. A task whose content rows move a golden names this in its `golden:` line and shows the annual instrument row unchanged, apart from the deliberate moves below.
- **Caravans.** Runecraft goods are drawn outside the weighted pool (§ Trade and value), so the ordinary goods of a caravan do not change.
- **Wild patches.** A separate pass with its own stream converts some cave shrubs (§ Glowcap). The main terrain stream draws the same numbers. The local-map golden moves once, in T-468. Only a tile that was already a cave shrub changes.
- **Deliberate moves.** Three changes do move numbers with no runecraft in play, and each task runs the annual instrument and explains the move:
  - **Hexers** move raid outcomes at peril 3 and 4 (T-479, which measures it). Peril 2 and below see none.
  - **Converted shrubs** take 10–25% of cave shrubs from their forage (T-468). The annual instrument gathers no cave shrub and plays one year, before the first Mountainhome caravan, so it shows neither this nor the extra goods: its row stayed 12.5/7/11/149/7/0/0.
  - **`remains`** give a dead wyrm or stalker worn items, so a `strip_corpse` job appears and recovered items add wealth and renown (T-476, which names a `golden:` line).

## Rules

### Row numbering

**Task:** T-478. Without this, the first new row corrupts every save.

The loader numbers rows sorted by id (`content-pipeline.md` § Loading step 4, `makeTable` in `core/registry.ts`). Numeric indices are saved in places that the id conversion does not reach: the `map.material` grid, `Skills.level` and `xp` (positional), `Labors.enabled` (bit position), `JobsState.laborPriorities`, job input filters, zone crop settings and other system states. A new material or skill that sorts into the middle of its table shifts all of them. An old save then loads under the soft match with its rock, skills and labors silently wrong.

The rule: **rows added after version 1 number after every older row.**

- New table `rowOrder` in new file `03-content/row-order.md`: columns `table`, `id`. Rows named there number after all unnamed rows of their table, in the order listed. Unnamed rows keep sorted order, numbered from 1. The rows of a new table are listed too, so a later row of it cannot shift them.
- `src/content/loader.ts` step 4 passes each table's list to `makeTable(name, rows, appended)`. `ids()`, `where()` and `rows` follow the same order, so a pick from an old list stays as it was, as long as the new row stays out of that list. `metal()` in `terrain/generate/traits.ts` picks from every weapon and armor row whose materials include `metal`; it skips rows with a launcher and no `ammo`, and rows with a `rune` property, so `old_battlefield` maps keep their arms.
- Schema: `list({ table: nonEmptyStr, id: nonEmptyStr })`; a listed id must exist in its table after `applyGenerated`, so a generated plant material (`glowcap`) is listed in `materials` too. New `exportRowOrder` in `scripts/lib/export/`.
- `test/fixtures/content-row-baseline.json` holds every table's ids at this commit, and is never edited. A test asserts that each keeps its index for good. A new row not in `rowOrder` fails it, and fails `content:check` (`scripts/lib/row-baseline.mjs`), with the line to add. `rowOrder` is not in the content hash, because the index order already is.
- On load, positional arrays shorter than the table are grown with zeros: `Skills.level` and `xp` in `restoreEntities` (`app/game-save.ts`), `Labors.enabled` likewise. `combat/melee.ts` `getSkill` otherwise reads `undefined` and returns `CREATURE_BASE_SKILL`. `laborPriorities` needs no growing: `JobBoard` starts every labor at the default priority and its `deserialize` overwrites only the saved length.
- New labors stay off for the dwarves of an older save, except as § The sanctum says. New dwarves get them on (`CoreSpawn.labors`).

**Save format, for all tasks.** `formatVersion` stays 1 and every `stateVersion` stays 1. New component fields and new state fields are optional; absent means none, as `threatThrottles` and `Hostile.retreat` do. System 25 with no saved entry keeps its initial state (`World.deserializeSystems` already skips it). Components are saved by table, so they need no code. No task needs a migration. A task that adds a field to `Item` or `Rune` adds an old-save test.

### Damage types

`DamageType` in `core/types.ts`, `DAMAGE_TYPES` in `content/schema.ts` and the separate `DAMAGE_TYPES` in `scripts/lib/export/creatures.mjs` hold `ember` and `frost` beside the three steel types. The last matters: `parseAttacks` silently drops an attack it cannot parse, and `content:check` still passes. `ember` is rune fire; its wound is a `burn` (`health/wounds.ts` `woundTypeFor`). `frost` is a wound type of its own. Natural melee attacks in `resolveMelee` accept `ember` and `frost` alongside the three steel types (other strings still fall to `blunt`, as the wyrm's adjacent breath does).

The layer table, with its `ember` and `frost` rows and its `ward` column, is in [weapons-and-armor.md](../03-content/weapons-and-armor.md) § Damage type versus layer; the `DAMAGE_VS_LAYER` constant in `combat/melee.ts` holds the same numbers, and a test compares the two. Mail is a poor answer to rune, plate a fair one, a ward the best. A burn bleeds little (`BLEED_TABLE`), so an ember bolt wins by pain and by part damage, not by blood.

**`armorReduction(entities, registry, defenderId, part, type, tick, armorPercent?)`** in `combat/melee.ts` is the one place the armour sum is written (16 § Melee resolution): `resolveMelee`, `resolveProjectileHit`, `applyEnchantOnHit` and `combat/reader.ts` `armorValue` all call it. Natural armour belongs to a species, so a defender with no `Creature` has none. A `ward` effect is added there, on every part (§ Effects). `armorPercent`, a sundering weapon's share (§ Enchantments in combat), multiplies the whole sum, the ward and natural armour included; absent, all of it counts.

### Glowcap

Glowcap is built. Its rows are in `plants.md` (the crop, and `glowcap_patch` under § Rare cave patches), `items.md` § Medical and herbs (`glowcap`, `rune_vial`), `materials.md` § Rune and `glyphs-and-colors.md` (`rune_cyan`). The light rule and the `glow` plot are in 07 § Growth and § Farm plots, and the lamp is in 14 § Special buildings.

**Glowcap is its own item**, not `plant_food`. The `edible` and `cookable` columns of a plant are not read: `plant_food` is edible by its item row and is an `ingredient` by its tag, of any material. A glowcap in `plant_food` would be eaten and cooked. A separate item follows `fiber` and `brightleaf`.

### Workshops

A workshop needs a row in `workshops-and-recipes.md` § Workshops (the export makes its `buildings` row, category `workshop`; the `tags` column holds `rune_work`), a block in `glyphs-and-colors.md` § Workshop patterns, and for authored recipes a `RECIPE_SECTIONS` line in `scripts/lib/export/rules.mjs`. Labor comes from the recipe's skill.

The runeforge is built: its row is in `workshops-and-recipes.md` (1 `anvil` + 3 `stone_block` + 1 `cut_gem`, masonry, 300 ticks, no fuel, tag `rune_work`, corners impassable like a forge), with its § Runeforge, and its skill `runesmithing` (labor `smithing`, profession Runesmith) in `skills-and-professions.md`. Its authored recipes, the runed robe and the circlet, are in its table there, with the `RECIPE_SECTIONS` line `['Runeforge', 'runeforge', 'runesmithing', false, true]` in `scripts/lib/export/rules.mjs`; the wands, staffs and settings are generated (§ Channels, § Setting stones).

`runecraft` and its labor `attunement` (default on, not for children) are in `skills-and-professions.md`. These skills and `runesmithing`, like `alchemy`, have `no` in the `embark` column there, so the embark screen hides them and `SetSkill` refuses them. Immigrants cannot arrive with them: `immigration/waves.ts` draws from its professions table, which names none of them. Profession colors: runecraft and runesmithing with Metal (`prof_steel`).

More laboratory recipes (`workshops-and-recipes.md` § Laboratory holds the rest; the draughts are in § Draughts):

| id | name | inputs | outputs | ticks | Q | xp | Task |
|---|---|---|---|---|---|---|---|
| `quench_deepsilver` | Quench deepsilver | 1 `bar` (deepsilver) | 12 `rune_vial` (rune) | 250 | no | 12 | T-476 |
| `render_ichor` | Render ichor | 1 `hollow_ichor` | 6 `rune_vial` (rune) | 200 | no | 10 | T-476 |

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

| kind | weight | what happens | how | severity | Task |
|---|---|---|---|---|---|
| `singed` | 40 | a light burn on a random arm, already cleaned; thought `singed` | `DamageDealt { damageType: 'burn', amount: 1, attackerId: 0, clean: true }` | note | T-469 |
| `blackout` | 25 | unconscious for `MISHAP_BLACKOUT_TICKS` | `CreatureStunned` (§ Effects) | note | T-469 |
| `scorched_circle` | 15 | the circle is destroyed, no item back | `Mishap` carries `buildingId`; 14 handles it and removes the building with no yield | alert | T-469 |
| `fire` | 7 | the first tile cardinal to the circle, north, east, south then west, that can burn (05's `burnableTile`) ignites; else nothing | `Mishap` carries `tile`; 05 queues it for its next tick, as lightning | alert | T-469 |
| `surge` | 3 | every creature with a body within `MISHAP_SURGE_RADIUS` of the circle on its level (the larger of the two axis distances), in id order, takes a light burn; the session's xp is granted twice | as `singed` | note | T-469 |
| `wisp_loose` | 10 | the `call` spell's own summon, a wisp, appears wild beside the circle and fades in a day; the apprentice gets no thought | `looseWisp` in `magic/summon.ts` (§ Summons) | note | T-475 |

### Channels

The wand and the staff are in [weapons-and-armor.md](../03-content/weapons-and-armor.md) § Channels, with their item rows (`category: weapon/ranged`, stack 1, quality-bearing, slot weapon, no `weapon` tag; wand `'`, staff `⌠`, both `rune_cyan`).

A channel's row has `launcher: { range, power }` with **no `ammo`**: `ammo` is optional in the schema and in the `WeaponRow`, `WeaponDefRow` and `LauncherDef` types, and the export writes it only for a launcher that has one. "A launcher with no ammo" is what a channel is, and code tests that (`isChannelRow` in `magic/cast.ts`), never an id. A hunter's launcher is never a channel: 11's ranged kit takes only a launcher with ammunition.

**A staff's material is its shoe.** `Item.material` is the metal of the bar. There is no `Item.shoe`. So the ordinary material filter on a work order picks the shoe, value and melting work as for any metal item. A staff holds one bar, so like a dagger it melts to nothing: `workshops/operate.ts` computes `floor(1 × 60 / 100) = 0`. Do not change the melt formula. A wand's material is its wood.

`runeMult` is a metals column ([minerals-and-metals.md](../03-content/minerals-and-metals.md) § Metals): silver 1.3, deepsilver 1.6, steel 1.1, iron 1.0, bronze 0.9, copper 0.8, every other metal 0.7. A wooden item counts 1.0.

**`Item.stone`** (`Idx<'MaterialDef'>`, optional; absent is none) names the gem on a channel. `items/api.ts` `canMerge` compares it (and `Item.enchant`), and `split` keeps both. A channel whose stone carries no spell row casts nothing.

```
power(item) = launcher.power × runeMult(item.material) × QUALITY_COMBAT_MULT[item.quality]
```

Wand 0.7. Iron staff 1.2. Silver fine staff `1.2 × 1.3 × 1.1 = 1.716`. Deepsilver masterwork staff `1.2 × 1.6 × 1.5 = 2.88`.

**Recipes.** One wand and one staff recipe per row of `spells`, generated in `generatedRecipes` (`content/generate.ts`) as `smelt_`, `alloy_` and `melt_metal_item` are (`forge_*` are authored rows, not generated); [workshops-and-recipes.md](../03-content/workshops-and-recipes.md) § Runeforge gives `make_wand_<stone>` and `make_staff_<stone>`. Every generated row names workshop `runeforge` and skill `runesmithing`, here and for the `set_*` rows. A generated row numbers last like any other: its id is a line of `row-order.md`.

`RecipeOutput` has `stone?: { from: 'input'; index: number }`. `WorkshopOperator.complete` in `workshops/operate.ts` reads that input's material before the inputs are consumed and writes it after `spawn.item`, as it writes `memorialDwarfId`. `inputFilter` already points the order's material filter at the input the first output's material comes from, so the player picks the metal of a staff and the wood of a wand. No new order field.

**Who claims.** In `combat/equipment.ts` `reequipSoldier`, before the weapon loop: a member with `runecraft ≥ 1` claims the available channel with the highest `power(item)`, whatever the squad's preference, and drops the weapon it held at the barracks. Holding a channel, the weapon loop is skipped for them. With none held or in stock they fall through to the ordinary rule. `scoreWeapon` returns −1 for a channel, so no one else ever holds one. A two-handed staff takes the shield rule of any two-handed weapon; a one-handed wand keeps a shield. `kitTypes` already includes weapons. A channel's class is no squad preference: `SetSquadEquipment` refuses it (`bad_setting`) and the military panel does not offer it.

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

**Cast when** (a bolt, as Firebloom has its own): the caster holds the bolt while a creature of its own faction (for a fortress caster, any fortress creature) stands on a tile the bolt would cross before its target, the tiles of 16's projectile ray. It then throws at another target: the nearest creature hostile to it (distance, then id) that `canCastBolt` allows, in line of sight, with no ally on the line (`otherBoltTarget` in `magic/cast.ts`). With none, it waits where it stands and spends nothing. The check is made at the cast and draws nothing, so friendly fire stays real: an ally can step into the bolt's path after the cast, and a missed bolt flies on and can land on someone beyond its target. A burst or a single whose held target does not qualify throws, by the same search without the line, at the nearest other hostile that qualifies.

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
| Ward | caster has no unexpired `ward` effect | `ward` effect with `round(6 × power)` for `round(600 × power)` ticks on every creature of the caster's faction within 3 on its level, the caster too, `sourceId` the caster. One `Warded { id }` each. A wand's ward is 4 for 420 ticks, an iron staff's 7 for 720 |
| Mend | a creature of the caster's faction within 4, in line of sight, has a bleeding unbandaged wound, or is unconscious from wounds (pain or blood, not a stun) with a light wound to close. Nearest, then lowest id | `Mended { id, casterId }`. 17 handles it: every bleeding wound `bandaged`, light wounds removed with their hp back, the rest `cleaned` |
| Dread | two or more creatures hostile to the caster within 4 in line of sight, conscious, not immune and not already under a `flee` effect, and `tick ≥ Rune.nextDreadTick` | up to `DREAD_MAX_TARGETS` of them, nearest first then id, each after the resist roll: a `flee` effect for `round(400 × power)` ticks, `sourceId` the caster. Sets `nextDreadTick` to the tick the effect ends |
| Call | the caster has fewer than `MAX_SUMMONS_PER_CASTER` summons alive, the creature count is under `MAX_CREATURES`, and a tile beside the caster is free | the summon stands on that tile (§ Summons); `SpellCast`'s `targetId` is the caster |

By 16's ranged branch, with `canCastBolt` also true only when:

| Spell | Condition | Does |
|---|---|---|
| Firebloom | no creature of the caster's faction (for a fortress caster, no fortress creature) stands in the 3×3 around the target, on its level, at the cast | adds `{ tile, at: tick + FIREBLOOM_DELAY_TICKS, casterId, raw }` to `pendingBlooms`, through `ctx.world.services.magic` (the `CoreServices` entry `MagicApi`, installed by 25, like `combat`). At `at`, 25's tick calls `resolveProjectileHit` with `raw` and `ember` for every creature with a body in the 3×3 on that level, in id order, whatever its faction, with skill `runecraft`, drawing on stream 25. So shields block and armor counts. No hit roll. The delay is what makes friendly fire real: soldiers walk in while it blooms |
| Daze | target has `Hostile.role` `captain`, or species size ≥ 100, is conscious (a stunned creature is not) and is not immune | after the resist roll, `CreatureStunned { id, until: tick + round(150 × power) }`. No hit roll, no projectile |

**Resist** (Dread, Daze): `Willpower / 2` percent, `RESIST_NO_ATTRIBUTES_PERCENT` without attributes, drawn on stream 25 (`ctx.world.rngFor('25')`). Creatures of size at least `MENTAL_IMMUNE_SIZE` and every `deep` creature are immune: such a target does not qualify. Only fortress casters hold these two stones (§ Hexers), so no dwarf is ever mind-struck.

Announcements: `RuneSpent { id }` once a caster falls below its spell's cost, at the cast, until regen lifts it over the cost again (`Rune.outAnnounced`; a vial does not lift it). A bloom that catches a creature of the caster's faction emits `SpellCast { casterId, spellId, targetId: the lowest such id, tile, burned: true }`, announced as an alert, once per caster per day (`bloomAlertsToday`).

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

**Task:** `slow`, `ward` and `flee` are built; T-474 (draughts).

`Spellbound` component (§ State). `src/core/effects.ts`: `effectValue(entities, id, kind, tick)`, the largest value among unexpired entries of a kind, 0 if none, and `effortUnderEffects`, the step's effort below. 25 adds entries through `addEffect` in `magic/cast.ts` and, on `HourPassed`, drops expired entries and the component with them. Readers compare `until` with the tick, so expiry needs no tick of its own.

| kind | value | read at | Task |
|---|---|---|---|
| `slow` | percent | `core/movement.ts` `moveAlongPath`, on the step's effort after crowding: `× (100 − slow + haste) / 100`, truncated, at least 1; a game with no `Spellbound` (the store is empty) does no lookup per mover. Every creature, one place. 17's `speedModifier` is not touched | T-470 |
| `ward` | armor | `armorReduction`: `+ ward × damageTypeVsLayer(type, ward)` on every part, while it lasts at the tick of the hit | T-473 |
| `flee` | 1 | `CombatSystem.tick`, after the conscious check (`stepFled` in `combat/fled.ts`): while it lasts the creature keeps its target, does not attack, and walks to the tile `FLEE_EFFECT_TILES` from the source of its latest `flee` entry, through itself, clamped to the map and stepped back toward it to a tile a walker can stand on; with no such tile or no path, to the nearest tile of its party's arrival edge (`getNearestEdgeTile`); a creature of no party then stands. A source with no position counts as the held target. `isFleeing(entities, id, tick)` counts it (+10 to hit, no parry, no block). 18's member step needs no change: it holds a target and returns. Nothing leaves the map, so the party's losses and retreat do not move, and when the effect ends the creature still holds its target and comes back | T-473 |
| `heal_rate` | percent | `health/tick.ts` healing: `healRemaining −= 5 × value / 100` when set | T-474 |
| `pain_half` | 1 | `health/tick.ts` pain sum | T-474 |
| `haste` | percent | the step above, and cooldowns in `resolveMelee` and `fireRanged`: `× 100 / (100 + value)` | T-474 |
| `fire_immune` | 1 | `armorReduction`'s caller: a hit whose wound type is `burn` does 0 | T-474 |
| `spot_radius` | tiles | `threats/ai.ts` where targets get `spotRadius` (line "spotRadius: entities.has(id, C.Attributes)"): the larger of the two | T-474 |

**Stun** is not an effect. Daze and `blackout` emit `CreatureStunned { id, until }`. 17 handles it (17 § Bleeding, pain, consciousness): it adds the creature to `wounded`, where it stays until the stun ends, saves `stunnedUntil` (a map in `HealthState`, optional), knocks a conscious body down at once with `CreatureUnconscious`, and its consciousness line becomes `conscious = pain < PAIN_UNCONSCIOUS && blood ≥ threshold && tick ≥ stunnedUntil`. So everything that respects `Body.conscious` holds: 16 skips the creature and hits it at +40, brains stop, and `CreatureUnconscious` and `CreatureConscious` fire. The patient check in `health/tick.ts` counts only unconsciousness from pain or blood, so a blackout admits no one. A stunned raider counts toward 18's retreat losses while it lies there. That is accepted: it is 150 ticks. A Daze caster may daze the same creature again once it wakes.

### Vials

A caster carries `CASTER_VIALS`. In `reequipSoldier`, after the weapon: a member holding a channel tops up by the ammunition logic, through `claimItemForSoldier`, taking available stacks with tag `rune_fuel` in the kit pool's order and splitting a larger stack so that only the missing vials are taken. `kitTypes` adds items with tag `rune_fuel`. `findAmmoForShooter` finds a carried vial by its item id, the item row with that tag.

`drinkVial` in `magic/cast.ts`, called by 16's loop for a channel holder with its cooldown elapsed and a hostile target held (every target the loop keeps is hostile), before `castSupport` and `canCastBolt`: when `current < cost`, a vial is carried and `vialsToday < VIALS_PER_DAY`, it consumes one, adds `VIAL_RUNE` capped at `max` (never lowering the rune), counts `vialsToday`, emits `VialDrunk { id }` and sets the cooldown to `tick + DRINK_TICKS`. `DayPassed` clears `vialsToday`. There is no fourth vial in a day. A Proficient runecaster has 50 rune and 15 more in the pouch for a day.

### Setting stones

Built. The enchantments are rows of `enchants` ([weapons-and-armor.md](../03-content/weapons-and-armor.md) § Enchantments), the settings are generated runeforge recipes ([workshops-and-recipes.md](../03-content/workshops-and-recipes.md) § Runeforge), and the runed robe and the circlet are armor rows with a `rune` property (weapons-and-armor.md § Armor), made at the runeforge.

`Item.enchant { id: Idx<'EnchantDef'>, tier: Quality }`, optional; absent is none. One per item, permanent. `tier` is the runesmith's quality roll, and `QUALITY_COMBAT_MULT[tier]`, rounded, scales what the row's `scales` names: its `value` or its `ticks`.

**Settings.** `applyGenerated` (`settingRecipes` in `content/generate.ts`) makes one recipe `set_<slot>_<enchant>` per row of `enchants`: input 0, kept, is 1 of every melee weapon type (`weapons` rows with no launcher and no `training`), 1 of every `armor` row with a layer (of the row's `only` slot when it has one) or 25 units of `bolt|arrow`, as one alternation; then the stone (a gem stone is 1 `cut_gem` of its material, another stone 1 of its item) and the row's vials in `rune_vial`. Weapon and armor 300 ticks, xp 15; ammunition 200 ticks, xp 10; quality yes, no fuel. A set of ammunition is exactly 25 units: the job search splits a larger stack.

`RecipeDef` has `transform: true` and `enchant` (the row it sets), and such a recipe has no outputs (content check: a transform recipe has none and names its row; every other recipe has at least one output). 12 runs it (12 § Operation, § Work orders): input 0 is not consumed; its delivered items get `enchant` through 13's `items.setEnchant(id, enchant)`, which re-accounts value as every mutation does; they are left at the output tile and released with the job; `StoneSet { itemId, enchantId, tier, smithId }` is emitted per item, and `ItemCrafted` is not. An order for it is `once` only, since there is no output to count.

Filters: `ItemFilter.noEnchant` (`items/search.ts` `matches`, `jobs/state.ts`), set by `WorkshopOperator.inputFilter` on a transform recipe's input 0, so an enchanted item is never set again. The order's material filter applies to input 0, since there is no first output. `WorkOrder.targetType?: Idx<'ItemTypeDef'>` narrows input 0's alternatives to one type; the orders panel offers it for a transform recipe, as it offers a material. There is no "this exact item" order: the search takes the nearest match.

A soldier's gear is owned and so is never a target. The runesmith sets stones in stock, and the squad's next re-equip takes the better item: `scoreWeapon` and `scoreArmorPiece` add `ENCHANT_CLAIM_BONUS` for an enchanted item (16 § Equipment). A member holding a channel claims a piece with a `rune` property for its slot first, past the squad's armor preference. Melting and `destroy` are unchanged, so an enchanted item melts to bars only and the stone is lost.

**Value.** 13 § Value: `+ stone value × ENCHANT_STONE_VALUE_MULT + vials × ENCHANT_VIAL_VALUE`, added in `ItemCore.value`; a gem stone's value is its material's; enchanted ammunition carries `round(value / 25)` a unit, so a set of 25 bolts of embers carries 100 and a split or a merge never changes wealth. Wealth follows through `account`. A masterwork steel breastplate of adamant is 4,000 + 90 × 3 + 12 × 15 = 4,450; an iron axe of embers gains 12 × 3 + 6 × 15 = 126.

**Names.** `magic.enchantOf(itemId)` gives the row, its suffix and its effects at the item's tier. The stocks panel, the look cursor and the `StoneSet` announcement name the item with the suffix (`enchantedName` in `ui/messages.ts`): a suffix that begins with "of" follows the name, "iron battle axe of embers (fine)"; any other goes before it, "keen iron short sword". The look cursor adds a dim line with the effects at the tier: "+9 ember on a hit."

### Enchantments in combat

**`fearsome` is a trade-off, by decision (T-485).** A fled raider is out of the fight for a while, but soldiers who chase it swing less: in the T-472 arena six soldiers with fearsome axes held a raid of ten in 16 of 24 fights against 20 with plain axes. The owner chose to keep it; not every enchantment is a strict improvement. The look line says so: "A fleeing foe is hard to catch."

**Task:** the rows below arrive with T-476. Content table `enchants` ([weapons-and-armor.md](../03-content/weapons-and-armor.md) § Enchantments) holds the rest: `keen`, `ember`, `rime`, `sure`, `fearsome`, `blaze`, `sunder`; `stout`, `emberward`, `rimeward`, `adamant`, `glowing`; `ember_ammo`, `rime_ammo`, `seeking`.

The resolution reads rows, never ids. A row: `{ id, slot, stone, vials, suffix, effects: { kind, value, type?, chance?, ticks?, scales }[], only? }`; `scales` is `value`, `ticks` or `none`. `magic/enchant.ts` `effectAtTier` gives an effect's numbers at a tier, `enchantOfItem` an item's, and for combat `itemEnchantEffects` (an item's effects at its tier, empty for none) and `wornEnchantEffects` (those of the pieces in a creature's five armor slots, head to feet). Effects of one kind on one item add up.

Weapons:

| stone | id | vials | suffix | effect at common tier | scales | Task |
|---|---|---|---|---|---|---|
| deepsilver bar | `deep` | 12 | of the deep | `damage_percent` +25, `vs_deep_percent` +50 | no | T-476 |
| `hollow_ichor` | `hollowbane` | 8 | hollowbane | `vs_deep_percent` +100 | no | T-476 |

Armor:

| stone | id | vials | suffix | effect at common tier | scales | Task |
|---|---|---|---|---|---|---|
| `wyrmscale` | `wyrmhide` | 8 | wyrmhide | `fire_percent` 0 on covered parts | no | T-476 |
| `hollow_ichor` | `hollowsight` | 8 | of hollow sight | `spot_radius` 10; head slot only | no | T-476 |

Where each kind is read. Every seam reads `Item.enchant` first, so an unenchanted fight does the same arithmetic, in the same order, and draws the same numbers. Only `flee` draws, and only for an item that carries it.

| kind | seam |
|---|---|
| `to_hit` | `resolveMelee`, the `hit` sum before the clamp, from the weapon. `fireRanged`, the `hit` before the clamp and the roll, from the unit of ammunition taken (`calculateRangedHit`'s `bonus`); a bystander's half chance has none |
| `damage_percent`, `vs_deep_percent` | `resolveMelee`, on `raw`, before armor: `raw × (100 + damage_percent + vs_deep_percent) / 100`, the second only when the target's `Creature.faction` is `deep` |
| `armor_percent` | `resolveMelee` passes it to `armorReduction` as `armorPercent`: that share of the target's whole armour sum counts. Several on one item: the smallest |
| `armor` | `armorCovering`: `piece.armor + value` where the piece has it, before the piece's metal, coverage, quality and layer multipliers, so the inspector's armour value follows |
| `fire_percent`, `frost_percent` | `throughEnchantedArmor` in `combat/melee.ts`, after the blunt-through rule and before Toughness, in `resolveMelee`, `resolveProjectileHit` (missiles, breath and blooms) and the extra hit below: each piece covering the part that has the kind lets that percent of the damage through, so two such pieces on a part multiply. Fire is a hit whose wound type is `burn` (`woundTypeFor`: `ember`, and the wyrm's `burn` breath); frost one whose wound type is `frost` |
| `extra_damage` | after a hit with damage above 0: `applyEnchantOnHit` in `magic/cast.ts`, called from `resolveMelee` and `advanceSingleProjectile` (on the target and on a bystander alike). A second hit of the effect's `type` on the same part: `value` less its own `armorReduction`, through `throughEnchantedArmor`, then Toughness. It emits one more `DamageDealt` (the same `attackerId` and `weaponId`) when that is above 0, no `AttackResolved` and no xp |
| `slow` | `applyEnchantOnHit`: `addEffect` of a `slow` of `value` for `ticks`, `sourceId` the attacker |
| `slow_immune` | `addEffect`: a `slow` is not added to a creature that wears a piece with it, whether a spell or an enchantment brings it. `addEffect` takes the registry for this; every caller adding a `slow` passes it |
| `flee` | `applyEnchantOnHit`: a creature Dread cannot take (`mentallyImmune`: the `deep` faction, size `MENTAL_IMMUNE_SIZE` or more) is never sent running, and nothing is drawn for it. Otherwise roll `chance` on stream 25 (a `chance` of 0 always applies), then the resist roll (§ Spells), and add a `flee` effect for `ticks`, `sourceId` the attacker, which 16's `stepFled` reads as Dread's |
| `spot_radius` | `threats/ai.ts`, where fortress targets get `spotRadius`: a dwarf's `SPOT_RADIUS` plus the largest `spot_radius` among the pieces it wears (`wornSpotRadius`); pieces do not add to each other |

Enchanted ammunition stays enchanted through `split`, and `canMerge` keeps it apart. The unit split off for a shot carries the stone in flight; its effects are read from `proj.itemId` at the hit, before the unit drops or breaks. A bolt that drops keeps its stone; one that breaks is gone with it.

### Draughts

**Task:** T-474.

Item rows, one per draught: category `medical/draught`, stack 5, bag, quality true, glyph `!`, tag `draught`, not `drinkable`. Laboratory recipes: 150 ticks, xp 8, quality yes, new recipe flag `spoilable: true`, two draughts from the inputs. Content table `draughts` (new): `{ id, effects, trigger, days? }`. `Duration = DRAUGHT_TICKS × QUALITY_COMBAT_MULT[item.quality]`.

| id | name | inputs | effect | drunk when | Task |
|---|---|---|---|---|---|
| `mending_draught` | draught of mending | 1 `rune_vial` + 2 `brightleaf` | `Mended` at once; `heal_rate` 200 | `AttackResolved` hit on a soldier on duty whose blood falls below 50%; or `give_draught` | T-474 |
| `stout_draught` | draught of stoutness | 1 `rune_vial` + 2 `plant_food` (pale_bell) | `pain_half` | `RaidArrived`, `AmbushSprung`: every soldier on duty | T-474 |
| `quick_draught` | draught of quickness | 1 `rune_vial` + 2 `plant_food` (sweetroot) | `haste` 25 | as stoutness | T-474 |
| `calm_draught` | calming draught | 1 `rune_vial` + 2 `plant_food` (hops) | thought `eased`; a second within `CALM_REST_DAYS` gives `dosed_again` instead | `give_draught` to a Miserable dwarf | T-474 |
| `hollowsight_draught` | draught of hollowsight | 1 `rune_vial` + 1 `hollow_ichor` | `spot_radius` 10 | `MonsterEmerged` or `DeepStirred` with Deep level ≥ 2: every soldier on duty | T-476 |
| `wyrmblood_draught` | draught of wyrmblood | 1 `rune_vial` + 1 `wyrmscale` | `fire_immune` | `ThreatNearby` from a creature with a ranged `burn` attack | T-476 |
| `murky_draught` | murky draught | spoiled batch | none; value 1 | never | T-474 |

**One draught, then rest.** The rest lives on `Spellbound` (`lastDraughtTick`, `lastCalmTick`), since most soldiers have no `Rune`. The component stays while either is within its rest. A dwarf who drank anything drinks nothing for `DRAUGHT_REST_DAYS`. A plain vial is not a draught.

**Who carries.** `Squad.equipment` gains `draughts: Idx<'ItemTypeDef'>[]`, ordered, empty by default, set through 16's existing `SetSquadEquipment`. `reequipSoldier` claims one of each listed draught, by the ammunition logic. `kitTypes` adds tag `draught`.

**Triggers are events, not scans.** 25 subscribes to the events in the table, walks the squad members on duty, and for each picks the first listed draught whose trigger fired and which is carried. It consumes it through `items.consume` and emits `DraughtDrunk`. There is no drinking time.

**`give_draught`.** Job type: labor and skill `medicine`, target entity, workTile entity, baseTicks 30, priority 2, producer `magic`. Produced for a patient with a serious or grievous wound, when an unowned `mending_draught` is in stock and the rest allows; and on `DayPassed` for a Miserable dwarf when a `calm_draught` is in stock and the longer rest allows. `excludeWorker` is the patient.

**Spoiled batch.** In `WorkshopOperator.complete`, for a `spoilable` recipe: with `max(0, ALCHEMY_MISHAP_PERMILLE − 10 × skill)` per mille, on 12's stream, every output becomes `murky_draught`. Only a spoilable recipe draws.

### Summons

A summon is a **war-trained tame animal assigned to its caster**. 08's tame brain does the rest (08 § Summons): it takes targets within `WAR_ANIMAL_RADIUS` of its dwarf, follows within 1 tile, and 16's targeting fights. 25 adds no brain. The code is `magic/summon.ts`.

**The call.** `castSupport`'s `call` branch (§ Spells) plans the call (`planCall`) and, once the rune is spent, answers it (`answerCall`): `spawn.creature(species, tile, 'fortress')`, then `Tame { trained: 'war', assignedTo: casterId, noBreed: true, condition: 0, pastureId: 0, petOf: 0, slaughter: false, juvenileUntil: 0, pregnantUntil: 0, lastProductTick: {} }` and `Summoned { summonerId: casterId, fadesAt: tick + SUMMON_TICKS }`, and `SummonCalled { id, casterId }`. The tile is the first free tile beside the caster on its level, in the order north, east, south, west, then north-east, south-east, south-west, north-west: one a creature of the species can stand on and no living creature holds. With none free the Call is not cast. Summons count toward `MAX_CREATURES` like any creature, and a summon is of the fortress faction, so a ward and a mend reach it.

War training adds +50% damage and +1 natural armor (`isWarTrained`), so the rows hold the lower numbers.

**The species.** The staff's metal picks the row, through the metals column `summon` ([minerals-and-metals.md](../03-content/minerals-and-metals.md) § Metals): steel and silver `stone_warden`, deepsilver `deep_shade`. A wand, or any metal with no `summon`, gets the `call` spell row's own `summon`, `wisp`. The three rows are in [creatures.md](../03-content/creatures.md) § Summons: a wisp is 6 `ember` as fought, a warden 22 `blunt` with armor 8, a shade 18 `edge` with armor 2. A summon has no stealth.

Rows carry `flags.summoned: true` (the word `summoned` in the flags column), and code reads the flag, never an id. A summoned species:

- leaves no corpse: `items/index.ts`, the `CreatureDied` branch, skips `createCorpse` when the species has the flag;
- is never slaughtered, named, assigned, pastured or trained: 08's animal commands reject it `not_found`, and 08's `tameList`, `wildList` and `bySpecies` leave it out, so the animals panel and the hunters do not see it;
- gives no grief: it is no one's pet, and 15's `saw_death` passes over its death (15's other death thoughts read dwarves and pets only);
- is never butchered: no `butcherable` flag;
- is never bandaged by a medic (17's `bandage_animal` passes over a creature with `Summoned`), never carried off by a thief (18), and never caught by a cage trap (19), since it would fade in the cage;
- is no name in the legend: 24's kill tally leaves out a killer with `Summoned`, though a summon's kill still awards its milestone;
- has no `Hostile` while it is the fortress's, so no party counts it. It is no dwarf: it has no `Brain` or `Labors`, so the population, immigration, burial and the end of the fortress never count it, and it carries nothing, so it adds no wealth.

**Fading.** On `HourPassed`, 25 emits `SummonFaded { id }` for every living `Summoned` with `fadesAt ≤ tick`, ascending, and 17 kills it with cause `faded` (17 § Bleeding, pain, consciousness). The log reads "A stone warden fades." On a creature's `CreatureDied`, every summon it called gets `fadesAt = tick`, so it fades on the next `HourPassed`. Death at 0 hp is ordinary and leaves nothing.

**Turning.** A species whose row has `flags.turns` (the deep shade; the word `turns` in the flags column) comes through turned with `SHADE_TURN_PERMILLE`, one draw on stream 25 at each Call of it; no other species draws. A turned summon spawns with faction `deep`, no `Tame` and `Summoned { summonerId: 0, fadesAt: tick + SUMMON_TICKS }`, so it does not count toward its caster's summons, does not fade when its caster dies, and fades at its day's end like any summon; 25 emits `SummonTurned { id }` and no `SummonCalled`. 18 handles `SummonTurned` (18 § The Deep): `spawnedHollowBorn(ctx, id, tile, hollowBorn)`, the same function the emergence uses, adds `Hostile { role: 'hollow', behaviorState: 'attack', … }`, puts it in `hollowBorn`, and sets the nearest fortress target. Announcement `SummonTurned`, danger: "Something came through the call that was not called: a deep shade turns on the fortress." Thought `summon_turned`, everyone. Measured: 50 turned in 1,000 castings of a deepsilver staff (`t475-summons.test.ts`); a squad of three in iron axes, shields, helms and mail killed a turned shade in 87 ticks, taking no wound.

**Wisp mishap.** `wisp_loose` (§ The sanctum) spawns the `call` row's `summon` beside the circle (the same free-tile order, around the circle's tile) with faction `wild` and `Summoned { summonerId: 0, fadesAt: tick + SUMMON_TICKS }`, so 08's wild brain wanders it; nothing spawns with no tile free or at `MAX_CREATURES`. The wisp is `neutral`: a `timid` one would run from the apprentice and, from a sanctum with no way to the map's edge, leave the map at once. 08's daily lifetime and cap check passes over it. The apprentice gets no thought.

**Inspector.** In the creature tab, under the effects line: a caster's "Summons: stone warden (fades in 9 hours), wisp (fades in 3 hours)."; a summon's "Called by Urist Ironvein; fades in 9 hours.", or "Fades in 9 hours." for one with no caster. A Call channel's line reads "Call: brings a stone warden for a day, 2 at a time."

### Rare materials

**Task:** T-476.

Nothing new is placed in the rock. Species get a new optional column `remains: { item, count }[]`. In `items/index.ts`, the `CreatureDied` branch, after `wornItems.push(...carriedItems)`: spawn each with `ItemFlag.Foreign` and add it to `wornItems`. The existing `strip_corpse` job then recovers it, since it runs on any non-dwarf corpse with worn items, and that clears `foreign`. No rng.

| item | category | value | stack | container | from | Task |
|---|---|---|---|---|---|---|
| `wyrmscale` | `medical/wyrmscale` | 80 | 10 | bag | `magma_wyrm` remains: 4 | T-476 |
| `hollow_ichor` | `medical/ichor` | 60 | 5 | bag | `hollow_stalker` and `hollow_maw` remains: 1 | T-476 |

### Deepsilver

**Task:** T-476.

In `WorkshopOperator.complete`, at a building with tag `rune_work`: for each consumed input whose material row has a positive `runePressure` (a new metals column; deepsilver `DEEP_PRESSURE_PER_RUNE_BAR`), emit `DeepsilverWorked { amount: units × runePressure }`. It applies to a quench, a deep setting, a shod staff and a circlet alike. 18 subscribes. `threats/deep.ts` splits `handleDeepsilverMined` into its tile part and a new `addDeepPressure(amount, ctx, …)`, which holds the pressure, the thresholds and `DeepStirred`.

When no tile has been mined, because the bar was bought, `triggerDeepEmergence` must still have a base. `findEmergenceBaseTile` is checked and tested for an empty list; the fallback is the workshop's tile, carried in the event as `tile`.

The deepsilver confirmation row `c_deepsilver` gains: "Working it at the runeforge or the laboratory wakes the Hollow too."

### Hexers

**Task:** T-479.

`gloam_hexer`: humanoid, size 50, speed 165, attack punch `blunt` 5 size 3, faction Gloam, `opensDoors`, `fleeBloodPercent` 50, glyph `G`. Role `hexer`.

- `threats/parties.ts` `calculatePartyComposition` gains a `year` argument. On top of size, like the captain: one `hexer` in a raid at peril 3 from year 3 and peril 4 from year 2; two in a siege.
- `threats/gear.ts` `equipHostileCreature`: `gearTiers.kits` gains `hexer`: `wand` with `stone: amethyst`, `dagger`, `cap`, `leather_jerkin`. A kit row may have `stone`, written after spawn. The wand's material is wood, by the branch that bows use.
- `threats/parties.ts`, after equipment: `entities.add(id, C.Rune, { current: HEXER_RUNE × 1000, … })`. It carries no vials and does not regenerate (§ Rune).
- `threats/ai.ts`: where `isArcher` is computed (two sites), the `hexer` role counts as an archer.

Casting is the ordinary loop: `canCastBolt` holds for any holder of a `Rune`. Twenty frost bolts, and then a club. Hexers hold only `amethyst`. The design's dread wand is cut, so no dwarf is ever mind-struck, and the `calm` armor enchantment goes with it. The wand is `foreign` as all hostile kit is, and it becomes fortress stock through `strip_corpse`. Only a member with `runecraft` claims it.

### Trade and value

Built. The Mountainhome's extra goods (`caravan-goods.md`) include rune vials, 5 to a good, permille 400 (*unmeasured*), at reputation ≥ 50; the extra goods are drawn outside the weighted pool on stream 25 (20 § Caravans), so the ordinary goods do not change, and a request finds the row only at the reputation it needs. The Mountainhome values `medical/vial` and `medical/draught` at 150 (`caravan-goods.md` § Preferences). Wildwood's wood rule already reaches a wand. No civilization values "enchanted" separately: `preferencePercent` reads category and material, and an enchanted item's value is already higher.

### Morale

**Task:** as the row says. Rows go to `personality-and-thoughts.md`; each needs a case in `morale/thoughts.ts` `eventPredicate` and `eventTargets`. `attuned`, `singed`, `first_runecaster`, `warded`, `mended_by_rune` and `summon_turned` are there (Work and skill; Pride and relief; Social and comfort; Loss and fear): `attuned` matches an `AttuneSession` whose `mishap` is empty, `first_runecaster` and `summon_turned` go to everyone (each event has its own announcement), and `warded` and `mended_by_rune` go to the dwarf the event names.

| id | text | value | hours | decay | cap | group | trigger | Task |
|---|---|---|---|---|---|---|---|---|
| `eased` | "The draught quieted me." | +8 | 72 | linear | 1 | none | a calming draught | T-474 |
| `dosed_again` | "Another draught. I am tired of draughts." | −4 | 72 | halflife | 1 | none | a calming draught within the rest | T-474 |

Every value sits inside the caps. Nothing here can take a fed, rested dwarf below 20.

## State

Rows go to `schemas/components.md` and the ownership table by task. `id-fields.ts` regenerates (an optional `Idx` field, `stone?`, is named without its mark). `Rune`, `Spellbound` (with `effects`), `Item.stone`, `Item.enchant` (with its `ItemEnchant` record), `WorkOrder.targetType`, `Projectile.spell` and `spellPower`, `MagicState` (in `schemas/system-state.md`, with `lastMishaps`, the last mishap of each sanctum for its panel, `pendingBlooms` and `bloomAlertsToday`) and `HealthState.stunnedUntil` and `Summoned` are there.

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
  lastDraughtTick?: Tick;        // T-474
  lastCalmTick?: Tick;           // T-474
}
interface Summoned { summonerId: EntityId; fadesAt: Tick }   // owner 25; summonerId 0 for a loose wisp or a turned shade

// additions to existing components
Item.stone?: Idx<'MaterialDef'>
Item.enchant?: { id: Idx<'EnchantDef'>; tier: Quality }
Projectile.spell?: Idx<'SpellDef'>
Projectile.spellPower?: number                                // the channel's power in thousandths
WorkOrder.targetType?: Idx<'ItemTypeDef'>
Squad.equipment.draughts?: Idx<'ItemTypeDef'>[]               // T-474

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

The `interface:check` script compares this section with the code. It holds only what exists. Each task moves its rows here from § Planned interfaces.

### Reader

- `magic.rune(id)` — current, max and regen in milli-rune, the metal percent and the pieces that lower it, the robe percent and the circlet bonus, whole hours to full (0 full, −1 never), the vials carried and the vials drunk today; undefined without a `Rune`
- `magic.sanctums()` — sanctum zones, ascending; `magic.apprentices(zoneId)` — its living adult apprentices, ascending; `magic.sessionsToday(id)`
- `magic.mishapPermille(zoneId, id)` — the mishap chance of this dwarf's next session there; `magic.lastMishap(zoneId)` — kind, dwarf and tick of the sanctum's last mishap, or undefined
- `magic.canCast(id)` — the creature holds a channel whose spell its rune pays for now; `magic.spellOf(itemId)` — the spell in a channel and its numbers (cost, range, damage, type, ticks, power, suffix), or undefined
- `magic.effects(id)` — the creature's unexpired timed effects
- `magic.summonsOf(id)` — the living summons this caster called, ascending
- `magic.enchantOf(itemId)` — an item's enchantment: its row, suffix, tier and effects at the tier; undefined for none

### Commands

`SetSanctumApprentices { zoneId, dwarfIds }`.

### Events consumed

`HourPassed` (regen, which also ends a caster's `RuneSpent` silence; expired effects; fading summons; the producer's hourly look), `DayPassed` (sessions, `vialsToday`, the day's bloom alerts), `SkillLevelUp` (the `Rune`, `FirstRunecaster`), `CreatureDied` (a caster's summons fade), `ZoneChanged` (sanctums).

### Events emitted

`AttuneSession { id, xp, mishap }`, `Mishap { id, kind, buildingId?, tile? }`, `CreatureStunned { id, until }` (a blackout; a Daze), `FirstRunecaster { id }`, `SpellCast { casterId, spellId, targetId, tile, burned }` (every cast, from 16's loop through `cast.ts`, with `burned: false`; a bloom that caught one of the caster's own, with `burned: true`), `RuneSpent { id }`, `VialDrunk { id }`, `Warded { id }`, `Mended { id, casterId }`, `SummonCalled { id, casterId }` (24's milestone), `SummonTurned { id }` (18, 15), `SummonFaded { id }` (17), and 16's `DamageDealt` (a mishap's light burn, `attackerId` 0; a bloom, through `resolveProjectileHit`).

### Registrations

Job producer `magic` (`attune`); inspector sections `creature › rune` (with the channel line), `zone › sanctum` (the sanctum panel, in 14's zones panel) and `item › stone`; announcements: `Mishap` (note for `singed`, `blackout`, `surge`, `wisp_loose`; alert for `scorched_circle`, `fire`), `FirstRunecaster` (note), `SummonTurned` (danger), `StoneSet` (note, a masterwork setting only; 12 emits it), `RuneSpent` (note), `SpellCast` with `burned: true` (alert: "Urist's firebloom caught Tova."). Service `world.services.magic` (`MagicApi.addBloom`).

## Planned interfaces

| Kind | Name | Task |
|---|---|---|
| Event | `DraughtDrunk { id, draughtId }` | T-474 |
| Event | `DeepsilverWorked { amount, tile }` (12 emits it) | T-476 |
| Consumes | `RaidArrived`, `AmbushSprung`, `AttackResolved`, `ThreatNearby`, `MonsterEmerged`, `DeepStirred` | T-474, T-476 |
| Registration | job producer `magic`: `give_draught` | T-474 |

Other systems' documents gain their parts in the same commits: 08 (summons), 12 (`transform`, `spoilable`, `stone`), 13 (`setEnchant`, `noEnchant`, value, `remains`, no corpse for a summon), 14 (`sanctum`), 15 (`saw_death`), 16 (channels, effects, damage types), 17 (`CreatureStunned`, `Mended`, `SummonFaded`), 18 (`DeepsilverWorked`, `SummonTurned`, `hexer`), 19 (no cage for a summon), 22 (`moveAlongPath`), 24 (the kill tally).

## Player-facing behavior

- **Glyphs.** Wand `'`, staff `⌠`, vial `¡`, rune circle `○`, all `rune_cyan`. Draught `!`, in the color of its row. Wisp `*`, warden `Φ`, shade `δ`. A hexer is `G`. All are in CP437, so `font-additions.json` does not change. `◊` and `¦` are not, which is why the design's glyphs changed. A warded creature's glyph has a dimmed `ward_cyan` background (`render/compositor.ts`, step 6), unless the attack flash is showing.
- **Sanctum panel**: the selected sanctum's inspector in the zones panel (zone type key `[S-c]`, `ui-screens/panels.md` § Zones). The room's tier, score and missing circle; the glowcap in stock; the mishap chance in words for a new apprentice ("one session in 17"); each apprentice with level, rune and sessions left today, and its own chance; the last mishap. `[S-o]` opens the apprentice picker, which adds or removes one adult dwarf at a time through `SetSanctumApprentices`.
- **Inspector, `creature › rune`**, in the look panel's creature tab: "Rune 31/50, +0.6 an hour (iron helm -20%, iron mail shirt -20%); full tomorrow", and under it the held channel: "Channel: iron staff of embers (fine). Emberbolt: 24 ember, range 12." A Frostbind adds ", slows by 50% for 360 ticks"; the other spells read by their kind ("Ward: 7 armour on every part for 720 ticks, range 3."). Under them, for a caster with vials or one that drank today, "Vials: 2 carried, 1 of 3 drunk today.", and for any creature under timed effects, "Under: ward 7 (340 ticks), slowed 50% (120 ticks)." From T-474 "Can take a draught again in 2 days". A caster's summons and a summon's caster are named under them (§ Summons, Inspector).
- **Look cursor**: a channel is named with its spell's suffix, "1 iron staff of embers (fine)", then its value, and the line under it reads "Emberbolt: 24 ember, range 12. Needs a runecaster." An enchanted item carries its suffix, "1 steel axe of embers (fine)", and a dim line gives its effects at its tier: "+9 ember on a hit."
- **Squad panel** (T-474): the ordered draught checklist, with each trigger in words. A member who can use the channel it holds (`runecraft` 1 or more) has the channel's glyph after its name in the members line: "Tova E. ⌠".
- **Orders panel**: a transform recipe offers the target type (`set in: any`, stepped by a click) and the material, and is `once` only.
- **Hints** (`hints` rows, T-477, each with a trigger on stock or buildings): "Glowcap grows in the dark under a glowstone lamp." "A staff is a stone on a stick: the stone is the spell, the dwarf is the fuel." "A wand is quick and soft; a shod staff is slow and hard." "Build the sanctum in stone." "Iron drinks the rune: a runecaster in mail recovers slowly." "The runeforge burns vials, not coal." "One draught, then three days' rest."
- **Legend milestones** (`milestones` rows and `legend/index.ts`): first stone set and first runecaster (T-476). `m_summon`, "A summoning was answered.", is awarded once, on the first `SummonCalled` ([ui-keymap-and-screens.md](../03-content/ui-keymap-and-screens.md) § Milestones); a shade that comes through turned answers nothing.

## Tuning constants

All *unmeasured* unless the row says what was measured. Rows move to `src/systems/magic/constants.ts` as the task that uses them lands.

| Name | Value | Meaning | Task |
|---|---|---|---|
| `RUNE_PER_LEVEL` | 5 | Rune maximum per level | T-469 |
| `RUNE_REGEN_PER_LEVEL` | 0.1 | Rune per hour per level; measured: a level-10 runecaster fills in 50 hours in a tunic and 84 in an iron helm and mail | T-469 |
| `METAL_RUNE_PENALTY_PERCENT` / `METAL_RUNE_FLOOR_PERCENT` | 20 / 20 | Per worn metal piece; floor | T-469 |
| `SANCTUM_APPRENTICES` | 4 | | T-469 |
| `ATTUNE_TICKS` / `ATTUNE_XP` / `ATTUNE_SESSIONS_PER_DAY` | 300 / 25 / 2 | Measured: Proficient at two sessions a day from Wits 50 in 73 days and 145 glowcap | T-469 |
| `MISHAP_BASE` / `MISHAP_FLOOR` | 60 / 10 | Per mille a session, less 2 per level and 1 per tier; measured: 61 mishaps in 1,000 level-0 sessions in a bare sanctum | T-469 |
| `MISHAP_BLACKOUT_TICKS` / `MISHAP_SURGE_RADIUS` | 200 / 3 | | T-469 |
| `FROSTBIND_SLOW_PERCENT` | 50 | | T-470 |
| `CASTER_HOLD_DISTANCE` | 4 | A caster whose spell is no bolt, with the rune for it, stands this far from its target | T-473 |
| `CASTER_VIALS` / `VIAL_RUNE` / `VIALS_PER_DAY` / `DRINK_TICKS` | 3 / 5 / 3 / 30 | | T-473 |
| `FIREBLOOM_DELAY_TICKS` | 20 | Between the cast and the bloom | T-473 |
| `DREAD_MAX_TARGETS` | 4 | | T-473 |
| `RESIST_NO_ATTRIBUTES_PERCENT` | 25 | | T-473 |
| `MENTAL_IMMUNE_SIZE` | 180 | | T-473 |
| `ENCHANT_CLAIM_BONUS` | 0.5 | Added to a claim score | T-471 |
| `DRAUGHT_TICKS` | 1200 | One day, times the quality multiplier | T-474 |
| `DRAUGHT_REST_DAYS` / `CALM_REST_DAYS` | 3 / 7 | | T-474 |
| `ALCHEMY_MISHAP_PERMILLE` | 100 | Per job, less 10 per level | T-474 |
| `SUMMON_TICKS` / `MAX_SUMMONS_PER_CASTER` / `SHADE_TURN_PERMILLE` | 1200 / 2 / 50 | A summon's day; summons a caster holds; turning per mille. Measured: 50 turned in 1,000 castings of a deepsilver staff | T-475 |
| `DEEP_PRESSURE_PER_RUNE_BAR` | 10 | The same as one mined tile (`DEEP_PRESSURE_PER_TILE`) | T-476 |
| `HEXER_RUNE` | 20 | | T-479 |

## Acceptance

Each task's work file lists its own. Together:

- A glowcap on a dark tile under a lamp grows. With the lamp removed, or on a lit tile, it does not. No dwarf eats or cooks one.
- Two glowcap make one vial. A dwarf with no `runecraft` never claims a channel and casts nothing.
- A Dabbling apprentice with 5 rune and a wand of embers casts five bolts, then clubs.
- The worked numbers above hold exactly.
- A Proficient runecaster at 0 rune reaches 50 in 50 ± 2 hours in a tunic, 34 in a robe, 84 in an iron helm and mail.
- Level 10 at two sessions a day takes 74 ± 3 days and 148 ± 6 glowcap at Wits 50. Over 1,000 level-0 sessions in a bare sanctum, mishaps number 60 ± 15, and none is a death, a lost limb or a stockpile item.
- A ward lapses at 420 ticks from a wand and 720 from an iron staff. A warded squad of six at the measured peril-2 raid loses less blood than an unwarded one.
- Dread sends at most four running and they come back. The party's retreat counter does not move.
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

## Differs from the design

The design is [the runecraft proposal](../../reports/designs/2026-11-01-runecraft-magic-system.md). This list goes when the marks go.

| # | The design said | This says | Why |
|---|---|---|---|
| 1 | Adding rows is free | New rows number after old ones, in a table of their own (§ Row numbering) | Rows are sorted by id and indices are saved raw, so a new row would corrupt every older save |
| 2 | Glowcap is `plant_food` (glowcap), "not food" | Its own item, `glowcap` | Any `plant_food` is eaten and cooked; the plant's `edible` column is not read |
| 3 | Damage type `burn` with a table row | `ember` for spells; `burn` stays without a row | The wyrm's breath is `burn` and a row would change its damage with no runecraft in play |
| 4 | `Item.shoe` and `Item.stone` | Only `Item.stone`; the staff's material is its shoe | The ordinary material filter, value and melting then work; one field fewer |
| 5 | Yew gives +10% power | Cut | The log is not recorded once the material is the metal; a small effect |
| 6 | One `make_wand`, one `make_staff`, `Item` filter picks the stone | One generated recipe per stone | The order's one material filter must pick the metal; this adds no order field |
| 7 | A sanctum chest with `wants`, `SetSanctumSupplies` | No chest, no wants; input from any stockpile | Hospital stocking is special-cased in 13 and 14; the job search needs nothing |
| 8 | `ATTUNE_XP` 50; "a one-year project" | 25: Proficient in 74 days | A year is 112 days; at 50 it took a third of a year |
| 9 | 25 ticks right after 16 | Order 25, last, nearly idle | Casting rides in 16's loop; effects compare ticks, so nothing needs freshness |
| 10 | `Slowed`, `Dazed`, `Fled`, `Ward` statuses; `magic.speedModifier` | One `Spellbound` list; slow and haste in the core step | Hostiles and animals do not read 17's modifier; one place covers everyone |
| 11 | Daze as its own status | `CreatureStunned` through `Body.conscious` | Every system already respects it |
| 12 | Firebloom is never cast into allies, and it burns allies | A 20-tick delay between the two | Instant, the two rules cannot both hold |
| 13 | Spell range column for bolts | Bolts use the launcher's range | Two ranges for one bolt told the player nothing |
| 14 | Robe +5 to the cast roll | Cut | The regen is the robe's point |
| 15 | `mend_wounds` off-duty job | Cut | It races 17's `stop_bleeding` over the same wounds for little gain |
| 16 | A fourth vial gives `rune_sick` | Cut, thought too | The dwarf stops at three, so the fourth never happens |
| 17 | Drinking stops movement | Only the attack cooldown | Stopping a soldier needs a new rule in 16's squads |
| 18 | `SetSquadDraughts` | 16's `SetSquadEquipment` carries the list | The command exists and accepts partial preferences |
| 19 | "Train with staff" toggle | A channel holder drills solo | No new setting |
| 20 | Armor `calm`; hexers with Dread; Dread on dwarves | All cut | Dwarves would need a new flight rule in 10; hexers throw frost |
| 21 | Armor `mending` | Cut | Needs part coverage inside 17's heal loop |
| 22 | Armor `glowing` lights the wearer's 3×3 | Spot radius only | A moving light is a new mechanism |
| 23 | `adamant` weight −4 | Cut | The armor is the effect |
| 24 | `blaze` 2% ignition | Cut | Needs 05 on a weapon hit for a rare effect |
| 25 | `venomed`, `spider_venom`; `ember_gland` | Cut | A timed pain source in 17, and a newt that is not butcherable, for two small stones |
| 26 | Butcher and `strip_corpse` yields | A `remains` column, carried out by `strip_corpse` | One seam for both; no change to the butcher |
| 27 | "This exact item" in the stocks panel | Cut; a target type and a material | A new order field and a new panel path |
| 28 | A set takes "≤ 25" of a stack | Exactly 25 units | The job search counts units |
| 29 | Toughness +20 on stoutness | Cut | Attributes are read everywhere; pain halved is the effect |
| 30 | Spoiled batch fills the lab with miasma | Murky draught only | Miasma is internal to 13's rot pass |
| 31 | Mountainhome rows from year 2 in the weighted pool; "enchanted" valued by civ | `extra` goods outside the pool, no year gate; no civ value for enchants | The pool's draws must not move; preference reads category and material |
| 32 | Wildwood draught; Hillfolk enchant value | Cut | No seam; little gain |
| 33 | Wild patches by cavern weight | A separate pass converts cave shrubs | Weights would shift every map's shrubs |
| 34 | `saw_wisp` for everyone who sees it | Cut | A scan in 15 for one light |
| 35 | Deep pressure 10 and 5 by recipe | 10 per bar at any `rune_work` building | One rule, read from the metal |
| 36 | A hollowbane kill in the legend; firebloom flash; a summon "stands in a doorway" | Cut | New event fields and presentation for small effects |
| 37 | Summon rows at their fighting numbers; a shade with stealth | Rows hold lower numbers; no stealth | War training adds 50% and 1 armor; a hidden turned shade adds nothing to the story |
| 38 | Glyphs `◊`, `¦` | `○`, `⌠` | Not in CP437 |
