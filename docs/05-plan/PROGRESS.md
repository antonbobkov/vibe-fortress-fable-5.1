# Progress

current-milestone: 4

Legend: `[ ]` not started · `[~]` in progress (agent, date) · `[x]` done (agent, date). Agents edit this file in the same commit as the task. Sub-tasks added by splitting go directly under their parent.

## M0 — Skeleton ([M0-skeleton.md](M0-skeleton.md))

- [x] T-M0-01 — Repository bootstrap (opus-m0, 2026-09-17)
- [x] T-M0-02 — Fixed-point math and rng (opus-m0, 2026-09-17)
- [x] T-M0-03 — Constants (opus-m0, 2026-09-17)
- [x] T-M0-04 — Map3D and chunks (opus-m0, 2026-09-17)
- [x] T-M0-05 — Entity store and components (opus-m0, 2026-09-17)
- [x] T-M0-06 — Registry and content loader (opus-m0, 2026-09-17)
- [x] T-M0-07 — Calendar, event queue, command queue (opus-m0, 2026-09-17)
- [x] T-M0-08 — Scheduler, World, system contract (opus-m0, 2026-09-17)
- [x] T-M0-09 — Spatial index, movement helper, pathfinding stubs (opus-m0, 2026-09-17)
- [x] T-M0-10 — Serialization core (opus-m0, 2026-09-17)
- [x] T-M0-11 — Headless runner and TestWorld (opus-m0, 2026-09-17)
- [x] T-M0-12 — Platform, glyph atlas, palette, renderer (opus-m0, 2026-09-17)
- [x] T-M0-13 — Compositor (terrain only), app boot, e2e hook (opus-m0, 2026-09-17)
- [x] T-M0-14 — Gate M0 (opus-m0, 2026-09-17)

## M1 — Ground ([M1-ground.md](M1-ground.md))

- [x] T-M1-01 — Value noise and hashing utilities (opus-m1, 2026-09-17)
- [x] T-M1-02 — World generation stages 1–5 (opus-m1, 2026-09-17)
- [x] T-M1-03 — World generation stages 6–9 and the reader (opus-m1, 2026-09-17)
- [x] T-M1-04 — Embark spec and party generation (opus-m1, 2026-09-17)
- [x] T-M1-05 — Local map generation: heightmap, rivers, layers, magma sea (opus-m1, 2026-09-17)
- [x] T-M1-06 — Local map generation: caverns, minerals, volcano, vegetation, traits (opus-m1, 2026-09-18)
- [x] T-M1-07 — Terrain system: designations, tile API, discovery, support (opus-m1, 2026-09-18)
- [x] T-M1-08 — Jobs system: board, labors, assignment, steps (opus-m1, 2026-09-18)
- [x] T-M1-09 — Dwarves system: brain (walk, idle), skills, xp, movement speed (opus-m1, 2026-09-18)
- [x] T-M1-10 — Dig, channel, carve, smooth, engrave, chop, gather job execution (opus-m1, 2026-09-18)
- [x] T-M1-11 — Spawn API and creature/dwarf spawning (opus-m1, 2026-09-18)
- [x] T-M1-12 — World gen and world map screens (opus-m1, 2026-09-18)
- [x] T-M1-13 — Embark screen (opus-m1, 2026-09-18)
- [x] T-M1-14 — Designate tool, look panel, log strip, status bar (opus-m1, 2026-09-18)
- [x] T-M1-15 — Compositor: creatures and designation/zone overlays (opus-m1, 2026-09-18)
- [x] T-M1-16 — Gate M1 (opus-m1, 2026-09-18)

## M2 — Things ([M2-things.md](M2-things.md))

