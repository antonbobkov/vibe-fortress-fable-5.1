# T-NEW — A fire kills most of a taiga fortress on a map with a brook at the wagon

**Source:** T-360, [the brook measurement](../../reports/audits/2026-10-18-brook-drinking-under-wildlife.md) § The deaths that are not about water, [data](../../reports/data/2026-10-18-brook-drinking.json) · **Size:** M · **Needs:** — · **Status:** open

## Why

With a brook entering at the west edge (the wagon's edge), two taiga seeds lose most of the fortress to `burnt` in two days, in both the dry and the usual opening:

| Seed | Variant | Deaths by `burnt` | Days | Others that burn |
|---|---|---:|---|---|
| `wildlife-taiga-3` | `control-west` | 7 dwarves (of 13) | 39 to 41 | a cat and a dog |
| `wildlife-taiga-3` | `dry-west` | 7 | 40 to 41 | not recorded |
| `wildlife-taiga-2` | `control-west` / `dry-west` | 4 / 6 | 54 to 56 | — |

The twelve rows of the annual instrument on the same seeds without a river have no death by fire, and neither has `control-north`. 17 § Injuries gives a `burn` wound to a creature on a burning tile (`BurnDamage`) and to anything struck by lightning; 05 and 06 own fire and lightning. A fortress of 13 that loses seven in two days to fire is either a wildfire the rules let reach the hall, or a fault.

## What to do

1. Diagnosis first: play `wildlife-taiga-3` with `playWildlifeYear(seed, biome, { brook: 'west' })` (the fixture option of T-360) to day 38, then with a probe that logs every tick from there: `BurnDamage` and `LightningStrike` events with the tile, the burning tiles and what is on them, and the weather.
2. Name the cause against 05 (fire, fuel, spread) and 06 (storms, lightning): a lightning strike on dry grass beside the wagon that spreads over the bank and the hall's approach, a hearth or forge fire that escapes onto a wooden floor, or a spread rule that burns without a fuel limit.
3. A game fault: a failing stepped test first, the fix, and the rule in 05 (for example, what may burn and how far a fire spreads over wet ground beside a brook). A rule working as written: say so in this file, and decide whether dwarves flee a burning tile (10 § Behavior selection step 1 names only hostile creatures).

## Done

- `wildlife-taiga-3` and `wildlife-taiga-2` with the west brook play past days 41 and 56 without a mass death by fire, or this file records the rule that causes it and the spec says what a player does about it. The annual instrument's hashes do not move (the fix touches only a map with a river).
