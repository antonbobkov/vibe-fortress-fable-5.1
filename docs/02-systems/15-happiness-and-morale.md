# 15 Happiness & Morale

**Owner:** `systems/morale` · **Depends on:** [10-dwarves.md](10-dwarves.md), [14-buildings-and-rooms.md](14-buildings-and-rooms.md), [`../00-vision/vision.md`](../00-vision/vision.md)

## Purpose

Make dwarves' lives matter without letting misery snowball. A dwarf's mood is one visible number built from listed causes. Mood changes how fast dwarves work and, at the bottom, what small trouble they cause. Fortress-wide mood drives immigration. The system is built so that a fortress whose needs are met cannot reach Miserable.

## Concepts

- **Thought**: a row of `personality-and-thoughts.md`: an id, a diary line, a signed value, a duration, a decay shape, a per-cause cap, a trigger, and personality scaling.
- **Active thought**: an instance on a dwarf with a start tick and a current value.
- **Standing thought**: a thought that persists while its condition holds (a need over its want threshold, no bedroom, an unburied dwarf).
- **Mood**: 0–`MOOD_MAX`, recomputed hourly.
- **Tier**: Ecstatic, Content, Fine, Unhappy, Miserable.
- **Hall spirit**: the average mood of adult dwarves.
- **Sulk**: the act of a dwarf who has been Miserable for `SULK_DAYS`.

## Rules

### Mood

```
positives    = min(POSITIVE_CAP, Σ value of active thoughts with value > 0)
negatives    = min(NEGATIVE_CAP, Σ |value| of active thoughts with value < 0)
needPressure = floor(min(NEED_PRESSURE_CAP, Σ |value| of the active standing thoughts hungry, thirsty, tired, lonely))
hearthBonus  = hearthHallTierIndex × HEARTH_TIER_BONUS          // 0 with no hearth; bare = 0 … royal = 5 × bonus
raw          = MOOD_BASELINE + positives − negatives − needPressure + hearthBonus + personalityBase
mood         = clamp(MOOD_MIN, MOOD_MAX, max(raw, MOOD_NEEDS_MET_FLOOR − needPressure))
```

With the constants below: baseline 55, positives up to +40, negatives down to −35, need pressure down to −20, hearth up to +10. The standing thoughts of the four survival and company needs count twice, once as thoughts and once as pressure: that is what makes neglect, and only neglect, able to take a dwarf below 20. With every need met, `needPressure` is 0 and mood is at least `MOOD_NEEDS_MET_FLOOR` (20, Unhappy, not Miserable) whatever the thoughts and the personality. This is the design's anti-spiral guarantee, and the tests in `04-implementation/acceptance-tests.md` check it.

### Tiers and effects

| Tier | Mood | Productivity | Other |
|---|---|---|---|
| Ecstatic | ≥ 85 | 115% | Talks relieve social need more; the dwarf hums (flavor line in the panel) |
| Content | 65–84 | 105% | |
| Fine | 40–64 | 100% | |
| Unhappy | 20–39 | 90% | Slower; more likely to idle at the hearth |
| Miserable | < 20 | 80% | Sulk counter runs |

Productivity is read by 11 as the work rate multiplier and by 10 as `productivity(id)` together with 17's wound modifier. The tier bounds and the productivity factors are *unmeasured*.

### Thoughts

Thought triggers are declarative: `{ event: EventType, where?: predicate on fields, target: which field names the dwarf }`. The morale system subscribes to every event named by any thought row and applies matching thoughts. A row of the meal, sleep or weather family that gives a condition and no event takes its family's event (`MealEaten`, `Slept`, `DwarfOutdoorsIn`), and the row is selected by the event's documented fields. Standing thoughts are condition checks, not events. `MealEaten` carries `mealType`, the id of the eaten item's type (easy, fine or lavish meal), and `ItemDestroyed` carries the item's final `quality`, so that the meal rows and `masterwork_lost` can be matched. Complex thoughts (friend died, saw a friend hurt) come from `ThoughtSource`s registered by 10.

Value scaling: `value × personalityMultiplier(dwarf, thought) × stageMultiplier` where `stageMultiplier` handles meal staleness (13) and room tiers (14) through the `where` predicate selecting a specific row per tier.

