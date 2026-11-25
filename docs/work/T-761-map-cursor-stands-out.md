# T-761 — The keyboard's map cursor is an inverted cell, and on grass it cannot be found

**Source:** playtest 2026-11-25 (newcomer) ([report](../../reports/data/2026-11-25-playtest-5.md), finding 7) · **Size:** S · **Needs:** — · **Status:** open

## Why

Played with the keyboard only, every tool works at "the map cursor" (24 § Input model: `Enter` sets a corner, places a building, picks a zone). The cursor is drawn as an inverted cell (23 § Compositor, step 10: `fg`/`bg` swapped). On the surface of a wooded or grassy site, a grass or tree glyph is green on black, so the inverted cell is black on green. Among dozens of green grass and tree glyphs it is very hard to find (`44-cursor-on-grass.png`, a crop of `43a.png`). I opened Designate with `d`, pressed `Enter` and moved with the arrows. I could not find the cursor before the box drew, and my first `Enter` landed on grass that could not be dug ("No tile here can be dug: dig marks rock walls and boulders."). The world map already solved this: its cursor is the region's glyph in black on `world_cursor`, a bright yellow, blinking with the designation blink (`ui-screens/menus-and-world.md` § World map).

## What to do

Decisions:

- **The fortress map cursor is drawn as the world map's is**: the tile's glyph in `black` on `world_cursor`, blinking with the designation blink (23 § Animation) and steady when Reduced motion is on. It replaces the inverted cell for every use of the map cursor (tools, picks, Look's tile, creature and item views).
- **The box being drawn keeps its own colours.** Only the cursor's own cell changes.
- When the colourblind palette is on, `world_cursor` maps as it does on the world map.

Spec: 23 § Compositor (step 10), 24 § Input model (the map cursor's look), `03-content/glyphs-and-colors.md` if it lists the cursor's colours.

## Done

- [ ] Tests (`describe` with the task id): with a tool armed, the cursor cell's `bg` is `world_cursor` and its `fg` black, on grass, rock and open air. Between blink phases it alternates as the designations do, and with Reduced motion it is steady. Look's creature view puts the same cell on the creature.
- [ ] Render goldens that show a cursor move. Update them with `npm run golden:update -- <name>` in the same commit, with a `golden:` paragraph. No world hash moves.
