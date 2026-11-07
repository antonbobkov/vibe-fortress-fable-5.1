# T-NEW — The plot panel says when a crop sown now cannot ripen before winter, and the log says when frost kills crops

**Source:** T-512 ([work file](T-512-three-years-sows-crops-too-late.md)): the three-year script sowed crops that could not ripen, and the frost killed 101 and 165 of them on `three-years-p0-3`, seed and all. A player walks into the same trap and is not warned. · **Size:** S · **Needs:** — · **Status:** open

## Why

A surface crop needs four stages of `stageDays` and grows only in its `seasons`, at the season's growth percent (`SEASON_GROWTH_PERCENT`: spring 100, summer 120, autumn 80; overcast 90 of that). If it is sown with too few days left, it goes dormant and winter's frost kills it. Each harvest returns one seed, so the seed in the ground dies with it (07 § Growth, § Seeds). Nothing in the game tells the player:

- The plot panel (`drawFarmSettings`, `src/ui/panels/zones.ts`) shows each season's crop and its seed count, and nothing about how long the crop takes or when it stops growing.
- `Shift+A` fills every season the crop can grow in, so a strawberry plot gets summer strawberries as well. The farmers then replant after every summer harvest, and no strawberry sown in summer can ripen: it needs 28 days at 100%, and summer has fewer than 28 days at 120% once sowing time and an overcast day are allowed for.
- In a temperate fortress, no surface crop sown in autumn ripens at all: at 80%, a 20-day turnip needs 25 days, and after the sowing fewer are left. An autumn crop set in the panel is a crop lost every year.
- `CropDied { reason: frost }` is not announced, so a field of crops vanishes with no line in the log. The player sees only that the seed is gone in spring (`PlotNeedsSeeds`).

The trade-off can stay: a player may still choose to sow late. It should be readable, like the panel's "Too cold to grow" note.

## What to do

- **Plot panel note**, under the crop counts and laid out like `ui.zone.farm_cold`: when the current season's crop cannot ripen before its growing seasons end, with the days left counted at the season's growth percent, say so. For example: "Sown now, strawberry cannot ripen before its seasons end: it needs 28 days, 9 are left." Draw it in the `bad` colour. Use the same reckoning as the script's `ripensInTime` (`test/scenarios/three_years_economy.ts`). A shared helper in `src/systems/plants/growth.ts` that the panel and the script both read would keep them the same. Show it only on surface plots.
- **Frost notice**: announce `CropDied` with `reason: frost` once per plot per frost, merged, for example "Frost killed 12 turnips on Farm plot 3." Write it as a note, with the plot's name the way `PlotNeedsSeeds` names it (`src/ui/announcements.ts`). Add the string to `src/ui/strings.ts` and to 07 § Player-facing behavior and § Registrations.
- A UI test of the note at the late-summer and early-autumn edges, and an announcement test of the frost line.

## Done

- A player who sets a crop that cannot ripen is told so in the panel; a frost that kills crops is in the log; the tests pass.
