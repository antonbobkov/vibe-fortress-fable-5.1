# Personality and Thoughts

**Owner:** content (`personality`, `thoughts`) · **Depends on:** [`../02-systems/15-happiness-and-morale.md`](../02-systems/15-happiness-and-morale.md), [`../02-systems/10-dwarves.md`](../02-systems/10-dwarves.md)

## Personality traits

Each dwarf has three traits, one from each of three randomly chosen pairs (never both of a pair). `freq` is the relative weight within its pair; `base` is added to the mood baseline; `groups` lists the thought groups the trait scales and by how much.

| id | name | pair | freq | base | groups scaled | description shown |
|---|---|---|---|---|---|---|
| `stoic` | Stoic | temperament | 50 | +3 | negatives ×0.5 | "Takes hardship in stride." |
| `sensitive` | Sensitive | temperament | 50 | −3 | positives ×1.3, negatives ×1.3 | "Feels everything keenly." |
| `gregarious` | Gregarious | sociability | 50 | 0 | social ×2, `lonely` ×2 | "Loves company." |
| `solitary` | Solitary | sociability | 50 | 0 | social ×0.5, `lonely` ×0.5 | "Prefers their own company." |
| `brave` | Brave | courage | 50 | +3 | fear ×0.5 | "Does not scare easily." |
| `timid` | Timid | courage | 50 | −3 | fear ×2 | "Startles at shadows." |
| `patient` | Patient | pace | 50 | 0 | `restless`, `bored` ×0.5 | "Content to wait." |
| `restless` | Restless | pace | 50 | 0 | `restless`, `bored` ×2 | "Needs to be doing something." |
| `tidy` | Tidy | order | 50 | 0 | `in_miasma` ×2, `admired_statue` ×1.5 | "Cannot stand a mess." |
| `messy` | Messy | order | 50 | 0 | `in_miasma` ×0.5 | "Does not notice a mess." |
| `greedy` | Greedy | wealth | 50 | 0 | `thief_escaped_with_my_things` ×2, `saw_masterwork` ×2, `hoards` sulk | "Likes owning fine things." |
| `ascetic` | Ascetic | wealth | 50 | 0 | room thoughts ×0.5 both ways | "Needs little." |

Sulk kinds by trait are in 15.

## Thoughts

Columns: `value` signed; `hours` duration; `decay` `linear` or `halflife` or `standing` (persists while the condition holds; value may scale with the condition); `cap` instances; `group` for personality scaling (`social`, `fear`, `room`, `need`, `loss`, `pride`, `craft`, `weather`, `comfort`, `none`); `trigger` the event with a predicate; `announce` whether the log mentions it. `text` is the diary line.

### Standing needs (group `need`)

| id | text | value | trigger |
|---|---|---|---|
| `hungry` | "I am hungry." | −(hunger − 50) / 5, min −10 | hunger ≥ 50 |
| `thirsty` | "I am thirsty." | −(thirst − 50) / 5, min −10 | thirst ≥ 50 |
| `tired` | "I am tired." | −(rest − 60) / 5, min −8 | rest ≥ 60 |
| `lonely` | "I have not talked to anyone in a while." | −(social − 50) / 10, min −5 | social ≥ 50 |
| `uncomfortable` | "There is nowhere to sit." | −(comfort − 55) / 10, min −4 | comfort ≥ 55 |
| `restless` | "I have nothing to do." | −(purpose − 60) / 10, min −4 | purpose ≥ 60 |
| `bored` | "Nothing lifts my spirits." | −(joy − 60) / 10, min −4 | joy ≥ 60 |

### Standing conditions

| id | text | value | group | trigger |
|---|---|---|---|---|
| `no_bedroom` | "I have no room of my own." | −2 | room | no assigned bedroom (checked daily; after the first 14 days) |
| `unburied_dead` | "The dead lie unburied." | −4 | loss | any dwarf corpse unburied > `UNBURIED_DAYS` |
| `unclothed` | "I have no proper clothes." | −3 | comfort | missing any clothing slot |
| `in_miasma` | "The stench is unbearable." | −5 | comfort | standing in miasma |
| `in_pain` | "It hurts." | −(pain / 10), min −8 | none | pain ≥ 20 |
| `bedridden` | "I cannot leave my bed." | −6 | none | bedridden |
| `slept_on_floor_last_night` | "Slept on the floor last night." | −3 | room | last sleep was on the floor; cleared by the next sleep in a bed |

