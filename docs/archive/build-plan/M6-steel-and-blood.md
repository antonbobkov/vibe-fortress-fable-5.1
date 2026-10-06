# M6 — Steel and Blood

**Goal:** combat, health and hospitals, threats and cavern monsters, the Deep, traps and mechanisms, alerts. **Gate:** `cb_*`, `he_*`, `th_*`, `df_*`, `bd_bridge`, `bd_floodgate`, `bd_burial`, `an_predator`, `an_tame`, `fo_hunt`, `fo_no_ammo`, `fl_drown`, `dw_starve` (complete), e2e `military-and-alert`, performance smoke (full systems).

Spec: [`16`](../../02-systems/16-combat.md), [`17`](../../02-systems/17-health-and-medicine.md), [`18`](../../02-systems/18-threats-monsters-and-raids.md), [`19`](../../02-systems/19-defense-and-traps.md), algorithms `combat-and-health.md`, `creature-brains.md` § Hostile party AI; content `weapons-and-armor.md`, `creatures.md`, `threat-schedules.md`.

## T-M6-01 Health: body values, wounds, bleeding, consciousness, death (L)

Needs: M5, F-01 … F-11 ([../fixes/README.md](../fixes/README.md)). Produces: `src/systems/health/{index,state,reader,wounds,tick}.ts`: `Body` fill from plans (`maxHp`, `maxBlood`), `onDamageDealt`, wound tables, limb loss and permanents, the health tick, `CreatureDied` as the single death path (re-route the M4 starvation and animal deaths through `Starvation` and health), environmental sources (`BurnDamage`, `MagmaContact`, `CreatureSubmerged`, `Fell`, `LightningStrike`, heat and cold hourly), speed and productivity modifiers wired into 10 and 11.
Spec: `17` § Body values … § Permanent injuries; algorithm § Health tick, § onDamageDealt.
Tests: scenarios `he_bleed`, `he_limb`, `he_fall`, `fl_drown`, `dw_starve` (death); unit: severity thresholds; wound table values; unconscious/death thresholds with Toughness and Willpower; `badly_healed` on unsplinted fracture; speed modifiers.

## T-M6-02 Combat: factions, targeting, melee resolution (L)

Needs: 01. Produces: `src/systems/combat/{index,state,reader,melee,targets,factions}.ts`, `Equipment` weapon/shield/armor slots, `combat.setTarget`, cooldowns, hit/parry/block/part/damage/armor per the algorithm, `DamageDealt`, `AttackResolved`, xp grants, natural attacks, war-trained bonus, civilian cornered fighting.
Spec: `16` § Targeting, § Attack cooldown, § Melee resolution; `weapons-and-armor.md` tables and worked examples.
Tests: scenarios `cb_hit_table`, `cb_armor`, `cb_worked_examples`; unit: `armorCovering` layer order; two-handed excludes shields; unconscious +40; `BLUNT_THROUGH_PERCENT`.

## T-M6-03 Combat: projectiles, line of sight through fortifications, hunting (M)

Needs: 02. Produces: `Projectile` entities and advancement, `shoot`, ammunition splitting and breakage, `blocksProjectile`, the fortification adjacency rule, `combat.fireAt` for 09; hunting job complete (approach, shoot, retrieve, field butchering, hunting dogs), `AMMO_FETCH`, `no_tool` reason for hunters.
Spec: `16` § Ranged resolution; `22` line of sight; `09` § Hunting.
Tests: scenarios `cb_ranged`, `fo_hunt`, `fo_no_ammo`; unit: projectile stops at walls; bystander half chance; overlook rule.

## T-M6-04 Combat: threats to civilians, fleeing, animals attacking (S)

Needs: 02. Produces: `threatScan` and `ThreatNearby`, civilian `flee` behavior and cornered rule in 10, animal `hunt`/`attack` states live, flee at blood percent, `CreatureFled`.
Spec: `16` § Fleeing and morale in combat, § Threat detection; `08` § Wild behavior (hunt, attack).
Tests: scenario `an_predator`; unit: throttle per creature; timid flee radius.

## T-M6-05 Squads, orders, duty, stations, patrols, alerts (M)

