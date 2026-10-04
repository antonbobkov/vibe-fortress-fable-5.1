# Progress

current-milestone: 8

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
- [x] T-M4-16 — Embark supplies and animals in play; hints; the year-one hints — gpt6-m4, 2026-09-23
- [x] T-M4-17 — Panels: orders, animals, mood, population stub, zones farm settings, hospital placeholder (gpt6-m4, 2026-09-23)
- [x] T-M4-18 — Compositor: crops, saplings, shrubs, grass colors, animals, hearth pulse — gpt6-m4, 2026-09-23
- [x] T-M4-19 — Property generator: farming, orders, animals, titles — gpt6-m4, 2026-09-23
- [x] T-M4-20 — Gate M4 — gpt6-m4, 2026-09-23

## M5 — Metal ([M5-metal.md](M5-metal.md))

- [x] T-M5-01 — Wood furnace and smelter: charcoal, ore smelting, coal — gpt6-m5, 2026-09-23
- [x] T-M5-02 — Alloys and steel — gpt6-m5, 2026-09-23
- [x] T-M5-03 — Forge: weapons, ammunition, armor, tools, metal furniture, crafts — gpt6-m5, 2026-09-23
- [x] T-M5-04 — Magma workshops — gpt6-m5, 2026-09-24
- [x] T-M5-05 — Mechanic's workshop and mechanisms as items; jeweler — gpt6-m5, 2026-09-24
- [x] T-M5-06 — Melting marked items — gpt6-m5, 2026-09-24
- [x] T-M5-07 — Masterworks and the `saw_masterwork` memory; statues admired — gpt6-m5, 2026-09-24
- [x] T-M5-08 — Stocks panel complete; orders panel global orders; workshop panel material filter — gpt6-m5, 2026-09-24
- [x] T-M5-09 — Gate M5 — gpt6-m5, 2026-09-24

## M5.5 — Audit fixes ([fixes/README.md](fixes/README.md))

- [x] F-01 — Job assignment livelock (agy-f01, 2026-09-25)
- [x] F-02 — Mood: need pressure and the needs-met floor (agy-f02, 2026-09-25)
- [x] F-03 — Fluids: equalize budget and settling (agy-f03, 2026-09-25)
- [x] F-04 — Year-one bootstrap scenario (agy-f04, 2026-09-25)
- [x] F-05 — Dwarf need activities (agy-f05, 2026-09-25)
- [x] F-06 — Recipe smoke through the real loop (agy-f06, 2026-09-25)
- [x] F-07 — Recipe constraints as content (agy-f07, 2026-09-25)
- [x] F-08 — M6/M7 spec arithmetic and gaps (agy-f08, 2026-09-25)
- [x] F-09 — Small fixes (agy-f09, 2026-09-25)
- [x] F-10 — Need rates: consumption matches the documented season (agy-f10, 2026-09-25)
- [x] F-11 — Idle dwarves notice work without waiting out IDLE_TICKS (agy-f11, 2026-09-25)
- [x] F-12 — Comfort and joy rates match the documented visit frequency (agy-f12, 2026-10-02)
- [x] F-13 — A locked gate makes a raid loiter and leave; animals never park on doors (agy-f13, 2026-10-03)
- [x] F-14 — Immigration spirit threshold 65 → 55 (agy-f14, 2026-10-03)
- [x] F-15 — Bandits who reach their stockpile steal and leave; a failed walk means unreachable (agy-f15, 2026-10-03)

## M6 — Steel and Blood ([M6-steel-and-blood.md](M6-steel-and-blood.md))

