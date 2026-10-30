# Surface variety: six biomes before and after (T-436)

**Examined:** the first screen of a new fortress in six biomes, at commit 2fd6fca (before) and with T-436 (after). **How:** a Playwright script started a Vite dev server of the worktree on its own port, generated the world `t436-a` through the New world screen, moved the cursor to the first region of each biome with no trait and no river, embarked with the Balanced preset and took a 1280 × 720 screenshot of the fortress screen and a 640 × 360 crop of its centre. The screenshots are not in git (`reports/screenshots/` is ignored); they were saved as `reports/screenshots/t436/before-<biome>.png` and `after-<biome>.png` in the T-436 worktree.

| Biome | Region | Before | After |
|---|---|---|---|
| forest | 543 | one level; a uniform `"` field with brown and white trees | swells one level up and down drawn as tinted plateaus and dimmed hollows, ramps along each step, grass in three glyphs and patchy greens, flowers, leaf-green oaks, shaded trees |
| grassland | 735 | one level of `"` | the same relief, a meadow with flowers in four colours, outcrops of bare rock |
| hills | 670 | one level, trees on `"` | swells and a ridge across the view, outcrops, boulders |
| mountain | 984 | one level of `"` with pines | plateaus and hollows, crags with scree rings, blue and white flowers |
| alpine | 1048 | a level field of `.` | snowfields, lichen-tinted rock plateaus, crags ringed with scree, boulders, dimmed lower ground |
| desert | 540 | one level of `"` | dunes: the wagon in a hollow under dry-grass rises, outcrops |

Before, every one of the six was relief 0, which generated a level map: the relief scale gave relief 1 only to a neighbour difference of 64 elevation or more, which few regions have. After, every region with any neighbour difference has relief 1 or more.
