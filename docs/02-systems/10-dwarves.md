# 10 Dwarves

**Detail level:** W2 · **Owner:** `systems/dwarves` · **Depends on:** [`../01-architecture/data-model.md`](../01-architecture/data-model.md), [11-jobs-and-labor.md](11-jobs-and-labor.md), [14-buildings-and-rooms.md](14-buildings-and-rooms.md), [15-happiness-and-morale.md](15-happiness-and-morale.md), [16-combat.md](16-combat.md), [17-health-and-medicine.md](17-health-and-medicine.md), [22-pathfinding-and-spatial.md](22-pathfinding-and-spatial.md)

## Purpose

Make dwarves people. A dwarf has a body with attributes, a mind with skills, needs and a personality, relationships, a daily rhythm, and a title if the player gives one. This system owns the top-level decision of what a dwarf does next and hands the details to jobs (11), the military (16) and medicine (17).

## Concepts

- **Attribute**: Strength, Agility, Toughness, Endurance, Willpower, Wits, Charm; 0–100.
- **Skill**: 0–`SKILL_MAX_LEVEL` with experience. The skill list is content; the design fixes the list in `skills-and-professions.md` (Wave 3) with about forty skills across mining, wood, stone, crafts, farming, animals, food, metal, textiles, medicine, mechanics, trade, and combat.
- **Need**: hunger, thirst, rest, social, comfort, purpose, joy; 0 (satisfied) to `NEED_MAX`.
- **Personality trait**: three per dwarf from the trait table; each trait scales certain thoughts and biases behavior.
- **Behavior**: the state the dwarf's brain is in: `flee`, `retreat`, `need`, `duty`, `patient`, `work`, `social`, `idle`.
- **Title**: Thane, Warden, Broker, Chief Medic.
- **Child**: a dwarf under `ADULT_AGE_YEARS`.

## Rules

### Attributes

- Rolled at creation (02 for the party; 21 for immigrants) around `ATTRIBUTE_BASELINE`.
- Drift: every `SkillLevelUp` adds `ATTRIBUTE_DRIFT` to the attribute linked to that skill in the skill table (mining → Strength and Endurance; crafts → Agility and Wits; combat → per weapon; social → Charm), capped at `ATTRIBUTE_MAX`. Nothing lowers attributes.
- Uses: Strength scales melee damage and carry speed; Agility scales hit and dodge and movement; Toughness scales max blood and wound resistance; Endurance slows rest and hunger growth; Willpower resists pain and grief; Wits scales skill experience; Charm scales social relief and trade.

### Skills and experience

- Each completed job grants `xp = jobDef.xp × (100 + Wits) / 150` to the job's skill; sparring and training grant per session (16); medicine per treatment (17).
- Level thresholds: `xpToNext(level) = 100 + level × 60` (level 0→1 needs 100, 19→20 needs 1240; the full ladder is 1,900 + 11,400 = about 13,000 xp).
- Tier names by level (content): Dabbling 1, Novice 2–3, Adequate 4–5, Competent 6–7, Skilled 8–9, Proficient 10–11, Talented 12–13, Adept 14–15, Expert 16–17, Master 18–19, Legendary 20.
- No skill rust.
- `SkillLevelUp` at levels 5, 10, 15 and 20 gives a happy thought; reaching 20 emits `LegendaryReached`.

### Needs

Rates per hour (applied at the hourly boundary, scaled by Endurance for hunger and rest: `rate × (150 − Endurance) / 100`):

| Need | Rise per hour | Relieved by | Want threshold | Critical threshold |
|---|---|---|---|---|
| hunger | 1 | eating: meal −100, raw food −70 | 50 | 85 |
| thirst | 1.6 (× `weather.thirstModifier()`) | drink: alcohol −100, water −80 | 50 | 85 |
| rest | 5 awake; −15 per hour asleep | sleeping | 60 | 90 |
| social | 2 | talking: −40 per conversation | 50 | none |
| comfort | 3 | sitting in a room of tier ≥ decent −40 per sit; hearth hall −20 | 55 | none |
| purpose | 2 while idle; −10 per hour of work | working | 60 | none |
| joy | 1.5 | hearth hall visit −30; mist −30; fine meal −20; seeing a masterwork −10 | 60 | none |

