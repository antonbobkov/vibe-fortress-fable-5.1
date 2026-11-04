# Creatures

**Owner:** content (`creatures`, `bodyPlans`) · **Depends on:** [`../02-systems/08-animals-and-domestication.md`](../02-systems/08-animals-and-domestication.md), [`../02-systems/16-combat.md`](../02-systems/16-combat.md), [`../02-systems/17-health-and-medicine.md`](../02-systems/17-health-and-medicine.md), [`../02-systems/18-threats-monsters-and-raids.md`](../02-systems/18-threats-monsters-and-raids.md)

## Body plans

Every plan maps its parts onto the six slots `head, torso, left_arm, right_arm, left_leg, right_leg`. `hit` is the hit weight (sums to 100); `hpFactor` × size gives the part's max hp; `functions` decide what a lost or disabled part costs.

| id | head | torso | left_arm | right_arm | left_leg | right_leg | notes |
|---|---|---|---|---|---|---|---|
| `humanoid` | hit 10, hp 0.5, see | hit 35, hp 1.0 | hit 12, hp 0.6, wield | hit 12, hp 0.6, wield | hit 15, hp 0.6, walk | hit 16, hp 0.6, walk | dwarves, humans, elves, goblins, trollkin, trolls, restless dead |
| `quadruped` | hit 12, hp 0.5, see | hit 40, hp 1.0 | "left foreleg" hit 12, hp 0.5, walk | "right foreleg" hit 12, hp 0.5, walk | hit 12, hp 0.5, walk | hit 12, hp 0.5, walk | most animals; a lost leg halves speed, two lost legs immobilize |
| `crawler` | hit 15, hp 0.5, see | hit 45, hp 1.0 | "front legs" hit 10, hp 0.4, walk | "front legs" hit 10, hp 0.4, walk | "back legs" hit 10, hp 0.4, walk | "back legs" hit 10, hp 0.4, walk | insects, crabs, spiders, crawlers |
| `bird` | hit 12, hp 0.4, see | hit 40, hp 1.0 | "left wing" hit 12, hp 0.4 | "right wing" hit 12, hp 0.4 | hit 12, hp 0.4, walk | hit 12, hp 0.4, walk | chickens; wings do nothing in version 1 |
| `serpent` | hit 20, hp 0.6, see | hit 50, hp 1.0 | "left foreclaw" hit 10, hp 0.5, walk | "right foreclaw" hit 10, hp 0.5, walk | "tail" hit 5, hp 0.5 | "tail" hit 5, hp 0.5 | wyrms and lizards |
| `fish` | hit 20, hp 0.5, see | hit 70, hp 1.0 | — 0 | — 0 | "tail" hit 5, hp 0.5, walk | "tail" hit 5, hp 0.5, walk | aquatic |
| `amorphous` | "maw" hit 30, hp 0.8, see | hit 70, hp 1.0 | — 0 | — 0 | — 0 | — 0 | the Hollow Maw; nothing to lose but the whole |

Parts with hit weight 0 are never hit. Head and torso destruction kill every plan.

## Column key

`speed` in tiles per tick; `diet` `grazer` / `carnivore` / `omnivore` / `none`; `temper` `timid` / `neutral` / `territorial` / `aggressive`; `class` movement class; `products` with intervals in days; `meat`/`hide` values for generated materials (0 = none); `value` in marks (embark and trade); `attacks` as `name type damage size`; `armor` natural armor; `flee` blood percent at which the creature flees (`—` never); `group` spawn group size; `season` when the species is seasonal; flags: `S` stealth, `D` breaks doors, `O` opens doors, `M` magma-safe, `N` nocturnal, `B` butcherable, `T` tameable, `W`/`H` trainable war/hunting.

Species defaults follow their section: dwarves and domestic animals are `fortress`; humans are `trader:hillfolk`, elves and Wildwood bearers `trader:wildwood`; wild surface animals, cavern fauna, cavern monsters and the restless dead are `wild`; Hollow-born are `deep`; the Gloam and trollkin are `hostile:gloam`, and the Hillfolk bandit is `hostile:hillfolk`. Perception uses the default of [08 Animals](../02-systems/08-animals-and-domestication.md).

## Dwarves and traders

