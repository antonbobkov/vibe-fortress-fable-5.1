# T-NEW — The world map shows where the cursor is and what its words mean

**Source:** [T-605's audit](../../reports/audits/2026-11-18-t605-first-hour-ux.md), findings 17 and 18 · **Size:** S · **Needs:** — · **Status:** open

## Why

The world map's cursor inverts its cell. On a dark forest that is a dark-green block with a black `♣`, on a snowy peak a white block among white peaks: the player cannot find which region the panel describes. The panel also uses words it never explains or that seem to contradict each other: "Temper ▓▓▓░░ 3" has no line (Peril has one); a site that "has … rock salt" also "lacks: salt"; the filter's "1396 regions match" counts oceans, where no one can embark; and the main menu's About is grey and does nothing.

## Decisions

- **The cursor has its own colours**: a bright yellow background with the region's glyph in black, whatever the biome, blinking with the designation blink unless Reduced motion is on (then steady).
- **Temper gets a dim line** under its bar, as Peril has: "Temper is the climate's harshness: cold, storms and heat."
- **The salt good is named apart from rock salt** ("sea salt" for the good the site lacks), in the site lists of 02 § What a site has and lacks.
- **The filter counts embarkable regions** ("312 sites match").
- **About** is hidden until it has a screen.

## Spec sections

`04-implementation/ui-screens/menus-and-world.md` § World map and § Main menu, `02-systems/02-embark-and-loadout.md` § What a site has and lacks, `03-content/glyphs-and-colors.md` (the cursor colour).

## Done

Unit tests: the cursor cell's colours on a forest and a glacier region differ from every biome's; the Temper line; the filter count excludes oceans. `generate-and-embark` and `embark-find` e2e pass.
