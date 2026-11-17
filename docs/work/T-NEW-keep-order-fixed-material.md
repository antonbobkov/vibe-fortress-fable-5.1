# T-NEW — A keep order of glass blocks counts glass

**Source:** [T-583's audit of Making Do's reach](../../reports/audits/2026-11-17-t583-making-do-reach.md) § Issues, 3 · **Size:** S · **Needs:** — · **Status:** open

## Why

12 § Work orders: a `maintain` order is runnable while `stock(outputItemType, materialFilter) < threshold`, and "with no filter, a maintain order of a recipe whose first output is `drink` of a `fixed` material counts that material alone". Only drinks get that rule. Making Do added many recipes whose output is an old item type in a fixed material: `make_glass_block` and `make_glass_block_potash` (a `stone_block` of glass), `fire_bricks` (a `stone_block` of brick), `make_jug` (a `bucket` of earthenware), `make_mugs_clay` and `make_mugs_glass`, the bone furniture (`make_table_bone` and the rest, of the fossil's `giant_bone`). A player who adds "keep 6 glass blocks" at the kiln gets nothing in any fortress with six stone blocks of any rock: the order is stocked by sandstone. T-583's player probe showed it in the orders panel ("Glass blocks · stocked (132)" with no glass in the fortress); the material list (`[S-f]`) fixes it, but nothing says it is needed.

T-583 made the panel count what the workshop counts (`workshops.orderStock`), so the panel now tells the truth; the rule itself is what surprises.

## What to do

Extend the drink rule of 12 § Work orders to every recipe whose first output has a `fixed` material: with no filter, its keep order counts that material alone. Recipes whose output material comes from the input (bone blocks from a fossil) keep counting the type unless the player filters, or count the material of their input's fixed `material` where the input names one; decide which and say so. Write it into 12 § Work orders, extend `outputFilter` (`systems/workshops/operate.ts`) and test it.

This changes what the three-year script's keep orders count if any of them is of a fixed-material recipe (its smelting orders, bars of a fixed metal, are the ones to check): run the sweep if one is.

## Done

The rule in 12, the test (a kiln keeping glass blocks in a fortress full of stone blocks makes glass), and the sweep's verdict if the fixture's orders move.