- A need at or above its critical threshold interrupts any job (11 returns the job to open with progress kept) and takes precedence in behavior selection. Hunger or thirst at `NEED_MAX` for `STARVE_DAYS` (hunger) or `DEHYDRATE_DAYS` (thirst) causes daily `Starvation { id }` damage through 17; at `NEED_MAX` an announcement "X is starving" (alert) fires once per day.
- Rest at `NEED_MAX` makes the dwarf fall asleep where they stand ("passed out").
- Each need at or above its want threshold produces a standing negative thought while it persists (15: `hungry`, `thirsty`, `tired`, `lonely`, `uncomfortable`, `restless`, `bored`); satisfying it produces the positive event thought.

### Eating and drinking

- Food search: nearest reachable edible item that is not forbidden or reserved, preferring `meal` items, then raw food, using 13's `findItem`. The dwarf carries it to the nearest dining hall chair with a table if one is within `DINING_SEARCH_RADIUS`, else eats on the spot. Emits `MealEaten { id, quality, atTable, roomTier }`.
- Drink search: alcohol in a barrel in a stockpile, else a well with water, else an adjacent water tile of level ≥ 1. Emits `DrankAlcohol { id, quality }` or `DrankWater { id }` (dwarves prefer ale; water gives a mild negative thought).
- Eating and drinking take `EAT_TICKS` and `DRINK_TICKS`.
- Patients are fed by care jobs (17).

### Sleeping

- Schedule: each dwarf has `sleepStartHour` (random 20–24) and sleeps `SLEEP_HOURS` unless rest is below 20. Rest at its want threshold outside the window also sends the dwarf to bed.
- Bed search: own bed (assigned bedroom), else any unassigned free bed, else the floor of the hearth hall, else where they stand. Emits `Slept { id, bedQuality, roomTier, onFloor }`.
- Sleep is interrupted by `danger`-severity events nearby and by hearth alert.

### Social, comfort, joy

- Social: go to the hearth hall or a meeting area; if another dwarf is there, both `Talked { a, b }` after `TALK_TICKS`; relationships increment; friends after `FRIEND_TALKS` talks. Talking to a friend relieves 60 instead of 40.
- Comfort: sit on a free chair in the best-tier room within reach for `SIT_TICKS`.
- Joy: a visit to the hearth hall counts (`HearthVisited`); mist (`DwarfFeltMist`), warm springs (`DwarfNearSpring`), fine meals and seeing a masterwork item in a room they enter (`SawMasterwork`, once per item per dwarf) count.
- Idle dwarves without a want go to the hearth hall and stand or sit there; the hearth hall is the default place.

### Behavior selection

Evaluated when the dwarf has nothing to do, when a need crosses a threshold, and when interrupted by an event. Priority order, the first that applies wins:

1. `flee`: 16 has flagged the dwarf as threatened (a hostile within `THREAT_RADIUS` and the dwarf is not a soldier on duty): path away from the threat toward the hearth hall.
2. `retreat`: fortress alert is `hearth` and the dwarf is a civilian: path to the hearth hall, or the nearest indoor tile behind a door if the hall is unreachable; stay until the alert ends.
3. `patient`: 17 has marked the dwarf as needing a hospital: go to the hospital bed (or the nearest bed) and rest; care jobs feed them.
4. `need` (critical): satisfy the most critical need.
5. `duty`: the dwarf is a soldier on duty (16): 16 controls movement and targets.
6. `need` (want): satisfy the highest need over its want threshold, unless a job with priority ≤ `NEED_DEFER_PRIORITY` is available and the need is below its critical threshold.
7. `work`: ask 11 for a job (`jobs.assign(id)`); if given, run the job's steps.
8. `social`: if social or comfort or joy is over its want threshold, do the corresponding activity.
9. `idle`: go to the hearth hall and wait up to `IDLE_TICKS`, then re-evaluate; re-evaluate at once if a job becomes available for this dwarf before the wait is over, so that new work is never ignored for a whole hour. Idle dwarves are shown as "No job" in the units panel.