### Food and drink

| id | text | value | hours | decay | cap | group | trigger |
|---|---|---|---|---|---|---|---|
| `ate_easy_meal` | "Had a decent meal." | +2 | 24 | linear | 1 | comfort | `MealEaten` easy |
| `ate_fine_meal` | "Had a fine meal." | +5 | 36 | linear | 1 | comfort | `MealEaten` fine |
| `ate_lavish_meal` | "Had a lavish meal." | +10 | 48 | linear | 1 | comfort | `MealEaten` lavish |
| `ate_raw_food` | "Ate something raw." | −1 | 12 | linear | 1 | comfort | `MealEaten` raw |
| `ate_stale_food` | "The food was stale." | −2 | 12 | halflife | 1 | comfort | `MealEaten` stale stage |
| `ate_in_bare_hall` | "Ate in a bare hall." | 0 | — | — | — | room | (no thought) |
| `ate_in_decent_hall` | "Ate in a decent hall." | +2 | 24 | linear | 1 | room | `MealEaten` at table, tier decent |
| `ate_in_fine_hall` | "Ate in a fine hall." | +4 | 24 | linear | 1 | room | tier fine |
| `ate_in_grand_hall` | "Ate in a grand hall." | +7 | 36 | linear | 1 | room | tier grand |
| `ate_in_royal_hall` | "Ate in a royal hall." | +10 | 48 | linear | 1 | room | tier royal |
| `drank_ale` | "Had a drink." | +3 | 24 | linear | 1 | comfort | `DrankAlcohol` ale, beer |
| `drank_fine_drink` | "Had a fine drink." | +5 | 36 | linear | 1 | comfort | `DrankAlcohol` wine, bellwine |
| `drank_water` | "Drank water. Water." | −2 | 12 | halflife | 1 | comfort | `DrankWater` from a well or indoor source |
| `drank_from_puddle` | "Drank from a puddle." | −4 | 12 | halflife | 1 | comfort | `DrankWater` outdoors |

### Sleep

| id | text | value | hours | decay | cap | group | trigger |
|---|---|---|---|---|---|---|---|
| `slept_in_bare_room` | "Slept in a bare room." | 0 | — | — | — | room | (no thought) |
| `slept_in_modest_room` | "Slept in my modest room." | +1 | 24 | linear | 1 | room | `Slept` own bedroom, modest |
| `slept_in_decent_room` | "Slept in my decent room." | +3 | 24 | linear | 1 | room | decent |
| `slept_in_fine_room` | "Slept in my fine room." | +5 | 36 | linear | 1 | room | fine |
| `slept_in_grand_room` | "Slept in my grand room." | +8 | 48 | linear | 1 | room | grand |
| `slept_in_royal_room` | "Slept in my royal room." | +10 | 48 | linear | 1 | room | royal |
| `slept_in_shared_bed_room` | "Slept in someone else's bed." | −1 | 12 | linear | 1 | room | `Slept` unassigned bed |
| `slept_on_floor` | "Slept on the floor." | −4 | 24 | linear | 1 | room | `Slept` onFloor |
| `slept_outdoors` | "Slept under the sky." | −5 | 24 | linear | 1 | weather | `Slept` outdoor tile |
| `well_rested` | "Feel well rested." | +2 | 12 | linear | 1 | comfort | `Slept` with rest reaching 0 |

### Social and comfort

