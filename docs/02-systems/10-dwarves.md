# 10 Dwarves

**Owner:** `systems/dwarves` · **Depends on:** [`../01-architecture/data-model.md`](../01-architecture/data-model.md), [11-jobs-and-labor.md](11-jobs-and-labor.md), [14-buildings-and-rooms.md](14-buildings-and-rooms.md), [15-happiness-and-morale.md](15-happiness-and-morale.md), [16-combat.md](16-combat.md), [17-health-and-medicine.md](17-health-and-medicine.md), [22-pathfinding-and-spatial.md](22-pathfinding-and-spatial.md)

## Purpose

Make dwarves people. A dwarf has a body with attributes, a mind with skills, needs and a personality, relationships, a daily rhythm, and a title if the player gives one. This system owns the top-level decision of what a dwarf does next and hands the details to jobs (11), the military (16) and medicine (17).

## Concepts

- **Attribute**: Strength, Agility, Toughness, Endurance, Willpower, Wits, Charm; 0–100.
- **Skill**: 0–`SKILL_MAX_LEVEL` with experience. The skill list is content; the design fixes the list in `03-content/skills-and-professions.md` with about forty skills across mining, wood, stone, crafts, farming, animals, food, metal, textiles, medicine, mechanics, trade, and combat.
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
- `SkillLevelUp { id, skill, level }` fires at every gained level; 15 gives a happy thought at levels 5, 10, 15 and 20; reaching 20 emits `LegendaryReached`.

### Needs

Rates per hour (applied at the hourly boundary, scaled by Endurance for hunger and awake rest only: `rate × (150 − Endurance) / 100`):

| Need | Rise per hour | Relieved by | Want threshold | Critical threshold |
|---|---|---|---|---|
| hunger | 1 | eating: meal −100, raw food −70 | 50 | 85 |
| thirst | 1.6 (× `weather.thirstModifier()`) | drink: alcohol −100, water −80 | 50 | 85 |
| rest | 5 awake; −15 per hour asleep | sleeping | 60 | 90 |
| social | 2 | talking: −40 per conversation | 50 | none |
| comfort | 1 | sitting in a room of tier ≥ decent −40 per sit; hearth hall −20; a meal at a table is a sit | 55 | none |
| purpose | 2 while idle; −10 per hour of work | working | 60 | none |
| joy | 0.75 | hearth hall visit −30, which eating, drinking and sitting in the hall add up to; mist −30; fine meal −20; seeing a masterwork −10 | 60 | none |