Children skip 5 and 7 except for hauling jobs (they have only the `hauling` labor and it cannot be turned off).

### Movement

Dwarves move with the movement helper at `speedFixed = species speed × (50 + Agility) / 100 × wound modifier (17) × carry modifier (a carried item heavier than `HEAVY_ITEM_DENSITY × size` halves speed)`. They avoid `restricted` tiles when a path without them exists (22 cost) and never enter `forbidden` tiles. A dwarf entering a misty tile emits `DwarfFeltMist` (once per `MIST_THOUGHT_COOLDOWN`); entering an outdoor tile during rain, storm, snow, heatwave or cold snap emits `DwarfOutdoorsIn { weather }` once per hour.

### Relationships

`Relationships.friends` and `grudges`; `talkCount: Map<id, n>`. Friend at `FRIEND_TALKS` talks; a sulk argument (15) adds a grudge; grudges fade after `GRUDGE_DAYS`. Friends' deaths cause stronger grief (15). Dwarves choose friends preferentially to talk to.

### Titles

- `AssignTitle { dwarfId, title }` and `AssignTitle { dwarfId: 0, title }` to vacate. One dwarf per title; a dwarf may hold several.
- Thane: the fortress-wide thought `thane_hall_grand` or `thane_hall_bare` depending on the Thane's bedroom tier (15, recomputed daily); the Thane's presence in the hearth hall lets talking relieve `THANE_SOCIAL_BONUS` more.
- Warden: squads gain `WARDEN_TRAINING_BONUS_PERCENT` training experience; the Warden is the default squad leader.
- Broker: their `trading` skill is used at the depot; without a Broker any dwarf with the `trading` labor trades at skill 0.
- Chief Medic: their `medicine` skill is used for diagnosis quality; care and treatment use the treating dwarf's skill.

### Children and aging

- Age advances yearly on `YearPassed`. A child becomes an adult at `ADULT_AGE_YEARS` (`DwarfBecameAdult`; labors all enabled; a "came of age" thought for the family).
- No births in version 1. No death by age.

### Clothing

Dwarves wear a body garment, a leg garment and boots (items with the `clothing` tag in three slots of `Equipment`). Missing clothing gives the `unclothed` thought and doubles cold injury risk (17). Clothing does not wear out. Immigrants and settlers arrive clothed; the clothier makes more for the naked.

### Death

17 emits `CreatureDied`; this system removes the dwarf from titles and squads (16 handles squads on the same event), updates population, and emits `DwarfDied { id, cause }`. The corpse item is created by 13; burial is 14 and 17.

## State

- Components: `Attributes`, `Skills`, `Needs`, `Personality`, `Schedule`, `Relationships`, `Title`, plus private `Brain { behavior, behaviorUntilTick, targetTile, activity, lastMistTick, lastOutdoorThoughtHour }`.
- `titles: Record<Title, EntityId | 0>`, `populationCached`, `children: EntityId[]`.
- Rng stream.

## Interfaces

### Reader

- `dwarves.list()`, `dwarves.population()`, `dwarves.adults()`, `dwarves.children()`
- `dwarves.isChild(id)`, `dwarves.title(id)`, `dwarves.holder(title)`
- `dwarves.skill(id, skillId)`, `dwarves.skillTier(id, skillId)`, `dwarves.attribute(id, attr)`
- `dwarves.need(id, need)`, `dwarves.behavior(id)`, `dwarves.activityText(id)` (for the units panel: "Digging", "Eating", "Sleeping", "No job")
- `dwarves.productivity(id)` — percent: mood multiplier (15) × wound modifier (17)
- `dwarves.friends(id)`, `dwarves.isFriend(a, b)`