Decay: `linear` (value falls to 0 over `durationHours`) or `halflife` (value halves every `durationHours / 3`). A `halflife` thought keeps at least 1, or its whole value when that is smaller (a stoic's halved −1), until `durationHours` have passed, so a ±1 row lasts its hours instead of rounding away within the first (T-569); after its hours it is removed once under 1, so a large one (−15 over 336 hours) runs on past them as before. Negative event thoughts use `halflife` with shorter durations than positive ones of similar weight, so bad days fade faster than good ones; the small −1 annoyances (`lab_stink`, `nettles`, `drank_cactus`, `smoky_hall`, `spat_on`) are all `halflife` and hold their −1 for their 12 hours.

Caps: a thought with `cap = 1` refreshes its start tick instead of stacking; `cap = n` allows n instances (for example `saw_masterwork` cap 3). No thought stacks without limit.

The thought list fixed by this design (values and durations in `03-content/personality-and-thoughts.md`):

- **Standing (needs):** `hungry`, `thirsty`, `tired`, `lonely`, `uncomfortable`, `restless`, `bored`; **standing (conditions):** `no_bedroom`, `slept_on_floor_last_night` (0 since T-572: the floor's thought is `slept_on_floor`), `unburied_dead` (any dwarf corpse unburied for 3+ days), `unclothed`, `in_miasma` (while standing in it), `in_pain` (pain above threshold), `bedridden`.
- **Food and drink:** `ate_easy_meal`, `ate_fine_meal`, `ate_lavish_meal`, `ate_raw_food`, `ate_stale_food`, `ate_in_bare_hall`, `ate_in_decent_hall`, `ate_in_fine_hall`, `ate_in_grand_hall`, `ate_in_royal_hall`, `drank_ale`, `drank_fine_drink` (wine, bellwine), `drank_water`, `drank_from_puddle` (surface water outdoors).
- **Sleep:** `slept_in_bare_room` … `slept_in_royal_room`, `slept_in_shared_bed_room` (a bedroom not their own), `slept_on_floor` (−2), `slept_outdoors`, `well_rested`, `slept_on_a_pallet` (`Slept`'s `bedType` a pallet, −1), `slept_in_a_bed` (a wooden bed not dressed, +1), `slept_in_a_soft_bed` and `slept_in_a_featherbed` (`Slept`'s `bedding`, 10 § Sleeping).
- **Social and comfort:** `talked_with_friend`, `talked_with_someone`, `sat_in_fine_room`, `hearth_visit`, `hearth_lit` (one-time, everyone), `thane_hall_grand`, `thane_hall_bare`, `admired_statue`, `saw_masterwork`, `felt_mist`, `warm_spring`, `saw_wisp` (a wisp appears within 8 tiles in line of sight, at most once a day: a dwarf who holds it sees no other), `lab_stink` (a dwarf of the fortress steps within `LAB_STINK_TILES` of a laboratory that spoiled a batch today, while it does not hold the thought: 25 § Draughts).
- **Work and skill:** `made_masterwork`, `made_fine_item`, `skill_milestone` (levels 5/10/15/20), `legendary`, `finished_big_job` (a dig of 50+ tiles finished by the fortress: everyone with mining), `harvest_in` (farmers on harvest), `first_vein` (the finder), `rune_sick` (a caster's desperate fourth vial, 25 § Vials).
- **Weather:** `caught_in_rain`, `caught_in_storm`, `snowed_on`, `bitter_cold`, `sweltering`, `saw_sunlight` (a dwarf who has been underground for 7+ days sees the sky: positive).
- **Making do:** `drank_cactus` (`DrankFromPlant`), `nettles` (`Stung` with `source: nettle`), `stung` (`Stung` with `source: bees`: a beekeeper or a passer-by, 08 § Hives), `spat_on` (`SpatOn`: the dwarf a camel spat on as it was milked or shorn, 08 § Products), `ate_wyrmtongue` (`MealEaten` whose `seasoned` holds `wyrmtongue`), `ate_salted_meal` (`MealEaten` whose `seasoned` holds `salt`), `smoky_hall` (`SmokyFuelBurned`: every fortress dwarf within `SMOKE_RADIUS` of its `tile`, Chebyshev on its level, 05 § Smoke; one that names a `dwarfId`, a candle's tallow smoke, to that dwarf alone, 14 § Candle stands and lanterns), `ate_by_candlelight` (`MealEaten` with `candlelit`: a meal at a table in comfort light, 10 § Eating and drinking), `feasted` (`MealEaten` with `feast`: a serving of a feast, 10 § Feasts), `held_a_feast` (`ItemCrafted` of `cook_feast`: everyone, 12 § Feasts), `drank_from_a_mug` (`MealEaten` with `mug`: a seat whose table holds its mug, 14 § Mugs at the table), `thane_pleased` (`WhimJudged` met: everyone) and `thane_grumbled` (`WhimJudged` missed: its `thaneId` alone, 10 § The Thane's whim), `smelled_smokehouse` (`ItemCrafted` of `smoke_meat` or `smoke_fish`: every fortress dwarf within `SMOKE_RADIUS` of the smokehouse's centre but its worker; the thought keeps the meat's species as its `detail`, which its text names: "Smells of smoked boar. Hungry now."). `saw_the_star` (`CraterEntered`: the dwarf who steps into a `starfall` crater; its cap and 168 hours keep it from repeating while it lasts, and the first entry of a fortress is a note, 10 § Movement), `forged_the_star` (`ItemCrafted` of a piece whose material is `star_steel`, to the crafter; the bars smelted from the meteorite and bars melted back are not pieces, so the smelter has none; there are three bars, so at most a handful of pieces). **The Thane's whim is all face:** `thane_pleased` and `thane_grumbled` are ordinary thoughts on `WhimJudged`, and nothing else in this system reads a whim: no other thought, no sulk, no mood cascade (flavour report item 26). **Wyrmtongue keeps out the cold:** a dwarf who holds `ate_wyrmtongue` (24 hours) is not given `bitter_cold`, and one it already holds is removed when `ate_wyrmtongue` is added.
- **Loss and fear:** `dwarf_died`, `friend_died`, `pet_died`, `child_died`, `saw_death`, `masterwork_lost`, `was_wounded`, `saw_hostile`, `raid_arrived`, `thief_escaped_with_my_things` (owner of a stolen item), `lost_limb`.
- **Pride and relief:** `raid_repelled`, `killed_hostile` (soldiers), `caravan_arrived`, `immigrants_arrived`, `buried_friend`, `memorial_placed`, `got_it_out` (after a sulk), `healed`, `came_of_age` (family), `new_hearth_hall_tier` (everyone, when the hearth hall reaches a new tier), `deep_stirred_dread` (negative, everyone, when the Deep stirs; short), `eased` (a calming draught, 25 § Draughts; half its value for one within `CALM_REST_DAYS` of the last), `dosed_again` (that early second draught).

Personality scaling (three traits per dwarf from the table): `stoic` halves negatives; `sensitive` multiplies both by 1.3; `gregarious` doubles social thoughts and lonely; `solitary` halves social thoughts and lonely; `brave` halves fear thoughts; `timid` doubles them; `patient` halves restless; `restless` doubles it and `bored`; `tidy` doubles `in_miasma`; `messy` halves it; `greedy` doubles `thief_escaped_with_my_things` and `saw_masterwork`; `ascetic` halves room thoughts both ways. `personalityBase` is +3 for `stoic` and `brave`, −3 for `sensitive` and `timid`, 0 otherwise, summed.

### Hall spirit

`hallSpirit = mean(mood of adult dwarves)` recomputed hourly. `HallSpiritChanged { value, tier }` when the tier (same bands as mood) changes. 21 reads the value; the status bar colors the hearth glyph by tier.

### Sulks

Each `DayPassed`, for each dwarf: if Miserable, `sulkCounterDays += 1`; otherwise it decays by 1 (not to below 0). At `SULK_DAYS` the dwarf sulks once, the counter resets to 0, and the dwarf gets `got_it_out`.

The sulk kind depends on personality, first match wins:

| Trait | Sulk | Effect |
|---|---|---|
| `restless` | takes the day off | behavior `idle` for one day; refuses jobs; announcement note |
| `gregarious` | argument | picks the nearest dwarf; both get `argued` (−5, 2 days); a grudge is added (10); announcement note |
| `sensitive` | weeps at the hearth | goes to the hearth hall; gets `wept` (+5 after: relief); announcement note |
| `greedy` | hoards | takes one craft item to their bedroom (13 `owned`); no announcement |
| otherwise | breaks a chair | destroys the nearest chair, table or cabinet of common quality or below (never masterworks, never beds); announcement alert. This system only chooses the furniture: `SulkHappened` carries its building id, and 14 removes it in its own tick |

Sulks never involve violence, never target other dwarves' bodies, never destroy stockpiled goods, and never happen more than once per `SULK_DAYS` per dwarf.

### Grief and burial

`dwarf_died` for everyone (small), `friend_died` for friends, `pet_died` for the owner, `child_died` for everyone (stronger). `unburied_dead` is standing for everyone while any dwarf corpse is unburied for more than 3 days. `buried_friend` and `memorial_placed` are positive and, on `Buried`, remove `unburied_dead` if it was the last corpse. The death thoughts are triggered by 17's `CreatureDied` when the dead creature's species is a dwarf, and read the event's `faction` and `ageTicks` for their conditions. `saw_death` takes a fortress creature of any species but a summoned one (25 § Summons): a summon's fading or fall is no death to see. `memorial_placed` is given only for a `Buried` with `coffinId: 0` (a memorial slab); a burial in a coffin outside a tomb does not give it.

A corpse consumed by a predator is lost for burial. It no longer counts as present unburied remains, but its loss emits no `Buried` event or burial relief; existing death thoughts keep their normal duration.

### Interaction with 10 needs

Need pressure is part of the mood formula, so a hungry fortress is an unhappy fortress before it is a starving one. The standing need thoughts are both the legible form of the pressure ("Hungry (−6)" in the dwarf's thought list) and its measure: all seven count among `negatives`, and `hungry`, `thirsty`, `tired` and `lonely` also make up `needPressure`. `uncomfortable`, `restless` and `bored` are ordinary standing negatives: a fortress without chairs or a meeting area is gloomier, not miserable. A dwarf on duty with a squad (16 § Squads: its squad in `train` or `active`, or any squad under a `watchful` or `hearth` alert) is not `restless`, whatever its purpose: drill and guard are something to do.

Masterwork sight thoughts consume 10's `SawMasterwork` event on room entry. Its visible objects are floor items and installed furniture, excluding container contents and the viewer's own work; 10 saves the per-dwarf seen-item memory.

## State

- `Mood` components: `value, tier, thoughts: { thoughtId, startTick, baseValue }[], sulkCounterDays`.
- `hallSpirit`, `hallSpiritTier`.
- Saved `hourlyDue`: a pending mood/hall-spirit recomputation, including the initial recomputation before the first system tick. Loading restores that pending work; saving neither executes it nor advances the clock. Once the initial recomputation has run, loading does not schedule it again.
- Rng stream (sulk target choice).
- `labStinks`: the laboratories that spoiled a batch today, each its footprint's bounds and the tick the day ends; an `ItemCrafted` of the spoiled draught (its draught row's trigger is `never`) adds its workshop. Expired marks are dropped at the next move. Saved, omitted when empty.

## Interfaces

### Reader

- `morale.mood(id)`, `morale.tier(id)`, `morale.productivity(id)` (percent)
- `morale.thoughts(id)` (id, text, current value, remaining hours)
- `morale.hallSpirit()`, `morale.hallSpiritTier()`
- `morale.def(thoughtId)`
- `morale.dayOff(id)` — the dwarf is taking the day off after a `restless` sulk

### Commands

None.

### Events consumed

`HourPassed` (recompute), `DayPassed` (sulks, standing conditions), every event referenced by a thought row (declared from the table at init), `RoomQualityChanged`, `HearthLit`, `Buried`, `CorpseCreated`, `ItemCrafted` (a spoiled batch marks its laboratory for `lab_stink`), `EntitiesMoved` (`saw_sunlight`, `admired_statue`, `lab_stink`).

### Events emitted

`MoodTierChanged { id, from, to }`, `ThoughtGained { id, thoughtId, value }` (only for thoughts with `announce: true`, such as `made_masterwork`), `SulkHappened { id, kind }`, `HallSpiritChanged { value, tier }`.

### Registrations

Panel `mood`; inspector section `creature › mood` (mood, tier, thoughts sorted by absolute value with remaining time, personality with its effects in words); status bar hearth glyph; announcements: `SulkHappened` (note or alert per kind), `MoodTierChanged` to Miserable (note). The miserable line gives the dwarf's reasons, its `LOG_MISERABLE_REASONS` (24) strongest negative thoughts at that moment, in their own words: 'Ketil Ironvein is miserable: "I am hungry. Slept on the floor. My friend is dead."'. The tier is the mood's band at each hourly recomputation, so a mood that hovers about 20 as hunger, thirst and rest rise and fall can fall to Miserable several times a day; the announcer, not the simulation, keeps that from filling the log. A day's miserable lines are one line, as the starving line is (24 § Announcements and the log): it names each dwarf once as it first falls that day, by first name, with the reasons that weigh most over the dwarves named (each reason's values summed over them, the first given first on a tie): '3 dwarves are miserable: Ketil, Asa, Njal. "I am hungry. I am thirsty. Slept on the floor."'. A dwarf already named on the day's line makes no line when it falls again that day; the line keeps its place, takes the time of the latest dwarf named and focuses the first; the next day starts a new line. So a dwarf is told at most once a day, and a fortress's misery is one line a day however many dwarves share it.

The unburied dead: on each `DayPassed`, while some dwarf's body (a corpse or a skeleton with a dwarf's name, not memorialized) has lain unburied past `UNBURIED_DAYS`, the condition of the `unburied_dead` thought, an alert counts every unburied dwarf body, of any age, against 14's free coffins (`buildings.freeCoffins()`) and says how many are missing; its focus and subject are the oldest body. With no free coffin: "5 dead wait for burial and no coffin is free: build coffins [b > Furniture], best in a tomb [z]." (`announce.unburied`); with fewer free coffins than bodies: "5 dead wait for burial and only 2 coffins are free: build 3 more [b > Furniture]." (`announce.unburied.few`); with enough, when something else holds the burials back (no path, no hauler, a forbidden body): "5 dead wait for burial: 5 coffins are free." (`announce.unburied.free`). A coffin outside a tomb also takes a burial (14, the `coffin` row), so the line asks for coffins first. It is a standing alert (24 § Announcements and the log): one line while it lasts.

`ThoughtGained` (note) is the dwarf's thought in its own words: 'Ketil Ironvein: "I made a masterwork."'. A thought that one event gives to many dwarves at once (`raid_repelled` and `hearth_lit` to everyone, `argued` to both of an argument's pair) is one line: the `ThoughtGained` events of one thought in one tick make one line, which names two dwarves ('Ketil Ironvein and Orm Ashbrow: "Had an argument."') and counts more ('13 dwarves: "We drove them off."') (24 § Announcements and the log).

