# Scope and Traceability

**Owner:** vision · **Depends on:** [vision.md](vision.md), [`../02-systems/README.md`](../02-systems/README.md)

## Requested features and where they live

Every feature in the original brief maps to at least one system document (Wave 2), one content table (Wave 3) and one acceptance test group (Wave 4).

| Requested feature | System documents | Content tables | Notes |
|---|---|---|---|
| World map; choosing an area with characteristics that affect gameplay | 01 World Generation, 02 Embark | regions-biomes-and-traits | Wealth, peril, temper, biome, traits are the difficulty selection |
| 3D map viewed as a 2D slice; digging; digging down; caves | 03 Terrain & Mining, 22 Pathfinding, 23 Rendering | materials | Three cavern layers, the Sea of Fire |
| Water and lava: rivers, waterfalls, hand-made channels; simple enough at scale | 04 Fluids, 05 Materials & Temperature | materials | Seven-level cellular automaton with active sets |
| Minerals, metals, mining, smelting | 03 Terrain, 05 Materials, 12 Workshops | minerals-and-metals, workshops-and-recipes | Ores, alloys, flux, fuel, magma forges, deepsilver |
| Animals, plants, hunting, gathering, farming, domesticated farms | 07 Plants & Farming, 08 Animals & Domestication, 09 Hunting, Gathering & Fishing | plants, creatures | Pastures, breeding, milking, shearing, eggs, war dogs |
| Weather, seasons | 06 Weather & Seasons | regions-biomes-and-traits | Temper rating scales severity |
| Fighting: armor, weapons, melee, shooting | 16 Combat | weapons-and-armor, skills-and-professions | Six body parts, three damage types |
| Health, bleeding, medicine | 17 Health & Medicine | items (medical supplies) | Hospital zone, medic jobs, infection |
| Monsters in caves | 18 Threats | creatures | Tiered by cavern; Hollow-born at the bottom |
| Periodic raids | 18 Threats | creatures (Gloam, trollkin) | Announced a day ahead; scaled by peril and wealth |
| Traps and defense structures | 19 Defense & Traps, 14 Buildings | buildings-and-furniture | Levers, plates, bridges, floodgates, fortifications |
| Storage, buildings | 13 Items & Storage, 14 Buildings & Rooms | items, buildings-and-furniture | Stockpiles with filters, containers |
| Job assignments with priorities | 11 Jobs & Labor | jobs | Job board, labors, priorities 1–9, work orders |
| Professions: wood, stone, leather, metal, brewing, cooking, other | 12 Workshops & Professions | skills-and-professions, workshops-and-recipes | Plus farming, hunting, fishing, weaving, gem cutting, mechanics, medicine, soldiering |
| Rooms, sleeping, room comfort | 14 Buildings & Rooms, 15 Morale | buildings-and-furniture | Six room quality tiers |
| Dwarf happiness affecting productivity, forgiving, no death spirals | 15 Happiness & Morale | personality-and-thoughts | Caps, asymmetric decay, sulks instead of tantrums |
| Player-chosen initial loadout from a budget | 02 Embark & Loadout | items, creatures, skills | Presets and custom |
| Immigrants when happiness crosses a threshold | 21 Immigration | names | Also gated by wealth and population cap |
| Periodic trader caravans | 20 Trade & Caravans | items, creatures | Three civilizations, one season each |
| Browser, PC controls, mouse | 24 UI & Input, 23 Rendering | glyphs-and-colors | Full keyboard and mouse parity |
| Colored ASCII graphics | 23 Rendering | glyphs-and-colors | Canvas glyph atlas |

## In scope for version 1

Everything in the table above, plus the things needed to make them coherent:

- Save and load with seasonal autosaves and rolling snapshots.
- A legend page and a list of past fortresses.
- Fishing, as a small third source of food alongside hunting and farming.
- Fire, in a simple form: burnable tiles ignite from magma or lightning, burn for a time, spread to neighbors with a chance, and leave ash.
- Freezing and thawing of surface water with the seasons.
- Burial: coffins, tombs, and the grief thought that burial softens.
- Children who arrive with immigrant families and grow up.
- Animal training: war dogs and hunting dogs; taming of caged wild animals.
- Positions: Thane, Warden, Broker, Chief Medic.
- Reputation with each civilization and requests for the next caravan.

## Out of scope for version 1

These are deliberately excluded. Where a hook is cheap it is noted so that later versions can add the feature without restructuring.

| Excluded | Why | Hook left in place |
|---|---|---|
| Adventure mode | A different game | None needed; the world map and registry are reusable |
| World history and legends simulation | Cost far exceeds value for a fortress game | Civilizations have fixed personalities in content tables |
| Multiplayer | A different architecture | Deterministic simulation with a command log makes lockstep possible later |
| Nobles, mandates, justice | Source of unforgiving spirals | Positions exist; adding demands is a morale-system extension |
| Magic, necromancy, vampires, werebeasts | Tone | None |
| Procedurally generated creature anatomy | Cost; legibility | Body plans are content tables; new plans are rows |
| Blood vessels, organs, nerves | Legibility | Six body parts with wound types |
| Flying creatures and flight pathfinding | Pathfinding complexity | Movement flags include a `fly` bit reserved but unused |
| Swimming as a skill | Complexity | Water ≥ `FLUID_DEEP_LEVEL` is impassable; creatures in it take drowning damage |
| Siege engines, ladders, digging enemies | Defense would need rework | Raider AI has a `breach` behavior slot, unused in v1 |
| Cave-ins of natural rock | Punishing and opaque | Constructions require support; natural rock never collapses |
| Aquifers | Frustrating for new players | Terrain generation has a layer-feature slot |
| Wind, humidity, erosion | No visible gameplay | None |
| Diseases beyond wound infection | Scope | Health has a `condition` list that infection uses |
| Trade beyond the depot (embassies, tribute) | Scope | Reputation exists |
| Audio | Scope; can be added as a presentation-layer listener on events | Event bus |
| Mod loading from external files | Scope | All content is already in data tables; a loader is the only missing piece |
| Localization | Scope | All player-facing strings live in content tables and UI string tables |
| Mobile and touch controls | PC target | UI actions are input-agnostic |

## Future extension candidates

Ordered by expected value. Each names the seam it plugs into.

1. **Simulation in a Web Worker** — implement `SimulationHost` over a worker; presentation already reads snapshots.
2. **Audio** — a presentation-layer subscriber to the event bus.
3. **Mods** — a loader that merges external tables into the registry before `init`.
4. **Nobles and demands** — a morale extension using positions and thoughts.
5. **Flying creatures** — enable the `fly` movement bit and add an aerial cost table to pathfinding.
6. **Sieges with breaching** — fill the raider `breach` behavior slot.
7. **Adventure mode** — reuse the world, registry and local map with a different app screen flow.

## Decisions fixed in Wave 1

These are the decisions that later waves build on and must not change silently:

- The four rating axes and the named region traits as the difficulty model.
- Seven-level fluids with an active set; water and magma share the same rules with different parameters.
- Six body parts; three damage types; wounds with bleeding; infection as the only disease.
- Mood 0–100 with five tiers; sulks as the ceiling of misbehavior.
- Seven starting dwarves; a budget in marks that grows with peril.
- Three trading civilizations on fixed seasons; the Gloam as the only raider civilization; the Hollow as the endgame.
- One hearth per fortress as a real building.
- Positions: Thane, Warden, Broker, Chief Medic. No other titles.
- The layered architecture, the system contract, commands in and events out, and determinism.
- TypeScript, Vite, Canvas 2D, no UI framework.
