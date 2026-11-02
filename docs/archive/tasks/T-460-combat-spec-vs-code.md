# T-460 — Combat rules the spec states and the code does not follow

**Closed:** 2026-11-01, in 44d0462.

**Source:** the summaries of 2026-11-01 ([combat](../../../reports/summaries/combat.md), [materials](../../../reports/summaries/materials-and-metals.md)) · **Size:** M · **Needs:** T-457 · **Status:** open

## Why

Writing the summaries from the code found places where the code and the spec disagree. The orchestrator confirmed the first and the fifth by search: `canWield` has no caller outside `src/systems/health/reader.ts`, and `armorWeightMult` is only declared.

1. **Lost arms and broken bones do not affect fighting.** 17 says combat reads `health.canWield`, so a lost arm blocks two-handed weapons and shields. Combat never calls it. This is the one that plays wrong.
2. **Aggressive creatures can flee.** The spec says aggressive species never flee. `src/systems/combat/index.ts` uses the per-species `fleeBloodPercent` first, and wolf (45), bear (35) and troll (30) have one. Only the magma wyrm and Deep-faction creatures never flee.
3. **Civilian flee radius.** 16's rules text says 10 and its constants table says 8. The code uses 8.
4. **Buckler against arrows.** Melee matches the spec (`5 + 2 × skill`, at most 30). `src/systems/combat/ranged.ts` uses 70% of the full-shield formula.
5. **Deepsilver armour weight.** The spec and `metals.json` (`armorWeightMult: 500`) say half weight. No code reads the field.
6. **Obsidian and bone weapons.** `weapons.json` and the spec list them as dagger and short-sword materials, but no recipe makes one.
7. **Kitchen ingredients (wording).** The spec says "anything in food/* except meals and tallow". The code uses an `ingredient` tag, which also excludes milk.

## What to do

For each, make the code follow the spec, or change the spec with a stated reason. The orchestrator's starting view:

- **1:** code follows spec. A dwarf who has lost an arm cannot use a two-handed weapon or a shield.
- **2:** spec follows code. Wounded wolves fleeing is the better game, and the instrument is measured with it.
- **3:** spec follows code (8).
- **4:** decide from the combat summary and say why.
- **5:** code follows spec only if weight has any effect in the game; otherwise drop the field and the claim.
- **6:** add the recipes, or remove the rows.
- **7:** spec wording follows code.

## Done

- Each item is settled in the spec and the code agrees, with a unit test for 1 and for any other behaviour change.
- The summaries are corrected where they described the mismatch.
- If behaviour changed, the instrument by the T-308 rule and the twenty-seed file by the set rule.
