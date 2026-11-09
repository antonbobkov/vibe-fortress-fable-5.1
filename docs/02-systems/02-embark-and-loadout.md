# 02 Embark & Loadout

**Owner:** `systems/embark` · **Depends on:** [01-world-generation.md](01-world-generation.md), [03-terrain-and-mining.md](03-terrain-and-mining.md), [06-weather-and-seasons.md](06-weather-and-seasons.md), [08-animals-and-domestication.md](08-animals-and-domestication.md), [10-dwarves.md](10-dwarves.md), [`../01-architecture/constants.md`](../01-architecture/constants.md)

## Purpose

Take the chosen region and the player's spending decisions and produce the starting fortress: seven dwarves, their supplies and animals, and the wagon on the surface. Also produce the `LocalMapSpec` that 03 uses to generate the local map.

## Concepts

- **Budget**: marks available to spend. `EMBARK_BUDGET_BASE + EMBARK_BUDGET_PER_PERIL × region.peril`. Harder regions grant more, so the trade is more supplies now for more danger later.
- **Party**: the seven dwarves. Each has a generated name, rolled attributes and personality, and player-assigned skills.
- **Catalog**: the list of purchasable items and animals with prices (`embark-catalog.md`). Prices are the item value plus a fixed markup, and animal values.
- **Preset**: a named fill of skills and supplies that fits the base budget.
- **Wagon**: a 3×3 building placed on arrival, containing the supplies, deconstructable for logs.

## Rules

### Party generation

For each of `EMBARK_DWARF_COUNT` dwarves, from the `embark.party` rng stream:

- Name: given name and hall-name from the names table; sex random; age uniform in `EMBARK_AGE_MIN..EMBARK_AGE_MAX` years.
- Attributes: each of the seven rolled as `ATTRIBUTE_BASELINE + sum of three rolls in −8..8` (a bell shape from 26 to 74), then clamped.
- Personality: three distinct traits from the personality table, weighted by their frequency.
- Skills: all zero. The player distributes `EMBARK_SKILL_POINTS_PER_DWARF` points, at most `EMBARK_SKILL_MAX_PER_SKILL` in any skill. Unspent points are lost; the screen warns. A skill with `embark: no` in `skills-and-professions.md` is not offered, and `SetSkill` refuses it with `not_found`.
- A dwarf can be re-rolled (new name, attributes, personality; skills kept) for `EMBARK_REROLL_COST` marks.
- Names are editable.

### Supplies

- The catalog is grouped: tools (picks, axes, crossbows and bolts, fishing rods, anvils), food (meals, meat, fish, plants, cheese), drink (ale, wine, bellwine), seeds, cloth and leather, bars, stone blocks, furniture (beds, tables, chairs), medical (thread, cloth, splints), animals.
- Quantities are set per line; the running total updates; the total cannot exceed the budget.
- Rules of thumb are shown as hints, not enforced: "Two picks, one axe, food and drink for the first week, and water or a still soon after, seeds for two plots."

### Presets

| Preset | Skills emphasis | Supplies emphasis |
|---|---|---|
| `balanced` | 2 miners, 1 carpenter/woodcutter, 1 mason/builder, 1 farmer/brewer, 1 cook/herbalist, 1 medic/hunter | 2 picks, 1 axe, 1 crossbow, a week of food and half a week of drink, seeds, 2 dogs, 1 cat |
| `miners_guild` | 3 miners, 1 smelter/smith, 1 mason, 1 brewer, 1 farmer | 3 picks, more drink, an anvil, iron bars |
| `farmstead` | 2 farmers, 1 herbalist, 1 cook, 1 brewer, 1 carpenter, 1 miner | Seeds of every kind, 2 cows, 4 chickens, 2 sheep, fewer tools |
| `warband` | 2 soldiers (axe, shield), 1 crossbow hunter, 1 armorsmith, 1 miner, 1 farmer, 1 medic | Iron weapons and mail for two, bolts, 3 war dogs, less food |