| id | text | value | hours | decay | cap | group | trigger |
|---|---|---|---|---|---|---|---|
| `talked_with_friend` | "Talked with a friend." | +5 | 24 | linear | 2 | social | `Talked` with a friend |
| `talked_with_someone` | "Had a chat." | +3 | 24 | linear | 2 | social | `Talked` |
| `sat_in_fine_room` | "Sat in a fine room." | +3 | 12 | linear | 1 | room | `Sat` tier ≥ fine |
| `hearth_visit` | "Warmed myself at the hearth." | +3 | 12 | linear | 1 | comfort | `HearthVisited` |
| `hearth_lit` | "The hearth is lit. This is home now." | +12 | 168 | linear | 1 | none | `HearthLit` (everyone) |
| `new_hearth_hall_tier` | "The hall has never looked better." | +6 | 72 | linear | 1 | room | `RoomQualityChanged` hearth hall, tier up |
| `thane_hall_grand` | "The Thane's hall is a credit to us." | +2 | standing | standing | 1 | room | Thane bedroom tier ≥ grand |
| `thane_hall_bare` | "The Thane sleeps in a hovel." | −1 | standing | standing | 1 | room | Thane bedroom tier ≤ modest |
| `admired_statue` | "Admired a fine statue." | +3 | 24 | linear | 2 | comfort | passing a statue of fine quality or better, once per statue per season |
| `saw_masterwork` | "Saw a masterwork." | +4 | 48 | linear | 3 | craft | `SawMasterwork` |
| `felt_mist` | "Felt the mist of a waterfall." | +5 | 24 | linear | 1 | comfort | `DwarfFeltMist` |
| `warm_spring` | "Warmed my feet in a spring." | +3 | 24 | linear | 1 | comfort | `DwarfNearSpring` |
| `warded` | "Felt the ward settle on me." | +1 | 12 | linear | 1 | comfort | `Warded` |

### Work and skill

| id | text | value | hours | decay | cap | group | trigger |
|---|---|---|---|---|---|---|---|
| `made_masterwork` | "I made a masterwork." | +15 | 168 | linear | 1 | craft | `MasterworkCreated` crafter |
| `made_fine_item` | "Made something fine." | +3 | 24 | linear | 1 | craft | `ItemCrafted` quality ≥ superior |
| `skill_milestone` | "Getting better at my craft." | +4 | 48 | linear | 1 | pride | `SkillLevelUp` levels 5, 10, 15 |
| `legendary` | "I have mastered my craft." | +12 | 336 | linear | 1 | pride | `LegendaryReached` |
| `finished_big_job` | "We finished a great digging." | +3 | 48 | linear | 1 | pride | a dig designation batch of 50+ tiles completes (all miners) |
| `harvest_in` | "The harvest is in." | +3 | 48 | linear | 1 | pride | `CropHarvested` (the farmer, once per day) |
| `first_vein` | "I struck ore." | +5 | 72 | linear | 1 | pride | `VeinFound` finder |
| `attuned` | "Felt the rune answer." | +2 | 12 | linear | 1 | pride | `AttuneSession` with no mishap |
| `singed` | "Singed my beard in the sanctum." | −3 | 24 | halflife | 1 | none | `Mishap` `singed` |

### Weather

| id | text | value | hours | decay | cap | group | trigger |
|---|---|---|---|---|---|---|---|
| `caught_in_rain` | "Got soaked." | −2 | 12 | halflife | 1 | weather | `DwarfOutdoorsIn` rain |
| `caught_in_storm` | "Caught in a storm." | −4 | 12 | halflife | 1 | weather | storm |
| `snowed_on` | "Snow down my collar." | −2 | 12 | halflife | 1 | weather | snow |
| `bitter_cold` | "It is bitterly cold." | −4 | 12 | halflife | 1 | weather | cold_snap |
| `sweltering` | "It is sweltering." | −3 | 12 | halflife | 1 | weather | heatwave |
| `saw_sunlight` | "Saw the sky again." | +3 | 24 | linear | 1 | comfort | first outdoor tile after 7+ days underground |

### Loss and fear

The dwarf, friend and child loss rows match `CreatureDied` of a dwarf only. Friendship comes from 10; the child row uses the recorded age when the dead entity is gone.

