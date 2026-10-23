# Intro

**Owner:** content (`intro`) · **Depends on:** [`../04-implementation/ui-screens/menus-and-world.md`](../04-implementation/ui-screens/menus-and-world.md) § Intro, [glyphs-and-colors.md](glyphs-and-colors.md)

The intro is a short animated scene drawn in the game's own glyphs and palette, written for Deepholm. Seven dwarves leave a hold that has run out of room, cross the surface past their wagon and some unimpressed wildlife, strike the first pick into an empty mountain, and the name of the game rises out of the rock. The screen that plays it is described in `menus-and-world.md` § Intro; this file holds its scenes, art, cues and captions.

## Stage

Every scene is drawn on a stage `INTRO_STAGE_COLS` wide and `INTRO_STAGE_ROWS` tall (`02-systems/24-ui-and-input.md` § Tuning constants), its top-left cell is column 0, row 0. A cell's colour comes from § Colors by its glyph, unless the cue that draws it names a colour. A space draws nothing: the cell keeps what is under it, and nothing is drawn outside the stage. The stage is centred in the window with its caption under it. A backdrop row whose first glyph is not a space runs on to the window's left edge with that glyph, and a row as wide as the stage runs on to the right edge with its last glyph, so ground, rock and sky fill a window of any width. The dwarves of a backdrop (`☺` `☻`) shuffle: each frame of `INTRO_FRAME_MS` a few of them show the other glyph.

## Scenes

The scenes play in table order; `ms` is how long each one lasts. `Backdrop` is the art drawn first, under every cue.

| id | ms | Backdrop |
|---|---|---|
| `hold` | 9000 | `hold` |
| `road` | 16000 | `road` |
| `mountain` | 11000 | `mountain` |
| `title` | 9000 | `range` |

## Cues

A cue draws a sprite on its scene. `Sprite` lists its frames; a frame is the art of that id when § Art has one, and otherwise the glyphs as written. `At` is the frame's top-left cell; `To`, when given, is where it goes, at an even pace from `From` to `Arrive` (to `Until` when `Arrive` is blank). The cue is drawn from `From` until `Until` (to the end of the scene when blank), in ms from the scene's start. Frames change every `Step` ms (`INTRO_FRAME_MS` when blank); a cue that moves changes frames only while it moves. `rise` draws the art column by column out of the rock below it: each column starts `INTRO_RISE_ROWS` rows lower, as `░`, `▒` and `▓`, and climbs to its place in a third of the time from `From` to `Until`, the first column starting at `From` and the last arriving at `Until`; risen art stays to the end of the scene.

| Scene | Sprite | Color | At | To | From | Arrive | Until | Step | Effect |
|---|---|---|---|---|---|---|---|---|---|
| `hold` | `☺` `☻` | `dwarf_normal` | 8,11 | 72,11 | 3500 | 8500 | | | |
| `hold` | `☺` `☻` | `dwarf_normal` | 7,11 | 71,11 | 3500 | 8500 | | | |
| `hold` | `☺` `☻` | `dwarf_normal` | 6,11 | 70,11 | 3500 | 8500 | | | |
| `hold` | `☺` `☻` | `dwarf_normal` | 5,11 | 69,11 | 3500 | 8500 | | | |
| `hold` | `☺` `☻` | `dwarf_normal` | 4,11 | 68,11 | 3500 | 8500 | | | |
| `hold` | `☺` `☻` | `dwarf_normal` | 3,11 | 67,11 | 3500 | 8500 | | | |
| `hold` | `☺` `☻` | `dwarf_normal` | 2,11 | 66,11 | 3500 | 8500 | | | |
| `road` | `wagon` | | 20,9 | | 0 | | 6200 | | |
| `road` | `wagon_a` `wagon_b` | | 20,9 | 76,9 | 6200 | 15600 | | 300 | |
| `road` | `r` | `rabbit_gray` | 33,11 | | 0 | | 4300 | | |
| `road` | `!` | `alert` | 33,10 | | 3400 | | 4300 | 200 | |
| `road` | `r` | `rabbit_gray` | 33,11 | 66,11 | 4300 | 6000 | | 100 | |
| `road` | `d` `b` | `deer_tan` | 47,10 | | 0 | | | 1400 | |
| `road` | `☺` `☻` | `dwarf_normal` | 9,11 | 71,11 | 500 | 11500 | | | |
| `road` | `☺` `☻` | `dwarf_normal` | 9,11 | 71,11 | 1100 | 12100 | | | |
| `road` | `☺` `☻` | `dwarf_normal` | 9,11 | 71,11 | 1700 | 12700 | | | |
| `road` | `☺` `☻` | `dwarf_normal` | 9,11 | 71,11 | 2300 | 13300 | | | |
| `road` | `☺` `☻` | `dwarf_normal` | 9,11 | 71,11 | 2900 | 13900 | | | |
| `road` | `☺` `☻` | `dwarf_normal` | 9,11 | 71,11 | 3500 | 14500 | | | |
| `road` | `☺` `☻` | `dwarf_normal` | 9,11 | 71,11 | 4100 | 15100 | | | |
| `mountain` | `☺` `☻` | `dwarf_normal` | -2,11 | 38,11 | 0 | 5000 | 9200 | | |
| `mountain` | `☺` `☻` | `dwarf_normal` | -4,11 | 35,11 | 0 | 5000 | | | |
| `mountain` | `☺` `☻` | `dwarf_normal` | -6,11 | 33,11 | 0 | 5000 | | | |
| `mountain` | `☺` `☻` | `dwarf_normal` | -8,11 | 31,11 | 0 | 5000 | | | |
| `mountain` | `☺` `☻` | `dwarf_normal` | -10,11 | 29,11 | 0 | 5000 | | | |
| `mountain` | `☺` `☻` | `dwarf_normal` | -12,11 | 27,11 | 0 | 5000 | | | |
| `mountain` | `☺` `☻` | `dwarf_normal` | -14,11 | 25,11 | 0 | 5000 | | | |
| `mountain` | `wagon_a` `wagon_b` | | -26,9 | 15,9 | 0 | 5600 | | 300 | |
| `mountain` | `pick_up` `pick_down` | `iron_gray` | 38,10 | | 5600 | | 8800 | 400 | |
| `mountain` | `*` ` ` `☼` ` ` | `sun_yellow` | 39,10 | | 6000 | | 8800 | 400 | |
| `mountain` | `.` | `text_dim` | 39,11 | | 8800 | | | | |
| `mountain` | `☺` `☻` | `dwarf_normal` | 38,11 | 39,11 | 9200 | 9500 | | | |
| `title` | `deepholm` | `diorite_gray` | 8,1 | | 600 | | 5600 | | `rise` |
| `title` | `*` ` ` ` ` ` ` | `sun_yellow` | 54,0 | | 6000 | | | 250 | |