A preset fills the party skills and the supply list to `EMBARK_BUDGET_BASE`; any extra peril budget stays unspent for the player. The embark screen opens with `balanced` applied.

### Testing mode

A start for trying features without reaching them in play (the owner, T-532). It is off by default; the embark screen says so on its bottom line (`[t] Testing mode: off`), and a fortress started in it is marked as testing for good.

- **No budget.** The budget is unlimited; rerolls are free; Embark needs only a name and one dwarf.
- **Any party.** Dwarves are added (`AddDwarf`, from the `embark.party` stream, with no skills) and removed (`RemoveDwarf`), from 1 to `EMBARK_TESTING_MAX_DWARVES`.
- **Any skill at any level.** Every skill is offered, the `embark: no` ones (runecraft, runesmithing, alchemy) included, from 0 to `SKILL_MAX_LEVEL`, per dwarf (`SetSkill`) or for the whole party at once (`SetSkillAll`). There is no point limit.
- **Any item.** A catalog line goes to `EMBARK_TESTING_MAX_COUNT`, ignoring its `max` and its temperature condition. Free item lines (`AddItem`, `SetItemCount`) bring anything else: an `items` row in any material (the materials that suit the item's `materials` column are offered first; any other is allowed and marked unusual), a quality from poor to masterwork (common when absent), a count to `EMBARK_TESTING_MAX_COUNT`, and for a wand or a staff (a launcher with no ammunition) a stone that carries a spell (`Item.stone`), or for a weapon, an armor piece or ammunition an enchantment of its slot (`Item.enchant`, its tier the line's quality). Two lines of the same item, material, quality, stone and enchantment merge. At arrival the free lines go into the wagon after the catalog's supplies, in stacks of the item's `stack`, a drink in a pine barrel per stack.
- **Rune at arrival.** A dwarf who arrives with `runecraft` 1 or more holds its `Rune`, full (25 § Rune of one's own); no `SkillLevelUp` is emitted, so `FirstRunecaster` waits for a dwarf who earns level 10.
- **Switching.** Turning testing mode on keeps the loadout and lifts the limits. Turning it off goes back to seven dwarves with no skills and nothing bought, and the screen applies `balanced` (asking first when anything was edited). A normal preset leaves testing mode; the testing preset enters it.
- **The testing preset** (`testing_fortress`, "Testing fortress", defined with the session in `systems/embark/testing.ts` because it names free item lines the preset table cannot hold): twelve dwarves at level 15 covering every labour that has a skill (mining, masonry, carpentry, farming, brewing, cooking, smithing, runecraft, runesmithing, alchemy, medicine, the combat skills and the rest); plenty of food, drink, logs, blocks, bars (iron, copper, steel, silver, gold) and charcoal; seeds of every kind; beds and furniture; a squad's kit (helms, mail, swords, spears, shields, crossbows and bolts) and two war dogs; for runecraft 40 glowcap, 20 glowcap seed, rough glowstone and two glowstone statues to place as lamps, 60 rune vials, a cut gem of every spell's stone, staffs of embers, of warding and of mending, wands of stillness and of calling, an axe of blaze, a keen sword, a stout mail shirt, 25 ember bolts, two runed robes and two silver circlets, and mending and stout draughts. Runecraft, smithing, farming and combat can be tried on the first day.
- **The mark.** `FortressState.testing` is `true` (absent for a normal fortress, so no normal world hash moves). The save header carries `testing: true` and the Load screen marks the row "(testing)". The legend record carries `testing`; its screen names the fortress "(testing)", says "A testing fortress: it began with an unlimited loadout, so its milestones were not earned in normal play.", and heads its milestones "Milestones (testing start)". Milestones are still recorded, since testing them is a use of the mode.

### Loadouts

The player can save the current loadout under a name and load it on a later embark, on any site and any world.

- **A loadout** is the supply list (catalog entry and count) and each dwarf's skills by party position (the first dwarf's, the second's, …). It does not hold the party's names, attributes or rerolls, or the fortress name: those belong to the world and the site.
- **Saved loadouts** are kept by the app outside any world, beside the settings (`01-architecture/persistence.md` § Storage), so they survive a reload and serve every new world. A name is 1 to `EMBARK_LOADOUT_NAME_MAX` characters (24 § Tuning constants); names compare without case, and saving under a name that is taken asks before it replaces that loadout (`c_overwrite_loadout`). Saved loadouts can be listed, loaded, renamed (not to a taken name) and deleted (`c_delete_loadout`).
- **Loading** replaces every skill and supply line with the loadout's, through the session's own `SetSupply` and `SetSkill`; after edits it asks first (`c_load_loadout`). A loadout is stored by content id, so it survives a content change: a catalog entry or skill that no longer exists, or is no longer offered at embark, is left out; an entry whose temperature condition fails on this site is left out; a count or level above its current limit is lowered to the limit; skills for dwarves beyond the party are left out. The screen names each of them after the load.
- **The budget is never changed by a load.** A loadout that costs more than the site's budget loads whole; the screen says what it costs and by how much it is over, Embark stays disabled with its reason ("Over budget by 44 ☼"), and the player trims it. The same holds for a dwarf with more skill points than `EMBARK_SKILL_POINTS_PER_DWARF`.
- **A testing loadout** (saved in testing mode, § Testing mode) also holds `mode: testing` and the free item lines, and its party size is the number of dwarves whose skills it holds. It loads in testing mode: the party grows or shrinks to that size (new dwarves from the `embark.party` stream), then the skills, supplies and free lines are set; a free line whose item, material, stone or enchantment no longer exists is left out and named. A normal loadout loaded in testing mode goes back to normal play first (seven dwarves). The saved loadouts list marks a testing loadout "testing" instead of "over budget".

### Fortress name

Text field with a generated default from the names table. Used in announcements, saves and the legend.

### Local map specification

On Embark, produce:

```
LocalMapSpec {
  seed: hash(worldSeed, regionId),
  biome, elevation, relief (0–3 from neighbor elevation differences; 0 is level), soilDepth (from biome),
  geology, wealth, peril, temper, deepness, traits, volcano,
  river: { inflowEdges, outflowEdge, class } | null, lake,
  civEdges: nearestEdgeTo, arrivalEdge: nearestEdgeTo.mountainhome
}
```

`relief = maxDiff = 0 ? 0 : min(3, 1 + floor(maxDiff / RELIEF_DIFF_STEP))`, where `maxDiff` is the largest absolute elevation difference to the eight neighbouring regions that exist. Relief 0 is level ground, which a region has only when every neighbour shares its elevation; every other site has at least the gentle relief 1 (03 stage 1).

03 generates the map from this and nothing else, so a region always generates the same local map.

### Site summary

Before the player chooses a site, the world map's region panel summarises what its local map will have (`04-implementation/ui-screens/menus-and-world.md` § World map). The summary is computed from the region's `LocalMapSpec` and the content tables 03 reads, by the rules of 03 § Local map generation, so it never says what the map will not have. What generation rolls is given as an estimate and says so ("about", "likely").

| Row | What it says | Rule |
|---|---|---|
| Soil | the soil materials, most common first, and the depth in levels; or none, on bare rock or obsidian | 03 stage 3: `soilDepth` of the biome (+2 and `loam` only on `serene_vale`); none where it is 0 (`alpine`) and on `glasslands`, whose surface is obsidian |
| Trees | about `treeDensity × LOCAL_MAP_W × LOCAL_MAP_H` trees, and the species by weight (willows too when a river is carved); or none | 03 stage 9: trees grow only on soil; `glasslands` density |
| Shrubs | about `(1 − treeDensity) × shrubDensity × LOCAL_MAP_W × LOCAL_MAP_H` shrubs and their species, or none; grass to graze, or no grass and cave moss below | 03 stage 9: shrubs and grass only on soil; cave loam floors carry grass (07 § Grass) |
| Water | the river carved (its class, its inflow edges or the spring it rises from, and its outflow edge or a lake at its end), the region's lake, `gemsprings`' warm springs; "likely frozen in winter" when the winter value below is under `FREEZE_C`; or none on the surface | 03 stage 2: every river region carves its river, a river's source region from a spring; the springs need dry surface soil (stage 10) |
| Stone | the geology class and its layers, top down (basalt first on `glasslands`) | 03 stage 4 and the layer templates |
| Ores | likely: every ore whose expected count (03 stage 7, with the `ironheart` and `glasslands` changes) is at least one and whose host is a layer the map must reach, most expected first; deepsilver when the wealth gives deepsilver veins | a layer is reached when its deepest possible top (the maximum thicknesses above it) lies above the lowest rock level under the lowest possible surface (stage 1's base minus the relief amplitude, less the soil) |
| Climate | the temperature band of the region's `tempC`, the mean, and summer and winter as `seasonBase + temperSpread`; under `frostmarrow`, spring and autumn as cold | 01 § Biomes bands; 06 § Surface temperature |
| Wildlife | the biome's surface species by weight: the aggressive and territorial ones as dangerous, then the rest; `serene_vale` removes its banned species; `frostmarrow` adds the wild yak | 08 § Wild spawning |

The missing essentials come first, in the alert colour, each with its consequence and workaround: no surface soil (farm in a cavern or on mud, graze in a cavern), no trees (wood only from the wagon, logs brought, caravans and cavern fungus), no water on the surface (drink only what is brought or brewed; dig to a cavern lake). Water is missing when there is no carved river, no lake and no spring.

### Arrival

1. Generate the local map (03).
2. Find the wagon site: the 3×3 patch of walkable surface tiles with no trees, nearest to the midpoint of the `arrivalEdge`, searching inward up to `ARRIVAL_SEARCH_DEPTH` tiles; if none, clear trees from the first candidate patch. Each cleared tree leaves its own species’ `logs` range, clamped by `TREE_LOGS_MIN` and `TREE_LOGS_MAX`, drawn from the `02` stream; the logs are of its wood and lie on its tile. A tree tile’s material id identifies the species; plants and materials have independent numeric indices.
3. Place the wagon building (function tag `container`, capacity unlimited, deconstructable, yields `WAGON_LOGS` pine logs; the wagon is made of pine).
4. Spawn every purchased item inside the wagon's container, using the catalog material for each item and its container (pine barrels and flax-cloth bags). The wagon may hold these item containers; their contents lie at its centre and are found and unloaded as on the ground. Spawn animals on walkable tiles around the wagon after the dwarves’ tiles. An explicit sex wins; a purchased unit of several animals is females followed by one male; single animals from one line alternate female, male. Each is `Tame` with no pasture, condition 0 and the training bought.
5. Spawn the dwarves through the creature spawn API, using the party records to build 10's dwarf components, adjacent to the wagon with all labors enabled except that dwarves with a combat skill ≥ 3 also get `Soldier`-ready flags (no squad yet). Needs start at 20 (mildly hungry, thirsty, rested).
6. Assign the title Thane to the dwarf with the highest Charm (ties by id). No Warden, Broker or Chief Medic yet.
7. Set the fortress name, embark tick and region. The calendar is set to `START_SEASON`, day 1, `START_HOUR`, year 1 before any arrival spawn, so supplies and creatures carry the arrival tick.
8. Emit `Embarked { fortressName, regionId }`. The app switches to the fortress screen, paused, centered on the wagon at the surface z-level, and shows the first hint.

Arrival consumes item entries of the local map’s trait spawn list; an entry's `stone`, when present, is set as the item's `Item.stone`. Creature entries are consumed by 08 and 18 after arrival.

## State

Embark state exists only during the embark screen: `budget`, `party[]`, `supplies[]`, `preset`, `fortressName`, `mode` (`normal` or `testing`) and `items[]` (testing mode's free item lines). After arrival nothing of it persists except through the world (the wagon, items, dwarves), for a testing embark `FortressState.testing`, and the saved loadouts, which the app keeps outside every world (§ Loadouts). The `LocalMapSpec` is saved with the world for reference.

## Interfaces

### Reader

Not applicable: there is no embark reader. The app constructs the embark session before the world exists and the embark screen holds it directly. The session's fields (the party, the supplies, the preset, the fortress name) are state, not reader methods.

### Commands (embark session, handled by the app before the world exists)

`SetSkill { dwarf, skill, level }`, `RerollDwarf { dwarf }`, `RenameDwarf { dwarf, name }`, `SetSupply { entry, count }`, `ApplyPreset { preset }`, `SetFortressName { name }`, `ConfirmEmbark`; and for testing mode (§ Testing mode) `SetEmbarkMode { mode }`, `AddDwarf`, `RemoveDwarf { dwarf }`, `SetSkillAll { skill, level }`, `AddItem { line }`, `SetItemCount { index, count }`. The testing commands are refused with `not_testing` in normal mode.

### Events emitted

`Embarked { fortressName, regionId }`.

## Player-facing behavior

The site is chosen on the world map, whose region panel carries the site summary (§ Site summary). The embark screen has three tabs and a footer:

- **Dwarves**: list of seven, each with its skills beside its name; selecting one shows name (editable), age, attributes as bars, personality words, and the skill list with +/− controls, remaining points and a find field. Reroll button.
- **Supplies**: catalog grouped by category with quantity fields, unit price, line total; a find field that searches every entry, animals too, by name or group; and a view of every chosen line, supplies and animals, to review and trim the loadout in one place.
- **Animals**: species with price and count.
- **Items** (testing mode only): the free item lines and the form that makes one (§ Testing mode); its find field narrows the selected field's choices.
- Footer: budget remaining, preset menu (each preset with its total and its dwarves' main skills), fortress name, Embark button; below it the testing mode switch. Embark is disabled while over budget and shows why; otherwise, outside testing mode, the footer names any dwarf whose skill points are unspent. Leaving the screen after edits asks first (`c_leave_embark`, default No), since the edits are lost. Embarking with no pick, no axe, no food item or no drink item asks first, one question for each, in that order ("Embark without a pick?", "Embark without an axe?", "Embark with no food?", "Embark with no drink?"; confirmations `c_embark_no_pick`, `c_embark_no_axe`, `c_embark_no_food`, `c_embark_no_drink`, default No).

Nothing chosen here is irreversible in the fortress: skills grow, items are consumed, animals breed.

## Tuning constants

| Name | Value | Meaning |
|---|---|---|
| `EMBARK_AGE_MIN` / `EMBARK_AGE_MAX` | 18 / 65 | Years (*unmeasured*) |
| `EMBARK_REROLL_COST` | 25 | Marks (*unmeasured*) |
| `EMBARK_MARKUP_PERCENT` | 20 | Added to item value for catalog price (*unmeasured*) |
| `ARRIVAL_SEARCH_DEPTH` | 20 | Tiles inward from the edge to search for a wagon site (*unmeasured*) |
| `WAGON_LOGS` | 3 | Logs from deconstructing the wagon (*unmeasured*) |
| `RELIEF_DIFF_STEP` | 96 | Elevation difference to a neighbour per relief level above 1 (*unmeasured*) |
| `EMBARK_TESTING_MAX_DWARVES` | 50 | Most dwarves a testing embark brings (*unmeasured*) |
| `EMBARK_TESTING_MAX_COUNT` | 999 | Most units of one catalog entry or one free item line in a testing embark (*unmeasured*) |

## Extension points

- New catalog entries and presets are content rows.
- A different party size is `EMBARK_DWARF_COUNT`; the screen lays out any count up to 12.
- A "reclaim" mode (arriving at a fallen fortress) would reuse arrival steps 2–8 with an existing local map.
