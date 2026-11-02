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

- **No new rng draw on any existing stream** unless a channel, an enchanted item, a draught or a hexer is in play. All casting rolls that are not 16's ordinary hit, block and part rolls draw on system 25's stream, `world.rngFor('25')`. That stream is the design's `magic` stream. Streams are named by system id. 25 takes its stream at init, so the save's `rng` section always holds the key `25`; an older save without it starts the stream from the seed. With no sanctum session, nothing but 20's caravan extras draws on it.
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
- `src/content/loader.ts` step 4 passes each table's list to `makeTable(name, rows, appended)`. `ids()`, `where()` and `rows` follow the same order, so a pick from an old list stays as it was, as long as the new row stays out of that list. `metal()` in `terrain/generate/traits.ts` picks from every weapon and armor row whose materials include `metal`; T-470 and T-471 make it skip rows with a launcher and no `ammo`, and rows with `rune`, so `old_battlefield` maps keep their arms.
- Schema: `list({ table: nonEmptyStr, id: nonEmptyStr })`; a listed id must exist in its table after `applyGenerated`, so a generated plant material (`glowcap`) is listed in `materials` too. New `exportRowOrder` in `scripts/lib/export/`.
- `test/fixtures/content-row-baseline.json` holds every table's ids at this commit, and is never edited. A test asserts that each keeps its index for good. A new row not in `rowOrder` fails it, and fails `content:check` (`scripts/lib/row-baseline.mjs`), with the line to add. `rowOrder` is not in the content hash, because the index order already is.
- On load, positional arrays shorter than the table are grown with zeros: `Skills.level` and `xp` in `restoreEntities` (`app/game-save.ts`), `Labors.enabled` likewise. `combat/melee.ts` `getSkill` otherwise reads `undefined` and returns `CREATURE_BASE_SKILL`. `laborPriorities` needs no growing: `JobBoard` starts every labor at the default priority and its `deserialize` overwrites only the saved length.
- New labors stay off for the dwarves of an older save, except as § The sanctum says. New dwarves get them on (`CoreSpawn.labors`).

**Save format, for all tasks.** `formatVersion` stays 1 and every `stateVersion` stays 1. New component fields and new state fields are optional; absent means none, as `threatThrottles` and `Hostile.retreat` do. System 25 with no saved entry keeps its initial state (`World.deserializeSystems` already skips it). Components are saved by table, so they need no code. No task needs a migration. A task that adds a field to `Item` or `Rune` adds an old-save test.

### Damage types

