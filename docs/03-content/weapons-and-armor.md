# Weapons and Armor

**Owner:** content (`weapons`, `armor`) · **Depends on:** [`../02-systems/16-combat.md`](../02-systems/16-combat.md), [minerals-and-metals.md](minerals-and-metals.md), [items.md](items.md)

## Weapons

Columns: `skill` is the combat skill used; `type` the damage type; `damage` the base damage before metal, quality and strength; `size` scales the attack cooldown (`size × 3 + 10 − Agility/10`); `hands`; `bars` are metal bars to forge (or logs for wooden items); `mult` the item value multiplier; `range` for launchers with the `power` multiplier applied to ammunition damage.

### Melee

| id | name | class | skill | type | damage | size | hands | bars | mult | materials | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `dagger` | dagger | dagger | `dagger` | edge | 12 | 3 | 1 | 1 | 4 | metal, obsidian, bone (0.5) | fast: cooldown 19 at Agility 50 |
| `short_sword` | short sword | sword | `sword` | edge | 18 | 5 | 1 | 2 | 8 | metal, obsidian | |
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

### Ammunition

| id | name | type | damage | stack | per craft | materials | mult | notes |
|---|---|---|---|---|---|---|---|---|
| `bolt` | bolt | pierce | 20 | 50 | 25 per bar, 20 per log, 15 per bone pile | metal, wood (0.4), bone (0.5) | 0.2 | |
| `arrow` | arrow | pierce | 16 | 50 | 25 per bar, 20 per log, 15 per bone pile | metal, wood, bone | 0.2 | |
| `sling_stone` | sling stone | blunt | 10 | 50 | 30 per raw stone | stone | 0.05 | |

Ammunition damage: `ammo.damage × launcher.power × metalMult(ammo)`.

## Armor

Columns: `slot`; `covers` lists body parts with coverage percent; `layer`; `armor` is the base armor value; `weight` for the speed penalty (`speed × (100 − Σ weight / 4)%`); `bars`/`materials`; `mult` the value multiplier.

| id | name | slot | covers | layer | armor | weight | bars | materials | mult |
|---|---|---|---|---|---|---|---|---|---|
| `cap` | cap | head | head 100 | leather | 4 | 2 | 1 leather | leather | 3 |
| `helm` | helm | head | head 100 | plate | 8 | 6 | 1 | metal | 6 |
| `gambeson` | gambeson | body | torso 100, arms 40 | padding | 3 | 3 | 3 cloth | cloth | 4 |
| `leather_jerkin` | leather jerkin | body | torso 100, arms 30 | leather | 5 | 4 | 3 leather | leather | 6 |
| `mail_shirt` | mail shirt | body | torso 100, arms 60 | mail | 12 | 12 | 3 | metal | 15 |
| `breastplate` | breastplate | body | torso 100 | plate | 18 | 16 | 4 | metal | 20 |
| `bracers` | bracers | arms | arms 80 | leather | 3 | 2 | 1 leather | leather | 3 |
| `gauntlets` | gauntlets | arms | arms 60 | plate | 6 | 4 | 1 | metal | 5 |
| `leggings` | leather leggings | legs | legs 100 | leather | 4 | 3 | 2 leather | leather | 4 |
| `greaves` | greaves | legs | legs 100 | plate | 10 | 10 | 2 | metal | 10 |
| `leather_boots` | leather boots | feet | legs 20 | leather | 2 | 1 | 1 leather | leather | 2 |
| `metal_boots` | metal boots | feet | legs 30 | plate | 4 | 4 | 1 | metal | 5 |
| `buckler` | buckler | shield | — | — | block only | 3 | 1 log or 1 bar | wood, metal | 4 |
| `shield` | shield | shield | — | — | block only | 6 | 1 log + 1 bar, or 2 bars | wood, metal | 6 |

Clothing (`tunic`, `trousers`, `boots`, `cloak`) counts as a `padding` layer with armor 1 for the parts it covers (tunic: torso 100, arms 50; trousers: legs 100; boots: legs 10; cloak: torso 50).

`armorValue(piece, part) = armor × armorMult(material) × coverage / 100 × qualityArmorMult`, where `qualityArmorMult` is poor 0.8, common 1.0, fine 1.1, superior 1.2, exceptional 1.35, masterwork 1.5. Leather and cloth pieces use `armorMult` 1.0.

## Damage type versus layer

Multiplier applied to a layer's armor value when reducing damage of the given type:

| Type \ Layer | padding | leather | mail | plate |
|---|---|---|---|---|
| edge | 0.6 | 0.8 | 1.2 | 1.1 |
| pierce | 0.4 | 0.6 | 0.8 | 1.2 |
| blunt | 1.2 | 1.0 | 0.5 | 0.9 |

## Shields

`blockChance = min(40, 10 + 2 × shield skill)` for `shield`; a `buckler` uses `min(30, 5 + 2 × skill)` and has half the weight.

## Natural armor and attacks

Species rows in [creatures.md](creatures.md) give `naturalArmor` (a flat reduction applied like a plate layer with `armorMult` 1.0 covering every part) and a list of attacks `{ name, type, damage, size }`.

## Worked examples

- **Iron battle axe vs unarmored goblin torso**: raw = 22 × 1.0 × 1.0 × (50 + 50)/100 = 22; the goblin's Toughness is the default 50, so damage round(22 × 0.95) = 21; goblin torso maxHp = 55; ratio 0.38 → serious cut. Bleed 3 per health tick; the goblin (blood 550) is unconscious after 330 / 3 = 110 health ticks = 550 ticks, dead after 733 ticks …
- **Same axe vs dwarf in a common iron mail shirt and tunic**: reduction = mail 12 × 1.0 × 1.0 × 1.2 (edge vs mail) + padding 1 × 0.6 = 15; damage = 7; ratio 7/60 = 0.12 → light cut. Bleed 1.
- **Steel warhammer (common) vs trollkin (natural armor 4, size 150)**: raw = 24 × 1.25 × 1.0 × (50 + 60)/100 = 33; natural plate 4 × 0.9 = 3.6; 29.4 × 0.95 (Toughness 50) = 27.9 → 28; trollkin torso 150 → ratio 0.19 → light bruise, no fracture (45); a limb (maxHp 90): 28 ≥ 27 → a fracture in one hit.
- **Magma wyrm bite (damage 45, edge) vs steel breastplate (superior)**: reduction 18 × 1.25 × 1.0 × 1.2 × 1.1 = 29.7; damage 15.3; ratio 0.26 → serious cut. Deepsilver breastplate: 18 × 1.6 × 1.2 × 1.1 = 38 → 7 → light.
- **Crossbow (wood, iron bolt) at range 8 by a skill-6 hunter vs a deer (size 40, dodge 2)**: hit = 40 + 18 − 16 + (40 − 60)/4 − 4 = 33%; damage 20 × 1.2 × 1.0 = 24 × 0.95 = 22.8 → 23 vs deer torso 40 → ratio 0.575 → grievous puncture, bleed 8: the deer (blood 400) is unconscious after 150 ticks and dead within 200 ticks of a torso hit.
