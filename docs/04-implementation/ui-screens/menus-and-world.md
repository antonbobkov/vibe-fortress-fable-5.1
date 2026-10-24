# Wireframes: Intro, Main Menu, World Generation, World Map, Settings, Load, Legend

**Owner:** `ui/screens/*` · **Depends on:** [`../../02-systems/24-ui-and-input.md`](../../02-systems/24-ui-and-input.md), [`../../02-systems/01-world-generation.md`](../../02-systems/01-world-generation.md)

## Intro

The intro comes in two styles, chosen by the Intro style setting: `deep` (the default) and `hall`. Both are played by the same screen, from content, and both end the same way.

The hall intro:

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│   ████▄ █████ █████ ████▄ █   █ ▄███▄ █     █▄ ▄█              │
│   █   █ █     █     █   █ █   █ █   █ █     █ ▀ █              │
│   █   █ ████  ████  ████▀ █████ █   █ █     █   █              │
│   █   █ █     █     █     █   █ █   █ █     █   █              │
│   ████▀ █████ █████ █     █   █ ▀███▀ █████ █   █              │
│                        ▲                                       │
│        ▲              ▲▒▲            ▲                         │
│▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│
│                                                                │
│                    a hall beneath the world                    │
│                                                                │
│                    Any key or click to skip                    │
└────────────────────────────────────────────────────────────────┘
```

The hall intro is a short animated scene, about 45 seconds, drawn on the text grid in the game's glyphs and palette: seven dwarves leave a hold with no room left in it, walk out past their wagon, a rabbit that bolts and a deer that does not, strike the first pick into an empty mountain with a spark, and `DEEPHOLM` rises out of the rock column by column. Its scenes, art, cues, captions and colours are content (`03-content/intro.md`); the screen only plays them. The stage is centred in the window with the caption on the row under it, and its ground, rock and sky run on to the window's edges, so it fits any window size. The last row says "Any key or click to skip" in the dim colour.

The deep intro:

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│████████████████████████████████████████████████████████████████│
│▒▒▒▒▒▒▒▒▒▒░░░░          ▄▄▓▓▓▓▓▓▄▄            ░░░░▒▒▒▒▒▒▒▒▒▒▒▒│
│▒▒▒▒▒▒▒▒▒░░        ▄▓▓██████████████▓▓▄          ░░▒▒▒▒▒▒▒▒▒▒▒│
│▒▒▒▒▒▒▒▒░░     ▄▓████▓▓▒▒░░████░░▒▒▓▓████▓▄       ░░▒▒▒▒▒▒▒▒▒▒│
│▒▒▒▒▒▒▒▒░░     ▀▓████▓▓▒▒░░████░░▒▒▓▓████▓▀       ░░▒▒▒▒▒▒▒▒▒▒│
│▒▒▒▒▒▒▒▒▒░░        ▀▓▓██████████████▓▓▀          ░░▒▒▒▒▒▒▒▒▒▒▒│
│▒▒▒▒▒▒▒▒▒▒░░░░          ▀▀▓▓▓▓▓▓▀▀            ░░░░▒▒▒▒▒▒▒▒▒▒▒▒│
│████████████████████████████████████████████████████████████████│
│                                                                │
│                    The deep blinked first.                     │
│                                                                │
│                    Any key or click to skip                    │
└────────────────────────────────────────────────────────────────┘
```

The deep intro is a film of about 45 seconds in big block art: every art pixel is a cell, or a square of cells, filled with a block or shade glyph in two colours of its own sixteen-colour palette, with checker dither, scanline hatching and speckle for texture. It cuts straight from scene to scene: a dwarf goes down a shaft on a rope, his lantern swinging, and stops at the bottom for a drink; an eye the size of the rock condenses out of static, opens, looks about and blinks; the wall behind him cracks and a torrent of glowing water bursts out all round him, and he finishes his drink; his silhouette rises against the water's light, raises a pick and strikes; and the rock shatters into `DEEPHOLM`. Its palette, inks, scenes, layers, camera keys, effects (palette cycling, pans with parallax, cuts, shakes, flashes, dithered fades and static) and captions are content (`03-content/deep-intro.md`); the screen only plays them. The pictures fill a letterboxed strip, drawn at the largest whole scale that fits the window and centred, with black above and below it and stone pillars at its sides when the window is wider. The art is always drawn at that one scale: nothing zooms, and a close shot, such as his face, is an image of its own reached by a cut. Its captions are few, on the row under the strip, and the last row is the skip line.