## Player-facing behavior

- Mood panel: a summary of the thoughts held by most dwarves, with their weights and how many hold each, which lists a thought's holders on demand; then every dwarf with its tier and its three strongest current thoughts; sortable; click to inspect.
- Status bar: the hearth glyph colored by hall spirit tier; hovering shows "Hall spirit: Content (71)".
- The thought list in a dwarf's inspection is the whole explanation of the number.

## Tuning constants

| Name | Value | Meaning |
|---|---|---|
| `POSITIVE_CAP` | 40 | |
| `NEGATIVE_CAP` | 35 | |
| `NEED_PRESSURE_CAP` | 20 | |
| `MOOD_NEEDS_MET_FLOOR` | 20 | Mood floor while no need is neglected |
| `NEED_WEIGHT` | 40 | Per point of need over its want threshold, /100 |
| `HEARTH_TIER_BONUS` | 2 | Per hearth hall tier index (bare 0 … royal 5) |
| `SULK_DAYS` | 7 | Consecutive days Miserable before a sulk (*unmeasured*) |
| `UNBURIED_DAYS` | 3 | *unmeasured* |
| `LAB_STINK_TILES` | 3 | A dwarf this close to a laboratory that spoiled a batch today (the larger axis distance to its footprint, on its level) gets `lab_stink` (*unmeasured*) |

Thought values, durations and decay shapes are content; `MOOD_BASELINE` is global.

## Extension points

- Values and preferences (a dwarf who loves oak): a per-dwarf preference list and a multiplier in the predicate.
- Festivals: a scheduled event that emits a fortress-wide positive thought.
- Stress that accumulates across seasons: a second slow variable feeding `personalityBase`; keep the caps.
