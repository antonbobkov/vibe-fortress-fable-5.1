# Skills and Professions

**Owner:** content (`skills`, `labors`) · **Depends on:** [`../02-systems/10-dwarves.md`](../02-systems/10-dwarves.md), [`../02-systems/11-jobs-and-labor.md`](../02-systems/11-jobs-and-labor.md), [`../02-systems/12-workshops-and-professions.md`](../02-systems/12-workshops-and-professions.md)

## Skill levels

| Level | Tier name | Cumulative xp |
|---|---|---|
| 0 | — | 0 |
| 1 | Dabbling | 100 |
| 2 | Novice | 260 |
| 3 | Novice | 480 |
| 4 | Adequate | 760 |
| 5 | Adequate | 1,100 |
| 6 | Competent | 1,500 |
| 7 | Competent | 1,960 |
| 8 | Skilled | 2,480 |
| 9 | Skilled | 3,060 |
| 10 | Proficient | 3,700 |
| 11 | Proficient | 4,400 |
| 12 | Talented | 5,160 |
| 13 | Talented | 5,980 |
| 14 | Adept | 6,860 |
| 15 | Adept | 7,800 |
| 16 | Expert | 8,800 |
| 17 | Expert | 9,860 |
| 18 | Master | 10,980 |
| 19 | Master | 12,160 |
| 20 | Legendary | 13,400 |

`xpToNext(level) = 100 + level × 60`. A dig job gives 8 xp: a miner reaches level 5 after about 140 tiles and level 10 after about 460.

## Labors

| id | name | default on | children |
|---|---|---|---|
| `mining` | Mining | yes | no |
| `woodcutting` | Woodcutting | yes | no |
| `construction` | Construction | yes | no |
| `carpentry` | Carpentry | yes | no |
| `masonry` | Masonry | yes | no |
| `crafts` | Crafts | yes | no |
| `gem_cutting` | Gem cutting | yes | no |
| `mechanics` | Mechanics | yes | no |
| `farming` | Farming | yes | no |
| `herbalism` | Herbalism | yes | no |
| `animal_care` | Animal care | yes | no |
| `animal_training` | Animal training | yes | no |
| `hunting` | Hunting | yes | no |
| `fishing` | Fishing | yes | no |
| `butchery` | Butchery | yes | no |
| `leather` | Leather | yes | no |
| `textiles` | Textiles | yes | no |
| `cooking` | Cooking | yes | no |
| `brewing` | Brewing | yes | no |
| `smelting` | Smelting | yes | no |
| `smithing` | Smithing | yes | no |
| `medicine` | Medicine | yes | no |
| `trading` | Trading | yes | no |
| `hauling` | Hauling | yes | yes (fixed on) |
| `cleaning` | Cleaning | yes | no |

## Skills

Columns: `labor`; `profession` title when this is the highest skill; `military` title (weapon skills only, shown while in a squad); `attributes` raised on level-up; `used by` the jobs or systems.

