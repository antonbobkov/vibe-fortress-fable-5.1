# 17 Health & Medicine

**Owner:** `systems/health` · **Depends on:** [16-combat.md](16-combat.md), [10-dwarves.md](10-dwarves.md), [13-items-and-storage.md](13-items-and-storage.md), [14-buildings-and-rooms.md](14-buildings-and-rooms.md), [11-jobs-and-labor.md](11-jobs-and-labor.md)

## Purpose

Turn damage into consequences that unfold over time and can be treated: wounds that bleed, bones that must be set, burns and frost, infection, unconsciousness, permanent injuries and death. Own the hospital and the medic's work.

## Concepts

- **Body**: `parts[6]` from the body plan, each with `hp`, `maxHp` and a wound list; `blood`, `maxBlood`, `pain`, `conscious`, `permanent[]`.
- **Wound**: `{ type: cut | puncture | bruise | fracture | burn | frost, severity: light | serious | grievous, bleed: Fixed per health tick, pain, healRemaining, treated: { bandaged, sutured, splinted, cleaned, dressed }, infected }`.
- **Patient**: a creature marked for hospital care.
- **Hospital**: a zone with beds and a supply chest.
- **Treatment**: a medic job that changes a wound's `treated` flags.

## Rules

### Body values

- `maxHp(part) = size × partHpFactor(bodyPlan, part)` (torso 1.0, head 0.5, limbs 0.6 for the standard plan; content).
- `maxBlood = size × BLOOD_PER_SIZE × (50 + Toughness) / 100` for creatures with attributes; `size × BLOOD_PER_SIZE` otherwise.

### Wound creation

On `DamageDealt { defender, part, damageType, amount }`:

1. `ratio = amount / maxHp(part)`. `severity`: `light` if `ratio < LIGHT_MAX`, `serious` if `< SERIOUS_MAX`, else `grievous`.
2. `part.hp −= amount`. If `part.hp ≤ 0`: the part is **destroyed**: for `head` or `torso` the creature dies (`CreatureDied { cause: killed, killerId }`); for a limb the limb is lost (`permanent: lost_<part>`, `LimbLost` event, the `lost_limb` thought), its wounds are removed, and a grievous `cut` remains at the stump with heavy bleeding.
3. Otherwise add a wound with type from `damageType` (16's mapping; rune's `ember` is a `burn`), `bleed` and `pain` from the wound table (type × severity; content), `healRemaining = HEAL_BASE_TICKS × severityMultiplier`.
4. Toughness reduces combat hits in 16's resolution (`min(10, Toughness / 10)` percent). Environmental damage is not reduced.

Environmental sources create wounds through the same path with synthetic damage:

| Source | Event | Effect |
|---|---|---|
| Burning tile | `BurnDamage { id, amount }` | `burn` wound on a random part each materials tick |
| Magma | `MagmaContact` | `amount = maxHp(torso) × 2` as `burn` to torso: death for anything not `magmaSafe` in its species row (ember newts, wyrms) |
| Drowning | `CreatureSubmerged` each health tick while submerged and not aquatic or amphibious | `DROWN_DAMAGE` to torso as `bruise` (no bleeding); at 0 hp the creature dies with `cause: drowned` |
| Falling | `Fell { id, levels }` | `amount = levels² × FALL_DAMAGE_PER_LEVEL_SQ` to a random leg (60%) or torso (40%) as `blunt` → `bruise` or `fracture`; damage to a limb is capped at the limb's hp − 1: a fall breaks bones but never severs a limb |
| Lightning | `LightningStrike` on the tile | `burn` grievous to head and torso |
| Heat and cold | hourly while outdoors above `HEAT_INJURY_C` / below `COLD_INJURY_C` | `burn` (heat stroke) or `frost` light wound on a random limb; clothing (10) halves the chance |
| Starvation | `Starvation { id }` daily | `amount = maxHp(torso) × STARVE_PERCENT / 100` to torso as `wasting` (a `bruise` that does not heal until fed) |
| Bridge | `BRIDGE_CRUSH_DAMAGE` | `blunt` to a random part |
| Sparring | 16 | light `bruise` |

