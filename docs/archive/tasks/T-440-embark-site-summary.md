# T-440 — The embark screen says what a site has and lacks

**Closed:** 2026-10-24, in acaf429.

**Source:** the owner, 2026-10-23 (first play session) · **Size:** M · **Needs:** — · **Status:** open

## Why

The owner settled on bare rock without knowing there was no soil or wood.

## Decisions

1. **Has.** The embark (site choice) screen shows a summary of the chosen site, from the same generation inputs the local map will use:
   - surface soil (depth, or "none");
   - trees (density and main species, or "none");
   - shrubs and grazing;
   - water (river, brook, lake, or "none");
   - stone layers and likely ores (from geology);
   - climate (temperature band and its winters);
   - wildlife danger;
   - peril;
   - region traits (volcano and others).
2. **Lacks.** Missing essentials are flagged in the alert colour, each with its consequence and workaround:
   - "No surface soil: farm in a cavern or on mud";
   - "No trees: wood only from the wagon, caravans and cavern fungus";
   - "No water on the surface".
3. Where a value is only estimated before local generation, the screen says so (for example "likely ores"). Nothing shown may be false.
4. Write the spec first: the embark screen doc and 02.

## Done

- A unit test that the summary matches the generated local map's actual soil, trees and water, over a handful of seeds and biomes, including alpine and desert.
- An e2e screenshot of an alpine site's warnings.
- The gates pass.
