# T-612 — The legend and the hover line explain the surface

**Source:** [T-605's audit](../../reports/audits/2026-11-18-t605-first-hour-ux.md), finding 9 · **Size:** S · **Needs:** — · **Status:** open

## Why

The first screen of a forest site is covered in `↑` `♠` `♣`, `"` `'` `` ` `` and coloured `*`. Help's Legend lists `♣ tree`, `" grass, moss, shrub` and `* web`. So a new player cannot tell a birch (`↑`) or a yew (`♠`) for a tree, does not know `'` and `` ` `` are grass, and reads the flowers as spider webs. The hover line and Look call a grass tile "Clay floor", and say nothing of a flower, so grass, which pastures and grazing need, is never named.

## Decisions

- **Legend › Terrain** gains, generated from content: one row per tree glyph with the species that use it ("↑ birch, aspen", "♠ yew, pine, spruce"), a row "' ` grass (outdoors)" beside the `"` row, and a row "* flowers on grass (outdoors)" before "* web (white)". The glyph is drawn in a typical colour of each.
- **The hover line and Look's terrain line name the grass**: "Clay floor, grass" for a floor with grass, "Loam floor, flowers" for a flower tile (03's tile inspection already knows the grass; the flower is a drawing of grass, 23 § Compositor).
- No glyph changes.

## Spec sections

`04-implementation/ui-screens/panels.md` § Help (Legend), `02-systems/24-ui-and-input.md` § Inspection (the hover summary), `03-content/glyphs-and-colors.md` § Terrain if a note is needed.

## Done

A unit test finds each tree glyph of `plants.json` in the Legend and the grass and flower rows; a unit test hovers a grass tile and reads "grass". `t429-help-sections` passes, updated for the new rows.
