# Weapons and Armor

**Owner:** content (`weapons`, `armor`) · **Depends on:** [`../02-systems/16-combat.md`](../02-systems/16-combat.md), [minerals-and-metals.md](minerals-and-metals.md), [items.md](items.md)

## Weapons

Columns: `skill` is the combat skill used; `type` the damage type; `damage` the base damage before metal, quality and strength; `size` scales the attack cooldown (`size × 3 + 10 − Agility/10`); `hands`; `bars` are metal bars to forge (or logs for wooden items); `mult` the item value multiplier; `range` for launchers with the `power` multiplier applied to ammunition damage.

### Melee

| id | name | class | skill | type | damage | size | hands | bars | mult | materials | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `dagger` | dagger | dagger | `dagger` | edge | 12 | 3 | 1 | 1 | 4 | metal | fast: cooldown 19 at Agility 50 |
| `short_sword` | short sword | sword | `sword` | edge | 18 | 5 | 1 | 2 | 8 | metal | |
| `battle_axe` | battle axe | axe | `axe` | edge | 22 | 6 | 1 | 2 | 8 | metal | the same item as the woodcutting `axe`; `axe` in items.md is this |
| `great_axe` | great axe | axe | `axe` | edge | 30 | 9 | 2 | 3 | 12 | metal | |
| `mace` | mace | mace | `mace` | blunt | 20 | 6 | 1 | 2 | 7 | metal (silver +30%) | |
| `warhammer` | warhammer | hammer | `hammer` | blunt | 24 | 7 | 1 | 2 | 8 | metal (silver +30%) | |
| `maul` | maul | hammer | `hammer` | blunt | 32 | 10 | 2 | 3 | 12 | metal | |
| `spear` | spear | spear | `spear` | pierce | 18 | 6 | 1 | 1 (+1 log) | 6 | metal head | |
| `pike` | pike | spear | `spear` | pierce | 24 | 9 | 2 | 2 (+1 log) | 9 | metal head | |
| `pick` | pick | pick | `pick` | pierce | 16 | 6 | 1 | 2 | 6 | metal | the mining tool |
| `club` | club | mace | `mace` | blunt | 12 | 5 | 1 | 1 log | 2 | wood | trollkin and hillfolk bandits carry these |
| `training_axe` | training axe | axe | `axe` | — | 0 | 6 | 1 | 1 log | 2 | wood | no damage; sparring |
| `training_sword` | training sword | sword | `sword` | — | 0 | 5 | 1 | 1 log | 2 | wood | |
| `training_spear` | training spear | spear | `spear` | — | 0 | 6 | 1 | 1 log | 2 | wood | |

### Launchers

| id | name | class | skill | range | power | ammo | size | hands | materials | mult | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `crossbow` | crossbow | crossbow | `crossbow` | 12 | 1.20 | `bolt` | 6 | 2 | wood (1 log), metal (1 bar) | 10 | metal crossbows: power 1.30 |
| `bow` | bow | bow | `bow` | 14 | 1.00 | `arrow` | 5 | 2 | wood (1 log) | 8 | yew: power 1.10 |
| `sling` | sling | sling | `sling` | 8 | 0.80 | `sling_stone` | 2 | 1 | leather | 2 | |

Launchers used in melee (no ammunition) attack as a `club` at half damage with the `hammer` skill.

### Channels

A channel is a launcher with no ammunition: a wand or a staff, which casts the spell of the stone set in it (§ Spells, [25-runecraft.md](../02-systems/25-runecraft.md) § Channels). `materials` is what the item is made of: a wand is its wood, a staff the metal of its shoe; `bars` and `logs` are the stock it is made from. Item rows: category `weapon/ranged`, stack 1, quality-bearing, slot weapon, no `weapon` tag; the glyph and color are the item's.

| id | name | class | skill | range | power | size | hands | bars | logs | materials | mult | glyph | fg |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `wand` | wand | staff | `runecraft` | 8 | 0.70 | 3 | 1 | 0 | 1 | wood | 10 | `'` | `rune_cyan` |
| `staff` | staff | staff | `runecraft` | 12 | 1.20 | 7 | 2 | 1 | 1 | metal | 14 | `⌠` | `rune_cyan` |

`power(item) = power × runeMult(material) × qualityMultiplier`, with the metal's `runeMult` ([minerals-and-metals.md](minerals-and-metals.md) § Metals); a wooden item counts 1.0. A wand is 0.70, an iron staff 1.20, a fine silver staff 1.716, a masterwork deepsilver staff 2.88. In melee a channel is a launcher: a `club` at half damage with the `hammer` skill.

### Ammunition