Needs: 02. Produces: `Squad` entities and all squad commands, `Soldier` duty, order execution (kill, station, patrol, follow), `SetAlert` and `AlertChanged` effects (civilians retreat through 19's retreat tile in T-M6-12; doors `lock_on_alert`; war animals), military titles in professions, kill records and `killed_hostile`.
Spec: `16` § Squads, § Alerts, § Kills and loot; `24` § alert selector.
Tests: scenario `cb_squad_station`; unit: mode transitions under alert; order queue semantics; `SQUAD_MAX_SIZE` and count limits; leader default is the Warden.

## T-M6-06 Training and equipment (M)

Needs: 05. Produces: barracks and archery range training sessions with xp and sparring injuries; equipment claiming by preference every `REEQUIP_CHECK_DAYS`, `owned` flag, drops of replaced gear at the barracks, armor speed penalty with `armor_use`, `SOLDIER_AMMO` quivers, training weapons.
Spec: `16` § Training, § Equipment.
Tests: scenario `cb_training`; unit: best-item selection by `metalTier × qualityMult`; two-handed/shield exclusion; speed penalty floor; archery bolts recovered by hauling.

## T-M6-07 Hospitals and medicine (M)

Needs: 01, M2-03. Produces: `Patient` flow, hospital zone settings and supply wants as a 13 filter, medic jobs (all ten) with inputs and failure chance, infection daily rolls with miasma and floor-sleep modifiers, cures, discharge and `PatientHealed`, care jobs, crutches, `Chief Medic` skill for diagnosis, animal bandaging.
Spec: `17` § Infection, § Patients and hospitals, § Animals; `jobs.md` § Health.
Tests: scenarios `he_bandage`, `he_fracture`, `he_infection`; unit: needs list priority order; supplies consumed; discharge conditions; treatment failure at skill 0 consumes the input.

## T-M6-08 Threats: schedule, renown, party generation, arrival, warnings (M)

Needs: 02. Produces: `src/systems/threats/{index,state,reader,schedule,parties,gear}.ts`: schedule rolls from content per peril, renown, party composition and gear tiers, edge arrival with trickle, `ThreatWarning` with fog, `RaidArrived` (danger), trait modifiers, bandits condition on Hillfolk reputation (reputation exists from M7: read 0 until then), Embark-time first rolls.
Spec: `18` § Renown, § Schedule, § Party composition, § Arrival and warning; `threat-schedules.md`.
Tests: scenarios `th_schedule`, `th_warning`; unit: size formula caps; composition fractions; gear per tier; no winter raids at peril ≤ 2.

## T-M6-09 Threats: party and member AI, thieves, stealth, loot, retreat, door breaking (L)

Needs: 08, 05. Produces: the party state machine and member brain per `creature-brains.md` § Hostile; stealth and spotting (dogs), `ThiefSpotted/ThiefEscaped` with wealth adjustment and owner thought, loiter and retreat outcomes, `raid_repelled`, `DoorBreakAttempt` and 14's `DoorBroken` after `DOOR_BREAK_TICKS`, hostile equipment on corpses and `strip_corpse`.
Spec: `18` § Party AI, § Stealth; `14` § Doors (breaking).
Tests: scenarios `th_loiter`, `th_retreat`, `th_thief`, `th_troll_door`; unit: goal selection per purpose; separated members act alone; loot carried off the map.

## T-M6-10 Cavern monsters, webs, restless dead (M)

Needs: 09. Produces: initial cavern spawns asleep, wake on breach, daily respawn with caps and traits, monster seek/return, spider webs (`web` flag, entangle cost), restless dead dusk rising and dawn collapse, `MonsterSpawned`, `RestlessRose`, wyrm fire breath as a ranged burn attack.
Spec: `18` § Cavern monsters; `creatures.md` cavern monster rows; `22` web cost.
Tests: scenario `th_restless`; unit: monsters do not leave the band without a target; webs entangle for `WEB_TICKS`; wyrm breath applies `burn` at range 6.

## T-M6-11 The Deep (S)

Needs: 10. Produces: Deep pressure from `DeepsilverMined`, thresholds and emergences (rock cracking through the terrain API at the last mined tile), Hollow-born global targeting, `DeepStirred` and `deep_stirred_dread`, waves after level 4, the threats panel gauge data.
Spec: `18` § The Deep; `threat-schedules.md` § The Deep.
Tests: scenario `th_deep`; unit: threshold table; emergence tiles adjacent to the last mined deepsilver; waves grow by one.

## T-M6-12 Defense: traps, plates, levers, retreat tile, war animal stations (M)

Needs: 05, M2-06. Produces: `src/systems/defense/{index,state,reader,traps,plates,retreat}.ts`: trap registry from buildings, trigger on `EntitiesMoved` with mode rules, the four trap behaviors, `CreatureCaged` (creature becomes dormant inside the cage item; release restores it), rearm and clean jobs, plate condition edges → `MechanismTriggered`, `pull_lever` completion → `MechanismTriggered`, `defense.retreatTile` (used by 10 on hearth alert), chain stations.
Spec: `19` (all); `14` § Mechanisms and links (14 applies toggles with `LINK_DELAY_TICKS`: implement the pending-toggle queue in 14 in this task).
Tests: scenarios `df_stone_fall`, `df_cage`, `df_plate_bridge`, `df_dwarf_safe`, `df_retreat_tile`, `cb_alert_hearth`; unit: jam chance grows with corpses; `all` mode; plate reset spacing; retreat tile rule order.

## T-M6-13 Mechanisms: links, drawbridges, floodgates in play (M)

Needs: 12, M3. Produces: `LinkMechanism/UnlinkMechanism` jobs consuming a mechanism, drawbridge raise/lower with crush and displacement, floodgate open/close affecting fluids and pathing, `BuildingStateChanged` consumers in 04 and 22 verified, lever panel.
Spec: `14` § Mechanisms and links; `19` § Doors, bridges, floodgates as defense (patterns).
Tests: scenarios `bd_bridge`, `bd_floodgate`; unit: the six defense patterns as headless scenarios `df_pattern_gate`, `df_pattern_airlock`, `df_pattern_corridor`, `df_pattern_drowning`, `df_pattern_magma`, `df_pattern_pit` (plan-only ids, not in `acceptance-tests.md`; each asserts the outcome promised in `19` § Doors, bridges, floodgates as defense against a scripted raid).

## T-M6-14 Burial, grief, memorial slabs (S)

Needs: 01, M4-13. Produces: `bury` job to coffins in tombs, `Buried`, `unburied_dead` standing thought clearing, `memorial_slab` crafting for a named dead dwarf and placement counting as burial, `AssignCoffin`.
Spec: `14` § Burial; `15` § Grief and burial.
Tests: scenario `bd_burial`, `mo_grief` (complete with a real death).

## T-M6-15 Taming, training, war animals, pets follow (S)

Needs: 12, M4-04. Produces: `TameCaged`, `TrainAnimal` jobs at the kennel with success rolls, war and hunting behavior, chains and squad assignment, `ReleaseCage`/`ReleaseCaged`.
Tests: scenario `an_tame`; unit: success formula; war dog attacks within radius; hunting dog follows its hunter.

## T-M6-16 Military, threats, health panels; combat log; announcements (M)

Needs: 05–12, M4-17. Produces: `panels/{military,threats}.ts`, hospital zone settings panel, creature health tab with the diagnosis rule, combat log tab with strings, danger auto-pause and centering, the deepsilver confirmation dialog (`c_deepsilver`) gating `Designate`.
Spec: `ui-screens/panels.md` (Military, Threats), `24` § Announcements, § Confirmations; `18` § Player-facing behavior.
Tests: unit golden buffers; `ui_danger_pause` scenario (headless: `RaidArrived` sets speed 0 through the host); e2e `military-and-alert`: create a squad, set a station by click, set alert Hearth by keyboard, assert civilians move toward the hearth hall and the door locks.

## T-M6-17 Compositor: hostiles, projectiles, traps, stealth, webs, bridges; squad stations overlay (S)

Needs: 16. Produces: compositor rules for these; flash on first attack; unconscious blink.
Tests: golden render `m6-raid.json`.

## T-M6-18 Gate M6 (S)

Needs: all. `reports/M6-gate.md`; `current-milestone: 7`; save the reference fortress fixture `test/fixtures/reference-fortress.deepholm` produced by a scripted headless run (year 3, 80 dwarves via `TestWorld` spawns, 25,000 items, breached cavern, waterfall) for `perf_reference`; run `test:perf`; `year_one` and the perf-tier `year_one_seeds` (no deaths on any seed); property generator extended with squad, alert, trap, lever and hospital commands.

> The gate uses **two** fixtures, because one cannot answer both questions asked of it (owner decision, 2026-09-27).
>
> **Behaviour under play — this is what the M6 gate asserts.** A *played* fortress, not a scripted one: 20 dwarves on their own brains; at least six workshops with `maintain` orders and their inputs stocked; two stockpiles being hauled to; a farm; the disturbed lake of `fixes/F-03` (`fl_settle`); and a squad. It must show no deaths, the lake settling, and orders and hauling actually running. Its per-system averages are reported.
>
> **Load at target scale — measured and reported here, but gated in M8.** The 80-dwarf scripted `test/fixtures/reference-fortress.deepholm` of `performance-budget.md` (year 3, 80 dwarves, 120 animals, 25,000 items, 600 buildings, 60 zones, river, breached cavern, waterfall). The M6 gate builds it, measures it, and records every system against its allocation in `reports/M6-gate.md`, stating plainly which systems are over and by how much. It does **not** fail the M6 gate on those figures.
>
> Why: performance within budget is the goal of M8, whose gate is "`perf_*` within budget" and whose first tasks are [T-M8-01 Profiling pass and per-system budgets](M8-polish.md) and [T-M8-02 Load shedding](M8-polish.md). The load-shedding rules of `performance-budget.md` § Load shedding rules are specified but unimplemented until T-M8-02. Failing M6 on allocations the plan does not schedule until M8 would block trade, immigration and the outside world on work that already has a home. The M6 measurements become T-M8-01's baseline, and a system over its allocation is a gate failure **at M8**.
