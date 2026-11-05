# T-496 — A drunk vial is capped below a circlet's rune

**Source:** T-491 (found while adding the desperate fourth vial) · **Size:** S · **Needs:** — · **Status:** open

## Why

25 § Vials says a vial adds `VIAL_RUNE` "capped at `max`", and § Rune of one's own gives `max = level × RUNE_PER_LEVEL + circlet bonus`. `drinkVial` in `src/systems/magic/cast.ts` caps at `runeMaxMilli(skillLevel(...))`, which leaves out the circlet bonus (`runeGear(...).maxBonus`). A caster in a circlet who drinks near the top of its rune is held at the plain maximum. It never lowers the rune (`Math.max(rune.current, …)`), so nothing is lost that the caster had; it only fills less.

## What to do

- Cap the vial (and the desperate fourth, `SICK_VIAL_PERCENT`) at `runeMaxMilli(level, runeGear(entities, registry, id).maxBonus)`, the same `max` that `magic.rune` reports.
- Test: a Proficient caster in a silver circlet at 52 rune drinks a vial and reaches 57, not 52.

## Done

- The cap is the circlet-aware `max`, with a test. With no runecraft in play nothing moves (only a caster with a circlet and a vial is touched).
