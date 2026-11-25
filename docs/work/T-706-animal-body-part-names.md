# T-706 — A wolf has arms: the creature view names every body by the dwarf's parts

**Source:** playtest 2026-11-24 ([report](../../reports/data/2026-11-24-playtest.md), finding 8) · **Size:** S · **Needs:** — · **Status:** open

## Why

The log's "4 wolves have come to the valley" with `[v]` opened a wolf (`reports/data/2026-11-24-playtest/42-wolf-view.png`): its health lists `head`, `torso`, `left arm`, `right arm`, `left leg`, `right leg`. `creatures.md` § Body plans names a quadruped's arm slots "left foreleg" and "right foreleg", a bird's "left wing" and "right wing", a crawler's "front legs" and "back legs", a serpent's "left foreclaw" and its tail, a fish's tail, and gives a fish no arms and the Hollow Maw only a "maw" (`src/content/bodyPlans.json` carries the names). Combat reads the plan's names (`combat/melee.ts`); the creature view (`look.ts`, a fixed `partNames` list) and `health.summaryText` (`PART_NAMES` in `src/systems/health/reader.ts`, "bleeding from the left arm") use the humanoid names for every creature. A chicken has arms, a fish has arms of 0 hp, a cow is "bleeding from the left arm".

The wolf's view also reads `Activity:` with nothing after it.

## What to do

Decisions:

- The creature view's health parts and `summaryText` take each part's name from the creature's body plan (`bodyPlans` row of its species), falling back to the slot name only for a plan with no name for that slot. A slot whose part has hit weight 0 (a fish's arms, the maw's limbs) is not listed.
- A slot that shares its name with another ("front legs" twice, "tail" twice) is listed once per slot as now, with its own hp; `summaryText` names it as the plan does.
- A creature with no activity text says what its behaviour is (`wild`'s `Activity: grazing`, `sleeping`, `wandering`, as the Units All tab's "Wild, grazing" does), never an empty `Activity:`.

Spec: `ui-screens/fortress-screen.md` § Inspection panel (the creature view's health lines), 17 § Interfaces (`summaryText`'s part names).

## Done

- [ ] Tests: a wolf's view lists "left foreleg" and "right foreleg"; a chicken's "left wing"; a fish has no arm rows; a cow wounded in a foreleg is "bleeding from the left foreleg"; a wild animal's view has an activity.
- [ ] UI and text only: no world hash moves.
