# Player Experience

**Owner:** vision · **Depends on:** [vision.md](vision.md)

This document describes the game as the player lives it, from the main menu to the end of a fortress. It is the reference for what every system must add up to. Where it names a number, that number is pinned in [`../01-architecture/constants.md`](../01-architecture/constants.md) or in the relevant system document; it is repeated here only for readability.

## Screens, in the order the player meets them

1. **Main menu** — New world, Continue, Load, Legends (past fortresses), Settings, About.
2. **World generation** — seed, world size (small / standard / large), and a live preview that fills in as generation runs. Takes about two seconds.
3. **World map** — the whole world as a colored ASCII map. The cursor shows each region's biome, elevation, rivers, wealth, peril, temper, special traits, and nearest neighbors (Mountainhome, Hillfolk, Wildwood, Gloam). A filter panel highlights regions matching chosen criteria. This is the difficulty selection.
4. **Embark** — a budget in marks, seven dwarves with editable names and skill points, a supply list with prices, animals, and presets (Balanced, Miner's Guild, Farmstead, Warband). The fortress is named here.
5. **Fortress** — the main game screen. The map fills the window; a status bar runs along the bottom; a sidebar opens on the right when a panel is active. Everything else in this document happens here.
6. **Legend** — shown when a fortress ends: years survived, peak population, deepest level, wealth, notable events, cause of end.

## The first ten minutes

The wagon stands at the map edge on the surface. Seven dwarves and their animals unload. The player sees a hillside with trees, a brook, a rock face. The map is at the surface z-level; the sky above is not shown, the soil below shows dimly through open ground.

The tutorial is not a separate mode. Five *hints* appear as notes in the log, once each, triggered by state: "Designate a place to dig (D)", "Dwarves need drink: build a still", "Set up a stockpile so hauled goods have somewhere to go", "Winter is in 60 days; farms need soil or mud", "A hearth makes a hall a home". Hints can be dismissed forever in settings.

Within ten minutes a player who knows the genre has: designated an entrance tunnel into the rock face, placed a stockpile for food and a stockpile for everything else, ordered a carpenter's workshop and a still, and set two dwarves to dig while the others haul.

## The first hour

The entrance is dug. A staircase goes down two levels into sandstone. The first bedrooms are 2×3 cells with a bed each. A dining hall is cut, and a hearth is placed in its center; the log says "The hearth is lit. This is a deepholm now." Every dwarf gains a warm thought.

A farm plot is placed on soil or on the mud left by the brook's spring flood. Dimcaps are planted in the dark; barley on the surface. The still turns dimcaps into ale. The kitchen turns turnips and meat into meals. Miners hit a vein of hematite in the second level; the log names the finder.

A wild boar wanders into the cabbage. The hunter, with the embark crossbow, brings it down; the butcher's workshop yields meat, hide and bones; the tannery turns the hide into leather. Autumn: the Wildwood caravan arrives at the trade depot and the player sells stone crafts for seeds and a bow. First winter: the brook freezes, the surface farm sleeps, and the fortress lives on ale and mushrooms. The dwarves are Fine to Content.

## Year one to year two

In spring the Mountainhome caravan brings picks, an anvil and news. The first immigrant wave arrives at the end of spring: six dwarves, two with children, because the hall's average mood crossed the threshold. The population is now thirteen and the dining hall is too small.

The player digs deeper. Granite and marble. Gems in clusters. A vein of malachite. The first cavern is breached at around level 20: a fungal forest, a cave lake, glowing beetles, and, within a few days, a cave crawler that kills a war dog. The player walls the breach with a door and a lever-operated hatch.

A smelter and a forge go up next to a stockpile of ore and charcoal. Bronze first, then iron. Two dwarves are assigned to a squad under the Warden with iron mail and axes. They spar at the barracks. A Gloam thief is spotted stealing a barrel; the alert flashes; the squad chases it off.

Summer: the Hillfolk caravan. Autumn: the first real raid is announced a day ahead. "Gloam scouts have been seen at the eastern edge." The player pulls the lever and raises the drawbridge. Eight goblins cross the moat's edge, find no way in, take bolts from the fortifications, and leave with two dead. The dwarves gain proud thoughts. The player has learned that the map is a weapon.

## Years three and four

The fortress is thirty to fifty dwarves. Work orders keep ten meals, twenty drinks and five bars of iron in stock. Rooms have been smoothed and engraved; the Thane has a fine bedroom; the hearth hall is Grand. A hospital with beds and a chest of thread and splints has already saved a miner who fell into a channel.

The second cavern brings trolls and magma pools. The player builds a magma forge and stops burning charcoal. Steel arrives with flux and coal. A trap corridor at the entrance with stone-fall traps and a cage trap catches a trollkin alive; a trainer tames a cave crawler for the kennels.

Peril decides how hard this is. In a Peril 1 region the raids stay small and thieves are the main nuisance. In a Peril 4 region, sieges with trollkin arrive every autumn and the caverns have blind stalkers that ambush in the dark.

## The late game and the Deep

At the bottom of the third cavern lies the Sea of Fire. Beside it, in the rock, veins of deepsilver glint pale blue. Mining the first vein triggers "The Deep stirs." Each further vein mined raises a pressure that is shown to the player as a gauge. When it crosses thresholds, the Hollow-born come up through freshly cut rock: first a few crawlers of a new kind, then stalkers, then a magma wyrm.

Deepsilver armor and axes are the reward. A fortress that never mines deepsilver never meets the Hollow. This is the player's choice, and the game tells them so before the first vein is cut.

## Endings

A fortress ends when every dwarf is dead ("The hall falls silent") or when the player retires it. Either way the Legend screen is shown and the fortress is added to the Legends list in the main menu. There is no victory screen, but there are milestones recorded on the legend: first hearth, first metal, first cavern, fifty dwarves, magma forge, first deepsilver, a Hollow-born slain, a decade survived.

## Difficulty is the map

There are no difficulty sliders. The world map's four visible axes are the difficulty setting:

- **Wealth** (0–4): how rich the rock is in ore and gems, and whether there is a volcano or shallow magma.
- **Peril** (0–4): how near the Gloam are, how soon and how large raids come, how dangerous the caverns are.
- **Temper** (0–4): how harsh the weather is: long winters, storms, heat, short growing seasons.
- **Biome**: what grows, what lives there, what the surface is made of.

Special traits add texture: *Wyrm Roost* (a wyrm sleeps in cavern three), *Fungal Depths* (rich cave crops, more cave beasts), *Glasslands* (volcanic; obsidian and shallow magma, few trees), *Frostmarrow* (long winters, yaks and snow leopards), *Old Battlefield* (buried weapons and armor; the restless dead in autumn), *Serene Vale* (peril 0, rich soil, a gentle start).

## Legibility and feedback

- The **log** shows every announcement. Notes are gray, alerts are yellow, dangers are red and pause the game.
- The **status bar** shows date and season, weather, population, mood summary (the hearth glyph colored by average mood), drink and food counts, current z-level, speed, and any active alert.
- Any dwarf, animal, item, building or tile can be inspected with a click or the look cursor. The inspection panel shows every number the simulation uses for that thing.
- The **jobs panel** shows every open job, who has claimed it, and why unclaimed jobs are waiting (no worker with the labor, unreachable, missing materials).
- The **mood panel** lists every dwarf's mood tier and their three strongest current thoughts.

## Comfort

- Pause at any time; the game starts paused after loading.
- Three speeds plus pause. Designations, zones and building placements can be undone before work begins.
- Autosave every season and a rolling set of the last four seasonal snapshots. Loading a snapshot is an explicit choice on the Load screen.
- Every action has a keyboard shortcut and a mouse path. Menus show their shortcuts.
- Nothing in the world requires reaction speed. Danger pauses the game.