| id | name | type | damage | stack | per craft | materials | mult | notes |
|---|---|---|---|---|---|---|---|---|
| `bolt` | bolt | pierce | 20 | 50 | 25 per bar, 20 per log, 15 per bone pile | metal, wood (0.4), bone (0.5) | 0.2 | |
| `arrow` | arrow | pierce | 16 | 50 | 25 per bar, 20 per log, 15 per bone pile | metal, wood, bone | 0.2 | |
| `sling_stone` | sling stone | blunt | 10 | 50 | 30 per raw stone | stone | 0.05 | |

Ammunition damage: `ammo.damage × launcher.power × metalMult(ammo)`.

## Armor

Columns: `slot`; `covers` lists body parts with coverage percent; `layer`; `armor` is the base armor value; `weight` for the speed penalty (`speed × (100 − Σ weight / 4)%`); `bars`/`materials`; `mult` the value multiplier; `rune` what the piece does for its wearer's rune ([25-runecraft.md](../02-systems/25-runecraft.md) § Rune of one's own): `regen ×n` multiplies the regen, `max +n` adds to the maximum. A piece with a `rune` property never counts toward the metal penalty.

| id | name | slot | covers | layer | armor | weight | bars | materials | mult | rune |
|---|---|---|---|---|---|---|---|---|---|---|
| `cap` | cap | head | head 100 | leather | 4 | 2 | 1 leather | leather | 3 | |
| `helm` | helm | head | head 100 | plate | 8 | 6 | 1 | metal | 6 | |
| `gambeson` | gambeson | body | torso 100, arms 40 | padding | 3 | 3 | 3 cloth | cloth | 4 | |
| `leather_jerkin` | leather jerkin | body | torso 100, arms 30 | leather | 5 | 4 | 3 leather | leather | 6 | |
| `mail_shirt` | mail shirt | body | torso 100, arms 60 | mail | 12 | 12 | 3 | metal | 15 | |
| `breastplate` | breastplate | body | torso 100 | plate | 18 | 16 | 4 | metal | 20 | |
| `bracers` | bracers | arms | arms 80 | leather | 3 | 2 | 1 leather | leather | 3 | |
| `gauntlets` | gauntlets | arms | arms 60 | plate | 6 | 4 | 1 | metal | 5 | |
| `leggings` | leather leggings | legs | legs 100 | leather | 4 | 3 | 2 leather | leather | 4 | |
| `greaves` | greaves | legs | legs 100 | plate | 10 | 10 | 2 | metal | 10 | |
| `leather_boots` | leather boots | feet | legs 20 | leather | 2 | 1 | 1 leather | leather | 2 | |
| `metal_boots` | metal boots | feet | legs 30 | plate | 4 | 4 | 1 | metal | 5 | |
| `buckler` | buckler | shield | — | — | block only | 3 | 1 log or 1 bar | wood, metal | 4 | |
| `shield` | shield | shield | — | — | block only | 6 | 1 log + 1 bar, or 2 bars | wood, metal | 6 | |
| `rune_robe` | runed robe | body | torso 100, arms 60, legs 40 | padding | 3 | 2 | 3 cloth | cloth | 8 | regen ×1.5 |
| `circlet` | circlet | head | head 100 | plate | 2 | 1 | 1 | metal | 10 | max +10 |

The runed robe and the circlet are made at the runeforge ([workshops-and-recipes.md](workshops-and-recipes.md) § Runeforge). A soldier who holds a channel claims a piece with a `rune` property for its slot first ([16-combat.md](../02-systems/16-combat.md) § Equipment).

Clothing (`tunic`, `trousers`, `boots`, `cloak`) counts as a `padding` layer with armor 1 for the parts it covers (tunic: torso 100, arms 50; trousers: legs 100; boots: legs 10; cloak: torso 50).

`armorValue(piece, part) = armor × armorMult(material) × coverage / 100 × qualityArmorMult`, where `qualityArmorMult` is poor 0.8, common 1.0, fine 1.1, superior 1.2, exceptional 1.35, masterwork 1.5. Leather and cloth pieces use `armorMult` 1.0.

## Damage type versus layer

Multiplier applied to a layer's armor value when reducing damage of the given type:

| Type \ Layer | padding | leather | mail | plate | ward |
|---|---|---|---|---|---|
| edge | 0.6 | 0.8 | 1.2 | 1.1 | 1.0 |
| pierce | 0.4 | 0.6 | 0.8 | 1.2 | 1.0 |
| blunt | 1.2 | 1.0 | 0.5 | 0.9 | 1.0 |
| ember | 0.3 | 0.6 | 0.4 | 0.8 | 2.0 |
| frost | 1.0 | 0.8 | 0.3 | 0.5 | 2.0 |