| id | text | value | hours | decay | cap | group | trigger |
|---|---|---|---|---|---|---|---|
| `dwarf_died` | "One of us died." | −5 | 168 | halflife | 3 | loss | `CreatureDied` (everyone) |
| `friend_died` | "My friend is dead." | −15 | 336 | halflife | 2 | loss | `CreatureDied` friend (10 source) |
| `pet_died` | "My pet died." | −10 | 168 | halflife | 1 | loss | `CreatureDied` pet owner |
| `child_died` | "A child died." | −10 | 336 | halflife | 1 | loss | `CreatureDied` child (everyone) |
| `saw_death` | "Watched someone die." | −4 | 72 | halflife | 2 | fear | `CreatureDied` within 8 tiles and line of sight, fortress creature |
| `masterwork_lost` | "My masterwork is gone." | −8 | 168 | halflife | 1 | craft | `ItemDestroyed` masterwork, crafter |
| `was_wounded` | "I was hurt." | −4 | 72 | halflife | 1 | fear | `WoundInflicted` serious or worse |
| `saw_hostile` | "Saw an enemy." | −3 | 24 | halflife | 1 | fear | `ThreatNearby` |
| `raid_arrived` | "Raiders are at the gate." | −4 | 48 | halflife | 1 | fear | `RaidArrived` (everyone) |
| `thief_escaped_with_my_things` | "A thief took my things." | −5 | 72 | halflife | 1 | none | `ThiefEscaped` item owner |
| `lost_limb` | "I lost a limb." | −12 | 336 | halflife | 1 | none | `LimbLost` |
| `deep_stirred_dread` | "Something below has noticed us." | −4 | 48 | halflife | 1 | fear | `DeepStirred` (everyone) |
| `argued` | "Had an argument." | −5 | 48 | halflife | 1 | social | sulk argument, both |
| `dosed_again` | "Another draught. I am tired of draughts." | −4 | 72 | halflife | 1 | none | `DraughtDrunk` calming, within `CALM_REST_DAYS` of the last |

### Pride and relief

| id | text | value | hours | decay | cap | group | trigger |
|---|---|---|---|---|---|---|---|
| `raid_repelled` | "We drove them off." | +8 | 96 | linear | 1 | pride | `RaidEnded` repelled or wiped (everyone) |
| `killed_hostile` | "I struck down an enemy." | +4 | 72 | linear | 3 | pride | `KillRecorded` killer, hostile victim |
| `caravan_arrived` | "Traders have come." | +2 | 48 | linear | 1 | none | `CaravanArrived` (everyone) |
| `immigrants_arrived` | "New faces in the hall." | +3 | 48 | linear | 1 | social | `ImmigrantsArrived` (everyone) |
| `buried_friend` | "Laid a friend to rest." | +8 | 96 | linear | 1 | loss | `Buried` friend of the dead |
| `memorial_placed` | "A memorial was placed." | +4 | 96 | linear | 1 | loss | `Buried` with `tombTier: none`, friends |
| `got_it_out` | "Feel better after that." | +10 | 72 | linear | 1 | none | `SulkHappened` the dwarf |
| `wept` | "Had a good cry." | +5 | 48 | linear | 1 | none | sulk weep |
| `healed` | "Back on my feet." | +5 (+2 per hospital tier above bare) | 96 | linear | 1 | none | `PatientHealed` |
| `came_of_age` | "The child has grown." | +3 | 72 | linear | 1 | social | `DwarfBecameAdult` family |
| `hoarded` | "Got something nice for my room." | +3 | 48 | linear | 1 | none | sulk hoard |
| `first_runecaster` | "We have a runecaster in the hall." | +4 | 72 | linear | 1 | pride | `FirstRunecaster` (everyone) |
| `mended_by_rune` | "The rune closed my wound." | +3 | 48 | linear | 1 | none | `Mended` |
| `eased` | "The draught quieted me." | +8 | 72 | linear | 1 | none | `DraughtDrunk` calming, not within `CALM_REST_DAYS` of the last |

## Announcement flags

`announce: true` for `made_masterwork`, `legendary`, `hearth_lit`, `raid_repelled`, `argued`, and every sulk. Everything else is visible only in the dwarf's thought list and the mood panel.

## Consistency check with the mood formula

A dwarf with every need met, no bedroom (−2), unclothed (−3) and three deaths (−15 halflife) sits at 55 − 20 = 35 (Unhappy) and climbs within a week. The same dwarf with a decent bedroom (+3 per night), meals in a decent hall (+2), ale (+3) and a chat (+3) rests around 55 + 11 = 66 (Content). Reaching Ecstatic (85) needs a fine or grand hall, fine meals and drinks, a friend, a mist garden and a masterwork or two: 55 + 40 (capped) − 0 + 8 (grand hearth hall) = 103 → clamped 100.
