# Production chains: what makes what

**Short answer.** The longest chain is **6 steps**: a plant grown for fibre is turned into thread, cloth, a cloth bag, flour (milled in that bag) and then a cooked meal. The product with the most work behind it is the **steel anvil**, at about 22 jobs. Runecraft adds chains of up to 5 steps (a stone set in anything forged of steel). This page was computed from `src/content/recipes.json`, `metals.json` and `minerals.json` on master (2026-11-01), with runecraft added on 2026-11-05.

Dwarves in this game make things at **workshops** (3×3 buildings). Each workshop runs **recipes**: take some input items, spend some time, produce output items. One recipe run is one **job**. This page groups the recipes into chains.

## How a "step" is counted

- One step is one recipe run at a workshop.
- A chain starts from **raw goods**: ore and stone dug out of the rock, logs from felled trees, crops, and animal parts (hides, wool, milk, bones). Digging, felling, harvesting and butchering are not counted as steps.
- **Fuel counts.** Smelters and forges burn one fuel bar per job unless they sit on magma. Fuel is made by another recipe (a log becomes charcoal at the wood furnace, one step; coal ore is smelted into coal, one step), so a fuel-burning job sits one step above its fuel.
- **Containers count.** Brewing needs an empty barrel and milling flour needs an empty bag. Those are inputs.
- Where an item can be made several ways (a barrel from wood or from metal), the "longest" figure takes the longest way and the "shortest" takes the shortest.
- Not counted: building the workshop itself, hauling, growing.

## The chains