`ember` is rune fire and its wound is a `burn`; `frost` makes a `frost` wound. Mail is a poor answer to rune, plate a fair one, a ward the best. A type with no row multiplies by 1.0: the magma wyrm's breath is `burn`, which has none. The `ward` column is read by a ward's armor ([25-runecraft.md](../02-systems/25-runecraft.md) § Effects).

## Spells

The stone set in a channel fixes its spell ([25-runecraft.md](../02-systems/25-runecraft.md) § Spells). `cost` is whole rune, spent at the cast and never scaled; `range` is blank where the spell flies as far as the channel reaches; `base` and `ticks` are scaled by the channel's power, `round(base × power)` and `round(ticks × power)`; `suffix` is the channel's name ("iron staff of embers"). The runeforge makes one wand and one staff recipe per row.

| stone | id | name | kind | cost | range | base | type | ticks | suffix | summon |
|---|---|---|---|---|---|---|---|---|---|---|
| `garnet` | `emberbolt` | Emberbolt | bolt | 1 | — | 18 | ember | — | of embers | — |
| `amethyst` | `frostbind` | Frostbind | bolt | 1 | — | 8 | frost | 300 | of frost | — |
| `quartz` | `ward` | Ward | ward | 2 | 3 | 6 | — | 600 | of warding | — |
| `emerald` | `mend` | Mend | mend | 2 | 4 | — | — | — | of mending | — |
| `sapphire` | `dread` | Dread | dread | 2 | 4 | — | — | 400 | of dread | — |
| `ruby` | `firebloom` | Firebloom | burst | 3 | 8 | 14 | ember | — | of blooms | — |
| `diamond` | `daze` | Daze | single | 3 | 6 | — | — | 150 | of stillness | — |
| `glowstone` | `call` | Call | call | 3 | — | — | — | — | of calling | `wisp` |

A `bolt` flies as a missile. A `burst` blooms on the 3×3 around its target after a delay, a `single` strikes its target with no missile; both are cast by 16's ranged branch. `ward`, `mend`, `dread` and `call` are support spells, cast for the fortress creatures or against the hostiles around the caster. `call` brings a summon beside the caster: the species is the `summon` of the staff's metal ([minerals-and-metals.md](minerals-and-metals.md) § Metals), or the row's own `summon` for a wand or a metal with none ([creatures.md](creatures.md) § Summons); its `range` is blank because it reaches no one. What each does, and when it is cast, is in 25 § Spells. A Frostbind hit that does damage slows the target by `FROSTBIND_SLOW_PERCENT` for `round(300 × power)` ticks. A ward of a power-1.0 channel is 6 armour on every part for 600 ticks: 4 for 420 ticks from a wand, 7 for 720 from an iron staff.

## Enchantments

A runesmith sets a stone in a weapon, an armor piece or a set of 25 bolts or arrows at the runeforge ([25-runecraft.md](../02-systems/25-runecraft.md) § Setting stones). One row per enchantment. `slot` is what it is set in; `stone` is a gem material (set as a `cut_gem` of it), a metal (set as a `bar` of it) or an item id; `vials` the rune vials the setting burns; `suffix` the name it gives the item: a suffix that begins with "of" follows the name ("iron battle axe of embers"), any other goes before it ("keen iron battle axe"); `only` limits an armor row to one slot. `effects` are what it does, at the common tier: `kind value`, with a damage type, a chance and a duration where the kind has them. `scales` says what the item's tier scales by `QUALITY_COMBAT_MULT[tier]`, rounded: `value`, `ticks` or `none`. The kinds are read in combat as 25 § Enchantments in combat says; a kind none reads does nothing. Every number is *unmeasured*.