The purpose rates, the critical thresholds and joy's relief from mist, a fine meal and a masterwork are *unmeasured*; the other rates, reliefs and want thresholds are measured as need errands per dwarf-day and shares of a dwarf's time ([balance model](../03-content/balance.md#needs-and-consumption)).

- A need at or above its critical threshold interrupts any job (11 returns the job to open with progress kept) and takes precedence in behavior selection. Hunger or thirst at `NEED_MAX` for `STARVE_DAYS` (hunger) or `DEHYDRATE_DAYS` (thirst) causes daily `Starvation { id }` damage through 17; at `NEED_MAX` one `Starving { id, need }` announcement (alert) fires per dwarf per day, naming hunger when both hunger and thirst are maxed. Daily starvation requests fire once if either duration has elapsed.
- Replacing a need activity with a weeping sulk cancels the activity before changing the brain: drop a held meal at the dwarf's current tile, release only its personal food or drink reservation through the item API with `ItemReleased`, delete the plan and stop its obsolete walk. A later selection may reserve an item anew; it must not orphan the old plan's reservation. A reservation that has passed to another holder is preserved.
- Threshold crossings and the sleep schedule set saved `interruptFlags` for the next behavior selection; a critical crossing emits `NeedCritical`, which 11 consumes to return an interruptible job to open with progress kept. A job held while the dwarf is away from work (a need, flight, shelter, a patient's bed; in practice one that is not interruptible) stays with the dwarf and resumes on its return, until 11 gives it back after `JOB_HOLD_TICKS` of absence.
- Rest at `NEED_MAX` makes the dwarf fall asleep where they stand ("passed out").
- Each need at or above its want threshold produces a standing negative thought while it persists (15: `hungry`, `thirsty`, `tired`, `lonely`, `uncomfortable`, `restless`, `bored`); satisfying it produces the positive event thought.

A food or drink errand reserves one unit under the dwarf's id. Death, unconsciousness, flight, a failed walk or the item becoming inedible or undrinkable abandons that errand. Release its still-owned reservation through the item API and emit one `ItemReleased { itemId, jobId: dwarfId }`; a held meal drops at the dwarf's tile. Never release another holder's reservation. Consumption ends the reservation by consuming the reserved unit.

### Eating and drinking

- Food search: nearest reachable edible item that is not forbidden or reserved, preferring `meal` items, then raw food, using 13's `findItem`. The dwarf carries it to the nearest dining hall chair with a table if one is within `DINING_SEARCH_RADIUS`, else eats on the spot. Emits `MealEaten { id, quality, atTable, roomTier }`.
- Drink search: alcohol in a barrel in a stockpile, else a well with water, else the nearest reachable water tile of level ≥ 1 (not frozen) within `DRINK_SEARCH_RADIUS` tiles horizontally of the dwarf and 8 levels up or down, drunk from any walkable tile 8-adjacent to it on its level, or on the level above it when open air with no fluid lies over the water (the bank over a brook or river, whose water lies one level below the ground, `local-map-generation.md` § 2; a floor or rock over the water is no bank). A brook that has frozen (04 § Freezing and thawing) gives no water until it thaws: a fortress with no drink in stock, no brew and no well on unfrozen water has nothing to drink through the winter. Rank the stand tiles by their horizontal Chebyshev distance from the dwarf plus their vertical distance times `Z_DISTANCE_WEIGHT`, ties by the stand tile index. If none of the listed sources is reachable, a reachable loose alcohol item is a last resort; consume one unit and emit the same `DrankAlcohol` event. Brew left in its barrel at the still, or anywhere off a stockpile, is loose: a fortress whose drink stockpile wants no barrels drinks at the brook before it drinks its brew. Emits `DrankAlcohol { id, quality }` or `DrankWater { id }` (dwarves prefer ale; water gives a mild negative thought).
- Eating and drinking take `EAT_TICKS` and `DRINK_TICKS`.
- A meal eaten at a table is also a sit in the room of its chair. It relieves comfort as a sit there would and emits `Sat { id, roomTier }`: −40 in a room of tier ≥ decent, −20 in the hearth hall, nothing at a table in neither.
- A meal or a drink finished on a hearth-hall tile counts its `EAT_TICKS` or `DRINK_TICKS` toward a hearth visit (§ Social, comfort, joy).
- Patients are fed by care jobs (17).

### Sleeping

- Schedule: each dwarf has `sleepStartHour` (uniformly 20–23 from 10's rng stream) and sleeps `SLEEP_HOURS` unless rest is below 20. Rest at its want threshold outside the window also sends the dwarf to bed.
- Bed search: own bed (assigned bedroom), else any unassigned free bed, else the floor of the hearth hall, else where they stand. Emits `Slept { id, bedQuality, roomTier, onFloor }`.
- A built bed holds one dwarf. Choosing it for sleep holds it immediately, during the walk and sleep, until the dwarf wakes, abandons the activity or dies. The saved rest activity's `itemId` is the bed id (0 for floor sleep); loading preserves the hold. Bed availability is live, not cached with room geometry. An own bed held by another dwarf is unavailable too; another free unassigned bed or the floor is the fallback. A patient holds its assigned bed under 17's rule, so a tired medic never chooses it.
- Sleep is interrupted by `danger`-severity events nearby and by hearth alert.
- A soldier on duty who walks to a bed or sleeps is serving a need: in every squad mode, 16's squad code neither moves it nor gives it a target until it is back on duty (16 § Squads).

### Social, comfort, joy

- A talk needs no trip. Every `TALK_CHECK_TICKS` each awake dwarf that is not walking and whose social need is at or over its want threshold looks, through the spatial index, for another awake dwarf that is not walking within Chebyshev distance 2 on the same level; a friend first, then the lowest id. The two start a talk in passing. Awake means conscious and not asleep; a dwarf is walking while it has a walk under way. A dwarf already in a talk, or on a social errand, is not chosen. Two dwarves eating at the same table talk this way.
- A talk in passing lasts `TALK_TICKS`. It is checked every `TALK_CHECK_TICKS`: if either dwarf has died, fallen asleep or unconscious, started to walk, or is no longer within distance 2, the talk ends with no effect. Otherwise at its end both get `Talked { a, b }` and its relief, exactly as for a social errand. Neither dwarf is held at its work. A dwarf that finishes a meal, a drink, a sit or a hearth visit during the talk stays where it is until the talk ends, and so does a dwarf with no work; a threat, an alert or a critical need takes it away as from any activity.
- Social errand: go to the nearest reachable hearth-hall or meeting-area tile and wait up to `SOCIAL_WAIT_TICKS`; the first living dwarf within Chebyshev distance 2 on the same level who is not asleep (friends first, then by id) is the partner; both get `Talked { a, b }` after `TALK_TICKS`; relationships increment; friends after `FRIEND_TALKS` talks. Talking to a friend relieves 60 instead of 40. The partner is not interrupted.
- Comfort errand: sit on a free chair in the best-tier room within reach for `SIT_TICKS`; without a chair in a room of tier ≥ decent, sit in the hearth hall.
- Joy errand: stand in the hearth hall for `HEARTH_VISIT_TICKS`; this is a hearth visit (`HearthVisited`, −30).
- Time in the hearth hall is a hearth visit. Each meal, drink or sit a dwarf finishes on a hearth-hall tile adds its `EAT_TICKS`, `DRINK_TICKS` or `SIT_TICKS` to the dwarf's saved count. When the count reaches `HEARTH_VISIT_TICKS` the dwarf gets one hearth visit (`HearthVisited`, −30) and the count returns to zero.
- Joy is also relieved by mist (`DwarfFeltMist`), warm springs (`DwarfNearSpring`), fine meals and seeing a masterwork item in a room they enter (`SawMasterwork`, once per item per dwarf). Room entry inspects floor items and installed furniture throughout the entered room, excluding container contents and the viewer's own work. Save the per-dwarf seen-item memory across visits and loads.
- The three errands are taken only at step 8 of behavior selection, by a dwarf with no work.
- Hall errand: when social, comfort or joy is at or over `LEISURE_MARK`, a dwarf takes one sit in the hearth hall before ordinary work (step 6). It walks to the nearest free chair on a hearth-hall tile, or to a hall tile when no chair is free, and sits for `SIT_TICKS`. The sit relieves comfort as any sit there does and its `SIT_TICKS` count toward a hearth visit, which they complete. It is also the talk: every `TALK_CHECK_TICKS` while seated, a dwarf with social at or over its want threshold and no talk in passing under way takes as partner any other dwarf within Chebyshev distance 2 on its level that is not asleep (a friend first, then the lowest id), as on a social errand; at the end of the sit both get `Talked` and its relief. The partner is not interrupted. Without a hearth hall there is no hall errand.
- If a hall errand ends with one of the three still at or over `LEISURE_MARK` and no talk under way (nobody came within reach), the dwarf takes no other hall errand for `LEISURE_RETRY_TICKS`. The tick is saved per dwarf.
- Idle dwarves without a want go to the hearth hall and stand or sit there; the hearth hall is the default place.

### Behavior selection

Evaluated when the dwarf has nothing to do, when a need crosses a threshold, and when interrupted by an event. `PatientAdmitted` and `PatientDischarged` set its interrupt flag. Priority order, the first that applies wins:

1. `flee`: 16 has flagged the dwarf as threatened (a hostile within `THREAT_RADIUS` and the dwarf is not a soldier on duty): path away from the threat toward the hearth hall. After fleeing, remember the hostile and its last seen tile while it lives and remains within `THREAT_RADIUS` of that tile. Changing level or reaching the hall does not clear this memory. Do not start a noncritical need or a job whose target is on that tile's level within horizontal Chebyshev `THREAT_RADIUS`; serve a safe reachable target instead, or wait in the hearth hall. Critical needs override this avoidance and continue across threat scans.

Fire is checked before step 1, every tick, for every conscious dwarf, a soldier on duty included. A dwarf is in danger when it stands on a burning tile, or on a tile that can burn (05 § Fire) while a cardinal neighbour or the tile below it burns. It drops what it is doing (an activity is cancelled; a job returns to the board with its progress kept) and walks to the nearest tile it reaches that is not burning and cannot burn: breadth first by legal step count (burning tiles block movement) within `FIRE_FLEE_NODE_LIMIT` tiles, ties by tile index. Its activity reads "Fleeing the fire" and its behavior is `flee` with no threat held. On arrival, or once it stands on safe ground, it selects again. This holds for a sleeper, a conscious patient and a dwarf in a critical need; it takes precedence over every step below. An unconscious dwarf does not move. With no such tile in reach the dwarf stays where it is.
2. `retreat`: fortress alert is `hearth` and the dwarf is a civilian: path to the hearth hall, or the nearest indoor tile behind a door if the hall is unreachable; stay until the alert ends. A critical need overrides the retreat, as it overrides `flee`: a sheltering civilian whose hunger, thirst or rest has reached its critical threshold goes to serve it by step 4's rules, wherever the food, drink or bed is, and returns to shelter when the need is served while the alert lasts. Medical work does the same: a sheltering civilian that holds a job for a patient (17: the jobs `carry_patient`, `feed_patient`, `water_patient` and the treatments) keeps it, and one that can claim such a job takes it, so long as the job is open to it by 11's rules (a remembered hostile near the patient excludes it, and `flee` ends a job in progress, which returns to the board); it works the job outside the shelter and returns to shelter when the job ends while the alert lasts. A lever does the same: a sheltering civilian that holds or can claim the `pull_lever` job of a lever inside its shelter (11) works it and returns to shelter. Under the alert 11 offers a sheltering civilian patient-care jobs and those pulls only. A want-level need does not end the retreat, except that a sheltering civilian serves a want-level hunger, thirst or rest from a target inside the shelter (the food, the drink, or a bed, for rest, in the hearth hall, or in the indoor area it shelters in when there is no hall: the tiles around its retreat tile that are not `outdoor` and are reached along the walker graph (a level changes only by stairs or a ramp) without passing a door, hatch, floodgate or drawbridge), which does not expose it; with no such target it stays. Social, comfort and joy are not served under the alert. A civilian for whom neither is reachable (shut out by a locked gate) skips this step until one becomes reachable; `flee` still protects them.
3. `patient`: 17 has marked the dwarf as needing a hospital: go to the hospital bed (or the nearest bed) and rest; care jobs feed them. A conscious patient does this under any alert, a `hearth` alert included (step 2 does not hold it in shelter); an unconscious one is carried. A soldier on duty is the exception while a hostile is in sight (step 5's definition): it stays on duty and fights on, and takes `patient` on the first think after the last hostile in sight is dead or gone, in every squad mode and under every alert. It leaves its squad's orders with that step (16 § Squads) and returns to duty on discharge while it is still on duty. Its want-level needs and scheduled sleep wait during that fight in every mode; a critical need still takes step 4. When the fight ends, patient rest takes precedence even over an ongoing need activity: abandon the activity, release its held food or drink through the usual cancellation path, and walk to the bed.
4. `need` (critical): satisfy the most critical need. Always applies to soldiers on duty as well as civilians, in every squad mode.
5. `duty`: the dwarf is a soldier on duty (16): 16 controls movement and targets. A soldier on duty works no job: one it held when it was called to duty is interrupted with its progress kept and returns to the board for another worker (11 § Job steps). Apart from the fighting patient of step 3, duty holds the soldier against its want-level needs (step 6) and its scheduled sleep in two cases only: its squad is treated as active (`active` mode, or any mode under a `watchful` or `hearth` alert, 16 § Squads) and a hostile is in sight; or its squad has an explicit order (`station`, `patrol`, `follow`, `kill`) during a `watchful` or `hearth` alert. A hostile is in sight when it is alive, not stealthed, within `PERCEPTION_RADIUS` (16) horizontally and two levels vertically, and in line of sight; a combat target the soldier still holds is not by itself in sight, since 16 keeps a target that is out of sight (16 § Targeting). In every other case the want takes precedence: training, a station, patrol, follow or kill order while the alert is `calm`, and an alert without an order do not hold it, and the soldier returns to duty when the need is met. A critical need (step 4) wins in every case.
6. `need` (want): satisfy the highest of hunger, thirst and rest over its want threshold, unless a job with priority ≤ `NEED_DEFER_PRIORITY` is available and the need is below its critical threshold. Social, comfort and joy are not served here below `LEISURE_MARK`: they wait for step 8 and are relieved in passing (§ Eating and drinking; § Social, comfort, joy). With none of hunger, thirst and rest to serve, a dwarf with one of the three at or over `LEISURE_MARK` takes the hall errand here, before default-priority work and under the same exception for a job with priority ≤ `NEED_DEFER_PRIORITY`. A soldier whose duty does not hold (step 5) never reaches step 8, so it serves the highest of all its wants here, those three included.
7. `work`: queue the dwarf for 11 through `jobs.assign(id)` and stay in `work` while waiting for its later tick to answer. With a job, run its steps; when no longer queued and without a job, go idle.
8. `social`: the dwarf has no work: 11 has answered with no job and reports no open job the dwarf could take, or the dwarf cannot or may not work (a day off, a wound, a child with no hauling to do). A dwarf in a talk in passing stays for it. Otherwise do the errand of the highest of social, comfort and joy over its want threshold. No such errand starts while a job is open for the dwarf; only the hall errand of step 6 does.
9. `idle`: go to the hearth hall and wait up to `IDLE_TICKS`, then re-evaluate; re-evaluate at once if a job becomes available for this dwarf before the wait is over, so that new work is never ignored for a whole hour. Idle dwarves read "No job" as their activity text, and the units panel shows them as "Idle".

`DwarfIdle` fires once per stretch without a job and is reset by real work. With no hearth hall, idle uses the saved arrival wagon tile; without an arrival it stays at the current tile. Selection repairs legacy negative goals before queued work. Patient rest without a bed, cornered fighting and duty also use the current tile.

Civilian escape searches the legal walker edges, including stairs and ramps, with the dwarf's movement restrictions. Visit at most `CIVILIAN_FLEE_NODE_LIMIT` tiles breadth first by step count, breaking ties within each frontier by tile index. Prefer a reachable safer hearth-hall tile even when the bounded search cannot visit it: use the hall tile reached by the search, or the lowest-index eligible hall tile when none was visited. Only without an eligible reachable hall use the nearest visited safer tile. A safer tile is on another level from the threat or has greater horizontal Chebyshev distance from it than the starting tile. Exclude hostile-occupied tiles. If no safer tile is found, the civilian is cornered and fights back with the weapon or tool they carry: the weapon it wields, else the tool it holds, when 16 counts that item as a weapon (16 § Equipment), else its natural attack. A load it hauls is not a weapon.

A civilian is *caught* when, while fleeing, it is hit in melee (from an adjacent tile on its level) by a wild animal that is hunting it and whose movement speed (`Motion.speed`) is at least its own: running is no escape from an animal that does not let go. An animal hunts when its state is `hunt`, or `attack` with no defended tile (08 § Wild behavior). A hit from an animal defending its ground (`attack` with a defended tile), or from a hostile of a party (a thief, a bandit, a raider, the restless dead, the Deep), does not catch the civilian: it keeps fleeing, and a defending animal lets it go once it is out of the animal's provoke radius from where the attack began. From then on it is cornered by that attacker and fights it, by the rules of a cornered fight below, and its escape search admits only a tile it reaches through a tile the attacker cannot enter (a door that the attacker cannot pass): the first such tile in the same breadth-first order, with no hall preference and no distance test; none found means it stays and fights. It stops being caught when its attacker no longer holds it as its combat target (the attacker broke off or fled), when the attacker dies, or when it takes such a route; it then selects normally, and flees again if the attacker is still near. A threat scan from another hostile does not replace a caught civilian's attacker. A civilian who fights back, cornered or caught, does not chase: it strikes only an enemy within melee reach (16 § Targeting). The caught mark is saved with the held threat; older saves have none.

A critical need always interrupts a civilian's cornered fight, even when no resource can be found. An initial escape has first priority; after fleeing, a critical need may return through the remembered danger. Repeated threat scans do not restart a critical need activity, including when an escape is available; a newly more critical need still interrupts it normally. A cornered civilian with no enemy in melee reach and no melee or ranged attack opportunity for `CIVILIAN_COMBAT_TIMEOUT_TICKS` leaves combat, clears its held threat and combat target, stops its combat walk, and selects normally. Melee reach or an attack opportunity refreshes the deadline; another threat scan does not. Save that deadline in `Brain.behaviorUntil` and the held threat in the system state. Omit the threat list when empty; older saves without it start with no held threats, and older records without a tile capture the saved hostile position on load. Leaving a fight clears its activity caption before normal selection queues work. A later threat scan may acquire a new threat.

Only shut-out civilians are watched for shelter becoming reachable. Recheck those ids on `AlertChanged`, `BuildingStateChanged` or a changed `pathing.connectivityRevision`, preserving flee precedence; save the watched ids. The revision is derived and does not change connectivity labels or saved path state.

Children skip 5 and 7 except for hauling jobs (they have only the `hauling` labor and it cannot be turned off).

Every target a need activity walks to must be reachable (connectivity labels). If the walk still fails, the dwarf does not retry that need for `NEED_RETRY_TICKS`.

### Movement

Dwarves move with the movement helper at `speedFixed = species speed × (50 + Agility) / 100 × wound modifier (17) × carry modifier (a carried item heavier than `HEAVY_ITEM_DENSITY × size` halves speed)`. They avoid `restricted` tiles when a path without them exists (22 cost) and never enter `forbidden` tiles. A dwarf entering a misty tile emits `DwarfFeltMist` (once per `MIST_THOUGHT_COOLDOWN`); entering an outdoor tile during rain, storm, snow, heatwave or cold snap emits `DwarfOutdoorsIn { weather }` once per hour.

The `EntitiesMoved` handler observes entries using the batch’s from/to tiles. It writes the dwarf’s `Brain` for mist and outdoor thought memory, and `Needs` for masterwork joy relief; it never changes a tile. A zero `lastMistTick` means mist has never been felt; otherwise the cooldown must have elapsed. `lastOutdoorThoughtHour` stores the hour index so the weather thought fires only once per hour. `DwarfNearSpring` fires when the destination is on or 8-adjacent to a spring on the same level and the origin was not. Miasma is a standing thought checked by 15, rather than a movement event.

### Relationships

`Relationships.friends` and `grudges`; `talkCount: Map<id, n>`. Friend at `FRIEND_TALKS` talks; a sulk argument (15) adds a grudge; grudges fade after `GRUDGE_DAYS`. Friends' deaths cause stronger grief (15). Dwarves choose friends preferentially to talk to.

### Titles

- `AssignTitle { dwarfId, title }` and `AssignTitle { dwarfId: 0, title }` to vacate. One dwarf per title; a dwarf may hold several. The saved per-role holder record is authoritative; reassigning or vacating one role preserves other roles. The singular `Title` component caches the first held role in title-table order, while `dwarves.titles(id)` returns them all.
- Thane: the fortress-wide thought `thane_hall_grand` or `thane_hall_bare` depending on the Thane's bedroom tier (15, recomputed daily); the Thane's presence in the hearth hall lets talking relieve `THANE_SOCIAL_BONUS` more.
- Warden: squads gain `WARDEN_TRAINING_BONUS_PERCENT` training experience; the Warden is the default squad leader.
- Broker: their `trading` skill is used at the depot; without a Broker any dwarf with the `trading` labor trades at skill 0.
- Chief Medic: their `medicine` skill is used for diagnosis quality; care and treatment use the treating dwarf's skill.

### Children and aging

- Age advances yearly on `YearPassed`. A child becomes an adult at `ADULT_AGE_YEARS` (`DwarfBecameAdult`; labors all enabled; a "came of age" thought for the family).
- No births in version 1. No death by age.

### Clothing

Dwarves wear a body garment, a leg garment and boots (items with the `clothing` tag in three slots of `Equipment`). Missing clothing gives the `unclothed` thought and doubles cold injury risk (17). Clothing does not wear out. Immigrants and settlers arrive with real carried cloth garments in the body, legs and feet slots, selecting each by clothing category and the material by cloth class from the registry. The `over` slot is optional; a missing required slot makes `isUnclothed` true. The same outfit helper serves both arrival paths; the clothier makes more for the naked.

### Death

17 emits `CreatureDied`; before removing the dwarf, this system calls 11's `jobs.workerDied` with the recorded death tile to release held, unworn tools and carried items. This system removes the dwarf from titles and squads (16 handles squads on the same event), updates population. All death consumers use this single event and its recorded species, faction, name, age and tile after the entity is removed. The corpse item is created by 13; burial is 14 and 17.

## State

- Components: `Attributes`, `Skills`, `Needs`, `Personality`, `Schedule`, `Relationships`, `Title`, plus private `Brain { behavior, behaviorUntilTick, targetTile, activity, lastMistTick, lastOutdoorThoughtHour }`.
- `titles: Record<Title, EntityId | 0>`, `populationCached`, `children: EntityId[]`.
- `wagonTile` (−1 without an arrival); `interruptFlags`; `threatened` records (dwarf id, hostile id, last scan tick and last seen tile, and `caught` while the hostile holds a civilian it caught fleeing); hunger/thirst maximum-duration clocks and daily `starvingAnnounced` records; activity plans; talks in passing (the two dwarves and the end tick), per-dwarf hearth-hall ticks and per-dwarf hall-errand retry ticks, each omitted when empty and empty in older saves; `idleAnnounced`; per-dwarf `sawMasterworks`; `needRetryUntil`; `shutOut` ids and `shelterCheckPending`.
- Rng stream.

## Interfaces

### Reader

- `dwarves.list()`, `dwarves.population()`, `dwarves.adults()`, `dwarves.children()`
- `dwarves.isChild(id)`, `dwarves.title(id)`, `dwarves.holder(title)`
- `dwarves.titles(id)` — every title the dwarf holds, in the order of the title table
- `dwarves.isUnclothed(id)` — a body garment, a leg garment or boots are missing
- `dwarves.skill(id, skillId)`, `dwarves.skillTier(id, skillId)`, `dwarves.attribute(id, attr)`
- `dwarves.need(id, need)`, `dwarves.behavior(id)`, `dwarves.activityText(id)` (for the units panel: "Digging", "Eating", "Sleeping", "No job"; the panel shows "No job" as "Idle")
- `dwarves.productivity(id)` — percent: mood multiplier (15) × wound modifier (17)
- `dwarves.friends(id)`, `dwarves.isFriend(a, b)`
- `dwarves.bedHolder(bedId)` ? the living dwarf walking to or sleeping in the bed through its saved rest activity, or 0; patient holds are combined by 14
- `dwarves.avoidedThreatTile(id)` — the last seen tile of a still-near living hostile for a civilian, or −1; job eligibility uses this memory

### Commands

`AssignTitle`, `RenameDwarf`, `SetSchedule { dwarfId, sleepStartHour }`. (The units panel also issues `SetLabor { dwarfId, laborId, on }`; that command is 11's, which owns `Labors`.)

### Events consumed

`HourPassed`, `DayPassed`, `YearPassed`, `JobCompleted` (experience), `CreatureDied`, `CreatureUnconscious` (abandon a need errand), `AlertChanged`, `ThreatNearby` (from 16), `AttackResolved` (from 16: a fleeing civilian caught by a hunting animal), `PatientAdmitted` and `PatientDischarged` (17: interrupt behavior selection), `HearthLit`, `MoodTierChanged` (productivity cache).

### Events emitted

`ItemReleased { itemId, jobId: dwarfId }`, `MealEaten`, `DrankAlcohol`, `DrankWater`, `Slept`, `Talked`, `Sat { id, roomTier }`, `HearthVisited { id }`, `DwarfFeltMist { id }`, `DwarfNearSpring { id }`, `DwarfOutdoorsIn { id, weather }`, `SawMasterwork { id, itemId }`, `NeedCritical { id, need }`, `Starving { id, need }`, `SkillLevelUp { id, skill, level }`, `LegendaryReached { id, skill }`, `DwarfIdle { id }`, `TitleAssigned { dwarfId, title }`, `DwarfBecameAdult { id }`, `Starvation { id }` (hunger or thirst has reached the point of death; 17 applies it).

### Registrations

Panel `units`; inspector sections `creature › dwarf` (attributes, skills with tiers and progress bars, needs, personality, title, relationships, activity, productivity); announcements: starving (alert), passed out (note), title assigned (note), came of age (note), legendary (note).

## Player-facing behavior

- Units panel: a table of every dwarf with name, profession, activity, mood tier glyph, and a labor grid toggle view (dwarves × labors, with the profession's default labors highlighted). The shown profession comes from the highest positive skill that has a profession title, ties by ascending skill content id; without one, show Peasant.
- Dwarf inspection: everything listed under the inspector section; every number the simulation uses is visible.
- Title assignment from the units panel or the dwarf inspection. Titles are chosen from the four roles with their current holders. Enter assigns the selected role to the selected dwarf, or vacates it if already held; a child is refused with a reason. Rename uses the modal text field (24 characters for a dwarf; squad rename uses 32). In the units panel, `[` and `]` change the selected dwarf's sleep hour by one, wrapping at midnight. The units panel also renames a dwarf, moves the sleep hour, and marks several dwarves to add to a squad or to open in the labor manager.
- Glyph `☺` in a color by state: white normal, yellow when a need is critical, red when wounded, blue when asleep, gray as a child, green when a soldier on duty.

## Tuning constants

| Name | Value | Meaning |
|---|---|---|
| `ADULT_AGE_YEARS` | 12 | *unmeasured* |
| `ATTRIBUTE_DRIFT` | 1 | Per level-up (*unmeasured*) |
| `STARVE_DAYS` | 7 | Days at hunger 100 before damage (*unmeasured*) |
| `DEHYDRATE_DAYS` | 3 | *unmeasured* |
| `EAT_TICKS` | 60 | |
| `DRINK_TICKS` | 40 | |
| `SLEEP_HOURS` | 7 | |
| `TALK_TICKS` | 80 | |
| `TALK_CHECK_TICKS` | 10 | Ticks between two scans that start, check and end talks in passing (*unmeasured*) |
| `SOCIAL_WAIT_TICKS` | 200 | A social errand waits this long for a partner (*unmeasured*) |
| `SIT_TICKS` | 100 | |
| `LEISURE_MARK` | 75 | Social, comfort or joy at this level sends a dwarf to sit in the hearth hall before default-priority work |
| `LEISURE_RETRY_TICKS` | 600 | After a hall errand that left one of the three at the mark, no other for this long |
| `HEARTH_VISIT_TICKS` | 100 | Ticks in the hearth hall that make one hearth visit |
| `IDLE_TICKS` | 50 | *unmeasured* |
| `DINING_SEARCH_RADIUS` | 40 | Tiles (path distance) (*unmeasured*) |
| `DRINK_SEARCH_RADIUS` | 64 | Tiles, horizontal Chebyshev distance from the dwarf, within which a thirsty dwarf looks for water; a bank beyond it is not searched for (*unmeasured*) |
| `NEED_DEFER_PRIORITY` | 2 | A job at priority 1–2 is done before a want-level need |
| `NEED_RETRY_TICKS` | 50 | After an unreachable need target (*unmeasured*) |
| `THREAT_RADIUS` | 8 | *unmeasured* |
| `CIVILIAN_COMBAT_TIMEOUT_TICKS` | 200 | Ticks without melee reach or a melee/ranged attack opportunity before a civilian leaves combat (*unmeasured*) |
| `CIVILIAN_FLEE_NODE_LIMIT` | 256 | Maximum legal tile visits in a civilian escape search (*unmeasured*) |
| `FIRE_FLEE_NODE_LIMIT` | 2048 | Maximum legal tile visits in the search of a dwarf running from a fire for ground that cannot burn (*unmeasured*) |
| `FRIEND_TALKS` | 5 | *unmeasured* |
| `GRUDGE_DAYS` | 28 | *unmeasured* |
| `THANE_SOCIAL_BONUS` | 20 | *unmeasured* |
| `WARDEN_TRAINING_BONUS_PERCENT` | 25 | *unmeasured* |
| `HEAVY_ITEM_DENSITY` | 3 | Items heavier than 3 × the carrier's size units halve speed (*unmeasured*) |
| `MIST_THOUGHT_COOLDOWN` | 1200 | Ticks (*unmeasured*) |

Need rates and thresholds above follow the balance model; the consumption arithmetic is in [`../03-content/balance.md`](../03-content/balance.md).

## Extension points

- Births: a pregnancy field on married pairs and a `DwarfBorn` event; children already exist.
- Skill rust: a decay pass in the daily handler.
- More needs (faith, beauty): a row in the needs table and an activity in behavior selection.
- Personality-driven job preferences: a bias term in 11's scoring that reads `Personality`.