| Chain | Steps (workshop) | Notes |
|---|---|---|
| **Food, cooked** | crop, meat, fish, eggs, cheese or flour, then cook a meal (kitchen) | 2, 3 or 4 ingredients make 4, 6 or 8 meals. Rendered fat becomes tallow, which no recipe uses. |
| **Flour** | crop (barley, cavewheat), then mill flour (farmer's workshop), into an empty bag | Needs a bag from the cloth or leather chain. |
| **Cheese** | milk, then make cheese (farmer's workshop) | |
| **Drink** | plant, then brew (still), into an empty barrel | 4 plants make 20 drinks. Hopped ale needs barley plus hops. |
| **Metal** | ore, smelt (smelter), then forge (forge) | Details in the [metals summary](materials-and-metals.md). |
| **Fuel** | log, then charcoal (wood furnace). Or coal ore, then coal (smelter) | |
| **Stone** | raw stone, then blocks, furniture, statues, mugs, sling stones, mechanisms (mason, craftsdwarf, mechanic) | One step from the rock. |
| **Wood** | log, then furniture, tools, bows, arrows, training weapons, splints (carpenter, bowyer); mugs and crafts (craftsdwarf) | One step from the tree. |
| **Cloth** | fibre crop (flax, cave sporecloth), then fibre (farmer's workshop), thread and cloth (loom), then clothes, bags, rope, bandages (clothier) | Wool takes a short cut: shear a sheep, spin, weave. Spider silk is gathered as thread. |
| **Leather** | hide (from butchering), then leather (tannery), then armour, bags, quivers, slings (leatherworks) | |
| **Bone and shell** | bone pile, shell piece, skull (from butchering), then crafts, arrows, bolts, totems (craftsdwarf) | |
| **Gems** | rough gem (mined), then cut gem (jeweler) | A glowstone lamp also needs a stone block. |
| **Rune** | glowcap (grown under a lamp), then rune vial (laboratory) | 2 glowcap a vial. A ground glowstone gives 4 vials, a quenched deepsilver bar 12, a rendered hollow ichor 6. |
| **Channels** | log + cut gem, then a wand; log + cut gem + bar, then a staff (runeforge) | No fuel. The gem is the spell; the bar is the staff's power. An iron staff is 3 steps from the ore (fuel, bar, staff). |
| **Settings** | an item + a stone + 4 to 12 vials, then the same item enchanted (runeforge) | The item is kept, not consumed. On a steel item this is 5 in a row. |
| **Draughts** | rune vial + 2 plants (or a monster stone), then 2 draughts (laboratory) | 2 steps from the glowcap. A novice alchemist's batch can spoil into murky draughts. |
| **Runed robe, circlet** | sporecloth cloth + 2 vials, then a robe; a silver bar + cut gem + 2 vials, then a circlet (runeforge) | The robe is 4 in a row (fibre, thread, cloth, robe). |
| **Knapped blades** | obsidian stone or bone pile, then a dagger or short sword (craftsdwarf) | One step, no forge. |
| **Crafts** | stone, wood, bone, shell or metal, then a random figurine, ring or amulet (craftsdwarf, forge) | Trade goods. |

## Main chains as a diagram

```
FOOD     crop ----------------------------------------------> kitchen: meal
         crop(barley) -> farmer's: flour (needs a bag) ------> kitchen: meal
         milk -> farmer's: cheese ---------------------------> kitchen: meal
DRINK    crop + empty barrel -> still: drink
METAL    ore -> smelter: bar -> forge: weapon / armour / furniture
         bar + bar (+ stone, fuel) -> smelter: alloy bar -> forge
FUEL     log -> wood furnace: charcoal   (burned at smelter and forge)
CLOTH    flax -> farmer's: fibre -> loom: thread -> loom: cloth -> clothier: bag or garment
LEATHER  hide -> tannery: leather -> leatherworks: armour or bag
RUNE     glowcap (under a lamp) -> laboratory: vial -> laboratory: draught
                                             vial + cut gem + item -> runeforge: enchanted item
         log + cut gem (+ bar) -> runeforge: wand (staff)
```

## The longest chain: 6 steps

All three meal recipes (easy, fine, lavish) tie at 6. The route that makes it 6 uses a **cloth bag** as the flour container:

| Step | Job | Workshop |
|---|---|---|
| 1 | Process flax into 2 fibre | farmer's workshop |
| 2 | Spin fibre into thread | loom |
| 3 | Weave 2 thread into cloth | loom |
| 4 | Sew cloth into a bag | clothier |
| 5 | Mill flour into the bag (needs barley or cavewheat) | farmer's workshop |
| 6 | Cook a meal with flour as an ingredient | kitchen |

**Ties.** Cave sporecloth instead of flax is the same 6 steps. The steel barrel route to brewing and the glowstone lamp reach 5, and so does a stone set at the runeforge in a steel weapon or breastplate, or in a gambeson (fibre, thread, cloth, gambeson, setting). Nothing else reaches 6.

**Shortest ways.** The same meal made from raw meat is 1 step. A leather bag gives 4 (hide, leather, bag, flour, meal). Wool gives 5.

If fuel is not counted, the meal chain is still 6, and the longest metal chain drops from 4 to 3.

## The most steps, two ways

- **Most steps in a row (depth):** the meals above, at 6.
- **Most jobs overall:** the **steel anvil** (a forge needs one), about **22 jobs**. Next are the steel breastplate and the steel statue, about **18 jobs** each. Ties on depth: every item forged from steel, or from an alloy such as bronze or brass, sits at 4 in a row (for steel: charcoal, iron bar, steel bar, item).

How a steel breastplate adds up (4 bars):

| Job | Count |
|---|---|
| Smelt hematite into 2 iron bars each | 2 |
| Alloy 1 iron bar + 1 flux stone + 1 fuel into 1 steel bar | 4 |
| Forge the breastplate | 1 |
| Charcoal for all of the above (the alloy burns 2 fuel per bar) | 11 |
| **Total** | **18** |

Any bar can be forged into most metal items, so **material choice decides the depth**: a copper breastplate is 3 in a row, a steel one is 4.

## Spec vs code

- The recipe tables agree with `docs/03-content/workshops-and-recipes.md`: 145 authored rows plus 60 generated (16 smelting, 5 alloy, 1 melt, 8 wands, 8 staffs, 22 settings) make 205, and the per-workshop counts match (the runeforge holds 40: 2 authored, 38 generated; the laboratory 10).
- The spec says kitchen ingredients are "anything in food/* except meals and tallow". The code uses an `ingredient` tag, which leaves out milk (milk only goes to cheese). Same result for play, different wording.
- The magma kiln has no recipes, as the spec says, and cannot be built from the menu.
