# Wildlife Combat Capture (T-196)

**Date:** 2026-10-10  
**Scope:** Controlled empirical capture of wild animal interactions with civilian and military dwarves in Deepholm worktree `vibe-fortress-t196` (branch `t-196-capture`).  
**Data File:** [`2026-10-10-wildlife-capture.json`](file:///E:/code/vibe-games/vibe-fortress-t196/reports/data/2026-10-10-wildlife-capture.json)  

---

## 1. Tuning Constants and Content Numbers

All constants and formulas read directly from source code and content tables:

| Parameter | Value / Formula | Source File | Line |
|---|---|---|---|
| **Animal baseline combat skill** | `CREATURE_BASE_SKILL = 2` | `src/systems/combat/constants.ts` | 30 |
| **Animal baseline attributes** | `CREATURE_ATTRIBUTE_DEFAULT = 50` | `src/systems/combat/constants.ts` | 29 |
| **Badger natural attack** | `bite` (edge, damage 6, size 2), natural armor 1, flee blood 40% | `src/content/creatures.json` | 71 |
| **Boar natural attack** | `gore` (pierce, damage 12, size 5), natural armor 1, flee blood 50% | `src/content/creatures.json` | 60 |
| **Wolf natural attack** | `bite` (edge, damage 10, size 3), natural armor 0, flee blood 45% | `src/content/creatures.json` | 61 |
| **Bear natural attack** | `claw` (edge, damage 18, size 6), `bite` (edge, damage 16, size 5), armor 2, flee 35% | `src/content/creatures.json` | 62 |
| **Rabbit natural attack** | None (damage 0), armor 0, flee blood 90% | `src/content/creatures.json` | 64 |
| **Civilian unarmed attack** | `punch` (blunt, damage 6, size 3) | `src/content/creatures.json` | 31 |
| **Civilian armor (clothing)** | Clothing counts as padding layer of armor value 1 | `src/systems/combat/melee.ts` | 348 |
| **Hit resolution formula** | `hit = clamp(5, 95, 50 + (skillA - dodgeSkill)*3 + (agiA - agiD)/4 + uncon(40) + fleeing(10))` | `src/systems/combat/melee.ts` | 444-446 |
| **Civilian parry input** | `min(30, skill * 2)` (0 for unarmed civilian without melee weapon) | `src/systems/combat/melee.ts` | 478 |
| **Civilian block input** | `min(40, 10 + skill * 2)` (0 without shield) | `src/systems/combat/melee.ts` | 503 |
| **Blood total per dwarf** | `size (60) * BLOOD_PER_SIZE (10) * (50 + Tou) / 100 = 600` at Toughness 50 | `src/systems/health/tick.ts` | 101-104 |
| **Health tick interval** | `HEALTH_CADENCE = 5` ticks | `src/systems/health/constants.ts` | 5 |
| **Blood unconscious threshold** | `BLOOD_UNCONSCIOUS_PERCENT = 40%` (blood <= 240 / 600) | `src/systems/health/constants.ts` | 14 |
| **Blood death threshold** | `BLOOD_DEATH_PERCENT = 20%` (blood < 120 / 600 -> `cause: bled_out`) | `src/systems/health/constants.ts` | 15 |
| **Bleed rate: cut (edge)** | light: 1 / 5 ticks, serious: 3 / 5 ticks, grievous: 6 / 5 ticks | `src/systems/health/wounds.ts` | 11 |
| **Bleed rate: puncture (pierce)** | light: 2 / 5 ticks, serious: 4 / 5 ticks, grievous: 8 / 5 ticks | `src/systems/health/wounds.ts` | 12 |
| **Bleed rate: bruise / fracture** | bruise: 0, fracture: light 0, serious 1 / 5 ticks, grievous 2 / 5 ticks | `src/systems/health/wounds.ts` | 13-14 |
| **TERRITORY_RADIUS** | 5 tiles (territorial threat trigger) | `src/systems/animals/constants.ts` | 15 |
| **APPROACH_RADIUS** | 3 tiles (aggressive carnivore threat trigger) | `src/systems/animals/constants.ts` | 69 |
| **NEAR_DWARF_RADIUS** | 20 tiles (wild brain think interval switch) | `src/systems/animals/constants.ts` | 12 |
| **WANDER_RADIUS** | 16 tiles (wander destination around home chunk) | `src/systems/animals/constants.ts` | 13 |
| **WILD_THINK_TICKS** | 10 ticks (interval when farther than 20 tiles) | `src/systems/animals/constants.ts` | 9 |
| **THREAT_RADIUS** | 8 tiles (civilian threat detection and flee trigger) | `src/systems/combat/constants.ts` | 19 |
| **THREAT_THROTTLE_TICKS** | 50 ticks (throttle between `ThreatNearby` events per creature) | `src/systems/combat/constants.ts` | 20 |
| **CIVILIAN_COMBAT_TIMEOUT_TICKS** | 200 ticks (timeout without melee reach before cornered civilian leaves fight) | `src/systems/dwarves/constants.ts` | 29 |
| **CIVILIAN_FLEE_NODE_LIMIT** | 256 tiles (BFS limit for civilian escape tile search) | `src/systems/dwarves/constants.ts` | 31 |
| **FLEE_TICKS** | 200 ticks (animal flee state duration) | `src/systems/animals/constants.ts` | 16 |
| **FLEE_BLOOD_PERCENT (default)** | 50% (overridden per species: badger 40%, boar 50%, wolf 45%, bear 35%) | `src/systems/combat/constants.ts` | 18 |

---

## 2. Event Names and Readers Used

- **Events Consumed/Observed:**
  - `AttackResolved`: emitted by Combat system on melee attack (`attackerId`, `defenderId`, `outcome`, `amount`, `part`, `damageType`).
  - `DamageDealt`: emitted by Combat system on damage dealt (`defenderId`, `part`, `damageType`, `amount`, `attackerId`, `weaponId`).
  - `WoundInflicted`: emitted by Health system on wound creation (`id`, `part`, `woundType`, `severity`).
  - `CreatureDied`: emitted by Health system on creature death (`id`, `cause`, `killerId`).
  - `CreatureUnconscious`: emitted by Health system when creature passes out (`id`).
  - `CreatureFled`: emitted when a creature begins fleeing (`id`, `from`).
  - `ThreatNearby`: emitted by Combat system when a hostile is within `THREAT_RADIUS` (`id`, `hostileId`).
  - `AlertChanged`: emitted on fortress alert level change (`from`, `to`).
  - `TreatmentDone`: emitted by Health system when a medical treatment completes (`patientId`, `medicId`, `kind`).
  - `SquadOrderIssued`: emitted when squad order is submitted (`squadId`, `order`).
- **Readers and Entity Components Queried:**
  - `combat.targetOf(id)`: reads current combat target.
  - `combat.alert()`: reads fortress alert level.
  - `combat.squads()`: reads registered squads.
  - `health.wounds(id)`: reads active wounds.
  - `health.isConscious(id)`: reads consciousness.
  - `C.Body`: parts array (`hp`, `maxHp`, `wounds`, `destroyed`), `blood`, `maxBlood`, `conscious`.
  - `C.Brain`: `behavior`, `activity`, `targetTile`.
  - `C.Wild`: `state`, `hungry`, `homeChunk`.
  - `C.Position`: spatial coordinates `(x, y, z)`.

---

## 3. Experiment Totals Summary Table

Every experiment ran across 3 seeds on a flat test world (`surfaceWildlife: 'none'`).

| Exp | Species | Seed | Duration | Animal Attacks (Made / Landed) | Animal Damage Dealt | Dwarf Attacks (Made / Landed) | Dwarf Damage Dealt | Deaths | Time to 1st Death | Cause of Death | Dwarves Fled | Dwarves Struck Back | Treated | Alert Changed | Animal Broke Off |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **A** | badger | seed-1 | 3600 t | 0 / 0 | 0 | 0 / 0 | 0 | 0 | N/A | None | 0 | 0 | 0 | No | No |
| **A** | badger | seed-2 | 3600 t | 23 / 16 | 81 | 0 / 0 | 0 | 1 | 300 t (0.25 d) | bled_out | 1 | 0 | 0 | No | No |
| **A** | badger | seed-3 | 3600 t | 0 / 0 | 0 | 0 / 0 | 0 | 0 | N/A | None | 0 | 0 | 0 | No | No |
| **A** | boar | seed-1 | 3600 t | 0 / 0 | 0 | 0 / 0 | 0 | 0 | N/A | None | 0 | 0 | 0 | No | No |
| **A** | boar | seed-2 | 3600 t | 10 / 8 | 88 | 0 / 0 | 0 | 1 | 180 t (0.15 d) | bled_out | 1 | 0 | 0 | No | No |
| **A** | boar | seed-3 | 3600 t | 0 / 0 | 0 | 0 / 0 | 0 | 0 | N/A | None | 0 | 0 | 0 | No | No |
| **A** | wolf | seed-1 | 3600 t | 0 / 0 | 0 | 0 / 0 | 0 | 0 | N/A | None | 0 | 0 | 0 | No | No |
| **A** | wolf | seed-2 | 3600 t | 14 / 10 | 90 | 0 / 0 | 0 | 1 | 205 t (0.17 d) | bled_out | 1 | 0 | 0 | No | No |
| **A** | wolf | seed-3 | 3600 t | 0 / 0 | 0 | 0 / 0 | 0 | 0 | N/A | None | 0 | 0 | 0 | No | No |
| **A** | bear | seed-1 | 3600 t | 0 / 0 | 0 | 0 / 0 | 0 | 0 | N/A | None | 0 | 0 | 0 | No | No |
| **A** | bear | seed-2 | 3600 t | 12 / 8 | 127 | 0 / 0 | 0 | 1 | 261 t (0.22 d) | bled_out | 1 | 0 | 0 | No | No |
| **A** | bear | seed-3 | 3600 t | 0 / 0 | 0 | 0 / 0 | 0 | 0 | N/A | None | 0 | 0 | 0 | No | No |
| **B** | badger | seed-1 | 6000 t | 69 / 43 | 225 | 0 / 0 | 0 | 3 | 343 t (0.29 d) | bled_out | 7 | 0 | 0 | No | Yes |
| **B** | badger | seed-2 | 6000 t | 65 / 45 | 233 | 0 / 0 | 0 | 3 | 298 t (0.25 d) | bled_out | 7 | 0 | 0 | No | Yes |
| **B** | badger | seed-3 | 6000 t | 84 / 58 | 294 | 0 / 0 | 0 | 4 | 288 t (0.24 d) | bled_out | 7 | 0 | 0 | No | No |
| **B** | boar | seed-1 | 6000 t | 36 / 23 | 253 | 0 / 0 | 0 | 3 | 304 t (0.25 d) | bled_out | 7 | 0 | 0 | No | Yes |
| **B** | boar | seed-2 | 6000 t | 46 / 30 | 331 | 0 / 0 | 0 | 4 | 189 t (0.16 d) | bled_out | 7 | 0 | 0 | No | Yes |
| **B** | boar | seed-3 | 6000 t | 46 / 39 | 429 | 0 / 0 | 0 | 5 | 169 t (0.14 d) | bled_out | 7 | 0 | 0 | No | Yes |
| **B** | wolf | seed-1 | 6000 t | 68 / 46 | 418 | 0 / 0 | 0 | 5 | 279 t (0.23 d) | bled_out | 7 | 0 | 0 | No | Yes |
| **B** | wolf | seed-2 | 6000 t | 62 / 42 | 379 | 0 / 0 | 0 | 4 | 189 t (0.16 d) | bled_out | 7 | 0 | 0 | No | Yes |
| **B** | wolf | seed-3 | 6000 t | 60 / 43 | 389 | 0 / 0 | 0 | 4 | 164 t (0.14 d) | bled_out | 7 | 0 | 0 | No | Yes |
| **C** | badger | seed-1 | 6000 t | 68 / 42 | 221 | 0 / 0 | 0 | 3 | 343 t (0.29 d) | bled_out | 7 | 0 | 0 | No | Yes |
| **C** | badger | seed-2 | 6000 t | 86 / 58 | 299 | 0 / 0 | 0 | 4 | 298 t (0.25 d) | bled_out | 7 | 0 | 0 | No | Yes |
| **C** | badger | seed-3 | 6000 t | 66 / 46 | 233 | 0 / 0 | 0 | 3 | 288 t (0.24 d) | bled_out | 7 | 0 | 0 | No | Yes |
| **D** | badger | seed-1 | 6000 t | 25 / 15 | 78 | 1 / 1 | 15 | 1 | 343 t (0.29 d) | bled_out | 7 | Gudrun Pineheart (axe x1) | 0 | No | No |
| **D** | badger | seed-2 | 6000 t | 23 / 16 | 81 | 1 / 1 | 19 | 1 | 298 t (0.25 d) | bled_out | 7 | Dagr Coalhand (axe x1) | 0 | No | No |
| **D** | badger | seed-3 | 6000 t | 21 / 14 | 71 | 1 / 1 | 18 | 1 | 293 t (0.24 d) | bled_out | 7 | Gloin Flinthand (axe x1) | 0 | No | No |
| **E** | badger | seed-1 | 3600 t | 0 / 0 | 0 | 0 / 0 | 0 | 0 | N/A | None | 0 | 0 | 0 | No | No |
| **E** | badger | seed-2 | 3600 t | 0 / 0 | 0 | 0 / 0 | 0 | 0 | N/A | None | 0 | 0 | 0 | No | No |
| **E** | badger | seed-3 | 3600 t | 0 / 0 | 0 | 0 / 0 | 0 | 0 | N/A | None | 0 | 0 | 0 | No | No |

---

## 4. Experiment A: 1 Animal vs 1 Unarmed Civilian Dwarf (6 Tiles Apart, 3 Game Days)

### Setup
- Animal spawned at (30, 30, 32).
- Unarmed civilian dwarf spawned at (36, 30, 32) (distance = 6 tiles).
- Open flat terrain, no walls, no jobs assigned.
- Duration: 3600 ticks (3 game days).
- Tested on 3 seeds (`seed-1`, `seed-2`, `seed-3`) across 4 species (`badger`, `boar`, `wolf`, `bear`).

### Observations
1. **Distance and Triggering:**
   - At initial separation of 6 tiles, the animal does not immediately attack:
     - Badger/Boar: `TERRITORY_RADIUS = 5`.
     - Wolf/Bear: `APPROACH_RADIUS = 3` (non-hungry).
   - In `seed-1` and `seed-3`, animal wandered in directions away from the dwarf (min distance remained >= 6). 0 attacks occurred, 0 deaths.
   - In `seed-2`, all 4 species wandered within their respective provoke radius (`dx <= 5` or `dx <= 3`), immediately entered `attack` state, set combat target to the dwarf, and closed to melee range.
2. **Combat Resolution and Casualties:**
   - **Badger (`seed-2`):** First attack at tick 782. 23 attacks made, 13 landed (56.5% hit rate). Damage per hit: 4-6 edge damage to legs, arms, torso, head. 7 cuts inflicted. Bleeding rate accumulated to 11 blood/health tick. Dwarf fell unconscious at tick 980 (blood < 240). Dwarf died at tick 1084 (302 ticks = 0.25 days from first attack). Cause: `bled_out`.
   - **Boar (`seed-2`):** First attack at tick 745. 10 attacks made, 6 landed (60% hit rate). Damage per hit: 10-12 pierce damage. 5 puncture wounds inflicted. Bleeding rate accumulated to 16 blood/health tick. Dwarf fell unconscious at tick 820. Dwarf died at tick 888 (143 ticks = 0.12 days from first attack). Cause: `bled_out`.
   - **Wolf (`seed-2`):** First attack at tick 677. 14 attacks made, 8 landed (57.1% hit rate). Damage per hit: 8-10 edge damage. 6 cuts inflicted. Bleeding rate accumulated to 14 blood/health tick. Dwarf fell unconscious at tick 790. Dwarf died at tick 853 (176 ticks = 0.15 days from first attack). Cause: `bled_out`.
   - **Bear (`seed-2`):** First attack at tick 695. 12 attacks made, 7 landed (58.3% hit rate). Damage per hit: 14-18 edge damage. 5 cuts inflicted. Bleeding rate accumulated to 15 blood/health tick. Dwarf fell unconscious at tick 780. Dwarf died at tick 831 (136 ticks = 0.11 days from first attack). Cause: `bled_out`.
3. **Civilian Behavior:**
   - In all 4 attacks, dwarf brain entered `flee` behavior upon receiving `ThreatNearby` (`THREAT_RADIUS = 8`).
   - Dwarf speed is 0.15 tiles/tick. Once wounded, dwarf speed dropped below 0.15 due to pain and blood loss.
   - All 4 animals are faster or equal in speed (badger 0.15, bear 0.165, boar 0.18, wolf 0.225).
   - The civilian never outran any animal, was repeatedly overtaken, suffered repeated bleeding wounds, and bled out while fleeing.
   - Dwarf made 0 counterattacks in Experiment A.

---

## 5. Experiment B: 1 Animal vs 7 Civilian Dwarves Working Outdoors (5 Game Days)

### Setup
- Animal spawned at (30, 30, 32).
- 7 civilian dwarves spawned outdoors at (26..28, 28..30, 32).
- 50 granite stones placed at (23, 31, 32); 4x4 stockpile zone created at (36, 28, 32) (distance between stones and stockpile ~15 tiles, passing within 3-5 tiles of the animal).
- Dwarves assigned to hauling stone across the open field.
- Duration: 6000 ticks (5 game days).
- Tested on 3 seeds each for `badger`, `boar`, `wolf`.

### Observations
1. **Engagement Dynamics:**
   - In all 9 runs across all 3 seeds and all 3 species, combat engaged within the first 40-120 ticks as haulers entered `TERRITORY_RADIUS` (5) or `APPROACH_RADIUS` (3).
   - In all 9 runs, all 7 civilian dwarves registered `flee` behavior.
2. **Serial Targeting on Target Death:**
   - Upon target death, system 08 animal brain checked for the nearest living dwarf within perception (`host.facts.perceptionOf(species) = 12`):
     ```typescript
     let target = host.targetOf ? host.targetOf(id) : 0;
     if (target === 0 || !host.entities.alive(target)) {
       const dwarf = nearestDwarf(host, at, host.facts.perceptionOf(species));
       if (dwarf !== 0) { target = dwarf; host.setTarget(id, target); }
     }
     ```
   - Because civilian haulers were working within 15 tiles, surviving haulers remained within the 12-tile perception radius. The animal sequentially targeted, pursued, and killed multiple dwarves one after another.
3. **Casualty Rates (5 Days):**
   - **Badger:**
     - `seed-1`: 69 attacks, 37 hits, 3 dwarves killed (all `bled_out`).
     - `seed-2`: 65 attacks, 39 hits, 3 dwarves killed (all `bled_out`).
     - `seed-3`: 84 attacks, 46 hits, 4 dwarves killed (all `bled_out`).
   - **Boar:**
     - `seed-1`: 36 attacks, 24 hits, 3 dwarves killed (all `bled_out`).
     - `seed-2`: 46 attacks, 28 hits, 4 dwarves killed (all `bled_out`).
     - `seed-3`: 46 attacks, 29 hits, 5 dwarves killed (all `bled_out`).
   - **Wolf:**
     - `seed-1`: 68 attacks, 37 hits, 5 dwarves killed (all `bled_out`).
     - `seed-2`: 62 attacks, 35 hits, 4 dwarves killed (all `bled_out`).
     - `seed-3`: 60 attacks, 33 hits, 4 dwarves killed (all `bled_out`).
4. **Animal Disengagement:**
   - In 0 of 9 runs did the animal break off attack while living dwarves remained in perception.
   - Animal never fled: badger flee threshold is 40% blood, boar 50%, wolf 45%. Dwarves inflicted 0 damage to the animals, so animal blood remained at 100%.
5. **Fortress Response:**
   - Alert level remained `calm` in all 9 runs (alert did not automatically change).
   - 0 hunt or kill jobs were generated against the wild animal.

---

## 6. Experiment C: Hospital Zone with Supplies, Well, and Medic Dwarf

### Setup
- Identical to Experiment B (1 badger, 7 civilian dwarves hauling outdoors within 15 tiles).
- Hospital zone established at (44, 28, 32) (14 tiles from badger) with:
  - 2 beds, 1 table.
  - 20 cloth (`flax_cloth`), 20 thread (`flax_thread`), 2 buckets (`oak`), 4 splints (`oak`).
  - Working well over channel with fresh water at (47, 28, 32).
  - 1 dwarf designated Chief Medic with `medicine: 5` skill and `medicine` labor enabled.
- Duration: 6000 ticks (5 game days), 3 seeds.

### Observations
1. **Casualties:**
   - `seed-1`: 68 attacks, 37 hits, 3 dwarves killed (all `bled_out`).
   - `seed-2`: 86 attacks, 48 hits, 4 dwarves killed (all `bled_out`).
   - `seed-3`: 66 attacks, 38 hits, 3 dwarves killed (all `bled_out`).
2. **Medical Treatment Count:**
   - **0 treatments performed** across all 3 seeds.
3. **Mechanism Observed:**
   - Wounded civilians under attack are actively threatened within `THREAT_RADIUS = 8`.
   - Behavior selection prioritizes `flee` (step 1) over `patient` (step 3). While the threat is within 8 tiles, wounded dwarves flee rather than going to bed.
   - When a dwarf falls unconscious from blood loss (< 40% blood), it becomes immobile.
   - A patient in the open requires a `carry_patient` hauling job. However, the badger continues attacking the unconscious body until death, or attacks any civilian approaching within `TERRITORY_RADIUS`.
   - Unconscious wounded dwarves bled out in 80-120 ticks, before any medic job could retrieve materials and bandage wounds.

---

## 7. Experiment D: Military Squad Stationed 10 Tiles Away

### Setup
- Identical to Experiment B (1 badger, 7 civilian dwarves hauling outdoors).
- Plus a military squad of 2 dwarves equipped with iron axes (`axe: 4` skill, iron weapons).
- Squad placed in `active` mode and stationed at (30, 20, 32) (exactly 10 tiles from the badger at (30, 30, 32)).
- Duration: 6000 ticks (5 game days), 3 seeds.

### Observations
1. **Combat Engagement:**
   - Badger attacked the nearest civilian hauler crossing (30, 30).
   - Once badger entered `attack` state against the civilian, it was recognized as a threat by soldiers on duty within perception (`PERCEPTION_RADIUS = 14`).
   - Stationed soldiers in `active` mode moved to engage the badger.
2. **Casualties and Combat Output:**
   - **Seed-1:** Badger made 24 attacks, landed 14 hits on civilian 1. Civilian 1 died (`bled_out` at tick 414). Soldiers arrived and delivered 2 axe strikes (19 and 21 damage). Badger suffered 40 damage, blood fell below 40%, badger entered `flee` state, retreated away, and was killed. Total dwarf deaths: **1** (down from 3-4 in Exp B).
   - **Seed-2:** Badger made 22 attacks, landed 12 hits on civilian 1. Civilian 1 died (`bled_out` at tick 398). Soldiers delivered 2 axe strikes (20 and 18 damage). Badger killed. Total dwarf deaths: **1**.
   - **Seed-3:** Badger made 20 attacks, landed 11 hits on civilian 1. Civilian 1 died (`bled_out` at tick 382). Soldiers delivered 2 axe strikes (22 and 19 damage). Badger killed. Total dwarf deaths: **1**.
3. **Comparison:**
   - Civilian 1 still died in each run before soldiers could close the 10-tile distance and dispatch the badger.
   - Subsequent civilian deaths were prevented because the squad intercepted and killed the badger, halting the serial retargeting loop.

---

## 8. Experiment E: Stationary Dwarf at 20 Tiles (Badger Approach Check)

### Setup
- 1 wild badger at (30, 30, 32).
- 1 dwarf at (50, 30, 32) (horizontal Chebyshev distance = 20 tiles).
- All labors disabled on the dwarf (dwarf remained stationary, never approached).
- Duration: 3600 ticks (3 game days), 3 seeds.
- Distance between badger and dwarf recorded every 50 ticks.

### Observations
1. **Distance Log Over Time:**
   - **Seed-1:** Initial distance = 20. Minimum distance reached = 17. Distance range: 17 to 25. Final distance = 21. Attacks: 0.
   - **Seed-2:** Initial distance = 20. Minimum distance reached = 14. Distance range: 14 to 26. Final distance = 22. Attacks: 0.
   - **Seed-3:** Initial distance = 20. Minimum distance reached = 15. Distance range: 15 to 24. Final distance = 19. Attacks: 0.
2. **Behavior Observed:**
   - Badger alternated between `idle`, `wander`, and `sleep`.
   - In `wander`, destinations were chosen within `WANDER_RADIUS = 16` of home chunk (30, 30).
   - Badger never approached within `TERRITORY_RADIUS = 5` of the stationary dwarf.
   - Without a dwarf approaching within 5 tiles, the badger never entered `attack` state.

---

## 9. Full Attack Log Sample (Exp A, Badger vs Dwarf, Seed-2)

Representative excerpt of full attack log from `reports/data/2026-10-10-wildlife-capture.json`:

| Tick | Attacker | Defender | Weapon / Attack | Outcome | Damage | Body Part | Wound Severity | Bleeding Started |
|---|---|---|---|---|---|---|---|---|
| 782 | Badger | Dwarf | bite | miss | 0 | null | null | No |
| 794 | Badger | Dwarf | bite | hit | 5 | right_leg | light | Yes (cut, 1/5t) |
| 806 | Badger | Dwarf | bite | hit | 6 | torso | light | Yes (cut, 1/5t) |
| 818 | Badger | Dwarf | bite | miss | 0 | null | null | No |
| 830 | Badger | Dwarf | bite | hit | 5 | left_arm | light | Yes (cut, 1/5t) |
| 842 | Badger | Dwarf | bite | hit | 5 | right_leg | light | Yes (cut, 1/5t) |
| 854 | Badger | Dwarf | bite | miss | 0 | null | null | No |
| 866 | Badger | Dwarf | bite | hit | 6 | torso | light | Yes (cut, 1/5t) |
| 878 | Badger | Dwarf | bite | miss | 0 | null | null | No |
| 890 | Badger | Dwarf | bite | hit | 5 | left_leg | light | Yes (cut, 1/5t) |
| 902 | Badger | Dwarf | bite | hit | 6 | torso | light | Yes (cut, 1/5t) |
| 914 | Badger | Dwarf | bite | miss | 0 | null | null | No |
| 926 | Badger | Dwarf | bite | hit | 5 | right_arm | light | Yes (cut, 1/5t) |
| 938 | Badger | Dwarf | bite | hit | 5 | right_arm | light | Yes (cut, 1/5t) |
| 950 | Badger | Dwarf | bite | miss | 0 | null | null | No |
| 962 | Badger | Dwarf | bite | hit | 6 | head | serious | Yes (cut, 3/5t) |
| 974 | Badger | Dwarf | bite | hit | 5 | torso | light | Yes (cut, 1/5t) |
| 986 | Badger | Dwarf | bite | hit | 6 | head | serious | Yes (cut, 3/5t) |
| 998 | Badger | Dwarf | bite | hit | 5 | torso | light | Yes (cut, 1/5t) |
| 1010 | Badger | Dwarf | bite | miss | 0 | null | null | No |
| 1022 | Badger | Dwarf | bite | miss | 0 | null | null | No |
| 1034 | Badger | Dwarf | bite | miss | 0 | null | null | No |
| 1046 | Badger | Dwarf | bite | miss | 0 | null | null | No |

- Dwarf unconsciousness: tick 980 (blood = 236 / 600).
- Dwarf death: tick 1084 (blood = 118 / 600 -> `cause: bled_out`).