### Bleeding, pain, consciousness

Each health tick (every 5 ticks) for each creature in the `wounded` list or still admitted as a `Patient`, once in ascending entity-id order:

- `blood −= Σ wound.bleed` for wounds not `bandaged` (bandaging sets `bleed = 0`; suturing keeps it 0 and heals faster). A `light` wound stops bleeding by itself `CLOT_TICKS` after it was made (its `bleed` becomes 0); a `serious` or `grievous` wound bleeds until it is bandaged. Blood regenerates `BLOOD_REGEN_PER_TICK` per health tick when no wound bleeds.
- `pain = Σ wound.pain × (100 − Willpower / 2) / 100` (dwarves; other creatures use 100). A `pain` effect (25's `venomed` blade, or a giant cave spider's bite) adds its value to the sum while it lasts, and keeps the creature in the `wounded` list until it ends. Under a `pain_half` effect (25's draught of stoutness) the sum is halved, rounded down, before Willpower.
- `conscious = pain < PAIN_UNCONSCIOUS and blood ≥ maxBlood × BLOOD_UNCONSCIOUS_PERCENT / 100 and tick ≥ stunnedUntil`. An unconscious creature does nothing, is hit at +40, and is carried as a patient if a dwarf.
- **Mend.** On `Mended { id, casterId }` (25's Mend) a living creature with a body has every bleeding wound `bandaged` (its bleed 0), every light wound removed with its damage back to the part's hp, and every other wound `cleaned`. An infected wound keeps its infection and its cleaning request until a medic cures it. Mend is not a treatment job and gives no xp.
- **Stun.** On `CreatureStunned { id, until }` (25's daze and blackout) a living creature with a body is held unconscious until `until`: `stunnedUntil` keeps the later of two stuns, the creature joins `wounded` and stays there while the stun lasts, and a conscious body becomes unconscious at once with `CreatureUnconscious`. The first health tick at or after `until` drops the entry and wakes it by the line above, with `CreatureConscious`. A stun is not a wound: it admits no patient and does not keep one from discharge.
- Death: `blood < maxBlood × BLOOD_DEATH_PERCENT / 100` → `CreatureDied { cause: bled_out }`.
- **Fading.** On `SummonFaded { id }` (25's summon at the end of its day, or after its caster's death) a living creature dies with `CreatureDied { cause: faded, killerId: 0 }`, so every system's cleanup runs as for any death.
- Healing: `healRemaining −= 5` for each wound whose healing is not blocked, `× heal_rate / 100` under a `heal_rate` effect (25's draught of mending): fractures heal only at `UNTREATED_FRACTURE_PERCENT` speed unless `splinted`; infected wounds do not heal; `wasting` does not heal while starving. At 0 the wound is removed, `part.hp` regains the wound's damage, and for an unsplinted fracture that healed, a `permanent: badly_healed_<part>` is added.

### Infection

Each `DayPassed`, for each `cut`, `puncture` or `burn` that is not `cleaned`, not `sutured` and not `bandaged`, older than one day: `INFECTION_PERMILLE` (doubled in miasma or when the creature slept on the floor) → `infected`. Infected: fever (`Patient` regardless of severity; no work), pain +10, no blood regeneration; each day `INFECTION_DEATH_PERMILLE`. `clean_wound` with brightleaf cures the infection after `INFECTION_CURE_DAYS`; cleaning before infection prevents it. A bandage keeps the wound it covers clean: a bandaged wound is not rolled for infection, however long its suture or cleaning waits. A wound that stopped bleeding before it was bandaged (a clotted light wound) is rolled until it is cleaned or sutured. The first successful infection cleaning sets its cure deadline; while that cure is pending, the wound requests no further cleaning and the deadline is never restarted. The infection still keeps the patient admitted until the cure completes.

### Permanent injuries and their effects

| Permanent | Effect |
|---|---|
| `lost_left_arm` / `lost_right_arm` | cannot use two-handed weapons or shields; one lost arm: crafting speed −25%; both: no jobs, cannot eat unaided (care jobs) |
| `lost_left_leg` / `lost_right_leg` | speed 50%; a `crutch` item (carried) restores to 75%; both legs: bedridden (`bedridden` thought, no jobs, care jobs feed them) |
| `badly_healed_<limb>` | arm: −10% crafting; leg: −15% speed |
| `badly_healed_torso` | −10% blood max |
| `scarred_head` (from a serious head wound) | flavor only |

`health.speedModifier(id)` and `health.productivityModifier(id) = 100 − pain / 2 − (100 − bloodPercent) / 2 − permanent penalties`, minimum `PRODUCTIVITY_FLOOR`, are read by 10 and 11. `health.canWield(id, hands)` is read by 16.

### Patients and hospitals

- A dwarf becomes a `Patient` when: any wound bleeds, any fracture is unsplinted, any serious or grievous burn is undressed, any wound is infected, or the dwarf is unconscious from wounds (pain at `PAIN_UNCONSCIOUS` or blood below the threshold, so a stun does not count). `PatientAdmitted { id }`. A light burn admits no one, as a light bruise does not: its dwarf keeps working, and the treatments its wounds need (`dress_burn`, `clean_wound` and any other) are made for it where it is, as for a patient, while a burn of it is undressed. So a fire that burns every dwarf with the `medicine` labor leaves them free to dress each other.
- Hospital zone settings: desired supplies `{ cloth, thread, splints, crutches, brightleaf, buckets }` (defaults `HOSPITAL_DEFAULT_SUPPLIES`). Both `SetHospitalSupplies` and the zone setting require a non-null record containing only these supply kinds, with integer counts from 0 to `HOSPITAL_SUPPLY_MAX`; otherwise `bad_setting`, with no mutation. Store a copy of the validated record; 13 treats the hospital's chests as a stockpile that wants those counts: haulers bring the supplies into a built chest from a tile beside it, and medics take them out the same way (13 § Containers in play). A hospital needs at least one bed and one chest.
- Behavior (10 `patient`): a conscious patient walks to a free hospital bed (any bed if none); an unconscious one gets a `carry_patient` job (labor `hauling`; the carrier picks them up like an item and puts them in the bed). Patients in bed rest; `Needs` still rise; `feed_patient` and `water_patient` jobs (labor `hauling`, no skill) bring a meal or a drink when hunger or thirst pass 60.
- A bleeding patient is bandaged where it lies. While one of its wounds bleeds without a bandage and was made less than `RESERVE_KEEP_TICKS` (11) ago, a dwarf other than the patient has the `medicine` labor enabled, and the patient's `stop_bleeding` job is not blocked (no cloth to fetch, no medic who can reach it; 11 § Blocking and retry), a conscious patient stays on its tile (off a door's tile, by 10's rule for a patient without a bed) and does not start the walk to its bed, and an unconscious one gets no `carry_patient` job. When that no longer holds (the bandage is on, the time has passed, or the job is blocked), it walks or is carried to its bed as above; a `carry_patient` job already made goes on. A patient in danger flees first, by 10's rules.
- Bed allocation uses 14's live hold query: choose an available built hospital bed, else an unassigned available bed. The saved `Patient.bedId` holds it during admission, walking, carrying and rest, until discharge, reassignment or death. One patient per bed, sharing neither with another patient nor a sleeper; the patient's own existing sleep hold may become its patient hold. With no available bed, assign 0 and wait at the current tile, retrying allocation on health ticks. Patients never walk to an unassigned occupied bed as a fallback. Losing an invalid or conflicting bed assignment retries allocation; patient movement follows the current assigned bed.
- Medic jobs (labor `medicine`, skill `medicine`), produced per patient per need, in priority order with the input each consumes:
  1. `stop_bleeding`: 1 `cloth` → every bleeding wound `bandaged`. Priority 1.
  2. `set_bone`: 1 `splint` per fracture → `splinted`. Priority 2.
  3. `suture`: 1 `thread` per `serious` or `grievous` cut or puncture → `sutured` (heals at `SUTURED_HEAL_PERCENT` speed, infection-proof). Priority 3.
  4. `clean_wound`: 1 `bucket` of water (a bucket item filled at a well or water tile by the medic as part of the job) + 1 `brightleaf` if the selected wound has an untreated infection → `cleaned`, and cures infection over `INFECTION_CURE_DAYS`. Priority 3. Cleaning is asked only for a wound that can still be infected (a `cut`, `puncture` or `burn` that is not `cleaned`, `sutured` or `bandaged`) or for an infected wound without a pending cure; a covered wound, and a bruise, fracture or frost wound, asks for none. Select the first infected wound without a pending cure, otherwise the first wound that can still be infected, in body-part/wound order. Skip wounds whose infection cure is pending, including when another wound needs cleaning; cleaning an uninfected wound consumes no brightleaf for a different pending infection. Revalidate infection inputs while the job is pending and before its final work step. If infection appeared after input-free cleaning was planned, hold completion, cancel that job through 11 (releasing its tool and reservations), and recreate it requiring brightleaf. The medic must fetch the required input before treatment; no input-free cure.
  5. `dress_burn`: 1 `cloth` per burn → `dressed` (halves burn pain, heals normally). Priority 3.
  6. `diagnose`: no input; the Chief Medic if any, else any medic; sets `diagnosed`, which makes the wound list visible in the inspector in full detail (undiagnosed patients show "wounded, bleeding" only) and gives `DIAGNOSE_XP`. Priority 4; created once per admission; after discharge it goes on while the dwarf has a wound and ends once none remains. The medic who diagnoses also diagnoses a dwarf while treating it: completing `stop_bleeding`, `set_bone`, `suture`, `clean_wound` or `dress_burn` on an undiagnosed dwarf sets `diagnosed` and gives `DIAGNOSE_XP` as the job would, and the `diagnose` job ends. Another medic's treatment does not diagnose while there is a Chief Medic.
  7. `give_crutch`: 1 `crutch` to a dwarf with a lost leg. Priority 5.
- A treatment's supply (cloth, splint, thread, brightleaf, and the cloth of `bandage_animal`) is counted in units (11 § Assignment step 4): the claim reserves one unit split from a stack, the medic carries that unit to the patient, and the rest of the stack stays in store for the next patient.
- Recompute each admitted patient's treatment needs from the current wounds and treatment flags on every health tick, including while pain alone delays discharge. A fully treated patient has no treatment needs and produces no repeated medic jobs; an unfinished treatment remains a need.
- Job work time `TREAT_TICKS` skill-scaled; a treatment other than `stop_bleeding` can fail at low skill (`TREAT_FAIL_PERMILLE − skill × 10`, minimum 0) consuming the input without effect; the job is re-created. `stop_bleeding` never fails: the first bandage decides whether a serious wound bleeds out. A failed wound treatment remains a saved request independently of admission, including when the dwarf was discharged before completion. The ordinary producer recreates it with its usual inputs and reservations only while the living target still has a wound requiring that treatment. Discharge does not cancel the request or readmit the dwarf; admission keeps its own criteria. Every treatment job (`stop_bleeding`, `set_bone`, `suture`, `clean_wound`, `dress_burn`) ends once no wound of its dwarf needs that treatment, admitted or not, also while it is under way: a dwarf discharged with a job still open (a light cut that clots before its bandage, a serious cut discharged when bandaged) keeps only the jobs its wounds still need. `give_crutch` outlives discharge. Success, healing or death ends a request once the treatment is no longer needed. Infection cleaning never restarts a pending cure.
- Discharge: no bleeding, no unsplinted fractures, no undressed serious or grievous burns, no infection, conscious, pain below `PAIN_DISCHARGE`. `PatientDischarged { id }`; `PatientHealed { id, hospitalTier }` when all wounds are light or gone, giving the `healed` thought (scaled by the hospital tier).
- A dwarf takes no health job whose target is itself (no treatment, `diagnose`, `carry_patient`, `feed_patient` or `water_patient` for its own wounds or needs), whatever its labors; another dwarf does it. The exception is `give_crutch`: a dwarf may fetch its own crutch.
- A priority 1 job for a patient (`stop_bleeding`, `carry_patient`) calls the nearest worker with its labor off interruptible work at once (11 § Assignment); the other treatments wait for a free medic.
- Without a hospital, medics still treat patients wherever they lie if supplies are in any stockpile; the hospital's value is proximity, beds and the room tier.
- Care continues under a `hearth` alert. A conscious patient is bandaged where it lies and walks to its bed as under any alert, an unconscious one is carried, and a dwarf with the labor leaves the shelter for a patient's job (`carry_patient`, `feed_patient`, `water_patient`, the treatments and `diagnose`) and returns when it ends (10 § Behavior selection step 2). Under the alert 11 offers a sheltering civilian these jobs only. A hostile near the patient keeps the medic away by the ordinary `flee` rule.

### Animals

Tame animals get bandaging only, and a summon (a creature with `Summoned`) gets none: the health producer creates `bandage_animal` (labor and skill `animal_care`) when any wound bleeds without a bandage. The job consumes one cloth at priority 1, uses the base duration in the job catalogue (skill-scaled), and bandages every bleeding wound, setting its bleed to 0. It has the same treatment-failure rule, using the worker's animal-care skill; a failed treatment consumes the cloth and can be produced again. Completion emits `TreatmentDone { kind: 'bandage_animal' }`. Animals never get surgery; wild and hostile creatures get nothing.

### Death and corpses

`CreatureDied { id, cause, killerId }` is emitted here for every creature. 13 creates the corpse, except for a summoned species (25 § Summons), which leaves none; 10 handles dwarves; 15 grief; 08 animals; 18 hostiles; 16 kills. When that event is dispatched, 13 creates the live corpse and hands off all worn and extra carried items before the removal is observable to presentation listeners. A hungry wild predator may consume the corpse under 08's eating rule; those remains are then unavailable for burial. Death leaves no carried clothing referencing its destroyed creature; corpse disposition and departure use the ordinary item API.

## State

- `Body` components; `Patient` components; `wounded: SortedSet<EntityId>`; `hospitals: zoneId[]`; per-patient job keys; saved failed-treatment requests, keyed by dwarf and treatment kind independently of `Patient`; `stunnedUntil`, the creatures a stun holds and the tick it ends (optional in the save; absent means none).
- Rng stream.

## Interfaces

### Reader

- `health.isConscious(id)`, `health.bloodPercent(id)`, `health.pain(id)`, `health.isWounded(id)`
- `health.wounds(id)` (full list; the UI applies the diagnosis rule), `health.permanent(id)`
- `health.isPatient(id)`, `health.needsTreatment(id)` (list of job kinds)
- `health.speedModifier(id)`, `health.productivityModifier(id)`, `health.canWield(id, hands)`, `health.canWork(id)`
- `health.summaryText(id)` ("Bleeding from the left arm; broken right leg (splinted); in pain")

### Commands

`SetHospitalSupplies { zoneId, wants }` (stored as a zone setting; 13 reads it).

### Events consumed

`DamageDealt` (one with `clean: true`, 25's mishap burn, makes its wound already `cleaned`, so it cannot take infection), `BurnDamage`, `MagmaContact`, `CreatureSubmerged`, `Fell`, `LightningStrike`, `Starvation`, `CreatureStunned` (25), `Mended` (25), `SummonFaded` (25), `HourPassed` (heat and cold), `DayPassed` (infection), `ZoneChanged` (hospitals), `JobCompleted`, `ItemCreated` (supplies for blocked jobs).

### Events emitted

`WoundInflicted { id, part, type, severity }`, `LimbLost { id, part, name, species }`, `CreatureUnconscious { id }`, `CreatureConscious { id }`, `CreatureDied { id, cause, killerId }`, `PatientAdmitted`, `PatientDischarged`, `PatientHealed { id, hospitalTier }`, `InfectionStarted { id }`, `InfectionCured { id }`, `TreatmentDone { patientId, medicId, kind }`, and 04's `CreatureSubmerged { id, tile }` (each health tick, for every creature its own drowning check finds submerged).

### Registrations

Job producer `health` (`carry_patient`, `feed_patient`, `water_patient`, `stop_bleeding`, `set_bone`, `suture`, `clean_wound`, `dress_burn`, `diagnose`, `give_crutch`, `bandage_animal`); inspector section `creature › health` (parts with hp bars, wounds with treatment flags, blood, pain, consciousness, permanent injuries); announcements: `PatientAdmitted` (note), `CreatureUnconscious` for dwarves (alert), `CreatureDied` for dwarves (danger, pauses; "Ketil Ironvein has bled to death"), for pets (alert), for others (note), `InfectionStarted` (alert), `LimbLost` (alert; "Ketil Ironvein has lost a limb", an animal or a raider by its species, "A cat has lost a limb"; the event carries the name and species taken when the limb was lost, so the line names a creature the same blow killed).

## Player-facing behavior

- Hospital zone: bed count, chest, supply wants with current counts, patients list with their needs.
- Creature inspection › Health tab. A patient's panel also has a `Care:` line saying what happens next: no hospital, no free hospital bed, no one with Medicine enabled, waiting to be carried, the treatment under way and who does it, the supply it waits for, waiting for a medic, or resting until healed (`ui-screens/fortress-screen.md` § Inspection panel).
- The status bar shows a red cross with a count when any dwarf is a patient.
- Hints: "A hospital needs a bed, a chest, cloth and thread", "Brightleaf treats infection; gather it from the woods", "Splints stop fractures healing wrong".

## Tuning constants

| Name | Value | Meaning |
|---|---|---|
| `BLOOD_PER_SIZE` | 10 | |
| `LIGHT_MAX` / `SERIOUS_MAX` | 0.2 / 0.5 | Damage ratio thresholds; measured, under a skill-5 medic no dwarf of 30 dies of a light or a serious cut, and 6 of a grievous one ([wound recovery](../../reports/audits/2026-10-21-wound-recovery.md), [the first bandage](../../reports/audits/2026-10-21-first-bandage.md)) |
| `HEAL_BASE_TICKS` | 6000 | 5 days for a light wound; serious ×3, grievous ×6. Measured: light cut 5.0 days, serious fracture 15.9, grievous fracture 30.7 ([wound recovery](../../reports/audits/2026-10-21-wound-recovery.md)) |
| `BLOOD_REGEN_PER_TICK` | 1 | Blood units per health tick (*unmeasured*) |
| `CLOT_TICKS` | 150 | Ticks after which a light wound stops bleeding by itself; measured, a Novice soldier in helm, mail shirt and greaves takes about eight light cuts from two goblins and stays standing in 55 of 60 duels ([combat pace tune](../../reports/audits/2026-10-21-combat-pace-tune.md)) |
| `PAIN_UNCONSCIOUS` | 80 | *unmeasured* |
| `BLOOD_UNCONSCIOUS_PERCENT` | 40 | Measured: a serious cut (bleed 3) takes a dwarf unconscious about 600 ticks after the wound, a grievous one about 300 ([wound recovery](../../reports/audits/2026-10-21-wound-recovery.md)) |
| `BLOOD_DEATH_PERCENT` | 20 | |
| `UNTREATED_FRACTURE_PERCENT` | 25 | Healing speed (*unmeasured*) |
| `SUTURED_HEAL_PERCENT` | 150 | Measured: a sutured serious cut heals in 10.3 days, a grievous one in 20.3 ([wound recovery](../../reports/audits/2026-10-21-wound-recovery.md)) |
| `INFECTION_PERMILLE` | 100 | Per untreated wound per day; measured, 12 of 30 light cuts with no medic are infected, none with one ([wound recovery](../../reports/audits/2026-10-21-wound-recovery.md)) |
| `INFECTION_DEATH_PERMILLE` | 50 | Per day infected; measured, 6 of those 12 die ([wound recovery](../../reports/audits/2026-10-21-wound-recovery.md)) |
| `INFECTION_CURE_DAYS` | 3 | *unmeasured* |
| `DROWN_DAMAGE` | 8 | Per health tick (*unmeasured*) |
| `FALL_DAMAGE_PER_LEVEL_SQ` | 6 | *unmeasured* |
| `STARVE_PERCENT` | 8 | Of torso hp per day (*unmeasured*) |
| `PRODUCTIVITY_FLOOR` | 30 | Percent (*unmeasured*) |
| `HOSPITAL_SUPPLY_MAX` | 999 | Maximum count requested by a hospital setting |
| `TREAT_TICKS` | 200 | |
| `TREAT_FAIL_PERMILLE` | 200 | At skill 0, for every treatment but `stop_bleeding`; measured, 6% to 17% of treatment jobs fail at skills 5 and 0 ([wound recovery](../../reports/audits/2026-10-21-wound-recovery.md)) |
| `DIAGNOSE_XP` | 20 | *unmeasured* |
| `PAIN_DISCHARGE` | 30 | Measured: patients leave in 0.3 to 2 days, except a grievous fracture, which stays until healed, 30.6 days ([wound recovery](../../reports/audits/2026-10-21-wound-recovery.md)) |
| `HOSPITAL_DEFAULT_SUPPLIES` | cloth 10, thread 5, splints 4, crutches 2, brightleaf 6, buckets 2 | *unmeasured* |

Wound bleed and pain values per type and severity are content.

## Extension points

- Diseases: a `condition` list on `Body` already holds `infected`; a disease table with daily progression fits the same loop.
- Prosthetics: an item that removes a `lost_leg` penalty.
- Surgery on internal injuries: a new wound type and treatment kind.
- Veterinary care beyond bandaging: enable more job kinds for animals.

## Planned: Making Do

Not yet in the game. Each block below is a rule of the Making Do content and names the task that builds it. That task moves its block into the sections above as plain specification (its constants into § Tuning constants, its events, commands and readers into § Interfaces) and deletes it here; the last one deletes this section. Every number here is *unmeasured*. The rows named are in the content documents' § Planned rows.

### Bone and metal splints and crutches (T-549)

A splint or crutch of bone or metal is a splint or crutch: `set_bone` and `give_crutch` take any material. The recipes are rows (`workshops-and-recipes.md` § Planned rows).

### Honey (T-555)

- `dress_burn` takes a `honey` in place of a `cloth`; a burn dressed with honey is also `cleaned`, so it is never rolled for infection.
- `clean_wound` takes a `honey` in place of the bucket of water: a fortress with no well cleans its wounds with honey. An infected wound still needs its brightleaf; honey prevents and cures nothing that is already infected.
- The medic takes cloth and water first, honey only when they are not available, so a hospital's honey goes to the fortress without them.
- Hospital supply kind `honey` (the desired-supplies record and `HOSPITAL_DEFAULT_SUPPLIES` gain it, default 0).

### Soap (T-NEW (compost))

- Hospital supply kind `soap` (default 0). A `wash_patient` job (labor `medicine`, skill `medicine`, priority 3, input 1 `soap`, `TREAT_TICKS`, xp 4) is made once per admission for a patient when a soap is available. Done, the patient is `washed` (`Patient.washed`): no wound of theirs is rolled for infection for the rest of that admission, the wounds they take during it included. Discharge clears it.
- Soap prevents, brightleaf cures, honey prevents one wound at a time: three medicines where there was one.
- Save: `Patient.washed` (absent: false).