## Captions

A caption is drawn centred under the stage from `From` to `Until`. Its text is the strings key `intro.<id>`.

| id | Scene | From | Until | Text |
|---|---|---|---|---|
| `full` | `hold` | 300 | 3700 | "The old hold was full. Very, very full." |
| `leave` | `hold` | 4000 | 8900 | "So seven of them packed a wagon and went to find some elbow room." |
| `lovely` | `road` | 300 | 4200 | "The world outside was wide, green and mostly quiet." |
| `mostly` | `road` | 4400 | 7400 | "Mostly." |
| `deer` | `road` | 8000 | 15600 | "The deer had seen dwarves before. It was not impressed." |
| `found` | `mountain` | 300 | 5400 | "At last: a mountain with nobody in it." |
| `strike` | `mountain` | 5600 | 8600 | "The eldest spat on her hands and swung." |
| `in` | `mountain` | 9000 | 10900 | "Clang. They were home." |
| `subtitle` | `title` | 6000 | 9000 | "a hall beneath the world" |

## Colors

The colour of each glyph in the art, from the palette of [glyphs-and-colors.md](glyphs-and-colors.md). A glyph not listed here is drawn in `text`.

| Glyph | Color |
|---|---|
| `▒` | `granite_gray` |
| `░` | `loam_brown` |
| `▓` | `dark_gray_rock` |
| `"` | `grass_green` |
| `,` | `grass_dry` |
| `.` | `dust_brown` |
| `▲` | `slate_gray` |
| `♣` | `forest_green` |
| `♠` | `pine_green` |
| `│` | `oak_brown` |
| `☼` | `sun_yellow` |
| `Θ` | `linen_cream` |
| `Ю` | `oak_brown` |
| `╥` | `oak_brown` |
| `═` | `oak_brown` |
| `∂` | `pebble_gray` |
| `%` | `meal_brown` |
| `☺` | `dwarf_normal` |
| `☻` | `dwarf_normal` |
| `+` | `oak_brown` |
| `▄` | `oak_brown` |
| `■` | `leather_brown` |
| `○` | `iron_gray` |
| `◙` | `iron_gray` |
| `m` | `mule_brown` |

## Art

Each piece is a fenced block under its id. Rows are read as written; a row may be shorter than the stage.

### `hold`