### Commands

`SetLabor { dwarfId, laborId, on }` (delegated to 11, which owns `Labors`; listed here because the units panel issues it), `AssignTitle`, `RenameDwarf`, `SetSchedule { dwarfId, sleepStartHour }`.

### Events consumed

`HourPassed`, `DayPassed`, `YearPassed`, `JobCompleted` (experience), `CreatureDied`, `AlertChanged`, `ThreatNearby` (from 16), `PatientAdmitted` and `PatientDischarged` (17), `HearthLit`, `MoodTierChanged` (productivity cache).

### Events emitted

`MealEaten`, `DrankAlcohol`, `DrankWater`, `Slept`, `Talked`, `Sat { id, roomTier }`, `HearthVisited { id }`, `DwarfFeltMist { id }`, `DwarfNearSpring { id }`, `DwarfOutdoorsIn { id, weather }`, `SawMasterwork { id, itemId }`, `NeedCritical { id, need }`, `Starving { id, need }`, `SkillLevelUp { id, skill, level }`, `LegendaryReached { id, skill }`, `DwarfIdle { id }`, `DwarfDied { id, cause }`, `TitleAssigned { dwarfId, title }`, `DwarfBecameAdult { id }`.

### Registrations

Panel `units`; inspector sections `creature › dwarf` (attributes, skills with tiers and progress bars, needs, personality, title, relationships, activity, productivity); announcements: starving (alert), passed out (note), title assigned (note), came of age (note), legendary (note).

## Player-facing behavior

- Units panel: a table of every dwarf with name, profession, activity, mood tier glyph, and a labor grid toggle view (dwarves × labors, with the profession's default labors highlighted).
- Dwarf inspection: everything listed under the inspector section; every number the simulation uses is visible.
- Title assignment from the units panel or the dwarf inspection.
- Glyph `☺` in a color by state: white normal, yellow when a need is critical, red when wounded, blue when asleep, gray as a child, green when a soldier on duty.

## Tuning constants

| Name | Value | Meaning |
|---|---|---|
| `ADULT_AGE_YEARS` | 12 | |
| `ATTRIBUTE_DRIFT` | 1 | Per level-up |
| `STARVE_DAYS` | 7 | Days at hunger 100 before damage |
| `DEHYDRATE_DAYS` | 3 | |
| `EAT_TICKS` | 60 | |
| `DRINK_TICKS` | 40 | |
| `SLEEP_HOURS` | 7 | |
| `TALK_TICKS` | 80 | |
| `SIT_TICKS` | 100 | |
| `IDLE_TICKS` | 50 | |
| `DINING_SEARCH_RADIUS` | 40 | Tiles (path distance) |
| `NEED_DEFER_PRIORITY` | 2 | A job at priority 1–2 is done before a want-level need |
| `THREAT_RADIUS` | 8 | |
| `FRIEND_TALKS` | 5 | |
| `GRUDGE_DAYS` | 28 | |
| `THANE_SOCIAL_BONUS` | 20 | |
| `WARDEN_TRAINING_BONUS_PERCENT` | 25 | |
| `HEAVY_ITEM_DENSITY` | 3 | Items heavier than 3 × the carrier's size units halve speed |
| `MIST_THOUGHT_COOLDOWN` | 1200 | Ticks |

Need rates and thresholds above were confirmed by the Wave 3 balance pass; the consumption arithmetic is in [`../03-content/balance.md`](../03-content/balance.md).

## Extension points

- Births: a pregnancy field on married pairs and a `DwarfBorn` event; children already exist.
- Skill rust: a decay pass in the daily handler.
- More needs (faith, beauty): a row in the needs table and an activity in behavior selection.
- Personality-driven job preferences: a bias term in 11's scoring that reads `Personality`.