| id | name | plan | size | speed | class | value | attacks | flags | glyph | fg |
|---|---|---|---|---|---|---|---|---|---|---|
| `dwarf` | dwarf | humanoid | 60 | 0.15 | walker | — | punch blunt 6 size 3 | O | `☺` | state color |
| `human` | human | humanoid | 70 | 0.165 | walker | — | punch blunt 7 size 3 | O | `☺` | `trader_hillfolk` |
| `elf` | elf | humanoid | 55 | 0.18 | walker | — | punch blunt 5 size 3 | O | `☺` | `trader_wildwood` |
| `wildwood_bearer` | wildwood bearer | humanoid | 55 | 0.165 | walker | — | punch blunt 5 size 3 | O | `☺` | `trader_wildwood` |

Traders and guards wear civ gear (see [caravan-goods.md](caravan-goods.md)).

## Domestic animals

| id | name | plan | size | speed | diet | temper | class | products | meat | hide | value | attacks | armor | flee | gestation / litter / grow (days) | flags | glyph | fg |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `dog` | dog | quadruped | 20 | 0.195 | none | neutral | walker | — | 2 | 3 | 30 | bite edge 8 size 3 | 0 | 50 | 20 / 2–4 / 60 | B T W H | `d` | `dog_tan` |
| `cat` | cat | quadruped | 6 | 0.195 | none | neutral | small | — | 1 | 2 | 10 | scratch edge 3 size 1 | 0 | 40 | 20 / 2–4 / 45 | B T | `c` | `cat_gray` |
| `cow` | cow | quadruped | 90 | 0.12 | grazer | timid | walker | milk 4 | 4 | 8 | 60 | kick blunt 12 size 6 | 0 | 60 | 60 / 1 / 120 | B T | `C` | `cow_brown` |
| `sheep` | sheep | quadruped | 40 | 0.135 | grazer | timid | walker | wool 28 | 3 | 5 | 30 | butt blunt 6 size 4 | 0 | 60 | 45 / 1–2 / 80 | B T | `s` | `sheep_cream` |
| `goat` | goat | quadruped | 35 | 0.165 | grazer | neutral | walker | milk 5 | 3 | 5 | 25 | butt blunt 7 size 4 | 0 | 55 | 40 / 1–2 / 70 | B T | `g` | `goat_gray` |
| `chicken` | chicken | bird | 4 | 0.135 | none | timid | small | eggs 3 | 1 | 0 | 6 | peck pierce 1 size 1 | 0 | 40 | egg hatching 12 / 1 / 30 | B T | `h` | `chicken_white` |
| `pig` | pig | quadruped | 55 | 0.135 | none | neutral | walker | — | 5 | 6 | 35 | bite edge 7 size 4 | 0 | 55 | 35 / 3–6 / 70 | B T | `p` | `pig_pink` |
| `mule` | mule | quadruped | 90 | 0.15 | grazer | timid | walker | — | 3 | 7 | 50 | kick blunt 12 size 6 | 0 | 60 | — (mules do not breed) | B T | `m` | `mule_brown` |
| `yak` | yak | quadruped | 120 | 0.12 | grazer | neutral | walker | milk 5, wool 28 | 4 | 10 | 70 | gore pierce 14 size 7 | 1 | 55 | 65 / 1 / 140 | B T | `Y` | `yak_black` |
| `horse` | horse | quadruped | 110 | 0.24 | grazer | timid | walker | — | 3 | 8 | 120 | kick blunt 14 size 6 | 0 | 65 | 70 / 1 / 120 | B T | `H` | `horse_brown` |

Horses come only from Hillfolk caravans at reputation ≥ 50. Yaks from the Mountainhome and in `frostmarrow` embarks.

## Wild surface animals

