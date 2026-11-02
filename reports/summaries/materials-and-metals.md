# Materials and metals: better, worse, and does it matter

**Short answer.** Yes, materials differ a lot, and metal is where it counts. A metal has one number for weapons and one for armour. The scale runs from 0.3 (bismuth) to 1.6 (deepsilver), with iron at 1.0 and **steel at 1.25 as the best metal a player can safely make**. Because armour is subtracted from damage rather than multiplied, a small gap in metal becomes a big gap in a fight. Everything here is read from `src/content/metals.json`, `minerals.json`, `materials.json`, `weapons.json`, `armor.json` and the formulas in `src/systems/combat/melee.ts`.

Terms used below. A **bar** is a block of refined metal, the thing smiths work with. **Ore** is rock that holds metal. **Smelting** is heating ore in a **smelter** (a workshop) to get bars. An **alloy** is a mix of two metals made at the smelter. **Fuel** is charcoal or coal burned by smelters and forges. **Flux** is limestone, dolomite, marble or chalk added when making steel.

## The metals

`weapon x` multiplies a weapon's damage. `armour x` multiplies an armour piece's protection. `Blunt` is an extra bonus for maces and hammers. `Value` is the price of one bar. `Melts` is the melting point in degrees C. Metals that melt at 1200 or below are destroyed by magma.

| Metal | Weapon x | Armour x | Blunt | Value | Melts | How you get it |
|---|---|---|---|---|---|---|
| **Deepsilver** | 1.60 | 1.60 | | 250 | 2400 | Deepsilver ore only, deep near magma. 1 bar per ore. Mining it wakes the Hollow (monsters come up through the rock). |
| **Steel** | 1.25 | 1.25 | | 40 | 1500 | Alloy: 1 iron bar + 1 flux stone + 1 fuel, plus fuel for the job. 1 bar out. |
| **Iron** | 1.00 | 1.00 | | 15 | 1538 | Hematite, magnetite, limonite. 2 bars per ore. |
| **Bismuth bronze** | 0.92 | 0.92 | | 20 | 900 | Alloy: 2 copper + 1 tin + 1 bismuth bars, 4 out. |
| **Bronze** | 0.90 | 0.90 | | 18 | 950 | Alloy: 1 copper + 1 tin bar, 2 out. |
| **Copper** | 0.80 | 0.80 | | 10 | 1085 | Malachite, native copper (2 per ore); tetrahedrite (1, plus a 50% silver bar). |
| **Brass** | 0.75 | 0.75 | | 16 | 930 | Alloy: 1 copper + 1 zinc bar, 2 out. Worse than plain copper. |
| **Silver** | 0.70 | 0.60 | +30% | 25 | 962 | Native silver (2 per ore); a by-product of galena and tetrahedrite. |
| **Platinum** | 0.50 | 0.60 | +10% | 90 | 1768 | Native platinum (rare, deep gabbro and diorite). |
| **Tin** | 0.50 | 0.50 | | 12 | 232 | Cassiterite. Mainly an alloy input. |
| **Zinc** | 0.50 | 0.50 | | 8 | 420 | Sphalerite. Alloy input. |
| **Electrum** | 0.45 | 0.45 | | 45 | 1000 | Alloy: 1 gold + 1 silver bar, 2 out. |
| **Gold** | 0.40 | 0.40 | +10% | 60 | 1064 | Native gold. |
| **Lead** | 0.40 | 0.40 | | 6 | 327 | Galena (1 lead, plus a 50% silver bar). |
| **Bismuth** | 0.30 | 0.30 | | 10 | 271 | Bismuthinite. Alloy input. |

In words:

- **Weapon x** is a straight damage multiplier. A steel axe hits 25% harder than an iron one, a copper axe 20% softer.
- **Armour x** multiplies how much damage a piece soaks up. Steel armour soaks 25% more than iron.
- **Silver and platinum maces** get a blunt bonus, but 0.7 x 1.3 = 0.91 still trails iron. Silver is no better than iron for fighting.
- **Value** is for trade and for the fortress's wealth score. Gold, platinum and silver are for selling and crafts, not for fighting.
- **Melting point** only matters near magma, fire and the forge: iron, steel, platinum and deepsilver survive magma.
- **Density and hardness** appear in the data (metal hardness is 100 for every metal) but the combat code does not read them. Armour weight comes from the armour piece; deepsilver alone halves it.
- **Forging rule.** Any bar can be forged into a weapon, armour piece or furniture. Only the anvil (iron or steel) and the metal mechanism (iron, steel, platinum or deepsilver) limit the metal.

## How to make each metal

1. **Dig the ore.** Veins sit in particular rocks (hematite in sandstone and limestone, cassiterite in granite, and so on).
2. **Smelt it** at a smelter: one ore in, one to two bars out.
3. **Fuel the job.** Every smelter and forge job burns 1 fuel bar. Charcoal comes from 1 log at a **wood furnace**. Coal ore (bituminous coal gives 2 coal bars per ore, lignite 1) is smelted without extra fuel. A **magma smelter or forge** built over magma burns no fuel.
4. **Alloy** at the smelter for bronze, bismuth bronze, brass, electrum and steel.
5. **Steel** costs the most fuel: 2 per steel bar. A steel breastplate (4 bars) burns about 11 fuel in total. See the [production chains](production-chains.md).
6. **Melting** an old metal item at the smelter returns 60% of its bars.

## Which is best

| Goal | Pick | Why |
|---|---|---|
| Strongest you can make safely | **Steel** | 1.25, needs only iron, flux stone and fuel. |
| Strongest at any price | Deepsilver | 1.6, but it wakes the Hollow when mined. |
| Cheap and good | Iron, then bronze | Iron is 1.0 from one ore type. Bronze needs two ores and an alloy job for 0.9. |
| Avoid | Brass, silver, gold, lead, tin, zinc, bismuth | All trail copper. |

## Does it matter in a fight?

Yes. Damage is `weapon damage x weapon metal x quality x strength`, then **armour is subtracted** (not divided), then a small toughness cut. Below: an axe hit (22 base edge damage, average strength and toughness, common quality) on the torso of a dwarf in a mail shirt plus a tunic. The first column is no mail, only the tunic.

| Axe metal | Tunic only | Copper mail | Iron mail | Steel mail | Deepsilver mail |
|---|---|---|---|---|---|
| Copper | 16.1 | 5.2 | 2.5 | 0 | 0 |
| Bronze | 18.2 | 7.3 | 4.6 | 1.1 | 0 |
| Iron | 20.3 | 9.4 | 6.7 | 3.2 | 0 |
| Steel | 25.6 | 14.6 | 11.9 | 8.5 | 3.7 |
| Deepsilver | 32.9 | 21.9 | 19.2 | 15.8 | 11.0 |

Read it like this. Against iron mail, a steel axe does **almost double** an iron axe's damage (11.9 against 6.7) and nearly five times a copper axe's (2.5). Steel mail turns a copper or bronze axe into a tickle on the torso. A dwarf's torso holds 60 health, so 12 damage is a light-to-serious cut and 2 is nothing.

Two limits. First, **armour covers only some body parts.** A mail shirt covers the torso and most of the arms and leaves the head and legs bare. In the combat measurement, a mailed Novice lost 47 of 60 duels to two unarmoured goblins, and with a helm and greaves added won 55 of 60 ([combat pace](../audits/2026-10-21-combat-pace.md), [tune](../audits/2026-10-21-combat-pace-tune.md)). Full coverage beats a better metal. Second, **raiders are not well armed.** A raid wears the metal of the region's peril (the danger rating of the map): copper at peril 1, bronze at 2, iron at 3 and 4. Captains and sieges get one metal better, so steel is the most you meet. Nobody attacks with deepsilver. Steel is therefore the practical ceiling.

