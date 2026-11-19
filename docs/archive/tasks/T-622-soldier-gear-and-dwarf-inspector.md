# T-622 — Show what a soldier carries, and the dwarf inspector's missing sections

**Closed:** 2026-11-18, in 4eca0dbe.

**Source:** [T-618's first-year audit](../../../reports/audits/2026-11-18-t618-first-year-ux.md), findings 4–7 · **Size:** M · **Needs:** — · **Status:** open

## Why

In the Balanced fortress the audit made a squad of three, set it to Train, and turned on ranged. A day later all three held nothing: the Balanced loadout's axe is a tool and its crossbow is the hunter's, so there was no weapon to claim. Nothing said so. The military panel names the members and the squad's preferences, never what each member holds; the weapon list offers every class with no count in stock; the creature inspector (Look) has no equipment line at all. The player sends an unarmed squad against boars, which the hints themselves warn against.

The inspector lacks more than equipment. 10 § UI lists its sections as attributes, skills with tiers and progress bars, needs, personality, title, relationships, activity and productivity; the panel shows activity, skills (no bars), mood and thoughts, and health. A player cannot see a dwarf's hunger, thirst or rest, its profession, its title, or its friends anywhere in the game.

## What to do

1. **Military panel**: under Members, one line "Armed 1 of 3 · unarmed: Liv H., Hrolf S." (the alert colour while any member lacks a weapon of the squad's choice or any weapon), and, when none of the chosen class is in stock, "No spear in stock: order one at a forge [o] or buy one."
2. **Weapon and armour lists** count what is in stock and free per class ("spear (0)", "axe (1, a tool)").
3. **The add list** shows each dwarf's best combat skill ("Hrolf Stonehold  Crossbow 3").
4. **Look › a dwarf** gains the sections 10 § UI names, in the wireframe's order: the identity line ("Miner · adult"), needs as bars, equipment and clothing ("Equipment iron spear, wooden shield; Wearing …"), relations, title, and the skill progress bars.

Spec: 16 § Military panel and `ui-screens/panels.md` § Military; `ui-screens/fortress-screen.md` § Inspection panel; 10 § UI.

## Done

Tests for the armed line, the stock counts and each inspector section; the military e2e checks the armed line.