| id | name | plan | size | speed | diet | temper | class | meat | hide | value | attacks | armor | flee | group | biomes (weight) | season | flags | glyph | fg |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `deer` | deer | quadruped | 40 | 0.24 | grazer | timid | walker | 4 | 6 | 25 | kick blunt 6 size 4 | 0 | 70 | 2–5 | temperate_forest 30, temperate_hills 25, temperate_grassland 20, taiga 15, wetland 10 | all | B | `d` | `deer_tan` |
| `boar` | boar | quadruped | 60 | 0.18 | omnivore | territorial | walker | 5 | 6 | 30 | gore pierce 12 size 5 | 1 | 50 | 1–3 | temperate_forest 25, dark_forest 20, wetland 15, temperate_hills 10 | all | B T | `b` | `boar_brown` |
| `wolf` | wolf | quadruped | 35 | 0.225 | carnivore | aggressive | walker | 2 | 5 | 20 | bite edge 10 size 3 | 0 | 45 | 3–6 | taiga 30, temperate_forest 15, cold_steppe 20, tundra 15, dark_forest 25, mountain 10 | all | B T W | `w` | `wolf_gray` |
| `bear` | bear | quadruped | 130 | 0.165 | omnivore | aggressive | walker | 6 | 12 | 80 | claw edge 18 size 6; bite edge 16 size 5 | 2 | 35 | 1 | temperate_forest 10, taiga 15, mountain 10, dark_forest 15, temperate_hills 8 | spring–autumn | B T W | `B` | `bear_brown` |
| `fox` | fox | quadruped | 12 | 0.225 | carnivore | timid | small | 1 | 3 | 12 | bite edge 4 size 2 | 0 | 60 | 1–2 | temperate_grassland 20, temperate_forest 15, cold_steppe 15, tundra 10, temperate_hills 15 | all | B T | `f` | `fox_orange` |
| `rabbit` | rabbit | quadruped | 8 | 0.225 | grazer | timid | small | 1 | 2 | 6 | — | 0 | 90 | 3–8 | temperate_grassland 35, temperate_hills 20, cold_steppe 20, savanna 10, temperate_forest 10 | all | B T | `r` | `rabbit_gray` |
| `elk` | elk | quadruped | 110 | 0.21 | grazer | neutral | walker | 5 | 9 | 50 | gore pierce 14 size 7 | 0 | 60 | 2–4 | taiga 30, cold_steppe 20, tundra 15, temperate_forest 10 | autumn, winter | B | `E` | `elk_brown` |
| `mountain_goat` | mountain goat | quadruped | 40 | 0.18 | grazer | neutral | walker | 3 | 5 | 25 | butt blunt 8 size 4 | 0 | 60 | 2–5 | mountain 35, alpine 35, temperate_hills 10 | all | B T | `g` | `goat_white` |
| `snow_leopard` | snow leopard | quadruped | 45 | 0.24 | carnivore | aggressive | walker | 3 | 9 | 60 | bite edge 12 size 3; claw edge 9 size 2 | 0 | 40 | 1 | alpine 20, tundra 10, mountain 15 | all | B N | `L` | `leopard_pale` |
| `giant_lizard` | giant lizard | serpent | 70 | 0.15 | carnivore | territorial | walker | 4 | 7 | 35 | bite edge 12 size 5 | 2 | 45 | 1–2 | desert 30, badlands 30, savanna 15 | all | B | `l` | `lizard_green` |
| `crocodile` | crocodile | serpent | 120 | 0.135 | carnivore | aggressive | amphibious | 5 | 10 | 70 | bite edge 22 size 7 | 4 | 30 | 1–2 | wetland 30, tropical_forest 15 (water within 6) | all | B | `A` | `croc_green` |
| `wild_horse` | wild horse | quadruped | 110 | 0.24 | grazer | timid | walker | 3 | 8 | 60 | kick blunt 14 size 6 | 0 | 70 | 3–6 | temperate_grassland 20, cold_steppe 25, savanna 20 | all | B T | `H` | `horse_dun` |
| `badger` | badger | quadruped | 15 | 0.15 | omnivore | territorial | small | 1 | 3 | 10 | bite edge 6 size 2 | 1 | 40 | 1 | temperate_forest 15, temperate_grassland 10, temperate_hills 15 | all | B | `b` | `badger_gray` |
| `lynx` | lynx | quadruped | 25 | 0.225 | carnivore | neutral | walker | 2 | 6 | 30 | bite edge 8 size 3 | 0 | 50 | 1 | taiga 20, temperate_forest 10, mountain 10 | all | B N | `l` | `lynx_tan` |
| `mammoth` | mammoth | quadruped | 220 | 0.12 | grazer | neutral | large | 8 | 20 | 300 | tusk pierce 30 size 10; trample blunt 25 size 9 | 4 | 40 | 2–4 | tundra 10, glacier-adjacent tundra 15 | winter | B | `M` | `mammoth_brown` |

Wildlife follows the region-trait hooks: `beastwood` multiplies all wildlife caps by 1.5, then `wolf` and `bear` caps by 2, and doubles those species' group sizes; `serene_vale` removes `wolf`, `bear`, `snow_leopard` and doubles all grazer caps; `fungal_depths` multiplies cavern caps by 1.5. Cap multipliers round up.

Per-species caps per biome are `cap = weight / 5` (rounded up, minimum 2); the biome's `wildlifeDensity` multiplies caps (see [regions-biomes-and-traits.md](regions-biomes-and-traits.md)).

## Cavern fauna (non-hostile; owned by 08)