**Task:** T-470. `DamageType` in `core/types.ts`, `DAMAGE_TYPES` in `content/schema.ts` and the separate `DAMAGE_TYPES` in `scripts/lib/export/creatures.mjs` gain `ember` and `frost`. The last matters: `parseAttacks` silently drops an attack it cannot parse, and `content:check` still passes. `ember` is rune fire; its wound is a `burn`. `frost` already exists as a wound type. `health/wounds.ts` `woundTypeFor` maps `ember` to `burn`. Natural melee attacks in `resolveMelee` accept `ember` and `frost` alongside the three steel types (other strings still fall to `blunt`, as the wyrm's adjacent breath does today).

The layer table gains two rows and a column. It moves to `03-content/weapons-and-armor.md`; `exportDamageVsLayer` and the schema gain `ward`; the `DAMAGE_VS_LAYER` constant in `combat/melee.ts` holds the same numbers, and a new test compares it with the JSON.

| Type \ Layer | padding | leather | mail | plate | ward |
|---|---|---|---|---|---|
| edge | 0.6 | 0.8 | 1.2 | 1.1 | 1.0 |
| pierce | 0.4 | 0.6 | 0.8 | 1.2 | 1.0 |
| blunt | 1.2 | 1.0 | 0.5 | 0.9 | 1.0 |
| ember | 0.3 | 0.6 | 0.4 | 0.8 | 2.0 |
| frost | 1.0 | 0.8 | 0.3 | 0.5 | 2.0 |

Mail is a poor answer to rune, plate a fair one, a ward the best. A burn bleeds little (`BLEED_TABLE`), so an ember bolt wins by pain and by part damage, not by blood.

**`armorReduction`.** The sum is written out three times today: `resolveMelee`, `resolveProjectileHit` and `combat/reader.ts` `armorValue`. T-470 extracts one function, `armorReduction(entities, registry, defenderId, part, type, tick)` in `combat/melee.ts`, with no change of result, and all three call it. T-472 and T-473 extend only that function.

### Glowcap

Glowcap is built. Its rows are in `plants.md` (the crop, and `glowcap_patch` under § Rare cave patches), `items.md` § Medical and herbs (`glowcap`, `rune_vial`), `materials.md` § Rune and `glyphs-and-colors.md` (`rune_cyan`). The light rule and the `glow` plot are in 07 § Growth and § Farm plots, and the lamp is in 14 § Special buildings.

**Glowcap is its own item**, not `plant_food`. The `edible` and `cookable` columns of a plant are not read: `plant_food` is edible by its item row and is an `ingredient` by its tag, of any material. A glowcap in `plant_food` would be eaten and cooked. A separate item follows `fiber` and `brightleaf`.

### Workshops

A workshop needs a row in `workshops-and-recipes.md` § Workshops (the export makes its `buildings` row, category `workshop`; the `tags` column holds `rune_work`), a block in `glyphs-and-colors.md` § Workshop patterns, and for its recipes a `RECIPE_SECTIONS` line in `scripts/lib/export/rules.mjs`. Labor comes from the recipe's skill.

| Workshop | Build inputs | Build labor, ticks | Shape | Task |
|---|---|---|---|---|
| `runeforge` | 1 `anvil` + 3 `stone_block` + 1 `cut_gem` | masonry, 300 | 3×3, corners impassable like a forge; tag `rune_work`; no fuel | T-470 |

| id | name | labor | profession | military | attributes | Task |
|---|---|---|---|---|---|---|
| `runesmithing` (skill) | Runesmithing | `smithing` | Runesmith | — | Agility, Wits | T-470 |

`runecraft` and its labor `attunement` (default on, not for children) are in `skills-and-professions.md`. These skills, like `alchemy`, have `no` in the `embark` column there, so the embark screen hides them and `SetSkill` refuses them. Immigrants cannot arrive with them: `immigration/waves.ts` draws from its professions table, which names none of them. Profession colors: runecraft and runesmithing with Metal (`prof_steel`).

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
max      = level × RUNE_PER_LEVEL + circlet bonus                    // level 10: 50; level 20: 100
regen    = level × RUNE_REGEN_PER_LEVEL × robe percent × metal percent   // per hour; level 10: 1 an hour
metal percent = max(METAL_RUNE_FLOOR_PERCENT, 100 − METAL_RUNE_PENALTY_PERCENT × n)
                // n = worn pieces of layer mail or plate whose material is class metal, except a piece with a rune property
```

Until T-471 brings the robe and the circlet, the robe percent is 100 and the circlet bonus 0. The pieces counted are the `Equipment.armor` slots; clothing is padding and never counts.

Integers: `current` is in milli-rune; `regen` truncates to milli-rune. On `HourPassed`, 25 adds `regen` to every `Rune` on a creature without `Hostile`, capped at `max`; a hostile creature's rune never comes back. A Proficient runecaster fills from 0 in 50 hours in a tunic (measured), 34 in a robe, 84 in an iron helm and mail (measured: 600 milli-rune an hour).

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

**Mishaps.** One roll per session on stream 25, at the dwarf's level before the session's xp: `max(MISHAP_FLOOR, MISHAP_BASE − 2 × level − tier)` per mille, then a second draw picks the kind by weight among the rows that have landed. Measured over 1,000 level-0 sessions in a bare sanctum: 61 (30 singed, 14 blackouts, 11 scorched circles, 5 fires with nothing to burn, 1 surge). None kills, takes a limb or touches a stockpile. A light burn is 1 point on a random arm (a draw on stream 25); an arm at 1 hp or lost is spared for the other arm, and with neither the burn does nothing. Its `DamageDealt` carries `clean: true`, so 17 makes the burn already `cleaned`: it cannot take infection, and it heals on its own with or without a medic (one may still dress it). So no mishap kills, now or later; the worst is the price of a chair. The last mishap of each sanctum is kept for its panel.

| kind | weight | what happens | how | severity | Task |
|---|---|---|---|---|---|
| `singed` | 40 | a light burn on a random arm, already cleaned; thought `singed` | `DamageDealt { damageType: 'burn', amount: 1, attackerId: 0, clean: true }` | note | T-469 |
| `blackout` | 25 | unconscious for `MISHAP_BLACKOUT_TICKS` | `CreatureStunned` (§ Effects) | note | T-469 |
| `scorched_circle` | 15 | the circle is destroyed, no item back | `Mishap` carries `buildingId`; 14 handles it and removes the building with no yield | alert | T-469 |
| `fire` | 7 | the first tile cardinal to the circle, north, east, south then west, that can burn (05's `burnableTile`) ignites; else nothing | `Mishap` carries `tile`; 05 queues it for its next tick, as lightning | alert | T-469 |
| `surge` | 3 | every creature with a body within `MISHAP_SURGE_RADIUS` of the circle on its level (the larger of the two axis distances), in id order, takes a light burn; the session's xp is granted twice | as `singed` | note | T-469 |
| `wisp_loose` | 10 | a wild timid `wisp` appears beside the circle and fades in a day | § Summons | note | T-475 |

### Channels

**Task:** T-470.

| id | name | class | skill | range | power | size | hands | bars | logs | materials | mult | Task |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `wand` | wand | staff | `runecraft` | 8 | 0.70 | 3 | 1 | 0 | 1 | wood | 10 | T-470 |
| `staff` | staff | staff | `runecraft` | 12 | 1.20 | 7 | 2 | 1 | 1 | metal | 14 | T-470 |

Item rows: `category: weapon/ranged`, stack 1, quality true, slot weapon, no `weapon` tag. Glyphs: wand `'`, staff `⌠`, both `rune_cyan`.

Launcher rows have `launcher: { range, power }` with **no `ammo`**. `ammo` becomes optional in the schema and in the `WeaponRow`, `WeaponDefRow` and `LauncherDef` types. "A launcher with no ammo" is what a channel is, and code tests that, never an id.

`scripts/lib/export/items.mjs` always writes `ammo`; change it with the schema so a staff row exports correctly.

**A staff's material is its shoe.** `Item.material` is the metal of the bar. There is no `Item.shoe`. So the ordinary material filter on a work order picks the shoe, value and melting work as for any metal item. A staff holds one bar, so like a dagger it melts to nothing: `workshops/operate.ts` computes `floor(1 × 60 / 100) = 0`. Do not change the melt formula. A wand's material is its wood.

`runeMult` is a new metals column (fixed): silver 1.3, deepsilver 1.6, steel 1.1, iron 1.0, bronze 0.9, copper 0.8, every other metal 0.7. A wooden item counts 1.0.

**`Item.stone`** (`Idx<'MaterialDef'>`, optional) names the gem on a channel. `items/api.ts` `canMerge` compares it and `Item.enchant`.

```
power(item) = launcher.power × runeMult(item.material) × QUALITY_COMBAT_MULT[item.quality]
```

Wand 0.7. Iron staff 1.2. Silver fine staff `1.2 × 1.3 × 1.1 = 1.716`. Deepsilver masterwork staff `1.2 × 1.6 × 1.5 = 2.88`.

**Recipes.** Generated by `applyGenerated` in `content/generate.ts`, one per row of `spells`, like `forge_*`. `applyGenerated` also appends their ids to `data.rowOrder`, as it does for every generated row after this point:

Generated in `generatedRecipes`, as `smelt_`, `alloy_` and `melt_metal_item` are (`forge_*` are authored rows, not generated). Every generated row names workshop `runeforge` and skill `runesmithing`, here and for the `set_*` rows.

| id | inputs | outputs | ticks | Q | xp |
|---|---|---|---|---|---|
| `make_wand_<stone>` | 1 `log` + 1 `cut_gem` (material the stone) | 1 `wand`, material from input 0, stone from input 1 | 200 | yes | 10 |
| `make_staff_<stone>` | 1 `log` + 1 `cut_gem` (the stone) + 1 `bar` | 1 `staff`, material from input 2, stone from input 1 | 300 | yes | 12 |

`RecipeOutput` gains `stone?: { from: 'input'; index: number }`. `WorkshopOperator.complete` in `workshops/operate.ts` writes it after `spawn.item`, as it writes `memorialDwarfId`. `inputFilter` already points the order's material filter at the input the first output's material comes from, so the player picks the metal of a staff and the wood of a wand. No new order field.

**Who claims.** In `combat/equipment.ts` `reequipSoldier`, before the weapon loop: a member with `runecraft ≥ 1` claims the available channel with the highest `power(item)`, whatever the squad's preference. With a channel held and none better, the weapon loop is skipped for them, as `scoreWeapon` gives a launcher −1 in a melee squad. With none in stock they fall through to the ordinary rule. `scoreWeapon` returns −1 for a channel for everyone else, so no one else ever holds one. A one-handed wand keeps the shield rule. `kitTypes` already includes weapons.

**Training.** `combat/training.ts` sends launcher holders to the archery path, which reads `launcher.ammo`. A channel holder takes the solo drill instead: half `TRAIN_XP` to `runecraft`, no rune spent.

**In melee** a channel is a club at half damage with `hammer`. `resolveMelee` already does this for `damageType === null` launchers.

### Casting

**Task:** T-470 for the frame and bolts; T-473 for the rest.

New module `src/systems/magic/cast.ts`, imported by `combat/index.ts`. Casting rides in 16's creature loop. 25 has no casting loop of its own.

In `CombatSystem.tick`, after `w`, `launcher` and the distances are known:

```
channel  = launcher !== undefined && launcher.ammo === undefined
hasAmmo  = channel ? canCastBolt(ctx, id, w, target) : (as today)
// kiting as today, with hasAmmo as above: a caster with rune keeps its distance
if channel and cooldown elapsed and castSupport(ctx, id, target, w):
    engagements.set(id, tick); continue                         // T-473; castSupport sets the cooldown by 16's rule
if isAdjacent: melee as today                                   // the club
else if isRanged in range with line of sight: fireAt as today   // the bolt, or T-473's burst and daze
else if channel and support staff and rune ≥ cost and dist ≤ CASTER_HOLD_DISTANCE: stop walking; continue   // T-473
else approach as today
```

`canCastBolt`: the holder has a `Rune`, the staff's spell is of kind `bolt`, `burst` or `single`, `current ≥ cost`, and the target is within the spell's range. `fireRanged` passes a `burst` or `single` to `magic/cast.ts` before it spawns anything (T-473). For a `bolt` it gains a third branch beside `naturalRanged` and the ammunition branch: `projectileItemId = 0`, `rawDamage = round(spell.base × power(item))`, `damageType = spell.type`, `weaponSkill = 'runecraft'`, `weaponSize = launcher size`, and it spends the rune. Everything after that line is the shared path. So the hit roll, cooldown, crowding (`crowdTicks`), projectile, bystander half chance and xp (+3 a hit, +1 a miss, through `grantXp` on `weaponDef.skill`) all come from 16. A bystander can be an ally: friendly fire is real by construction.

Cooldown is 16's rule: `size × 3 + 10 − Agility / 10`. At Agility 50 a staff is 26 ticks, a wand 14.

`Projectile` gains optional `spell?: Idx<'SpellDef'>`. `resolveProjectileHit` returns the damage it dealt. In `advanceSingleProjectile`, a hit with damage above 0 calls `applySpellOnHit` in `magic/cast.ts` (Frostbind's slow).

Below cost the channel is a club. T-473 adds the vial first (§ Vials).

The rune is spent at the cast, in every spell.

### Spells

**Task:** as the row says. Content table `spells` (new, in `03-content/weapons-and-armor.md`, new `SCHEMAS` entry and `exportSpells`).

| stone | id | name | kind | cost | range | base | type | ticks | suffix | Task |
|---|---|---|---|---|---|---|---|---|---|---|
| garnet | `emberbolt` | Emberbolt | bolt | 1 | launcher | 18 | ember | — | of embers | T-470 |
| amethyst | `frostbind` | Frostbind | bolt | 1 | launcher | 8 | frost | 300 | of frost | T-470 |
| quartz | `ward` | Ward | ward | 2 | 3 | 6 | — | 600 | of warding | T-473 |
| emerald | `mend` | Mend | mend | 2 | 4 | — | — | — | of mending | T-473 |
| sapphire | `dread` | Dread | dread | 2 | 4 | — | — | 400 | of dread | T-473 |
| ruby | `firebloom` | Firebloom | burst | 3 | 8 | 14 | ember | — | of blooms | T-473 |
| diamond | `daze` | Daze | single | 3 | 6 | — | — | 150 | of stillness | T-473 |
| glowstone | `call` | Call | call | 3 | self | — | — | — | of calling | T-475 |

Power scales `base` and `ticks`: `round(base × power)`, `round(ticks × power)`. Rune cost does not scale. Until T-473 and T-475 land, a stone with no row makes no recipe, so no such staff can exist.

Frostbind's hit, with damage above 0, adds a `slow` effect of `FROSTBIND_SLOW_PERCENT` for `round(300 × power)` ticks. T-472 adds the `rimeward` check in `addEffect` for `slow`, so spells and enchantments both respect it; T-470 has no such row to read.

When each casts (`castSupport` evaluates these for a held target, in this order; a bolt, burst or single goes by 16's ranged branch):

| Spell | Cast when | Does |
|---|---|---|
| Ward | caster has no unexpired `ward` effect | `ward` effect with `round(6 × power)` for `round(600 × power)` ticks on every fortress creature within 3 on its level, the caster too. One `Warded { id }` each |
| Mend | a fortress creature within 4, in line of sight, has a bleeding unbandaged wound or is unconscious from wounds. Nearest, then lowest id | `Mended { id, casterId }`. 17 handles it: every bleeding wound `bandaged`, light wounds removed with their hp back, the rest `cleaned` |
| Dread | two or more hostile creatures within 4 in line of sight, and `tick ≥ Rune.nextDreadTick` | up to `DREAD_MAX_TARGETS`, nearest first, each after the resist roll: a `flee` effect for `round(400 × power)` ticks, `sourceId` the caster. Sets `nextDreadTick` |
| Call | fewer than `MAX_SUMMONS_PER_CASTER` summons alive and the creature count under `MAX_CREATURES` | § Summons |

By 16's ranged branch, with `canCastBolt` also true only when:

| Spell | Condition | Does |
|---|---|---|
| Firebloom | no fortress creature stands in the 3×3 around the target at the cast | adds `{ tile, at: tick + FIREBLOOM_DELAY_TICKS, casterId, raw }` to `pendingBlooms`, through `ctx.world.services.magic` (a new `CoreServices` entry installed by 25, like `combat`). At `at`, 25's tick calls `resolveProjectileHit` with `raw` and `ember` for every creature in the 3×3, whatever its faction. So shields block and armor counts. No hit roll. The delay is what makes friendly fire real: soldiers walk in while it blooms |
| Daze | target has `Hostile.role` `captain`, or species size ≥ 100, and is not already stunned | after the resist roll, `CreatureStunned { id, until: tick + round(150 × power) }`. No hit roll, no projectile |

**Resist** (Dread, Daze): `Willpower / 2` percent, `RESIST_NO_ATTRIBUTES_PERCENT` without attributes, drawn on stream 25. Creatures of size at least `MENTAL_IMMUNE_SIZE` and every `deep` creature are immune: such a target does not qualify. Only fortress casters hold these two stones (§ Hexers), so no dwarf is ever mind-struck.

Announcements: `RuneSpent` once a caster falls below cost, until regen lifts them over it (`Rune.outAnnounced`). A firebloom that hits a fortress creature: `SpellCast`, alert, once per caster per day.

Worked numbers, at Toughness 50 (5%). All round as 16 rounds.

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

### Effects

**Task:** T-470 (`slow`), T-473 (the rest of the spells), T-474 (draughts).

`Spellbound` component (§ State). New `src/core/effects.ts`: `effectValue(entities, id, kind, tick)`, the largest value among unexpired entries of a kind, 0 if none. 25 adds entries through `addEffect` in `magic/cast.ts` and, on `HourPassed`, drops expired entries and the component with them. Readers compare `until` with the tick, so expiry needs no tick of its own.

| kind | value | read at | Task |
|---|---|---|---|
| `slow` | percent | `core/movement.ts` `moveAlongPath`, on the step's effort: `× (100 − slow + haste) / 100`, with a guard so a game with no `Spellbound` does no lookup per mover. Every creature, one place. 17's `speedModifier` is not touched | T-470 |
| `ward` | armor | `armorReduction`: `+ ward × wardMult(type)` on every part | T-473 |
| `flee` | 1 | `CombatSystem.tick`, after the conscious check: while it lasts the creature keeps its target, does not attack, and walks to a tile 12 away from `sourceId` (clamped to the map; the party's edge tile if no path). `isFleeing` counts it (+10 to hit, no parry) and gains a tick argument. 18's member step needs no change: it holds a target and returns. Nothing leaves the map, so the party's retreat count does not move | T-473 |
| `heal_rate` | percent | `health/tick.ts` healing: `healRemaining −= 5 × value / 100` when set | T-474 |
| `pain_half` | 1 | `health/tick.ts` pain sum | T-474 |
| `haste` | percent | the step above, and cooldowns in `resolveMelee` and `fireRanged`: `× 100 / (100 + value)` | T-474 |
| `fire_immune` | 1 | `armorReduction`'s caller: a hit whose wound type is `burn` does 0 | T-474 |
| `spot_radius` | tiles | `threats/ai.ts` where targets get `spotRadius` (line "spotRadius: entities.has(id, C.Attributes)"): the larger of the two | T-474 |

**Stun** is not an effect. Daze and `blackout` emit `CreatureStunned { id, until }`. 17 handles it (17 § Bleeding, pain, consciousness): it adds the creature to `wounded`, where it stays until the stun ends, saves `stunnedUntil` (a map in `HealthState`, optional), knocks a conscious body down at once with `CreatureUnconscious`, and its consciousness line becomes `conscious = pain < PAIN_UNCONSCIOUS && blood ≥ threshold && tick ≥ stunnedUntil`. So everything that respects `Body.conscious` holds: 16 skips the creature and hits it at +40, brains stop, and `CreatureUnconscious` and `CreatureConscious` fire. The patient check in `health/tick.ts` counts only unconsciousness from pain or blood, so a blackout admits no one. A stunned raider counts toward 18's retreat losses while it lies there. That is accepted: it is 150 ticks.

### Vials

**Task:** T-473.

A caster carries `CASTER_VIALS`. In `reequipSoldier`, after the weapon: a member holding a channel tops up by the ammunition logic, through `claimItemForSoldier`. `kitTypes` adds items with tag `rune_fuel`. `findAmmoForShooter` finds a carried vial by item id, from the tag.

In `canCastBolt` and `castSupport`, when `current < cost`, a hostile target is held, a vial is carried and `vialsToday < VIALS_PER_DAY`: consume one, add `VIAL_RUNE` capped at `max`, emit `VialDrunk`, set the cooldown to `tick + DRINK_TICKS`. `DayPassed` clears `vialsToday`. A Proficient runecaster has 50 rune and 15 more in the pouch for a day.

### Setting stones

**Task:** T-471.

`Item.enchant { id: Idx<'EnchantDef'>, tier: Quality }`, optional. One per item, permanent. `tier` is the runesmith's quality roll, and `QUALITY_COMBAT_MULT[tier]` scales the number where the table says so.

Recipes generated by `applyGenerated`, one per row of `enchants`, id `set_<slot>_<enchant>`:

| slot | input 0, kept | stone input | vials | ticks | Q | xp |
|---|---|---|---|---|---|---|
| weapon | 1 of every melee weapon type (the alternatives form `a\|b\|…`, from `weapons` with no launcher and no `training`) | the row's stone | the row's | 300 | yes | 15 |
| armor | 1 of every `armor` row with a layer, or the row's `only` slot | the row's stone | the row's | 300 | yes | 15 |
| ammo | 25 of `bolt\|arrow` (units) | the row's stone | the row's | 200 | yes | 10 |

A gem stone is `cut_gem` with its material; another stone is its item id.

`RecipeDef` gains `transform: true`, and such a recipe has no outputs (the schema's minimum of 1 becomes 0 when `transform` is set). An order for one is `once` only, because `outputFilter` has nothing to count. In `WorkshopOperator.complete`: input 0 is not consumed; the delivered items of input 0 get `enchant` through new `items.setEnchant(id, enchant)`, which re-accounts value as `mutate` does; they are left at the output tile with their reservation released; `StoneSet` is emitted. `ItemCrafted` is not.

Filters: `ItemFilter` gains `noEnchant: true` (`items/search.ts` `matches`, and `jobs/state.ts`), set by `recipeInputFilter` on input 0 when `transform`. `candidateTypes` needs no change, since it filters by type first. The order's material filter applies to input 0, since `inputFilter` already takes index 0 as the target when there is no first output. `WorkOrder` gains optional `targetType?: Idx<'ItemTypeDef'>`, which narrows input 0's alternatives to one type; the orders panel offers it for a transform recipe, as it offers a material. There is no "this exact item" order. The search takes the nearest match.

A soldier's gear is owned and so is never a target. The runesmith sets stones in stock, and the squad's next re-equip takes the better item: `scoreWeapon` and `scoreArmorPiece` add `ENCHANT_CLAIM_BONUS` for an enchanted item. Melting and `destroy` are unchanged, so an enchanted item melts to bars only.

**Value.** `items/value.ts`: `+ stone value × 3 + vials × 15`, added in `ItemCore.value`. A stone item's value is its material's or its item row's material value. Wealth follows through `account`. A masterwork steel breastplate of adamant is 4,000 + 90 × 3 + 12 × 15 = 4,450.

**Names.** The stocks panel and look cursor read `magic.enchantOf(itemId)` and add the row's suffix: "iron battle axe of embers (fine)". `ui/messages.ts` holds the item naming helpers.

**Mage armor** (`weapons-and-armor.md`, T-471). A new optional armor column `rune: { regenPercent?, maxBonus? }`. A piece with it does not count toward the metal penalty.

| id | name | slot | covers | layer | armor | weight | inputs | rune | Task |
|---|---|---|---|---|---|---|---|---|---|
| `rune_robe` | runed robe | body | torso 100, arms 60, legs 40 | padding | 3 | 2 | 3 `cloth` (sporecloth_cloth) + 2 `rune_vial` | regen ×1.5 | T-471 |
| `circlet` | circlet | head | head 100 | plate | 2 | 1 | 1 `bar` (silver, gold, electrum, platinum or deepsilver) + 1 `cut_gem` + 2 `rune_vial` | max +10 | T-471 |

Both are runeforge recipes, quality true, 250 and 220 ticks, xp 12 and 10. `reequipSoldier`: a member with a channel claims a piece with a `rune` property for its slot first, past the squad's armor preference.

### Enchantments in combat

**Task:** T-472 (effects); rows arrive per the table. Content table `enchants` (new; in T-471).

The resolution reads rows, never ids. A row: `{ id, slot, stone, vials, suffix, effects: { kind, value, ticks?, chance?, scales }[] }`. A row's `Task` column says when its stone is available.

Weapons:

| stone | id | vials | suffix | effect at common tier | scales | Task |
|---|---|---|---|---|---|---|
| quartz | `keen` | 4 | keen | `damage_percent` +10 | yes | T-471 |
| garnet | `ember` | 6 | of embers | `extra_damage` +8 `ember` | yes | T-471 |
| amethyst | `rime` | 6 | of rime | `slow` 30% for 200 ticks | yes (ticks) | T-471 |
| emerald | `sure` | 6 | sure | `to_hit` +10 | yes | T-471 |
| sapphire | `fearsome` | 8 | fearsome | 25% `flee` for 200 ticks | no | T-471 |
| ruby | `blaze` | 10 | of blaze | `extra_damage` +14 `ember` | yes | T-471 |
| diamond | `sunder` | 12 | sundering | `armor_percent` 50: the target's armor counts at half | no | T-471 |
| deepsilver bar | `deep` | 12 | of the deep | `damage_percent` +25, `vs_deep_percent` +50 | no | T-476 |
| `hollow_ichor` | `hollowbane` | 8 | hollowbane | `vs_deep_percent` +100 | no | T-476 |

Armor:

| stone | id | vials | suffix | effect at common tier | scales | Task |
|---|---|---|---|---|---|---|
| quartz | `stout` | 4 | stout | `armor` +2 on the piece | yes | T-471 |
| garnet | `emberward` | 6 | of embers warded | `fire_percent` 50 on covered parts | no | T-471 |
| amethyst | `rimeward` | 6 | of rime warded | `frost_percent` 50 on covered parts; wearer never slowed | no | T-471 |
| diamond | `adamant` | 12 | adamant | `armor` +4 on the piece | yes | T-471 |
| glowstone | `glowing` | 6 | glowing | `spot_radius` +2 | no | T-471 |
| `wyrmscale` | `wyrmhide` | 8 | wyrmhide | `fire_percent` 0 on covered parts | no | T-476 |
| `hollow_ichor` | `hollowsight` | 8 | of hollow sight | `spot_radius` 10; head slot only | no | T-476 |

Ammunition (a set of 25):

| stone | id | vials | suffix | effect | Task |
|---|---|---|---|---|---|
| garnet | `ember` (ammo row `ember_ammo`) | 4 | of embers | `extra_damage` +6 `ember` | T-471 |
| amethyst | `rime` (ammo row `rime_ammo`) | 4 | of rime | `slow` 30% for 200 ticks | T-471 |
| emerald | `seeking` | 4 | seeking | `to_hit` +10 | T-471 |

Where each kind is read. All of them guard on the item having `enchant`, so an unenchanted fight does the same arithmetic and draws the same numbers.

| kind | seam |
|---|---|
| `to_hit` | `resolveMelee`, the `hit` sum, from the weapon. `fireRanged`, the `hit` before the roll, from the ammunition |
| `damage_percent`, `vs_deep_percent` | `resolveMelee`, on `raw`, before armor. The target counts as deep by `Creature.faction === 'deep'` |
| `armor_percent` | `armorReduction` gains an optional percent argument. `resolveMelee` passes it |
| `armor` | `armorCovering`: `piece.armor + value` where the piece has it |
| `fire_percent`, `frost_percent` | after `armorReduction`, on the damage, from the pieces covering the part. Fire is a hit whose wound type is `burn`, so it covers the wyrm's breath. Frost likewise |
| `extra_damage` | after a hit with damage above 0: `applyEnchantOnHit` in `magic/cast.ts`, called from `resolveMelee` and `advanceSingleProjectile`. It emits a second `DamageDealt` on the same part, with its own `armorReduction` and Toughness, and no `AttackResolved` |
| `slow` | `applyEnchantOnHit`: `addEffect`, unless the target wears `rimeward` |
| `flee` | `applyEnchantOnHit`: roll `chance` on stream 25, then the resist rule. Never on `deep` |
| `spot_radius` | the same line as the draught's effect, from the head and body pieces |

Enchanted ammunition stays enchanted through `split`, and `canMerge` keeps it apart. A bolt that breaks is gone with its stone. Its effect is read from `proj.itemId` at the hit.

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

**Task:** T-475.

A summon is a **war-trained tame animal assigned to its caster**. 08's tame brain already does the rest: it takes targets within `WAR_ANIMAL_RADIUS` of its dwarf, follows within 1 tile, and 16's targeting fights. `Call` does `spawn.creature(species, tile, 'fortress')`, then adds `Tame { trained: 'war', assignedTo: casterId, noBreed: true, condition: 100, pastureId: 0, … }` and `Summoned { summonerId, fadesAt: tick + SUMMON_TICKS }`. The tile is the nearest free passable neighbour of the caster.

War training adds +50% damage and +1 natural armor (`isWarTrained`), so the rows hold the lower numbers.

The staff's material picks the row, through a new optional metals column `summon` (species id): steel and silver `stone_warden`, deepsilver `deep_shade`. A wand, or any other metal, gets the `call` spell row's default, `wisp`.

| id | plan | size | speed | movement | attacks | armor | flags | glyph | fg | as fought | Task |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `wisp` | crawler | 10 | 240 | walker | touch `ember` 4 size 2 | 0 | `summoned`, `trainable: none` | `*` | `rune_cyan` | 6 `ember` | T-475 |
| `stone_warden` | humanoid | 90 | 105 | walker | slam `blunt` 15 size 8 | 7 | `summoned`, `trainable: none` | `Φ` | `granite_gray` | 22 `blunt`, armor 8 | T-475 |
| `deep_shade` | humanoid | 60 | 210 | walker | claw `edge` 12 size 3 | 1 | `summoned`, `trainable: none` | `δ` | `hollow_violet` | 18 `edge`, armor 2 | T-475 |

Rows carry `flags.summoned: true`, and code reads the flag. A summoned species:

- leaves no corpse: `items/index.ts`, the `CreatureDied` branch, skips `createCorpse` when the species has the flag;
- is never slaughtered, named, assigned or trained: the animal commands reject `not_found`, and the animals panel leaves it out;
- gives no grief: no `petOf`, and 15's thoughts on death read dwarves and pets only;
- is never butchered: no `butcherable` flag;
- has no `Hostile`, so no party counts it.

**Fading.** On `HourPassed`, 25 kills every `Summoned` with `fadesAt ≤ tick` through 17's `killCreature` with cause `faded`, by emitting `SummonFaded { id }`, which 17 handles. On a summoner's `CreatureDied`, its summons get `fadesAt = tick`. Death at 0 hp is ordinary and leaves nothing.

**Turning.** A `deep_shade` turns with `SHADE_TURN_PERMILLE`, on stream 25. It spawns with faction `deep` and no `Tame`, and 25 emits `SummonTurned { id }`. 18 handles that: it adds `Hostile { role: 'hollow', behaviorState: 'attack', … }`, puts it in `hollowBorn`, and sets the nearest fortress target, as `triggerDeepEmergence` does. T-475 extracts that part of the loop into `spawnedHollowBorn(ctx, id, tile, hollowBorn)`. Announcement `SummonTurned`, danger. Thought `summon_turned`, everyone.

**Wisp mishap.** `wisp_loose` spawns `wisp` with faction `wild` and `Summoned { summonerId: 0, fadesAt: tick + SUMMON_TICKS }`. Its temper is `timid`, so 08's wild brain wanders it. The apprentice gets no thought.

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

**Task:** T-471.

Extra goods are built: 20 § Caravans says how they are drawn, and `caravan-goods.md` lists them. An extra good adds no pack animal, so a caravan's party is what it would be without it. T-471 adds a row to the extra table of `caravan-goods.md`, whose `Reputation` column takes `≥ 50`.

| civ | entry | item | count | permille | reputation | Task |
|---|---|---|---|---|---|---|
| mountainhome | Rune vials | `rune_vial` ×5 | 1 | 400 | ≥ 50 | T-471 |

Preferences (`caravan-goods.md`, T-471): Mountainhome `medical/vial` and `medical/draught` 150. Wildwood's wood rule already reaches a wand. No civilization values "enchanted" separately: `preferencePercent` reads category and material, and an enchanted item's value is already higher.

### Morale

**Task:** as the row says. Rows go to `personality-and-thoughts.md`; each needs a case in `morale/thoughts.ts` `eventPredicate` and `eventTargets`. `attuned`, `singed` and `first_runecaster` are there (Work and skill; Pride and relief): `attuned` matches an `AttuneSession` whose `mishap` is empty, and `first_runecaster` goes to everyone; the event has its own announcement.

| id | text | value | hours | decay | cap | group | trigger | Task |
|---|---|---|---|---|---|---|---|---|
| `warded` | "Felt the ward settle on me." | +1 | 12 | linear | 1 | comfort | `Warded` | T-473 |
| `mended_by_rune` | "The rune closed my wound." | +3 | 48 | linear | 1 | none | `Mended` | T-473 |
| `eased` | "The draught quieted me." | +8 | 72 | linear | 1 | none | a calming draught | T-474 |
| `dosed_again` | "Another draught. I am tired of draughts." | −4 | 72 | halflife | 1 | none | a calming draught within the rest | T-474 |
| `summon_turned` | "Something came through that was not called." | −4 | 48 | halflife | 1 | fear | `SummonTurned` (everyone) | T-475 |

Every value sits inside the caps. Nothing here can take a fed, rested dwarf below 20.

## State

Rows go to `schemas/components.md` and the ownership table by task. `id-fields.ts` regenerates. `Rune` (with `current` only), `MagicState` (in `schemas/system-state.md`, with `lastMishaps`, the last mishap of each sanctum for its panel) and `HealthState.stunnedUntil` are there.

```ts
interface Rune {                 // owner 25; also written by 18 for hexers
  current: number;               // milli-rune
  vialsToday?: number;           // T-473
  nextDreadTick?: Tick;          // T-473
  outAnnounced?: boolean;        // T-473
}
interface ActiveEffect { kind: string; value: number; until: Tick; sourceId: EntityId }
interface Spellbound {           // owner 25. T-470
  effects: ActiveEffect[];
  lastDraughtTick?: Tick;        // T-474
  lastCalmTick?: Tick;           // T-474
}
interface Summoned { summonerId: EntityId; fadesAt: Tick }   // owner 25. T-475

// additions to existing components
Item.stone?: Idx<'MaterialDef'>                               // T-470
Item.enchant?: { id: Idx<'EnchantDef'>; tier: Quality }       // T-471
Projectile.spell?: Idx<'SpellDef'>                            // T-470
WorkOrder.targetType?: Idx<'ItemTypeDef'>                     // T-471
Squad.equipment.draughts?: Idx<'ItemTypeDef'>[]               // T-474

interface MagicState {           // system 25's serialize(); schemas/system-state.md
  stateVersion: 1;
  sessionsToday?: [EntityId, number][];
  firstRunecasterDone?: boolean;
  lastMishaps?: [EntityId, { kind: string; dwarfId: EntityId; tick: Tick }][];
  pendingBlooms?: { tile: TileIndex; at: Tick; casterId: EntityId; raw: number }[];  // T-473
}
HealthState.stunnedUntil?: [EntityId, Tick][]
```

The system: `MagicSystem` in `src/systems/magic/index.ts`, `id '25'`, `order 25`, cadence 1, phase 0, added to `HeadlessGame.standardSystems` last. Its tick does nothing unless `pendingBlooms` is due, and returns at once when it is empty. Rng: `ctx.rng` is `world.rngFor('25')` in its own hooks; `magic/cast.ts`, called from 16's tick, uses `ctx.world.rngFor('25')` by name. The stream is saved in the `rng` section, not in `MagicState`, since 20 draws on it too.

## Interfaces

The `interface:check` script compares this section with the code. It holds only what exists. Each task moves its rows here from § Planned interfaces.

### Reader

- `magic.rune(id)` — current, max and regen in milli-rune, the metal percent and the pieces that lower it, and whole hours to full (0 full, −1 never); undefined without a `Rune`
- `magic.sanctums()` — sanctum zones, ascending; `magic.apprentices(zoneId)` — its living adult apprentices, ascending; `magic.sessionsToday(id)`
- `magic.mishapPermille(zoneId, id)` — the mishap chance of this dwarf's next session there; `magic.lastMishap(zoneId)` — kind, dwarf and tick of the sanctum's last mishap, or undefined

### Commands

`SetSanctumApprentices { zoneId, dwarfIds }`.

### Events consumed

`HourPassed` (regen; the producer's hourly look), `DayPassed` (sessions), `SkillLevelUp` (the `Rune`, `FirstRunecaster`), `CreatureDied`, `ZoneChanged` (sanctums).

### Events emitted

`AttuneSession { id, xp, mishap }`, `Mishap { id, kind, buildingId?, tile? }`, `CreatureStunned { id, until }`, `FirstRunecaster { id }`, and 16's `DamageDealt` (a mishap's light burn, `attackerId` 0).

### Registrations

Job producer `magic` (`attune`); inspector sections `creature › rune` and `zone › sanctum` (the sanctum panel, in 14's zones panel); announcements: `Mishap` (note for `singed`, `blackout`, `surge`; alert for `scorched_circle`, `fire`), `FirstRunecaster` (note).

## Planned interfaces

| Kind | Name | Task |
|---|---|---|
| Reader | `magic.canCast(id)`, `magic.spellOf(itemId)`: the spell and its numbers in that item | T-470 |
| Reader | `magic.effects(id)` | T-470 |
| Reader | `magic.enchantOf(itemId)`: a text line and the row | T-471 |
| Reader | `magic.summonsOf(id)` | T-475 |
| Event | `SpellCast { casterId, spellId, targetId, tile }` | T-470 |
| Event | `StoneSet { itemId, enchantId, tier, smithId }` (12 emits it) | T-471 |
| Event | `RuneSpent { id }`, `VialDrunk { id }`, `Warded { id }`, `Mended { id, casterId }` | T-473 |
| Event | `DraughtDrunk { id, draughtId }` | T-474 |
| Event | `SummonCalled { id, casterId }`, `SummonTurned { id }`, `SummonFaded { id }` | T-475 |
| Event | `DeepsilverWorked { amount, tile }` (12 emits it) | T-476 |
| Consumes | `RaidArrived`, `AmbushSprung`, `AttackResolved`, `ThreatNearby`, `MonsterEmerged`, `DeepStirred` | T-474, T-476 |
| Registration | job producer `magic`: `give_draught` | T-474 |
| Registration | inspector section `item › stone`; announcement `StoneSet` at masterwork (note) | T-470, T-471 |
| Registration | announcements: `RuneSpent` (note), `SpellCast` of a firebloom that burns a fortress creature (alert) | T-473 |
| Registration | announcements: `SummonTurned` (danger) | T-475 |

Other systems' documents gain their parts in the same commits: 12 (`transform`, `spoilable`, `stone`), 13 (`setEnchant`, `noEnchant`, value, `remains`), 14 (`sanctum`), 16 (channels, effects, damage types), 17 (`CreatureStunned`, `Mended`), 18 (`DeepsilverWorked`, `SummonTurned`, `hexer`), 22 (`moveAlongPath`).

## Player-facing behavior

- **Glyphs.** Wand `'`, staff `⌠`, vial `¡`, rune circle `○`, all `rune_cyan`. Draught `!`, in the color of its row. Wisp `*`, warden `Φ`, shade `δ`. A hexer is `G`. All are in CP437, so `font-additions.json` does not change. `◊` and `¦` are not, which is why the design's glyphs changed. A warded creature's glyph has a dimmed `ward_cyan` background (T-473, `render/compositor.ts`; palette row in the same task).
- **Sanctum panel**: the selected sanctum's inspector in the zones panel (zone type key `[S-c]`, `ui-screens/panels.md` § Zones). The room's tier, score and missing circle; the glowcap in stock; the mishap chance in words for a new apprentice ("one session in 17"); each apprentice with level, rune and sessions left today, and its own chance; the last mishap. `[S-o]` opens the apprentice picker, which adds or removes one adult dwarf at a time through `SetSanctumApprentices`.
- **Inspector, `creature › rune`**, in the look panel's creature tab: "Rune 31/50, +0.6 an hour (iron helm -20%, iron mail shirt -20%); full tomorrow". From T-470 the staff and its spell's numbers; from T-473 vials and effects; from T-474 "Can take a draught again in 2 days"; from T-475 summons.
- **Look cursor** (T-470): "iron staff of embers (fine). Emberbolt: 24 ember, range 12. Needs a runecaster." (T-471): "steel battle axe of embers (fine). +9 ember on a hit."
- **Squad panel** (T-474): the ordered draught checklist, with each trigger in words. (T-470): a channel shows beside a member only if they can use it.
- **Orders panel** (T-471): a transform recipe offers the target type and the material.
- **Hints** (`hints` rows, T-477, each with a trigger on stock or buildings): "Glowcap grows in the dark under a glowstone lamp." "A staff is a stone on a stick: the stone is the spell, the dwarf is the fuel." "A wand is quick and soft; a shod staff is slow and hard." "Build the sanctum in stone." "Iron drinks the rune: a runecaster in mail recovers slowly." "The runeforge burns vials, not coal." "One draught, then three days' rest."
- **Legend milestones** (`milestones` rows and `legend/index.ts`): first stone set and first runecaster (T-476), first summoning answered (T-475).

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
| `CASTER_HOLD_DISTANCE` | 4 | A support caster with rune stands this far from its target | T-473 |
| `CASTER_VIALS` / `VIAL_RUNE` / `VIALS_PER_DAY` / `DRINK_TICKS` | 3 / 5 / 3 / 30 | | T-473 |
| `FIREBLOOM_DELAY_TICKS` | 20 | Between the cast and the bloom | T-473 |
| `DREAD_MAX_TARGETS` | 4 | | T-473 |
| `RESIST_NO_ATTRIBUTES_PERCENT` | 25 | | T-473 |
| `MENTAL_IMMUNE_SIZE` | 180 | | T-473 |
| `ENCHANT_CLAIM_BONUS` | 0.5 | Added to a claim score | T-471 |
| `DRAUGHT_TICKS` | 1200 | One day, times the quality multiplier | T-474 |
| `DRAUGHT_REST_DAYS` / `CALM_REST_DAYS` | 3 / 7 | | T-474 |
| `ALCHEMY_MISHAP_PERMILLE` | 100 | Per job, less 10 per level | T-474 |
| `SUMMON_TICKS` / `MAX_SUMMONS_PER_CASTER` / `SHADE_TURN_PERMILLE` | 1200 / 2 / 50 | | T-475 |
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