It plays at launch, before the main menu, when the Intro at launch setting is `always`, or `first time` and it has not yet played at a launch (whether it has is saved with the settings and kept by Reset to defaults); `off` never plays it at launch. The main menu's `[i] Intro` plays it again whatever the setting. Both play the style the Intro style setting names. Any key skips it (a fixed key; a modifier pressed alone does not count), and so does a click; when it ends or is skipped the main menu opens. Each style has a short piece of music of its own (`02-systems/24-ui-and-input.md` § Music), heard when the intro is opened from the main menu. Captions are the strings `intro.<id>` (hall) and `deep_intro.<id>` (deep), the skip line `ui.intro.skip`. A test build skips it at launch unless the page is opened with `?intro=on`, which leaves the decision to the setting.

## Main menu

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│                    D E E P H O L M                             │
│                 a hall beneath the world                       │
│                                                                │
│                  ▶ [n] New world                               │
│                    [t] Tutorial                                │
│                    [c] Continue   (Emberhall · Year 2)         │
│                    [l] Load                                    │
│                    [g] Legends                                 │
│                    [o] Settings                                │
│                    [a] About                                   │
│                    [i] Intro                                   │
│   ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒≈≈≈≈▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒   │
│   (decorative slice of the last save's surface, or a          │
│    generated demo slice when no save exists)                   │
└────────────────────────────────────────────────────────────────┘
```

`Continue` loads the newest save of any kind; hidden when none exists. `Tutorial` starts the tutorial (§ Tutorial). The first time `New world` is chosen, before any tutorial has been offered, it asks first with the `c_tutorial` confirmation ("Is this your first fortress? The tutorial sets up a friendly site and walks you through the basics, a step at a time. Play it?"): `Yes` starts the tutorial, `No` (the default) opens world generation. That it was offered is saved with the settings, as whether the intro has played is, and Reset to defaults keeps it. A test build makes no offer unless the page is opened with `?tutorial=offer`.

## Tutorial

The tutorial walks a new player through the basics of a fortress, one step at a time, over the ordinary fortress screen of an ordinary game.

**The site.** It generates the standard-size world of the seed `TUTORIAL_WORLD_SEED` and embarks on one of its regions with the `balanced` preset, as `Embark` would; the fortress is a normal fortress, saved and loaded like any other. The region is the one that ranks first by, in turn: the fewest missing essentials of its site summary (soil, trees, water: `02-systems/02-embark-and-loadout.md` § Site summary), the lowest peril, a river or brook, the `temperate_forest` biome, the fewest traits, a temperate climate, and the lowest id. Oceans and other biomes no one can embark on are not ranked. The rule, not a region id, is fixed, so the tutorial keeps a friendly site when world generation changes.

**The box.** While the tutorial runs, a box is drawn over the top left corner of the map view, `TUTORIAL_BOX_COLS` wide (narrower when the map view is): its title names the step and the count, the step's text follows, wrapped, and its last row holds two buttons.

```
┌─ Tutorial · step 3 of 11 ────────────────┐
│ Open Designate with [d]: Dig is chosen.  │
│ Go down a level with [<] into the rock,  │
│ click one corner of a box, then the      │
│ opposite corner (or Enter twice). The    │
│ marked tiles blink while the work waits  │
│ for a miner.                             │
│ [F1] skip step  [Shift+F1] end tutorial  │
└──────────────────────────────────────────┘
```

Every key a step's text or a button names is the key its binding has now (24 § Settings): the text is read as a hint's is, in the global, panel-letter, map and list contexts and then the step's panel, and a panel letter in it puts that panel's keys first for the keys after it (`[z]`, then `[S-s]`), so a rebound key shows as rebound. `F1` (Global, "skip the tutorial step") goes on to the next step, and `Shift+F1` ("end the tutorial") ends the tutorial at once; a click on a button does the same. A click elsewhere on the box does nothing, and the map under it is reached by panning. The box is drawn only while the fortress screen is on top; a screen or dialog over the fortress hides it, and the tutorial goes on.

**The steps.** The steps are content (`03-content/ui-keymap-and-screens.md` § Tutorial): each row names its text (the string `tutorial.<id>`), its highlight and its check. A step waits for the player: it is done when its check holds, and the next step then begins. The checks are a fixed set, each read from the simulation's readers or the presentation state; a check that compares against the step's start takes that start when the step begins, and a check with two parts holds when each part has held at some time during the step:

| Check | Done when |
|---|---|
| `view_moved` | the camera has moved (or the whole map fits the view) and the level has changed, since the step began |
| `looked` | the look panel has shown a tile with no dwarf of the fortress on it, and one with a dwarf of the fortress |
| `dig_designated` | a tile is designated for digging |
| `stairs_designated` | a tile is designated for down stairs or up/down stairs, or more tiles are down or up/down stairs than when the step began |
| `stockpile_made` | a stockpile zone exists |
| `workshop_placed` | a workshop exists, planned, under construction or built |
| `order_queued` | a work order exists, at a workshop or for the fortress |
| `farm_plot_made` | a farm plot zone exists |
| `labors_changed` | any dwarf's labors differ from what they were when the step began |
| `paused_and_sped` | the game has run at 2× or 4×, and has been paused while it ran, since the step began |
| `saved` | a manual or quick save of the fortress has been written since the step began |

The checks are made after every key and click, after a save is written, and otherwise every `TUTORIAL_CHECK_MS`. A check never acts: the tutorial changes no simulation rule, gives no command and draws on no random stream, so a fortress played with it is the fortress played without it.

**Highlights.** A step's highlight draws over the UI in the key colour, without any glyph changed: a panel id highlights that panel's title row while the panel is open, and otherwise its entry in the hotkey strip of status row 2; `z`, `speed` and `menu` highlight the level, the speed and the `[Esc] menu` fields of status row 1. A highlight that is not on screen (a strip entry a narrow window drops) is not drawn. Highlights never block input: they take no click and no key.

**The end.** After the last step, the box says `ui.tutorial.done` ("That is the tutorial. The fortress is yours: keep digging, feed and house your dwarves, and [?] lists every key.") with one button, `[F1] close`. The tutorial ends when it is closed or ended, and when the fortress is left: a load, a new game or the main menu. It is presentation state and is not saved: a saved tutorial fortress loads as a plain fortress.

Strings: `ui.menu.tutorial` "Tutorial", `ui.busy.tutorial` "Making the tutorial world...", `ui.tutorial.title` "Tutorial · step {n} of {total}", `ui.tutorial.done_title` "Tutorial · done", `ui.tutorial.skip` "[F1] skip step", `ui.tutorial.end` "[Shift+F1] end tutorial", `ui.tutorial.close` "[F1] close", `ui.tutorial.done`.

## World generation

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ New world                                                                    │
│ Seed  [ coldmere-4471________ ]  [r] random                                  │
│ Size  ( ) small 32   (•) standard 64   ( ) large 96                          │
│ [g] Generate                                                                 │
│ ┌──────────────────────────────────────────┐  Stage: names ▓▓▓▓▓▓▓▓▓▓ 100%    │
│ │≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈│                                  │
│ │≈≈≈≈""""♣♣♣∩∩▲▲▲∩♣♣""≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈│  Land 41%   Mountains 6%         │
│ │≈≈"""♣♣♣♣∩▲▲▲▲▲∩∩♣♣♣""".≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈│  Rivers 7    Volcanoes 2         │
│ │≈"""""♣♣∩∩▲▲▲∩∩♣♣♣""""..≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈│                                  │
│ │  (completed world preview)              │                                  │
│ └──────────────────────────────────────────┘                                  │
│ [Enter] Continue to the map        [Esc] Back                                │
└──────────────────────────────────────────────────────────────────────────────┘
```