The fauna cavern cell accepts an optional `initial N` after its weight and cap. When absent, `cavern.initial` is zero. The shipped rows therefore have zero initial fauna; a later nonzero row is initialized at first breach by 08 without changing code. Monsters use their separate initial/count/respawn cells and belong to 18.

| id | name | plan | size | speed | diet | temper | class | meat | hide/shell | value | attacks | armor | flee | group | cavern (weight, cap) | flags | glyph | fg |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `glow_beetle` | glow beetle | crawler | 5 | 0.12 | none | timid | small | 1 | shell 4 | 8 | — | 1 | 90 | 2–6 | 1 (40, cap 12) | B; lights its tile | `i` | `glow_green` |
| `cave_crab` | cave crab | crawler | 12 | 0.105 | none | timid | small | 2 | shell 4 | 12 | pinch blunt 4 size 2 | 3 | 60 | 2–4 | 1 (30, cap 8) | B | `k` | `crab_pale` |
| `blind_fish` | blind fish | fish | 3 | 0.15 | none | timid | aquatic | 3 | 0 | 5 | — | 0 | 100 | 4–8 | cavern lakes (fish pool species, not spawned as creatures) | B | `f` | `fish_pale` |
| `cave_ox` | cave ox | quadruped | 100 | 0.12 | grazer | neutral | walker | 5 | 9 | 70 | gore pierce 14 size 7 | 1 | 55 | 2–4 | 2 (25, cap 6) | B T | `O` | `ox_gray` |
| `mole_hound` | mole hound | quadruped | 30 | 0.18 | omnivore | territorial | walker | 2 | 5 | 40 | bite edge 10 size 3 | 1 | 45 | 1–3 | 2 (25, cap 6) | B T W | `h` | `hound_umber` |
| `ember_newt` | ember newt | serpent | 8 | 0.135 | none | timid | walker | 1 | 0 | 40 | — | 0 | 80 | 1–3 | 3 (30, cap 8) | M; lives within 5 of magma; sold to the Mountainhome | `n` | `ember_orange` |

## Cavern monsters (owned by 18)

| id | name | plan | size | speed | temper | class | attacks | armor | flee | group | cavern (initial, cap, respawn) | flags | glyph | fg |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `cave_crawler` | cave crawler | crawler | 45 | 0.21 | aggressive | walker | bite edge 12 size 3; claw edge 8 size 2 | 2 | 30 | 3–5 | 1 (2 packs, cap 10, daily 80‰) | B N | `C` | `hostile` |
| `giant_cave_spider` | giant cave spider | crawler | 70 | 0.165 | territorial | walker | bite pierce 16 size 4 (venom: pain +20 for 300 ticks) | 3 | 40 | 1 | 1 (2, cap 3, daily 30‰); spins `web` on 8 tiles around its lair each day | B S | `S` | `hostile` |
| `blind_stalker` | blind stalker | humanoid | 65 | 0.18 | aggressive | walker | claw edge 14 size 3; bite edge 10 size 3 | 2 | 25 | 1–2 | 2 (3, cap 6, daily 60‰) | S N | `S` | `hostile` |
| `troll` | troll | humanoid | 140 | 0.135 | aggressive | large | slam blunt 26 size 8; bite edge 14 size 5 | 4 | 30 | 1–2 | 2 (2, cap 4, daily 40‰) | D B | `T` | `hostile` |
| `magma_wyrm` | magma wyrm | serpent | 220 | 0.12 | aggressive | large | bite edge 45 size 9; tail blunt 30 size 8; fire breath burn 40 ranged 6 size 10 | 12 | — | 1 | 3 (1 in `wyrm_roost`, else 0; cap 1; no respawn; the Deep may send one) | M D | `W` | `wyrm_red` |

## Hollow-born (faction `deep`; never flee; never loot)

| id | name | plan | size | speed | class | attacks | armor | flags | glyph | fg |
|---|---|---|---|---|---|---|---|---|---|---|
| `hollow_crawler` | hollow crawler | crawler | 55 | 0.225 | walker | bite edge 16 size 3; claw edge 10 size 2 | 4 | M N | `H` | `hollow_violet` |
| `hollow_stalker` | hollow stalker | humanoid | 80 | 0.195 | walker | claw edge 20 size 3; bite edge 14 size 3 | 6 | S M N D | `H` | `hollow_violet` |
| `hollow_maw` | the Hollow Maw | amorphous | 250 | 0.075 | large | engulf edge 50 size 12; crush blunt 40 size 10 | 15 | M D | `H` | `hollow_violet` |

## Gloam, Hillfolk bandits, the restless dead (owned by 18)