- [x] T-M2-01 — Items system: entities, item API, value, counts, wealth (opus-m2, 2026-09-18)
- [x] T-M2-02 — Item search (opus-m2, 2026-09-18)
- [x] T-M2-03 — Zones and stockpiles (opus-m2, 2026-09-18)
- [x] T-M2-04 — Wants-hauling and haul jobs (opus-m2, 2026-09-18)
- [x] T-M2-05 — Buildings: placement, build job, constructions, deconstruction (opus-m2, 2026-09-18)
- [x] T-M2-06 — Furniture, doors, hatches, special buildings (opus-m2, 2026-09-18)
- [x] T-M2-07 — Rooms (opus-m2, 2026-09-18)
- [x] T-M2-08 — Embark arrival: wagon, supplies, animals, initial stockpile hint (opus-m2, 2026-09-18)
- [x] T-M2-09 — Build tool, zones tool, stockpile filter editor, stocks panel, units panel (opus-m2, 2026-09-18)
- [x] T-M2-10 — Compositor: items and buildings; overlays zones and stockpile usage (opus-m2, 2026-09-18)
- [x] T-M2-11 — Save and load: full round-trip, autosave, Load screen (opus-m2, 2026-09-19)
- [x] T-M2-12 — Command log and replay script (opus-m2, 2026-09-19)
- [x] T-M2-13 — Property command generator: items and buildings (opus-m2, 2026-09-19)
- [x] T-M2-14 — Gate M2 (opus-m2, 2026-09-19)

## M3 — Water, Fire, Sky ([M3-water-fire-sky.md](M3-water-fire-sky.md))

- [x] T-M3-01 — Fluids: state, active set, fall and spread (opus-m3, 2026-09-19)
- [x] T-M3-02 — Fluids: pressure, evaporation, contact (opus-m3, 2026-09-19)
- [x] T-M3-03 — Materials: property arrays, temperature function, overrides (opus-m3, 2026-09-19)
- [x] T-M3-04 — Materials: fire and melting (opus-m3, 2026-09-19)
- [x] T-M3-05 — Freezing and thawing (opus-m3, 2026-09-19)
- [x] T-M3-06 — Weather system (opus-m3, 2026-09-19)
- [x] T-M3-07 — Mist, miasma hooks, and the movement-side effects plumbing (opus-m3, 2026-09-19)
- [x] T-M3-08 — Rendering: fluids, ice, fire, snow, rain, night; overlays fluid levels and temperature (opus-m3, 2026-09-19)
- [x] T-M3-09 — Performance smoke: fluids and pathing (opus-m3, 2026-09-19)
- [x] T-M3-10 — Gate M3 (opus-m3, 2026-09-19)

## M4 — Life ([M4-life.md](M4-life.md))

- [x] T-M4-01 — Plants: species data, growth, crops, plots, plant and harvest jobs (opus-m4, 2026-09-20)
- [x] T-M4-02 — Plants: trees, saplings, shrubs, grass, ash (opus-m4, 2026-09-20)
- [x] T-M4-03 — Animals: species, wild brain, spawning, leaving (opus-m4, 2026-09-20)
- [x] T-M4-04 — Animals: tame behavior, pastures, condition, breeding, products, slaughter marking (gpt6-m4, 2026-09-22)
- [x] T-M4-05 — Dwarves: needs, hourly update, thresholds, interrupts (gpt6-m4, 2026-09-22)
- [x] T-M4-06 — Dwarves: activities eat, drink, sleep, social, comfort, joy; behavior selection complete for civilians (gpt6-m4, 2026-09-22)
- [x] T-M4-07 — Dwarves: titles, children, aging, clothing slots (gpt6-m4, 2026-09-22)
- [x] T-M4-08 — Workshops: operation, work orders, quality, professions (gpt6-m4, 2026-09-22)
- [x] T-M4-09 — Workshops: carpenter, mason, craftsdwarf, kitchen, still, farmer's workshop recipes (gpt6-m4, 2026-09-22)
- [x] T-M4-10 — Butcher, tannery, loom, clothier, leatherworks, kennel, bowyer: buildings and recipes (gpt6-m4, 2026-09-22)
- [x] T-M4-11 — Foraging: gather zones, fishing, butchery, slaughter (gpt6-m4, 2026-09-23)
- [x] T-M4-12 — Animal product jobs at the farmer's workshop (gpt6-m4, 2026-09-23)
- [x] T-M4-13 — Morale: thoughts, mood, tiers, hall spirit, sulks (gpt6-m4, 2026-09-23)
- [x] T-M4-14 — The hearth and hearth hall (gpt6-m4, 2026-09-23)
- [x] T-M4-15 — Items: rot queue, miasma, corpses — gpt6-m4, 2026-09-23
- [ ] T-M4-16 — Embark supplies and animals in play; hints; the year-one hints
- [ ] T-M4-17 — Panels: orders, animals, mood, population stub, zones farm settings, hospital placeholder
- [ ] T-M4-18 — Compositor: crops, saplings, shrubs, grass colors, animals, hearth pulse
- [ ] T-M4-19 — Property generator: farming, orders, animals, titles
- [ ] T-M4-20 — Gate M4