Generate runs synchronously. On return, the screen shows the completed preview and the final stage at 100%.

## World map

```
┌────────────────────────────────────────────────────────────┬───────────────────────────────────┐
│≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈  │ Coldmere                          │
│≈≈≈≈""""""♣♣♣♣♣∩∩∩▲▲▲▲∩∩♣♣♣♣""""≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈ │ Alpine                            │
│≈≈"""""♣♣♣♣♣∩∩∩▲▲[▲]▲▲▲∩∩♣♣♣♣"""".≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈ │ No surface soil: no farms or grass│
│≈"""""""♣♣♣♣♣∩∩∩▲▲▲▲▲∩∩♣♣♣♣♣""""..≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈ │   up here. Farm in a cavern or on │
│≈""""""♣♣♣♣☺♣∩∩∩▲▲▲▲∩∩∩♣♣♣♣""""...≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈ │   mud; graze in a cavern.         │
│≈"""""""♣♣♣♣♣♣∩∩∩▲▲▲∩∩∩♣♣♣""""....≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈ │ No trees: wood only from the      │
│≈≈""""""""♣♣♣♣∩∩∩∩∩∩∩∩♣♣♣"""".....≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈ │   wagon, logs you bring, caravans │
│≈≈≈"""""""""♣♣♣♣∩∩∩∩♣♣♣♣""""......≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈ │   and cavern fungus.              │
│≈≈≈≈"""""""""""♣♣♣♣♣♣♣""""".......≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈ │ No water on the surface: drink    │
│≈≈≈≈≈"""""""""""""""""""".........≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈ │   what you bring or brew; dig down│
│≈≈≈≈≈≈"""""""""""""""""..........G.≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈ │   to a cavern lake.               │
│  (cursor [▲] · civ homes ☺ G · rivers drawn in blue)       │                                   │
│                                                            │ Soil     none: bare rock          │
│                                                            │ Trees    none                     │
│                                                            │ Shrubs   none; no grass; cave moss│
│                                                            │          below                    │
│                                                            │ Water    none on the surface      │
│                                                            │ Stone    igneous: rhyolite,       │
│                                                            │          andesite and 4 more      │
│                                                            │ Ores     likely cassiterite,      │
│                                                            │          magnetite and 5 more;    │
│                                                            │          deepsilver deep down     │
│                                                            │ Climate  cold, about 2°C; summer  │
│                                                            │          17°C, winter -13°C; spring│
│                                                            │          and autumn as cold       │
│                                                            │ Wildlife dangerous: snow leopard; │
│                                                            │          also mountain goat       │
│                                                            │                                   │
│                                                            │ Wealth  ▓▓▓░░ 3                   │
│                                                            │ Peril   ▓░░░░ 1                   │
│                                                            │ Peril counts raiders. Wild beasts │
│                                                            │ live everywhere.                  │
│                                                            │ Temper  ▓▓▓░░ 3                   │
│                                                            │ Trait: Frostmarrow                │
│                                                            │ Winter cold in spring and autumn; │
│                                                            │   snow instead of rain.           │
│                                                            │                                   │
│                                                            │ Mountainhome 9 regions (E)        │
│                                                            │ Hillfolk 5 regions (S)            │
│                                                            │ Wildwood 3 regions (W)            │
│                                                            │ Gloam: no land route; arrives     │
│                                                            │   from the E edge                 │
│                                                            │                                   │
│                                                            │ [f] filter  [?] legend            │
│                                                            │ [Enter] Embark here               │
└────────────────────────────────────────────────────────────┴───────────────────────────────────┘
```

