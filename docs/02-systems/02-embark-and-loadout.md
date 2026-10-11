# 02 Embark & Loadout

**Owner:** `systems/embark` · **Depends on:** [01-world-generation.md](01-world-generation.md), [03-terrain-and-mining.md](03-terrain-and-mining.md), [10-dwarves.md](10-dwarves.md), [`../01-architecture/constants.md`](../01-architecture/constants.md)

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
- Skills: all zero. The player distributes `EMBARK_SKILL_POINTS_PER_DWARF` points, at most `EMBARK_SKILL_MAX_PER_SKILL` in any skill. Unspent points are lost; the screen warns.
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

### Fortress name

Text field with a generated default from the names table. Used in announcements, saves and the legend.

### Local map specification

On Embark, produce:

```
LocalMapSpec {
  seed: hash(worldSeed, regionId),
  biome, elevation, relief (0–3 from neighbor elevation differences), soilDepth (from biome),
  geology, wealth, peril, temper, deepness, traits, volcano,
  river: { inflowEdges, outflowEdge, class } | null, lake,
  civEdges: nearestEdgeTo, arrivalEdge: nearestEdgeTo.mountainhome
}
```

`relief = min(3, floor(maxDiff × 4 / 256))`, where `maxDiff` is the largest absolute elevation difference to the eight neighbouring regions that exist.

03 generates the map from this and nothing else, so a region always generates the same local map.

### Arrival

1. Generate the local map (03).
2. Find the wagon site: the 3×3 patch of walkable surface tiles with no trees, nearest to the midpoint of the `arrivalEdge`, searching inward up to `ARRIVAL_SEARCH_DEPTH` tiles; if none, clear trees from the first candidate patch. Each cleared tree leaves its own species’ `logs` range, clamped by `TREE_LOGS_MIN` and `TREE_LOGS_MAX`, drawn from the `02` stream; the logs are of its wood and lie on its tile. A tree tile’s material id identifies the species; plants and materials have independent numeric indices.
3. Place the wagon building (function tag `container`, capacity unlimited, deconstructable, yields `WAGON_LOGS` pine logs; the wagon is made of pine).
4. Spawn every purchased item inside the wagon's container, using the catalog material for each item and its container (pine barrels and flax-cloth bags). The wagon may hold these item containers; their contents lie at its centre and are found and unloaded as on the ground. Spawn animals on walkable tiles around the wagon after the dwarves’ tiles. An explicit sex wins; a purchased unit of several animals is females followed by one male; single animals from one line alternate female, male. Each is `Tame` with no pasture, condition 0 and the training bought.
5. Spawn the dwarves through the creature spawn API, using the party records to build 10's dwarf components, adjacent to the wagon with all labors enabled except that dwarves with a combat skill ≥ 3 also get `Soldier`-ready flags (no squad yet). Needs start at 20 (mildly hungry, thirsty, rested).
6. Assign the title Thane to the dwarf with the highest Charm (ties by id). No Warden, Broker or Chief Medic yet.
7. Set the fortress name, embark tick and region. The calendar is set to `START_SEASON`, day 1, `START_HOUR`, year 1 before any arrival spawn, so supplies and creatures carry the arrival tick.
8. Emit `Embarked { fortressName, regionId }`. The app switches to the fortress screen, paused, centered on the wagon at the surface z-level, and shows the first hint.

Arrival consumes item entries of the local map’s trait spawn list. Creature entries are consumed by 08 and 18 after arrival.

## State

Embark state exists only during the embark screen: `budget`, `party[]`, `supplies[]`, `preset`, `fortressName`. After arrival nothing of it persists except through the world (the wagon, items, dwarves). The `LocalMapSpec` is saved with the world for reference.

## Interfaces

### Reader

Not applicable: there is no embark reader. The app constructs the embark session before the world exists and the embark screen holds it directly. The session's fields (the party, the supplies, the preset, the fortress name) are state, not reader methods.

### Commands (embark session, handled by the app before the world exists)

`SetSkill { dwarf, skill, level }`, `RerollDwarf { dwarf }`, `RenameDwarf { dwarf, name }`, `SetSupply { entry, count }`, `ApplyPreset { preset }`, `SetFortressName { name }`, `ConfirmEmbark`.

### Events emitted

`Embarked { fortressName, regionId }`.

## Player-facing behavior

The embark screen has three tabs and a footer:

- **Dwarves**: list of seven; selecting one shows name (editable), age, attributes as bars, personality words, and the skill list with +/− controls and remaining points. Reroll button.
- **Supplies**: catalog grouped by category with quantity fields, unit price, line total.
- **Animals**: species with price and count.
- Footer: budget remaining, preset menu, fortress name, Embark button. Embark is disabled while over budget and shows why. Embarking with no pick, no axe, or with no food or no drink, asks first ("Embark without a pick?", "Embark without an axe?", "Embark without food or drink?"; confirmations `c_embark_no_pick`, `c_embark_no_axe`, `c_embark_no_food_drink`, default No).

Nothing chosen here is irreversible in the fortress: skills grow, items are consumed, animals breed.

## Tuning constants

| Name | Value | Meaning |
|---|---|---|
| `EMBARK_AGE_MIN` / `EMBARK_AGE_MAX` | 18 / 65 | Years |
| `EMBARK_REROLL_COST` | 25 | Marks |
| `EMBARK_MARKUP_PERCENT` | 20 | Added to item value for catalog price |
| `ARRIVAL_SEARCH_DEPTH` | 20 | Tiles inward from the edge to search for a wagon site |
| `WAGON_LOGS` | 3 | Logs from deconstructing the wagon |

## Extension points

- New catalog entries and presets are content rows.
- A different party size is `EMBARK_DWARF_COUNT`; the screen lays out any count up to 12.
- A "reclaim" mode (arriving at a fallen fortress) would reuse arrival steps 2–8 with an existing local map.