```
▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒
▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒
▒▒Θ☺Θ☺Θ☺Θ☺Θ☺Θ☺Θ☺Θ☺Θ▒ЮЮ☺ЮЮ☺ЮЮ☺ЮЮ▒▒ ☺ ☼ ☺ ▒▒Θ☺Θ☺Θ☺Θ☺Θ☺Θ☺Θ☺Θ☺Θ▒▒▒▒▒
▒▒Θ☺Θ☺Θ☺Θ☺Θ☺Θ☺Θ☺Θ☺Θ▒Ю☺ЮЮ☺ЮЮ☺ЮЮ☺▒▒☺☺☺☺☺☺☺▒▒Θ☺Θ☺Θ☺Θ☺Θ☺Θ☺Θ☺Θ☺Θ▒▒▒▒▒
▒▒☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺▒▒▒▒
▒▒☺☺╥════════╥☺☺☺☺╥════════╥☺☺☺☺╥════════╥☺☺☺☺╥════════╥☺☺☺☺▒▒▒▒
▒▒☺☺☺∂☺∂☺∂☺∂☺∂☺☺☺☺☺∂☺∂☺∂☺∂☺∂☺☺☺☺☺∂☺∂☺∂☺∂☺∂☺☺☺☺☺∂☺∂☺∂☺∂☺∂☺☺☺☺▒▒▒▒
▒▒☺☺╥════════╥☺☺☺☺╥════════╥☺☺☺☺╥════════╥☺☺☺☺╥════════╥☺☺☺☺▒▒▒▒
▒▒☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺▒▒▒▒
▒▒☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺▒▒▒▒
▒▒☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺▒▒▒▒
▒▒............................................................+.
▒▒☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺☺▒▒▒▒
▒▒ЮЮЮЮЮЮЮЮЮ%%%%%%%%ЮЮЮЮЮЮЮЮЮ%%%%%%%%ЮЮЮЮЮЮЮЮЮ%%%%%%%%ЮЮЮЮЮЮЮ▒▒▒▒
▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒
▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒
```

### `road`

```
                                                       ☼
                                              ▲
                                            ▲▲▲▲    ▲
                                          ▲▲▲▲▲▲▲  ▲▲▲
                                        ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲      ▲
                ♣                     ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲   ▲▲▲
▒▒▒▒▒          ♣♣♣          ♠        ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
▒▒▒▒▒▒▒       ♣♣♣♣♣        ♠♠♠            ♣
▒▒▒▒▒▒▒▒        │         ♠♠♠♠♠          ♣♣♣       ♠
▒▒▒▒▒▒▒▒▒       │           │           ♣♣♣♣♣     ♠♠♠
▒▒▒▒▒▒▒▒▒▒    , │ ,     ,   │     ,       │   ,    │  ,      ,
▒▒▒▒▒▒▒▒▒+      .      .        .       .       .       .
""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
```

### `mountain`

```
                                              ▲
                                  ☼          ▲▒▲
                                            ▲▒▒▒▲      ▲
                                           ▲▒▒▒▒▒▲    ▲▒▲
                                          ▲▒▒▒▒▒▒▒▲  ▲▒▒▒▲
                                         ▲▒▒▒▒▒▒▒▒▒▲▲▒▒▒▒▒▲
                                        ▲▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▲
        ♣                              ▲▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▲
       ♣♣♣                             ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒
      ♣♣♣♣♣                  ♠         ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒
   ,    │    ,              ♠♠♠        ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒
     .       .            .            ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒
"""""""""""""""""""""""""""""""""""""""▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒
```

### `range`

```






                               ▲
             ▲                ▲▒▲                 ▲
            ▲▒▲              ▲▒▒▒▲       ▲       ▲▒▲
     ▲     ▲▒▒▒▲      ▲     ▲▒▒▒▒▒▲     ▲▒▲     ▲▒▒▒▲     ▲
    ▲▒▲   ▲▒▒▒▒▒▲    ▲▒▲   ▲▒▒▒▒▒▒▒▲   ▲▒▒▒▲   ▲▒▒▒▒▒▲   ▲▒▲
   ▲▒▒▒▲ ▲▒▒▒▒▒▒▒▲  ▲▒▒▒▲ ▲▒▒▒▒▒▒▒▒▒▲ ▲▒▒▒▒▒▲ ▲▒▒▒▒▒▒▒▲ ▲▒▒▒▲
 ▲▲▒▒▒▒▒▲▒▒▒▒▒▒▒▒▒▲▲▒▒▒▒▒▲▒▒▒▒▒▒▒▒▒▒▒▲▒▒▒▒▒▒▒▲▒▒▒▒▒▒▒▒▒▲▒▒▒▒▒▲▲
▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒
▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒
▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒
```

### `wagon`

```
 ЮЮ%Ю
▄■■■■▄═m
 ○  ○
```

### `wagon_a`

```
 ЮЮ%Ю
▄■■■■▄═m
 ○  ○
```

### `wagon_b`

```
 ЮЮ%Ю
▄■■■■▄═m
 ◙  ◙
```

### `pick_up`

```
/
```

### `pick_down`

```

 ─
```

### `deepholm`

```
████▄ █████ █████ ████▄ █   █ ▄███▄ █     █▄ ▄█
█   █ █     █     █   █ █   █ █   █ █     █ ▀ █
█   █ ████  ████  ████▀ █████ █   █ █     █   █
█   █ █     █     █     █   █ █   █ █     █   █
████▀ █████ █████ █     █   █ ▀███▀ █████ █   █
```
