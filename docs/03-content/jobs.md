# Jobs

**Owner:** content (`jobTypes`) · **Depends on:** [`../02-systems/11-jobs-and-labor.md`](../02-systems/11-jobs-and-labor.md), [skills-and-professions.md](skills-and-professions.md)

Every job type the game creates. Columns: `labor` required; `skill` used (— none; then no skill scaling and no xp); `target` kind; `workTile` where the worker stands (`adjacent` = an 8-neighbor on the same level, `at` = the target tile, `workshop` = the workshop's work tile, `entity` = adjacent to the entity); `baseTicks` before skill and productivity scaling (`—` when the producer computes it, e.g. from hardness or recipe); `tool`; `xp` on completion; `producer`; `interruptible` whether a critical need may interrupt it (`no` jobs are short enough to finish).

## Terrain (producer `terrain`)

| id | name | labor | skill | target | workTile | baseTicks | tool | xp | interruptible |
|---|---|---|---|---|---|---|---|---|---|
| `dig` | Dig | mining | mining | tile | adjacent | `DIG_BASE_TICKS × hardness/100` | pick | 8 | yes |
| `channel` | Channel | mining | mining | tile | at, then adjacent | `CHANNEL_BASE_TICKS × hardness/100` | pick | 10 | yes |
| `carve_stairs` | Carve stairs | mining | mining | tile | adjacent (up) / at (down) | `DIG_BASE_TICKS × 1.2 × hardness/100` | pick | 10 | yes |
| `carve_ramp` | Carve ramp | mining | mining | tile | adjacent | `DIG_BASE_TICKS × hardness/100` | pick | 8 | yes |
| `smooth` | Smooth | masonry | masonry | tile | adjacent / at (floor) | `SMOOTH_BASE_TICKS` | — | 6 | yes |
| `engrave` | Engrave | crafts | engraving | tile | adjacent / at (floor) | `ENGRAVE_BASE_TICKS` | — | 15 | yes |
| `remove_construction` | Remove construction | mining | mining | tile | adjacent | `DIG_BASE_TICKS / 2` | pick | 4 | yes |
| `chop` | Chop tree | woodcutting | woodcutting | tile | adjacent | `CHOP_BASE_TICKS` | axe | 10 | yes |
| `gather` | Gather plant | herbalism | herbalism | tile | adjacent | `GATHER_BASE_TICKS` | — | 5 | no |

For up or up/down stairs, the terrain producer's `extraStandTiles` also permits the tile directly above when it is a down or up/down stair. Floor smoothing and engraving, channel and down stairs work at the target; the other terrain rows work adjacent.

## Plants (producer `plants`)

| id | name | labor | skill | target | workTile | baseTicks | tool | xp | interruptible |
|---|---|---|---|---|---|---|---|---|---|
| `plant` | Plant seed | farming | farming | tile | at | `PLANT_TICKS` | — | 5 | no |
| `harvest` | Harvest | farming | farming | entity (crop) | at | `HARVEST_TICKS` | — | 8 | no |

## Animals (producer `animals`)

| id | name | labor | skill | target | workTile | baseTicks | tool | xp | interruptible |
|---|---|---|---|---|---|---|---|---|---|
| `milk_animal` | Milk | animal_care | animal_care | entity | workshop (farmer's) | 120 | — | 6 | no |
| `shear_animal` | Shear | animal_care | animal_care | entity | workshop (farmer's) | 150 | — | 6 | no |
| `collect_egg` | Collect eggs | hauling | — | building (nest box) | adjacent | 20 | — | 0 | no |
| `slaughter` | Slaughter | butchery | butchery | entity | workshop (butcher) | 60 | — | 4 | yes |
| `train_animal` | Train animal | animal_training | animal_training | entity | workshop (kennel) | `TRAIN_TICKS` | — | 20 | yes |
| `tame_animal` | Tame animal | animal_training | animal_training | entity (caged) | workshop (kennel) | `TRAIN_TICKS` | — | 25 | yes |

## Foraging (producer `foraging`)

| id | name | labor | skill | target | workTile | baseTicks | tool | xp | interruptible |
|---|---|---|---|---|---|---|---|---|---|
| `hunt` | Hunt | hunting | hunting | entity (animal) | ranged (see 09) | — | ranged weapon + ammo | 5 per shot, 20 per kill | yes |
| `fish` | Fish | fishing | fishing | zone tile | at | `FISH_TICKS` | — | 6 (+10 on catch) | yes |
| `butcher` | Butcher | butchery | butchery | entity (corpse) | workshop (butcher) | `BUTCHER_TICKS` | — | 8 | yes |

## Workshops (producer `workshops`)

| id | name | labor | skill | target | workTile | baseTicks | tool | xp | interruptible |
|---|---|---|---|---|---|---|---|---|---|
| `craft` | Craft (recipe) | recipe's labor | recipe's skill | building (workshop) | workshop | recipe | — | recipe | yes |

## Items (producer `items`)

| id | name | labor | skill | target | workTile | baseTicks | tool | xp | interruptible |
|---|---|---|---|---|---|---|---|---|---|
| `haul_to_stockpile` | Haul | hauling | — | entity (item) | destination slot | 5 (drop) | — | 0 | yes (drops the item) |
| `haul_to_dump` | Dump | hauling | — | entity (item) | dump zone tile | 5 | — | 0 | yes |
| `strip_corpse` | Strip corpse | hauling | — | entity (corpse) | adjacent | 40 | — | 0 | no |

## Buildings (producer `buildings`)

| id | name | labor | skill | target | workTile | baseTicks | tool | xp | interruptible |
|---|---|---|---|---|---|---|---|---|---|
| `build` | Build | by category (construction, carpentry, masonry, mechanics) | building | building | adjacent / at | type's `buildTicks` | — | 8 | yes |
| `deconstruct` | Deconstruct | as build | building | building | adjacent | `buildTicks / 2` | — | 4 | yes |
| `pull_lever` | Pull lever | hauling | — | building (lever) | adjacent | 10 | — | 0 | no |
| `link_mechanism` | Link mechanism | mechanics | mechanics | building pair | adjacent (target, then source) | 150 each | — | 12 | yes |
| `bury` | Bury | hauling | — | entity (corpse) | coffin tile | 60 | — | 0 | yes |

## Health (producer `health`)

| id | name | labor | skill | target | workTile | baseTicks | tool | xp | interruptible |
|---|---|---|---|---|---|---|---|---|---|
| `carry_patient` | Carry patient | hauling | — | entity (dwarf) | bed tile | 10 | — | 0 | yes |
| `feed_patient` | Feed patient | hauling | — | entity | entity | 40 | — | 0 | no |
| `water_patient` | Water patient | hauling | — | entity | entity | 30 | — | 0 | no |
| `stop_bleeding` | Bandage | medicine | medicine | entity | entity | `TREAT_TICKS` | — | 10 | no |
| `set_bone` | Set bone | medicine | medicine | entity | entity | `TREAT_TICKS × 1.5` | — | 12 | no |
| `suture` | Suture | medicine | medicine | entity | entity | `TREAT_TICKS` | — | 10 | no |
| `clean_wound` | Clean wound | medicine | medicine | entity | entity | `TREAT_TICKS` | bucket (filled) | 10 | no |
| `dress_burn` | Dress burn | medicine | medicine | entity | entity | `TREAT_TICKS` | — | 10 | no |
| `diagnose` | Diagnose | medicine | medicine | entity | entity | `TREAT_TICKS / 2` | — | 20 | no |
| `give_crutch` | Give crutch | medicine | medicine | entity | entity | 30 | — | 4 | no |
| `bandage_animal` | Bandage animal | animal_care | animal_care | entity | entity | 100 | — | 6 | no |


## Defense (producer `defense`)

| id | name | labor | skill | target | workTile | baseTicks | tool | xp | interruptible |
|---|---|---|---|---|---|---|---|---|---|
| `rearm_trap` | Rearm trap | mechanics | mechanics | building (trap) | adjacent | 80 | — | 6 | no |
| `clean_trap` | Clean trap | cleaning | — | building (trap) | adjacent | 100 | — | 0 | no |

## Trade (producer `trade`)

| id | name | labor | skill | target | workTile | baseTicks | tool | xp | interruptible |
|---|---|---|---|---|---|---|---|---|---|
| `haul_to_depot` | Haul to depot | hauling | — | entity (item) | depot tile | 5 | — | 0 | yes |
| `trade` | Trade | trading | trading | building (depot) | inside depot | session | — | per session | yes (closes the session) |

## Notes

- Jobs with `baseTicks` given as a constant name use that system's tuning constant.
- Every job's work rate is `1000 / baseTicks` per tick × skill factor `(100 + SKILL_TIME_BONUS_PERCENT × level) / 100` × productivity (mood and wounds), as defined in 11.
- Tool jobs require the tool in the weapon slot; the fetch step happens before the job's travel step.
- Interruptible `no` means the job is short enough that a critical need waits for it; the need is served immediately after.