## M5 — Metal ([M5-metal.md](M5-metal.md))

- [ ] T-M5-01 — Wood furnace and smelter: charcoal, ore smelting, coal
- [ ] T-M5-02 — Alloys and steel
- [ ] T-M5-03 — Forge: weapons, ammunition, armor, tools, metal furniture, crafts
- [ ] T-M5-04 — Magma workshops
- [ ] T-M5-05 — Mechanic's workshop and mechanisms as items; jeweler
- [ ] T-M5-06 — Melting marked items
- [ ] T-M5-07 — Masterworks and the `saw_masterwork` memory; statues admired
- [ ] T-M5-08 — Stocks panel complete; orders panel global orders; workshop panel material filter
- [ ] T-M5-09 — Gate M5

## M6 — Steel and Blood ([M6-steel-and-blood.md](M6-steel-and-blood.md))

- [ ] T-M6-01 — Health: body values, wounds, bleeding, consciousness, death
- [ ] T-M6-02 — Combat: factions, targeting, melee resolution
- [ ] T-M6-03 — Combat: projectiles, line of sight through fortifications, hunting
- [ ] T-M6-04 — Combat: threats to civilians, fleeing, animals attacking
- [ ] T-M6-05 — Squads, orders, duty, stations, patrols, alerts
- [ ] T-M6-06 — Training and equipment
- [ ] T-M6-07 — Hospitals and medicine
- [ ] T-M6-08 — Threats: schedule, renown, party generation, arrival, warnings
- [ ] T-M6-09 — Threats: party and member AI, thieves, stealth, loot, retreat, door breaking
- [ ] T-M6-10 — Cavern monsters, webs, restless dead
- [ ] T-M6-11 — The Deep
- [ ] T-M6-12 — Defense: traps, plates, levers, retreat tile, war animal stations
- [ ] T-M6-13 — Mechanisms: links, drawbridges, floodgates in play
- [ ] T-M6-14 — Burial, grief, memorial slabs
- [ ] T-M6-15 — Taming, training, war animals, pets follow
- [ ] T-M6-16 — Military, threats, health panels; combat log; announcements
- [ ] T-M6-17 — Compositor: hostiles, projectiles, traps, stealth, webs, bridges; squad stations overlay
- [ ] T-M6-18 — Gate M6

## M7 — The Outside World ([M7-outside-world.md](M7-outside-world.md))

- [ ] T-M7-01 — Trade: schedule, caravan parties, goods generation, arrival, depot, departure
- [ ] T-M7-02 — Trade: moving goods, the session, valuation, offers, gifts, reputation
- [ ] T-M7-03 — Trade session screen, civilizations panel, depot panel
- [ ] T-M7-04 — Immigration
- [ ] T-M7-05 — Population panel; renown and reputation readers in threats
- [ ] T-M7-06 — Legend record and screen; retire; final saves
- [ ] T-M7-07 — Settings screen, keybinding remap, colorblind toggle, auto-pause toggles, autosave toggle
- [ ] T-M7-08 — Help screen, legend of glyphs, overlays panel complete, debug panel
- [ ] T-M7-09 — Game menu, main menu Continue, confirmations complete
- [ ] T-M7-10 — Announcement registry complete; strings table audit
- [ ] T-M7-11 — Full-year headless scenario and the balance table
- [ ] T-M7-12 — Gate M7

## M8 — Polish and Balance ([M8-polish.md](M8-polish.md))

- [ ] T-M8-01 — Profiling pass and per-system budgets
- [ ] T-M8-02 — Load shedding
- [ ] T-M8-03 — Snapshots, export, import, storage quota handling
- [ ] T-M8-04 — Golden renders for every screen and panel
- [ ] T-M8-05 — E2E `full-year`
- [ ] T-M8-06 — Balance pass
- [ ] T-M8-07 — Colorblind palette and accessibility checks
- [ ] T-M8-08 — Documentation sync
- [ ] T-M8-09 — Release build
- [ ] T-M8-10 — Gate M8 — release