| stone | id | slot | vials | suffix | effects | scales | only |
|---|---|---|---|---|---|---|---|
| `quartz` | `keen` | weapon | 4 | keen | `damage_percent` 10 | value | |
| `garnet` | `ember` | weapon | 6 | of embers | `extra_damage` 8 ember | value | |
| `amethyst` | `rime` | weapon | 6 | of rime | `slow` 30 for 200 ticks | ticks | |
| `emerald` | `sure` | weapon | 6 | sure | `to_hit` 10 | value | |
| `sapphire` | `fearsome` | weapon | 8 | fearsome | `flee` 1, 25% for 200 ticks | none | |
| `ruby` | `blaze` | weapon | 10 | of blaze | `extra_damage` 14 ember; `ignite` 1, 2% | value | |
| `diamond` | `sunder` | weapon | 12 | sundering | `armor_percent` 50 | none | |
| `deepsilver` | `deep` | weapon | 12 | of the deep | `damage_percent` 25; `vs_deep_percent` 50 | none | |
| `hollow_ichor` | `hollowbane` | weapon | 8 | hollowbane | `vs_deep_percent` 100 | none | |
| `quartz` | `stout` | armor | 4 | stout | `armor` 2 | value | |
| `garnet` | `emberward` | armor | 6 | of embers warded | `fire_percent` 50 | none | |
| `amethyst` | `rimeward` | armor | 6 | of rime warded | `frost_percent` 50; `slow_immune` 1 | none | |
| `diamond` | `adamant` | armor | 12 | adamant | `armor` 4 | value | |
| `glowstone` | `glowing` | armor | 6 | glowing | `spot_radius` 2 | none | |
| `wyrmscale` | `wyrmhide` | armor | 8 | wyrmhide | `fire_percent` 0 | none | |
| `hollow_ichor` | `hollowsight` | armor | 8 | of hollow sight | `spot_radius` 4 | none | head |
| `garnet` | `ember_ammo` | ammo | 4 | of embers | `extra_damage` 6 ember | value | |
| `amethyst` | `rime_ammo` | ammo | 4 | of rime | `slow` 30 for 200 ticks | ticks | |
| `emerald` | `seeking` | ammo | 4 | seeking | `to_hit` 10 | value | |

What each kind means: `damage_percent` adds to the blow's damage before armor, and `vs_deep_percent` adds more against a creature of the Deep (the Hollow-born); `extra_damage` is a second hit of its type on the same part; `slow` and `flee` are timed effects on the target, `flee` only on a roll of its chance; `to_hit` adds to the hit chance; `armor_percent` is the share of the target's armor that counts; `armor` adds to the piece's own armor; `fire_percent` and `frost_percent` are the share of a fire or frost hit that gets through the pieces covering the part; `slow_immune` keeps the wearer from being slowed; `ignite` sets the struck creature's tile alight, on a roll of its chance, when that tile can burn; `spot_radius` adds tiles to how far the wearer spots a hidden creature (the largest among the pieces worn, not their sum).

## Shields

`blockChance = min(40, 10 + 2 × shield skill)` for `shield`; a `buckler` uses `min(30, 5 + 2 × skill)` and has half the weight.

## Natural armor and attacks

Species rows in [creatures.md](creatures.md) give `naturalArmor` (a flat reduction applied like a plate layer with `armorMult` 1.0 covering every part) and a list of attacks `{ name, type, damage, size }`.

The battle axe uses the item id `axe`, shared with the woodcutting tool, and carries `battle_axe` as its alias tag. The pick likewise uses the existing tool item id `pick`.

## Worked examples

- **Iron battle axe vs unarmored goblin torso**: raw = 22 × 1.0 × 1.0 × (50 + 50)/100 = 22; the goblin's Toughness is the default 50, so damage round(22 × 0.95) = 21; goblin torso maxHp = 55; ratio 0.38 → serious cut. Bleed 3 per health tick; the goblin (blood 550) is unconscious after 330 / 3 = 110 health ticks = 550 ticks, dead after 733 ticks …
- **Same axe vs dwarf in a common iron mail shirt and tunic**: reduction = mail 12 × 1.0 × 1.0 × 1.2 (edge vs mail) + padding 1 × 0.6 = 15; damage = 7; ratio 7/60 = 0.12 → light cut. Bleed 1.
- **Steel warhammer (common) vs trollkin (natural armor 4, size 150)**: raw = 24 × 1.25 × 1.0 × (50 + 60)/100 = 33; natural plate 4 × 0.9 = 3.6; 29.4 × 0.95 (Toughness 50) = 27.9 → 28; trollkin torso 150 → ratio 0.19 → light bruise, no fracture (45); a limb (maxHp 90): 28 ≥ 27 → a fracture in one hit.
- **Magma wyrm bite (damage 45, edge) vs steel breastplate (superior)**: reduction 18 × 1.25 × 1.0 × 1.2 × 1.1 = 29.7; damage 15.3; ratio 0.26 → serious cut. Deepsilver breastplate: 18 × 1.6 × 1.2 × 1.1 = 38 → 7 → light.
- **Crossbow (wood, iron bolt) at range 8 by a skill-6 hunter vs a deer (size 40, dodge 2)**: hit = 40 + 18 − 16 + (40 − 60)/4 − 4 = 33%; damage 20 × 1.2 × 1.0 = 24 × 0.95 = 22.8 → 23 vs deer torso 40 → ratio 0.575 → grievous puncture, bleed 8: the deer (blood 400) is unconscious after 150 ticks and dead within 200 ticks of a torso hit.
