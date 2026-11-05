# T-NEW — A turned shade that stays hidden for a while

**Source:** T-491 (the turned shade hides, flavour report item 14) · **Size:** S · **Needs:** the owner's choice below · **Status:** open

## Why

T-491 made a deep shade that comes through turned arrive stealthed, like a hollow stalker, until it is spotted. But a Call puts the shade on a tile beside its caster, and every dwarf spots a hidden creature within `SPOT_RADIUS` (6) with a line to it. 18's spotting runs every tick, so the caster sees the shade at its first look. In play the shade is hidden for about one tick: the rule is real and tested (`t491-flavour-pass.test.ts`, "a shade that turns beside its caster is seen by the caster at once"), but the "not seen at once" story the report wanted almost never happens. It does happen when no dwarf has a line to the shade, which a caster beside it always has.

This is a fun feature (`docs/fun-features.md`), so it is worth making it show, if the owner wants it.

## Options (owner's call)

1. **Leave it.** The shade hides only from dwarves who are not near; a squad running up from across the hall does not see it until it is within 6. Cost: none.
2. **Its caster does not spot it.** The dwarf whose call it came through is looking at the fight, not behind it. Keep the caster's id on the turned shade (an optional `Summoned.turnedFrom`, saved) and skip that one target in `checkSpotted` (`threats/ai.ts`). Other dwarves still spot it at 6 tiles. Small.
3. **It comes through a few tiles off.** The turned shade stands on a free tile `SPOT_RADIUS + 1` from the caster instead of beside it, out of sight where the map allows. It moves where the shade appears; a larger change to `answerCall` (`magic/summon.ts`).

## Done

- The chosen option is a rule in 25 § Summons, Turning, and 18 § The Deep, with a test; the fun-features row says what happens.
- With no runecraft in play nothing moves.