- [x] T-M6-01 — Health: body values, wounds, bleeding, consciousness, death (agy-m601, 2026-09-25)
- [x] T-M6-02 — Combat: factions, targeting, melee resolution (agy-m602, 2026-09-25)
- [x] T-M6-03 — Combat: projectiles, line of sight through fortifications, hunting (agy-m603, 2026-09-25)
- [x] T-M6-04 — Combat: threats to civilians, fleeing, animals attacking (agy-m604, 2026-09-25)
- [x] T-M6-05 — Squads, orders, duty, stations, patrols, alerts (agy-m605, 2026-09-25)
- [x] T-M6-06 — Training and equipment (agy-m606, 2026-09-26)
- [x] T-M6-07 — Hospitals and medicine (agy-m607, 2026-09-26)
- [x] T-M6-08 — Threats: schedule, renown, party generation, arrival, warnings (agy-m608, 2026-09-26)
- [x] T-M6-09 — Threats: party and member AI, thieves, stealth, loot, retreat, door breaking (agy-m609, 2026-09-26)
- [x] T-M6-10 — Cavern monsters, webs, restless dead (agy-m610, 2026-09-26)
- [x] T-M6-11 — The Deep (agy-m611, 2026-09-26)
- [x] T-M6-12 — Defense: traps, plates, levers, retreat tile, war animal stations (codex-m612, 2026-09-26)
- [x] T-M6-13 — Mechanisms: links, drawbridges, floodgates in play (codex-m613, 2026-09-26)
- [x] T-M6-14 — Burial, grief, memorial slabs (codex-m614, 2026-09-26)
- [x] T-M6-15 — Taming, training, war animals, pets follow (agy-m615, 2026-09-26)
- [x] T-M6-16 — Military, threats, health panels; combat log; announcements (codex-m616, 2026-09-26)
- [x] T-M6-17 — Compositor: hostiles, projectiles, traps, stealth, webs, bridges; squad stations overlay (codex-m617, 2026-09-26)
- [x] T-M6-18 — Gate M6 (codex-m618, 2026-09-27)

## M7 — The Outside World ([M7-outside-world.md](M7-outside-world.md))

- [x] T-M7-01 — Trade: schedule, caravan parties, goods generation, arrival, depot, departure (codex-m701, 2026-09-27)
- [x] T-M7-02 — Trade: moving goods, the session, valuation, offers, gifts, reputation (codex-m702, 2026-09-27)
- [x] T-M7-03 — Trade session screen, civilizations panel, depot panel (codex-m703, 2026-09-28)
- [x] T-M7-04 — Immigration (codex-m704, 2026-09-27)
- [x] T-M7-05 — Population panel; renown and reputation readers in threats (codex-m705, 2026-09-27)
- [x] T-M7-06 — Legend record and screen; retire; final saves (codex-m706, 2026-09-28)
- [x] T-M7-07 — Settings screen, keybinding remap, colorblind toggle, auto-pause toggles, autosave toggle (codex-m707, 2026-09-28)
- [x] T-M7-08 — Help screen, legend of glyphs, overlays panel complete, debug panel (opus-m708, 2026-09-28)
- [x] T-M7-09 — Game menu, main menu Continue, confirmations complete (opus-m709, 2026-09-28)
- [x] T-M7-10 — Announcement registry complete; strings table audit (opus-m710, 2026-09-28)
- [x] T-M7-11 — Full-year headless scenario and the balance table (opus-m711, 2026-09-28)
- [x] T-M7-12 — Gate M7 (agy-m712, 2026-10-02)

## M8 — Polish and Balance ([M8-polish.md](M8-polish.md))

- [x] T-M8-01 — Profiling pass and per-system budgets (codex-m801, 2026-10-03)
- [ ] T-M8-02 — Load shedding
- [x] T-M8-03 — Snapshots, export, import, storage quota handling (agy-m803, 2026-10-02)
- [x] T-M8-04 — Golden renders for every screen and panel (agy-m804, 2026-10-02)
- [x] T-M8-05 — E2E `full-year` (agy-m805, 2026-10-02)
- [x] T-M8-06 — Balance pass (agy-m806, 2026-10-02)
- [x] T-M8-07 — Colorblind palette and accessibility checks (agy-m807, 2026-10-02)
- [ ] T-M8-08 — Documentation sync
- [ ] T-M8-09 — Release build
- [ ] T-M8-10 — Gate M8 — release
