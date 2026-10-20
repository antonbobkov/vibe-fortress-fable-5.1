# T-398 — Dwarves with no drink die of hunger or thirst on the way to a distant bank, sheltering or not

**Closed:** 2026-10-18, in 057089c.

**Source:** T-360, [the brook measurement](../../../reports/audits/2026-10-18-brook-drinking-under-wildlife.md) § The deaths that are not about water, [data](../../../reports/data/2026-10-18-brook-drinking.json) · **Size:** M · **Needs:** — · **Status:** open

## Why

Twelve fortresses with no drink and a brook 38 to 49 tiles from the wagon lost 34 dwarves to `starvation` (hunger or thirst: the death record does not say which) in `dry-north`; 33 of them died 11 or more tiles from the wagon. In five of the twelve seeds the hearth alert sheltered the dwarves (300 to 68,580 ticks) and thirst reached 100, 21 of the deaths; the other 13 are one seed, `wildlife-taiga-3`, that never sheltered (first death on day 101). In the usual opening on the same maps thirst never passed 82. 10 § Behavior selection step 2 lets a sheltering civilian go for a need only at its critical threshold (85 for thirst). At 1.6 a hour that leaves 9.4 hours (470 ticks) to the point of dying; a walk of 43 tiles, in the open and in the animals' ground, does not fit in it.

## Diagnosis

Replayed with a per-dwarf trace (behaviour, activity, needs, tile, target, every 20 ticks; [the report](../../../reports/audits/2026-10-18-no-drink-deaths-diagnosis.md)). The proposed cause, a late start from the shelter, is not what kills. A sheltering civilian starts for water at thirst 85 or 86 and drinks, on a walk of 13 to 30 tiles (`wildlife-taiga-4`: four trips between days 52 and 58, each from thirst 86 to a drink; `wildlife-taiga-1`: three between days 78 and 82). The 34 deaths are three other things:

| Cause | Seeds | Deaths | Where the rule is |
|---|---|---:|---|
| The brook freezes. From day 85 (winter) no water tile within reach is liquid (`wildlife-taiga-3`, day 86: 0 liquid, 87 frozen water tiles within 32 tiles of a thirsty dwarf), thirst reaches 100 and, `DEHYDRATE_DAYS` later, the dwarves die on days 101 to 103. With the usual brew the same seeds lose nobody. | taiga-1, -2, -3 | 6 + 4 + 13 = 23 | 10 § Drink search, "not frozen"; 04 § Freezing and thawing |
| The search window is measured from the dwarf. A dwarf at the wagon (x 0) with the bank at x 40 finds no water within 32 tiles, sits idle with thirst 100 and drinks only when a job takes it into range; three died at the wagon on days 51 to 58. | temperate_forest-2 | 3 | 10 § Drink search, "within 32 tiles horizontally" |
| Hunger, not thirst. Hearth alert held 68,580 ticks (the harness holds it while an aggressive animal is within 40 tiles of the wagon); civilians do not farm or cook under it, the food ran out (no meal, no plant food, no harvest all year) and hunger sat at 100 from day 48 to the deaths on days 68 to 72. Thirst was served every time, at 86. The usual opening on this seed never sheltered. | taiga-4 | 8 | 10 § Behavior selection step 2 (a sheltering civilian does no work) |

## Decision

1. The leaving threshold is **not** changed. The cause it answers does not occur in the twelve seeds (no trip from a shelter was late), and a shelter more than about 40 tiles from the bank is not measured. A civilian under the alert still leaves for water at the critical threshold.
2. The drink search looks `DRINK_SEARCH_RADIUS` = 64 tiles from the dwarf, not 32. 10 § Drink search and its constants table say so. A dwarf at the wagon now finds a bank 40 tiles away. A bank beyond 64 tiles is not searched for.
3. A frozen brook gives no water; the rule stays and 10 § Drink search says what it means: a fortress needs drink in stock, brew, or a well on unfrozen water for the winter. A dry fortress on a brook in a taiga map dies of thirst on day 101 to 103; the player's answer is a still or a well (balance.md § Drink chain). Drinking from ice is a design change and is not made here.
4. Hunger in a long shelter is the harness's alert policy (a hearth alert held for 57 days) meeting the rule that a sheltering civilian does no work; it is filed apart as [T-399-hearth-alert-starves-the-fortress](T-399-hearth-alert-starves-the-fortress.md).

## Done

- `wildlife-temperate_forest-2` with the dry-north opening no longer loses dwarves at the wagon to a bank beyond 32 tiles; the other deaths are the winter freeze and the long shelter, each named above with the rule that causes it. The annual instrument's hashes do not move (no instrument map has water within 64 tiles and 8 levels of any dwarf), checked before and after.