Filter panel (`f`): checkboxes for biomes, min/max sliders for the three ratings (`+`/`-` on the focused row), river / volcano toggles, trait list; matching regions keep full color, others dim one step (`dim(c, 1)`). The cursor starts at the centre and inverts its cell. River regions draw blue `~`; civilization home glyphs and colors replace rivers and biomes. The region panel lists name, biome, volcano, the site's missing essentials, the site summary, five-cell rating bars (a dim line under the Peril bar reads "Peril counts raiders. Wild beasts live everywhere."), traits and every civilization's distance and cardinal arrival edge (for a civilization that no land route reaches, "no land route" in place of the distance, and the edge it still arrives from, as in the Gloam line above; its caravans and raiders come in from that edge all the same); there is no relief field.

The site summary is `02-systems/02-embark-and-loadout.md` § Site summary, one row per subject with its label in a `SITE_LABEL_COLS` column and its value wrapped under it: Soil, Trees, Shrubs (with grazing), Water, Stone, Ores, Climate (with summer, winter and `frostmarrow`'s long winter), Wildlife. A row names at most `SITE_LIST_NAMES` species, layers or ores and then "and N more". Counts read "about"; ores read "likely". Above it, each missing essential is a line in the alert color with its consequence and workaround, wrapped with a two-cell indent (`ui.site.lack.soil` "No surface soil: no farms or grass up here. Farm in a cavern or on mud; graze in a cavern.", `ui.site.lack.trees` "No trees: wood only from the wagon, logs you bring, caravans and cavern fungus.", `ui.site.lack.water` "No water on the surface: drink what you bring or brew; dig down to a cavern lake."). Each trait has its own "Trait:" line and under it dim lines saying what it does (`ui.site.trait.<id>`; for `gemsprings` on a site with no soil, `ui.site.trait.gemsprings_dry`, since its springs need soil). The Filter and Embark buttons keep the panel's last two rows; when the text above them is longer than the window, `PageUp` `PageDown` (Panels) scroll it a page and the wheel over the panel three rows a notch, a dim `▲` or `▼` at the panel's right edge shows there is more, and moving the cursor starts the next region at the top.

## Settings

```
┌──────────────────────────────────────────────────┐
│ Settings                                         │
│ ▶ Auto-pause on danger          [on ]            │
│   Auto-pause on alert           [off]            │
│   Hints                         [on ]            │
│   Colorblind palette            [off]            │
│   Zoom                          [Auto]           │
│   Edge scrolling                [off]            │
│   Autosave each season          [on ]            │
│   Snapshots kept                [4   ]           │
│   Combat log                    [hits only]      │
│   Keybindings ▸                                  │
│   Music volume                  [50%]            │
│   Music                         [on ]            │
│   Intro at launch               [first time]     │
│   Intro style                   [deep]           │
│   Reduced motion                [off]            │
│   [d] Reset to defaults         [Esc] Back       │
└──────────────────────────────────────────────────┘
```

Music volume runs from 0% to 100% in steps of 10% (`←` `→`, `Enter` or a click step it round); Music is on or off, as the music key turns it (`02-systems/24-ui-and-input.md` § Music). Intro at launch steps round `first time`, `always` and `off`, and Intro style between `deep` and `hall` (§ Intro). Reduced motion on stops the map's designations blinking (`02-systems/23-rendering.md` § Animation). Zoom is `Auto` or a fixed level (0.75, 1, 1.5, 2). Under the list a dim line says that `Auto` picks a larger cell on a large window and that a fixed zoom keeps the old look. When the window is too small for the requested zoom, a line in the alert color says so: `Zoom 1 (shown at 0.75: the window is small)` (`Zoom Auto (shown at 0.75: …)` for `Auto`).

Keybindings sub-screen:

```
┌──────────────────────────────────────────────────────────────────────┐
│ Settings · Keybindings                                               │
│ Action                                        Key                    │
│ Global                                                               │
│   cancel tool → close panel → game menu       Esc  fixed             │
│ ▶ pause / resume                              F8  (default Space)    │
│   speed up (1× → 2× → 4×)                     +                      │
│   …                                                                  │
│ Map                                                                  │
│   pan or move the map cursor (Shift: 10)      ←                      │
│   …                                                                  │
│ [Enter] rebind  [Del] default  [d] all defaults  [Esc] Back          │
│ Conflicts with Units panel: wounded dwarves first / list order       │
└──────────────────────────────────────────────────────────────────────┘
```

Every binding is listed under its context's heading (24 § Settings gives the order and the rules); the cursor moves over the bindings and skips the headings, `PageUp` `PageDown` by ten. `Enter` on a row, or a click on it, then a key rebinds it; `Esc` cancels the capture. `Delete` or `Backspace` gives the row its default back ("pause / resume: back to Space."), and `[d]` every binding ("Every key is back to its default."). A refusal is shown on the last line in red, and a conflict also draws the binding that has the key in red. Failed rebinding uses the shared registry messages `ui.settings.binding_conflict`, `ui.settings.binding_modifiers`, `ui.settings.binding_fixed` and `ui.settings.binding_browser` and leaves every binding unchanged; a reset says `ui.settings.binding_reset` or `ui.settings.bindings_reset`. The sub-screen's own keys are fixed (`03-content/ui-keymap-and-screens.md` § Fixed keys).

## Load

```
┌─────────────────────────────────────────────────────────────────────┐
│ Load                                                                │
│ Manual                                                              │
│ ▶ Emberhall · Day 12 of Summer, Year 2 · 23 dwarves · 18,450 ☼      │
│   ┌────────────────┐                                                │
│   │▒▒▒▒......▒▒▒▒▒▒│  thumbnail 48×27                               │
│   └────────────────┘                                                │
│ Autosaves                                                           │
│   Emberhall · Summer, Year 2 (auto)                                 │
│   Emberhall · Spring, Year 2 (auto)                                 │
│ Snapshots                                                           │
│   Emberhall · Winter, Year 1 · Autumn, Year 1 · …                   │
│ Finished                                                            │
│   Coldvein Hold · fell in Year 4 (view only)                        │
│ [Enter] Load  [x] Delete  [e] Export  [i] Import  [Esc] Back        │
└─────────────────────────────────────────────────────────────────────┘
```

## Legend

```
┌──────────────────────────────────────────────────────────────────┐
│ Coldvein Hold                                                    │
│ Founded Spring, Year 1 at Ashfell (mountain, wealth 3, peril 3)  │
│ Fell on Day 4 of Winter, Year 4.                                 │
│ The last dwarf, Solveig Deephand, died of her wounds.            │
│                                                                  │
│ Years 3 · Peak population 41 · Deepest level 6 · Wealth 52,300 ☼ │
│ Milestones                                                       │
│   Spring 1  The hearth was lit.                                  │
│   Summer 1  The first bar was smelted.                           │
│   Autumn 2  The first cavern was breached.                       │
│   Winter 3  The pale metal was taken.                            │
│   Autumn 4  A thing of the Hollow was slain.                     │
│ Notable                                                          │
│   Orm Ashbrow slew 14 enemies. Gnashvein the captain returned    │
│   twice. A magma wyrm came up in Winter, Year 4.                 │
│ Last words (log)                                                 │
│   !! The Hollow opens its mouth.                                 │
│   !  Brynja Coldhammer has bled to death.                        │
│   …                                                              │
│ [Esc] Back                                                       │
└──────────────────────────────────────────────────────────────────┘
```

## Text input

The modal `text_input` dialog: a prompt, one text field, the count of characters, and two buttons. It renames a dwarf or a squad.

```
  Rename Ketil Ironvein

  [ Ketil Ironvein___________ ]
  14/24
  [Enter] accept  [Esc] cancel
```

Printable keys append and `Backspace` deletes, up to the field's maximum. `Enter` answers with the text, trimmed; an empty text is not accepted and the count row says "Type at least 1 character." `Esc` cancels. No key reaches the screen below.
