# T-436 — Surface visual variety: relief, trees, shrubs, grass, boulders

**Source:** the owner, 2026-10-23 (first play session) · **Size:** L · **Needs:** — · **Status:** open

## Why

The owner's first site looked barren and flat. Even a rocky biome should read as a landscape.

## Decisions

1. **Relief.** Local maps show visible slopes and level changes: ramps, ridges, hollows and scattered outcrops scaled by the region's relief (0–3). A relief-0 site still gets gentle undulation. Mountain and alpine sites get crags and scree.
2. **Cover by biome.** Trees, shrubs, grass and flowers by biome, with several glyph and colour variants per species, so a meadow is not one repeated glyph. Bare rock gets lichen and moss tints, loose stones and boulders (`boulder` tiles, diggable as 03 already allows), and snow on alpine ground.
3. **Boulders.** Scatter surface boulders by biome and geology, more on mountain, alpine and badlands.
4. **Gameplay is unchanged in kind.** Alpine and glasslands stay soil-poor and treeless (that is their challenge, and T-440 tells the player). The variety is visual and geological, not new resources.
5. This is a world-generation change, so every world hash moves. Re-record the goldens, and re-run the annual instrument and the twenty-seed three_years_seeds by the T-308 rule. Do it after T-427 lands.

## Decisions taken in the work

6. **Every generated region with any neighbour difference has relief 1 or more; relief 0 is nearly level.** `relief = 0` only when every neighbour shares the region's elevation, otherwise `1 + floor(maxDiff / 96)` up to 3. Relief 1 is the gentle undulation decision 1 asks for (swells of a level up and down, ridges, outcrops); nearly every real region had relief 0 before, so this gives the owner's sites relief. Relief 0 keeps decision 1's gentle undulation in a sparse form: six low rises and dips of one level per 96 × 96 map, at least 52 tiles in from the arrival edge and clear of water, laid on the finished surface so the rock, ores and caverns below stay those of level ground, so the wagon site and arrival edge stay level; it has no ridge, outcrop, crag or boulder. Full undulation on relief 0 broke the three-year fortress, which builds at a fixed level near its arrival edge: its setup failed on 13 of 20 seeds. The scripted `regionSpec` regions of the long fixtures are relief 0; T-NEW long-fixtures-on-relief moves the fixtures onto relief.
7. **Every one-level step of the surface is a ramp**, so undulating ground can be walked (before, any level change split the surface into separate plateaus). Two levels or more stay a cliff.
8. **Higher ground is drawn as the ground it is.** While the level in view has open sky, a wall under an outdoor surface 1–3 levels up draws that surface on a background tinted toward the ground's tone, more for each level; lower ground stays dimmed. Without this a site in a hollow read as a field of `▒`.
9. **Crags also on badlands**; oak and ash draw in leaf colours; desert and badlands grass draws dry; flowers `*`, pebbles `·` and stones `∙`. The sunken hall now checks that its footprint fits under the ground (a crag top had put it in the air).

## Done

- Screenshots of six biomes (forest, grassland, hills, mountain, alpine, desert) before and after in a dated report. Every surface shows relief and mixed cover.
- The gates, the instrument and the twenty seeds pass.