| id | name | labor | profession | military | attributes | used by |
|---|---|---|---|---|---|---|
| `mining` | Mining | mining | Miner | — | Strength, Endurance | dig, channel, carve, remove construction |
| `woodcutting` | Woodcutting | woodcutting | Woodcutter | — | Strength, Agility | chop |
| `carpentry` | Carpentry | carpentry | Carpenter | — | Agility, Wits | carpenter and bowyer recipes |
| `masonry` | Masonry | masonry | Mason | — | Strength, Wits | mason recipes, smoothing |
| `crafting` | Crafting | crafts | Craftsdwarf | — | Agility, Wits | craftdwarf recipes |
| `engraving` | Engraving | crafts | Engraver | — | Agility, Wits | engrave, memorial slabs |
| `gem_cutting` | Gem cutting | gem_cutting | Gem cutter | — | Agility, Wits | jeweler recipes |
| `mechanics` | Mechanics | mechanics | Mechanic | — | Wits, Agility | mechanisms, links, traps, rearming |
| `building` | Building | construction | Builder | — | Strength, Endurance | build, deconstruct |
| `farming` | Farming | farming | Farmer | — | Endurance, Wits | plant, harvest, farmer's workshop plant processing |
| `herbalism` | Herbalism | herbalism | Herbalist | — | Wits, Agility | gather |
| `animal_care` | Animal care | animal_care | Animal keeper | — | Charm, Endurance | milk, shear, collect eggs, bandage animals |
| `animal_training` | Animal training | animal_training | Animal trainer | — | Charm, Willpower | train, tame |
| `hunting` | Hunting | hunting | Hunter | — | Agility, Endurance | hunt (approach and tracking; shooting uses the launcher skill) |
| `fishing` | Fishing | fishing | Fisher | — | Endurance, Agility | fish |
| `butchery` | Butchery | butchery | Butcher | — | Strength, Agility | butcher, slaughter |
| `tanning` | Tanning | leather | Tanner | — | Endurance | tannery |
| `leatherworking` | Leatherworking | leather | Leatherworker | — | Agility | leatherworks |
| `weaving` | Weaving | textiles | Weaver | — | Agility | loom |
| `clothesmaking` | Clothesmaking | textiles | Clothier | — | Agility | clothier |
| `cooking` | Cooking | cooking | Cook | — | Agility, Wits | kitchen |
| `brewing` | Brewing | brewing | Brewer | — | Wits | still |
| `smelting` | Smelting | smelting | Smelter | — | Endurance, Strength | smelter, wood furnace |
| `weaponsmithing` | Weaponsmithing | smithing | Weaponsmith | — | Strength, Agility | forge: weapons, ammunition, picks, axes |
| `armorsmithing` | Armorsmithing | smithing | Armorsmith | — | Strength, Endurance | forge: armor, shields |
| `metalcrafting` | Metalcrafting | smithing | Metalcrafter | — | Agility, Wits | forge: furniture, chains, cages, anvils, crafts, blocks |
| `medicine` | Medicine | medicine | Medic | — | Wits, Charm | all treatment jobs |
| `trading` | Trading | trading | Trader | — | Charm, Wits | trade session margin |
| `axe` | Axe | — | Axedwarf (civilian title: Woodcutter is separate) | Axedwarf | Strength, Agility | melee |
| `sword` | Sword | — | Swordsdwarf | Swordsdwarf | Agility | melee |
| `mace` | Mace | — | Macedwarf | Macedwarf | Strength | melee |
| `hammer` | Hammer | — | Hammerdwarf | Hammerdwarf | Strength | melee |
| `spear` | Spear | — | Speardwarf | Speardwarf | Agility | melee |
| `dagger` | Dagger | — | Knife fighter | Knife fighter | Agility | melee |
| `pick` | Pick fighting | — | (Miner) | Pickdwarf | Strength | melee with a pick |
| `unarmed` | Unarmed | — | Brawler | Brawler | Strength, Toughness | melee without a weapon |
| `crossbow` | Crossbow | — | Marksdwarf | Marksdwarf | Agility | ranged |
| `bow` | Bow | — | Bowdwarf | Bowdwarf | Agility | ranged |
| `sling` | Sling | — | Slinger | Slinger | Agility | ranged |
| `shield` | Shield | — | — | — | Agility, Toughness | block |
| `dodge` | Dodge | — | — | — | Agility | dodge |
| `armor_use` | Armor use | — | — | — | Endurance, Strength | armor speed penalty reduction |

Combat skills have no labor; they are used when a creature fights. Weapon skills raise the military title; `shield`, `dodge` and `armor_use` never give a title. A dwarf whose highest skill is a weapon skill but who is not in a squad shows the civilian title of their highest *civilian* skill, or `Settler`.

## Profession colors (units panel)

| Group | Skills | Color |
|---|---|---|
| Earth | mining, engraving, masonry, gem_cutting | `prof_gray` |
| Wood | woodcutting, carpentry | `prof_brown` |
| Craft | crafting, mechanics, building | `prof_tan` |
| Field | farming, herbalism, animal_care, animal_training, hunting, fishing, butchery | `prof_green` |
| Cloth | tanning, leatherworking, weaving, clothesmaking | `prof_violet` |
| Hearth | cooking, brewing | `prof_orange` |
| Metal | smelting, weaponsmithing, armorsmithing, metalcrafting | `prof_steel` |
| Care | medicine, trading | `prof_white` |
| Arms | all combat skills | `prof_red` |
| None | Settler, Child | `prof_dim` |

## Experience per job

Given in [jobs.md](jobs.md) per job type and in [workshops-and-recipes.md](workshops-and-recipes.md) per recipe (`xp` column). Combat: attacker weapon skill +3 per hit, +1 per miss; defender dodge +2 per dodged attack, shield +2 per block, armor_use +1 per hit reduced by armor; training sessions `TRAIN_XP` = 12 per skill. Medicine: `TREAT_XP` = 10 per treatment, `DIAGNOSE_XP` = 20. Trading: `TRADE_XP` = 15 × (1 + value/1000). Hunting: +5 per shot, +20 per kill. Fishing: +6 per attempt, +10 per catch. Farming: +5 per plant, +8 per harvest.