Other weapon and armour types change the numbers:

- **Armour type matters as well as metal.** Each armour layer soaks a different share of each damage type. Mail soaks edge well (x1.2) but blunt badly (x0.5). Plate soaks pierce best (x1.2). Padding and leather soak little edge or pierce.
- **Blunt weapons** (mace, hammer, maul) are the answer to mail, and at least 30% of their damage always bruises through armour.
- **Wooden arrows and bolts** count at 0.4 of an iron one's damage, bone at 0.5.

## Other materials

| Material | What it does | Numbers |
|---|---|---|
| **Stone** | Blocks, walls, furniture, statues, mugs, sling stones. The hardness sets how long a wall takes to dig. Not used for weapons or armour. | Hardness 50 (chalk) to 170 (quartzite). Digging a tile takes 60 ticks x hardness/100. Value 1 to 3. Density sets stone-fall trap damage: 40 x density/100. |
| **Wood** | Furniture, tools, bows, arrows, clubs. Wooden weapons hit at 0.4 of the base damage, so a club does about 5. All woods are the same in a fight. Yew makes a better bow (power 1.10 against 1.00). | Value 2 (birch) to 5 (yew). As smelter fuel, a log must first become charcoal. |
| **Bone** | Crafts, totems, arrows and bolts at 0.5 damage. | Value 1. |
| **Leather** | Cap, jerkin, bracers, leggings, boots, bags, quiver, sling. Counts as 1.0 for armour, whatever the animal. | Value 6. Jerkin armour 5, cap 4, leggings 4. |
| **Cloth** | Clothing (counts as 1 padding armour), gambeson (padding, armour 3), cloak, bags, rope, bandages. Wool cloth sells for more than flax. | Value: flax 8, wool 10, sporecloth 12. |
| **Obsidian** | Listed as a dagger and short-sword material at 0.7, but no recipe makes one. | |

Armour **layers**: padding 3, leather 4 to 5, mail 12, plate 4 to 18 per piece (helm 8, breastplate 18, greaves 10, gauntlets 6, metal boots 4). A heavier piece slows the wearer by its weight divided by 4 in percent: a full steel kit with a shield costs about 11% of walking speed, less with armour skill. Metal does not change the weight.

## Item quality

Yes, quality scales strength. Items made at a quality-bearing workshop (forge items, most armour and weapons) roll one of six levels. The roll is `5 x the smith's skill level + a random 0 to 40`, so skill 0 to 20 matters.

| Level | Poor | Common | Fine | Superior | Exceptional | Masterwork |
|---|---|---|---|---|---|---|
| Combat multiplier (weapon damage, armour value) | 0.8 | 1.0 | 1.1 | 1.2 | 1.35 | 1.5 |
| Sale value multiplier | 0.5 | 1.0 | 1.5 | 2.0 | 3.0 | 5.0 |

Chance of each quality by the smith's skill (percent):

| Skill level | Poor | Common | Fine | Superior | Exceptional | Masterwork |
|---|---|---|---|---|---|---|
| 0 | 73 | 27 | | | | |
| 4 (Adequate) | 24 | 61 | 15 | | | |
| 8 (Skilled) | | 37 | 49 | 15 | | |
| 12 (Talented) | | | 37 | 37 | 27 | |
| 16 (Expert) | | | | 24 | 37 | 39 |
| 20 (Legendary) | | | | | 12 | 88 |

A masterwork iron axe (1.5) out-damages a common steel axe (1.25). A legendary smith also helps armour the same way. Quality changes neither a shield's block chance nor an arrow's damage.

## Spec vs code

- The metal numbers in `metals.json` match `docs/03-content/minerals-and-metals.md`. The weapon-material table (wood 0.4, bone 0.5) matches `materials.json`.
- The spec marks metal tiers 0 to 5, but combat damage uses the multipliers directly. The tier only ranks gear for squads and sets raider kits.