| id | name | plan | size | speed | class | attacks (unarmed) | armor | flee | flags | gear (see caravan-goods and threat-schedules) | glyph | fg |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `gloam_snatcher` | gloam snatcher | humanoid | 45 | 0.225 | walker | dagger (carried) | 0 | 80 | S O | dagger, cap, leather jerkin | `G` | `hostile` |
| `gloam_warrior` | gloam warrior | humanoid | 55 | 0.165 | walker | punch blunt 5 size 3 | 0 | 40 | O | weapon by gear tier, cap or helm, jerkin or mail, shield 50% | `G` | `hostile` |
| `gloam_archer` | gloam archer | humanoid | 50 | 0.18 | walker | punch blunt 5 size 3 | 0 | 50 | O | bow, 30 arrows, dagger, cap, jerkin | `G` | `hostile` |
| `gloam_captain` | gloam captain | humanoid | 60 | 0.165 | walker | punch blunt 6 size 3 | 0 | 30 | O | best gear tier + 1, helm, mail, shield | `G` | `hostile_bright` |
| `gloam_hexer` | gloam hexer | humanoid | 50 | 0.165 | walker | punch blunt 5 size 3 | 0 | 50 | O | wand of frost, dagger, cap, jerkin | `G` | `hostile` |
| `trollkin` | trollkin | humanoid | 150 | 0.135 | large | slam blunt 28 size 8 | 3 | 25 | D | club | `T` | `hostile` |
| `hillfolk_bandit` | hillfolk bandit | humanoid | 70 | 0.165 | walker | punch blunt 7 size 3 | 0 | 60 | O | club or dagger, cap, jerkin | `B` | `hostile` |
| `restless_dead` | restless dead | humanoid | 60 | 0.09 | walker | claw edge 8 size 4 | 1 | — | N; collapses at dawn; not butcherable | rusted weapon 30% | `Z` | `undead_gray` |

Gear tiers: `hostile gear tier = min(peril, 3)` metal tier (1 copper, 2 bronze, 3 iron), sieges +1 (steel at peril 4). Captains +1.

## Summons (owned by 25)

What a runecaster's Call brings ([25-runecraft.md](../02-systems/25-runecraft.md) § Summons). A summon is called war-trained, which adds 50% to its attacks and 1 to its armor, so the rows hold the lower numbers. `summoned` in the flags column marks a summoned species: it leaves no corpse, is never butchered, named, assigned or trained, gives no grief, and fades. `turns` marks the species that may come through the call turned. Every number is *unmeasured*.

| id | name | plan | size | speed | temper | class | attacks | armor | flee | flags | glyph | fg |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `wisp` | wisp | crawler | 10 | 0.24 | neutral | walker | touch ember 4 size 2 | 0 | — | summoned | `*` | `rune_cyan` |
| `stone_warden` | stone warden | humanoid | 90 | 0.105 | aggressive | walker | slam blunt 15 size 8 | 7 | — | summoned | `Φ` | `granite_gray` |
| `deep_shade` | deep shade | humanoid | 60 | 0.21 | aggressive | walker | claw edge 12 size 3 | 1 | — | summoned turns | `δ` | `hollow_violet` |

A wisp is `neutral`: called, it fights as any war animal does, and below `FLEE_BLOOD_PERCENT` of its blood it runs; loose from a mishap, 08's wild brain wanders it, and it turns only on what strikes it. (A `timid` wisp would run from the apprentice beside it and, in a sanctum with no way to the map's edge, leave the map at once.) A warden and a shade are `aggressive`, so they never run.
## Remains

What a dead creature leaves on its corpse besides its gear: items made of the material that shares their id, which the `strip_corpse` job recovers like worn gear ([13](../02-systems/13-items-and-storage.md) § Corpses). A species not listed leaves none.

| species | remains |
|---|---|
| `magma_wyrm` | 4 `wyrmscale` |
| `hollow_stalker` | 1 `hollow_ichor` |
| `hollow_maw` | 1 `hollow_ichor` |

## Fish pools

Water body kinds and their fish material: river → `trout`, lake → `perch`, cavern lake → `blindfish`. These are not creatures; the `blind_fish` creature above is the visible schooling animal in cavern lakes and is separate from the pool.

## Speeds in play

At `SIM_TICKS_PER_SECOND` = 20 and 1×, a dwarf at 0.15 crosses 3 tiles per second; a deer at 0.24 outruns a dwarf; a wolf at 0.225 nearly matches a deer; trolls at 0.135 are slower than dwarves, which is why sealing a breach is possible.
