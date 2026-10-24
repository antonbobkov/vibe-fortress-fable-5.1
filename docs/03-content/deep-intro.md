# Deep intro

**Owner:** content (`deepIntro`) · **Depends on:** [`../04-implementation/ui-screens/menus-and-world.md`](../04-implementation/ui-screens/menus-and-world.md) § Intro, [intro.md](intro.md)

The deep intro is the default style of the intro (the Intro style setting `deep`; [intro.md](intro.md) is the `hall` style). It is drawn in big block art: every art pixel is a cell filled with a block or shade glyph in two colours of a sixteen-colour palette of its own, figures stand a whole strip tall, and the film cuts, pans and shakes; the art is always drawn at its own scale, and a close shot is an image of its own, reached by a cut. Its story, "The Deep Answers", was written for Deepholm. A dwarf goes down a shaft on a rope with a swinging lantern and sits at the bottom for a drink; an eye the size of the rock wall opens out of the static, looks about, and blinks; the wall behind him cracks and a torrent of glowing water bursts out of it all round him, and he finishes his drink first; his silhouette rises against the water's light, raises a pick and strikes; and the rock shatters into the name of the game. The screen that plays it is described in `menus-and-world.md` § Intro; this file holds its palette, inks, scenes, layers, camera, effects, captions and art.

## Stage

The pictures are drawn on a strip `DEEP_INTRO_STAGE_COLS` art pixels wide and `DEEP_INTRO_STAGE_ROWS` tall (`02-systems/24-ui-and-input.md` § Tuning constants). The strip is drawn at the largest whole scale that fits the window, each art pixel a square of that many cells on a side, with a row left under it for the caption and one for the skip line; it is centred. Around a strip that does not fill the window, a letterbox: black above and below it, stone pillars at its sides with a pale edge beside it (§ Parts). A flash covers the whole window.

An art pixel draws the ink of its letter (§ Inks). A space draws nothing: the layer under it shows, and under every layer the scene's fill. Art coordinates are in art pixels from the strip's top-left; `At` and `To` may lie outside the strip.

## Colors

The palette, sixteen colours of the old text screens.

| id | Hex |
|---|---|
| `black` | #000000 |
| `blue` | #0000AA |
| `green` | #00AA00 |
| `cyan` | #00AAAA |
| `red` | #AA0000 |
| `magenta` | #AA00AA |
| `brown` | #AA5500 |
| `light_gray` | #AAAAAA |
| `dark_gray` | #555555 |
| `light_blue` | #5555FF |
| `light_green` | #55FF55 |
| `light_cyan` | #55FFFF |
| `light_red` | #FF5555 |
| `light_magenta` | #FF55FF |
| `yellow` | #FFFF55 |
| `white` | #FFFFFF |

## Cycles

A cycle is a colour that takes its colours in turn, one every `Step`. `Drift` moves the turns across the strip, in art pixels per step: the cell at `x`, `y` shows the colour `step − dx·x − dy·y` of the list, so a drift of `-1,1` rolls the colours down and to the left.

| id | Colors | Step (ms) | Drift |
|---|---|---|---|
| `water` | `light_cyan` `light_cyan` `cyan` `white` `light_cyan` `cyan` `blue` `cyan` | 90 | -1,1 |
| `glow` | `yellow` `yellow` `brown` `yellow` `white` `yellow` | 120 | 0,0 |
| `iris` | `light_cyan` `cyan` `blue` `cyan` `light_cyan` `white` | 110 | 1,0 |
| `ember` | `red` `light_red` `yellow` `light_red` | 70 | 1,1 |

## Inks

Each letter of the art draws one glyph in a foreground and a background colour, either of which may be a cycle. `Density`, when given, is the share of the ink's cells drawn at a time, chosen afresh every `DEEP_INTRO_NOISE_MS`; the rest show what is under them, so the ink twinkles as speckle. The textures are the full block, the three shades, the shade `▒` as a checker dither, and the line glyphs `≡ ═ ─` as scanline hatching.

| Ink | Glyph | Fg | Bg | Density (%) |
|---|---|---|---|---|
| `.` | ` ` | `black` | `black` | |
| `W` | `█` | `white` | `black` | |
| `L` | `█` | `light_gray` | `black` | |
| `D` | `█` | `dark_gray` | `black` | |
| `C` | `█` | `light_cyan` | `black` | |
| `c` | `█` | `cyan` | `black` | |
| `B` | `█` | `blue` | `black` | |
| `R` | `█` | `light_red` | `black` | |
| `r` | `█` | `red` | `black` | |
| `N` | `█` | `brown` | `black` | |
| `Y` | `█` | `yellow` | `black` | |
| `w` | `▓` | `white` | `light_gray` | |
| `l` | `▒` | `light_gray` | `dark_gray` | |
| `d` | `░` | `dark_gray` | `black` | |
| `h` | `≡` | `light_gray` | `dark_gray` | |
| `H` | `═` | `white` | `light_gray` | |
| `-` | `─` | `dark_gray` | `black` | |
| `_` | `≡` | `dark_gray` | `black` | |
| `x` | `▒` | `light_cyan` | `cyan` | |
| `z` | `≡` | `light_cyan` | `cyan` | |
| `Z` | `═` | `cyan` | `blue` | |
| `F` | `▓` | `white` | `light_cyan` | |
| `b` | `░` | `blue` | `black` | |
| `n` | `▒` | `brown` | `black` | |
| `y` | `▓` | `yellow` | `brown` | |
| `K` | `▓` | `light_red` | `brown` | |
| `k` | `▒` | `red` | `brown` | |
| `~` | `█` | `water` | `black` | |
| `=` | `≡` | `water` | `blue` | |
| `%` | `▒` | `water` | `cyan` | |
| `O` | `█` | `glow` | `black` | |
| `g` | `▒` | `glow` | `black` | |
| `q` | `░` | `glow` | `black` | |
| `E` | `█` | `iris` | `black` | |
| `e` | `▒` | `iris` | `blue` | |
| `s` | `█` | `red` | `black` | 35 |
| `S` | `■` | `ember` | `black` | 30 |
| `t` | `░` | `light_cyan` | `black` | 45 |

## Parts

The inks of what the screen draws itself: the stone `side` pillars beside the strip, laid in courses `DEEP_INTRO_COURSE_ROWS` tall of blocks `DEEP_INTRO_BLOCK_COLS` wide, each course set half a block along from the one under it (the first ink is the stone, the second the mortar, and any others mark a few stones), the pillar's `edge` beside the strip, the letterbox `bar` above and below it, the `static` of a static effect (each pixel one of the inks, anew every `DEEP_INTRO_NOISE_MS`), the `flash` and the `fade`.

| Part | Inks |
|---|---|
| `side` | `l` `D` `h` |
| `edge` | `L` |
| `bar` | `.` |
| `static` | `W` `w` `l` `D` `d` `.` |
| `flash` | `W` |
| `fade` | `.` |

## Scenes

The scenes play in table order; `ms` is how long each one lasts. `Fill` is the ink under every layer.

| id | ms | Fill |
|---|---|---|
| `descent` | 8000 | `.` |
| `bottom` | 5000 | `.` |
| `eye` | 9000 | `.` |
| `torrent` | 7500 | `.` |
| `strike` | 6000 | `.` |
| `title` | 8000 | `.` |

## Layers

A layer draws art on its scene, later rows over earlier ones. `Art` lists its frames, which turn every `Step` ms (`INTRO_FRAME_MS` when blank). `At` is the art's top-left; `To`, when given, is where it goes, at an even pace from `From` to `Arrive` (to `Until` when `Arrive` is blank), and a moving layer changes frames only while it moves. It is drawn from `From` until `Until` (to the end of the scene when blank), in ms from the scene's start: the motion of a cue of [intro.md](intro.md) § Cues. `Depth` is how the layer follows the camera (§ Camera): 1 moves with the scene, 0 is fixed to the strip, between them a far layer, above 1 a near one; layers of different depths make the parallax. `Tile` repeats the art along `x`, `y` or both.

| Scene | Art | At | To | From | Arrive | Until | Step | Depth | Tile |
|---|---|---|---|---|---|---|---|---|---|
| `descent` | `shaft_back` | 0,0 | | 0 | | | | 0.35 | y |
| `descent` | `wall_left` | 0,0 | | 0 | | | | 1 | y |
| `descent` | `wall_right` | 54,0 | | 0 | | | | 1 | y |
| `descent` | `floor` | 0,105 | | 0 | | | | 1 | |
| `descent` | `halo_b` `halo_a` `halo_c` `halo_a` | 21,0 | | 0 | | | 350 | 0 | |
| `descent` | `rope_b` `rope_a` `rope_c` `rope_a` | 21,0 | | 0 | | | 350 | 0 | |
| `descent` | `fore_rocks` | 0,0 | | 0 | | | | 1.9 | y |
| `bottom` | `cave_bottom` | 0,0 | | 0 | | | | 1 | |
| `bottom` | `watcher` | 66,8 | | 2400 | | | | 1 | |
| `bottom` | `watcher` | 71,13 | | 2900 | | | | 1 | |
| `bottom` | `watcher` | 61,4 | | 3400 | | | | 1 | |
| `bottom` | `lantern_halo` | 6,15 | | 0 | | | | 1 | |
| `bottom` | `lantern` | 15,19 | | 0 | | | | 1 | |
| `bottom` | `sit_low` | 22,0 | | 0 | | 1400 | | 1 | |
| `bottom` | `sit_sip` | 22,0 | | 1400 | | 3000 | | 1 | |
| `bottom` | `sit_look` | 22,0 | | 3000 | | | | 1 | |
| `eye` | `eye_rock` | 0,0 | | 0 | | | | 1 | |
| `eye` | `eye_ring` | 0,0 | | 3600 | | | | 1 | |
| `eye` | `eye_closed` | 0,0 | | 0 | | 3600 | | 1 | |
| `eye` | `eye_half` | 0,0 | | 3600 | | 4100 | | 1 | |
| `eye` | `eye_open` | 0,0 | | 4100 | | 5000 | | 1 | |
| `eye` | `eye_look_l` | 0,0 | | 5000 | | 5600 | | 1 | |
| `eye` | `eye_look_r` | 0,0 | | 5600 | | 6200 | | 1 | |
| `eye` | `eye_open` | 0,0 | | 6200 | | 7000 | | 1 | |
| `eye` | `eye_half` | 0,0 | | 7000 | | 7150 | | 1 | |
| `eye` | `eye_closed` | 0,0 | | 7150 | | 7400 | | 1 | |
| `eye` | `eye_half` | 0,0 | | 7400 | | 7550 | | 1 | |
| `eye` | `eye_open` | 0,0 | | 7550 | | | | 1 | |
| `torrent` | `cave_back` | 0,0 | | 0 | | | | 1 | |
| `torrent` | `star_a` | 0,0 | | 1500 | | 2100 | | 1 | |
| `torrent` | `star_b` | 0,0 | | 2100 | | 2600 | | 1 | |
| `torrent` | `burst_1` | 0,0 | | 2600 | | 2750 | | 1 | |
| `torrent` | `burst_2` | 0,0 | | 2750 | | 2950 | | 1 | |
| `torrent` | `burst_3` | 0,0 | | 2950 | | | | 1 | |
| `torrent` | `lantern_small_halo` | 23,17 | | 0 | | | | 1 | |
| `torrent` | `lantern` | 26,19 | | 0 | | | | 1 | |
| `torrent` | `stand_low` | 33,10 | | 0 | | 4800 | | 1 | |
| `torrent` | `stand_sip` | 33,10 | | 4800 | | 6200 | | 1 | |
| `torrent` | `stand_toss` | 33,10 | | 6200 | | 6900 | | 1 | |
| `torrent` | `stand_ready` | 33,10 | | 6900 | | | | 1 | |
| `torrent` | `mug_fly` | 45,12 | 72,-5 | 6250 | 6900 | 6900 | | 1 | |
| `strike` | `glow_back` | 0,0 | | 0 | | | | 0.5 | |
| `strike` | `glow_floor` | 0,21 | | 0 | | | | 1 | |
| `strike` | `sil_raise` | 20,30 | 20,0 | 0 | 1800 | 2000 | | 0 | |
| `strike` | `face` | 0,0 | | 2000 | | 3800 | | 1 | |
| `strike` | `spray` | 0,2 | | 2000 | | 3800 | | 1.6 | |
| `strike` | `sil_raise` | 20,0 | | 3800 | | 4800 | | 0 | |
| `strike` | `sil_strike` | 20,0 | | 4800 | | | | 0 | |
| `strike` | `sparks` | 42,17 | | 4800 | | | | 0 | |
| `title` | `title_rock` | 0,0 | | 0 | | | | 1 | |
| `title` | `title_water` | 0,24 | | 0 | | | | 1 | |
| `title` | `embers` | 0,0 | | 1200 | | | | 1 | |
| `title` | `title_letters` | 3,6 | | 0 | | | | 1 | |
| `title` | `frag_1` | -2,2 | -30,-12 | 0 | 1300 | 1300 | | 1 | |
| `title` | `frag_2` | 18,1 | 10,-20 | 0 | 1300 | 1300 | | 1 | |
| `title` | `frag_3` | 38,2 | 44,-20 | 0 | 1300 | 1300 | | 1 | |
| `title` | `frag_4` | 58,1 | 84,-12 | 0 | 1300 | 1300 | | 1 | |
| `title` | `frag_5` | 6,12 | -26,30 | 0 | 1300 | 1300 | | 1 | |
| `title` | `frag_6` | 26,13 | 20,34 | 0 | 1300 | 1300 | | 1 | |
| `title` | `frag_7` | 46,12 | 52,34 | 0 | 1300 | 1300 | | 1 | |
| `title` | `frag_8` | 64,11 | 90,28 | 0 | 1300 | 1300 | | 1 | |

## Camera

The camera of a scene is the art point at the strip's centre; it pans and never scales the art. Each key is where the camera stands at `At` ms; it comes there from the key before it by `Move`: `linear`, `ease` (slow at both ends) or `cut` (it stays at the key before until `At`, then jumps). Before its first key a scene's camera stands at the first key, and after its last key at the last; a scene without keys looks at the strip's centre, 40,15. A layer of depth `d` is seen as if the camera stood at `40 + (x − 40)·d`, `15 + (y − 15)·d`, so a far layer moves less than the camera and a near one more.

| Scene | At | X | Y | Move |
|---|---|---|---|---|
| `descent` | 0 | 40 | 15 | cut |
| `descent` | 6400 | 40 | 95 | ease |

## Effects

Each effect runs from `From` to `Until` ms of its scene.

- `shake` moves the whole picture by up to `Value` art pixels each way, anew every `DEEP_INTRO_SHAKE_MS`, less and less until it ends.
- `flash` covers the whole window with the flash ink: solid for its first third, then dithered away.
- `fade_in` and `fade_out` dither the picture in from the fade ink, or out to it, by an ordered 4×4 dither of the art pixels.
- `static` covers the picture with static of the static inks, every pixel covered at its start and none at its end, so the picture condenses out of the noise.

| Scene | Effect | From | Until | Value |
|---|---|---|---|---|
| `descent` | `fade_in` | 0 | 700 | |
| `descent` | `shake` | 6400 | 7000 | 1 |
| `bottom` | `shake` | 4000 | 5000 | 1 |
| `eye` | `static` | 0 | 3400 | |
| `eye` | `shake` | 3600 | 4300 | 1 |
| `torrent` | `flash` | 2600 | 2850 | |
| `torrent` | `shake` | 2600 | 4800 | 3 |
| `strike` | `flash` | 4800 | 5300 | |
| `strike` | `shake` | 4800 | 6000 | 3 |
| `title` | `flash` | 0 | 500 | |
| `title` | `shake` | 0 | 1400 | 2 |
| `title` | `fade_out` | 7300 | 8000 | |

## Captions

A caption is drawn from `From` to `Until`, centred on the row under the strip. Its text is the strings key `deep_intro.<id>`.

| id | Scene | From | Until | Text |
|---|---|---|---|---|
| `descent` | `descent` | 1200 | 5600 | "Somebody always has to go down first." |
| `drink` | `bottom` | 600 | 3800 | "Nine hundred feet down, he stopped for a drink." |
| `blinked` | `eye` | 7700 | 9000 | "The deep blinked first." |
| `finish` | `torrent` | 5000 | 7400 | "He finished his drink first." |
| `subtitle` | `title` | 2200 | 8000 | "a hall beneath the world" |

## Art

Each piece is a fenced block under its id: rows of ink letters, read as written, a space for nothing.

### `shaft_back`

```
--------  -- - -- - -  - -- ------- --- - - ----- -  ----- -    -------- -     -
d           d
     d    d              d d                d          dd                     d
  d       d         d          d                d                       d

 ------------ ---- -------- --     -- -   --  ---  -- ---- ---- ------ ------ -
                                               d
   dd                  d             d        d            d            d  d_
          d          d                                               d
                  _   d                        _                  _
--  --- ---- - - -- --- - --- - -  --  -  ----- --- -- --- -- - --- -  --- - ---
    _                   _      d           d           d
                d
           d               d                  _               _
     d  d                                            d                       d
  -----  ----- -- ----- -   - -------- -- - --   - -- - - --- ------ ----- - ---
                           dd                          d                       d
                          d   d d             d   d  d          d d         _
                                 _       d
   d       dd                    d                                           dd
-- - - -   - --- ------- --  ----- -   --- ---- -  --  --- --  - -- --    -----
                  d         d               d         d        d
                                      d             d
d                            _                 d                            d
                       d
-- - -- ------ -  -- -- ----- - -  ----  - - ------ ------ -- -----  ---- -- ---
                      _          d         d   _d     dd        d
              d    _       d  d             _                    d dd        _
                _                  d  _    d
d       _                               _ d  d
```

### `wall_left`

```
DDDhhhhhhDDD..hhddllL
DDDDDDDDDDDD...DhhllL
DDDDDDDDDDDD...DDllL
hhDDDDDDDhhhh..DllL
DDDhhhhhhDDDDDhllL
DDDDDDDDDDDDDDDllW
DDDDDDDDDDDDDDDllW
hhDDDDDDDhhhhDDDllL
DDDhhhhhhDDDDDhhllL
DDDDDD...DDDDDDDllL
DDDDDD...DDDDDDllL
hhDDDD...hhhhllL
DDDhhhhhhddllL
DDD...DDDllW
DDD...DDllL
hhD...DDllL
lllhhhhhllW
lllllllllllL
lllllllllDllL
hhlllllllhhllL
lllhhhhhhllllW
lll...lllllllL
lll...llllllL
hhl...lllhllL
DDDhhhhhh.llL
DDDDDDDDD..llL
DDDDDDDDD...DllL
hhDDDDDDDhhhhDDllL
DDDhhhhhhDDDDDhhDllL
DDDDDDDDDDDDDDDDhhllL
```

### `wall_right`

```
       LlldddDDDDDDDDD
        LllhhhhhhhDDDD
         WlllDDDDDDhhh
           LllDDDDDDDD
            LllDDDDDDD
            LllhhhDDDD
           Llllllllhhh
         Llllllllll...
       Wlllllllllll...
      Wllllhhhhhhhl...
     WllDhDDDDDDDDDhhh
    WllDDDDDDDDDDDDDDD
     LllDDDDDDDDDDDDDD
     LllDDDhhhhhhhDDDD
     LllDhDDD...dddhhh
     LllDDDDD...dddddd
    LllDDDDDD...dddddd
   WllhhDDDhhhhhhhdddd
 Lll...llhlllDDDDDDhhh
LllD...llllllDDDDDDDDD
Lllhh..llllllDDDDDDDDD
 WllDhhhlllhhhhhhhDDDD
   LllDDDhDDDDDDDDDhhh
     LllDDDDDDDDDDDDDD
      LllDDDDDDDDDDDDD
       LllDhhhhhhhDDDD
        LllDD...dddhhh
       LllDDD...dddddd
       LllDDD...dddddd
       LllDhhhhhhhdddd
```

### `fore_rocks`

```



D
...D
.....D
.......D
.........D
...........D
............D
............D
............D
...........D
.........D
.......D
.....D
...D



                                                                               D
                                                                             D..
                                                                           D....
                                                                         D......
                                                                       D........
                                                                      D.........
                                                                     D..........
                                                                    D...........
                                                                    D...........
                                                                    D...........
                                                                     D..........
                                                                      D.........
                                                                       D........
                                                                         D......
                                                                           D....
                                                                             D..

D
...D
.....D
......D
......D
.....D
...D

```

### `floor`

```
LLLLllLllLLLlLLLllLLlLLlLLlLllLlLLLLLLLLllllLlllLLLLlLLlLLLLLlLLLLlLLllllLLlllLL
llllhdddd...ddhhhhlhhhhhhlllllllllllDDDhhdddddddhhhhhhDDDDDDhhDlllllllll...hhhhh
lllllhhdd..hhhDDDDlllllllllllllhhhhlDDD..hhhhhhlllllllDhhhh.DDDllhhhhhhl...lllll
hhllllllhhhDDDDDDDllllllllllhhllllllhDD...DDDlllllllllDDD...DDDhhllllllhh..lllll
..hhlllllDDDDDDDDDllllllllhhllllllllllh...DDDlllllllllDDD...DDhllllllllllhhlllll
```

### `rope_a`

```
    N             DDD
    y         WWLLLLlllll
    N        WWWLLLLllllll
   KNK      WWWWLLLLlllllll
   KKK     LLLLLLLLLllllllll
    Bb    DLDDDLDDDLDDDLDDDLD
    Bb      knnnnnnnnnnnnnk
    Bb      kK.WKKRRRK.WKKk
    Bb      kKKKKKRRRKKKKKk
     Bb   NNNNNnNkRRRkNNnNNNN
     Bb   yyyNNNNNNNNNNNNNyyy
     BbbbbBNnyyyyyNNNyyyyyNnBBBB
     BbbbbNnNNnNNn...NNnNNnNNBBBB
       bbyNnNNnNNnNNnNNnNNnNNnBBB
       bbNynyNnNynyNnNNnNNnyynNBBB
       bnNynyNnNynyNnNNnNNnyynNBBB
       bbNnyynNNnNNnNNnyNnNNnNBB BB
       bbbnyynNNnNNnNNnyNnNNnBBB BB
       bbbBNNnNNnyNnNNnNynNNBBBB  KK
       bbbBBNnNNnyNnNNnNynNBBBBB  D
       bbbBBBNNnyNnNNnNNnNNBBBBB  D
       bNNNNNNNnyNnNNnNNnNNNNNNB DLD
           bBByNnNnNNNnNnBBB     LOL
           bBBBNnN   NnNBBBB     OYO
           bBBBYYY   YYYBBBB     LOL
          LLLLLNnN   NnNLLLLD    DDD
          DDDDDDD     DDDDDDD



```

### `halo_a`

```

















                            qqqqqq    qqq
                          q q  qq q qq  qq
                         qq q  q  qqq   qq
                        qqqq  ggggggqgqq q
                       qq   qqggggqgggqgqqqq
                       qqq  gqgqqgqgggqgq qq
                      qq q qqgggggqgqggggg
                            qggggggggqgqq qq
                       qqqqqqggggqgggqqggqq
                           q  gqqgqqggg   q
                         qqq qq  qg q q  q
                          qq q   qqq  qq  q
                               qq q q  q
```

### `rope_b`

```
    N             DDD
    y         WWLLLLlllll
    N        WWWLLLLllllll
   KNK      WWWWLLLLlllllll
   KKK     LLLLLLLLLllllllll
    Bb    DLDDDLDDDLDDDLDDDLD
    Bb      knnnnnnnnnnnnnk
    Bb      kK.WKKRRRK.WKKk
    Bb      kKKKKKRRRKKKKKk
     Bb   NNNNNnNkRRRkNNnNNNN
     Bb   yyyNNNNNNNNNNNNNyyy
     BbbbbBNnyyyyyNNNyyyyyNnBBBB
     BbbbbNnNNnNNn...NNnNNnNNBBBB
       bbyNnNNnNNnNNnNNnNNnNNnBBB
       bbNynyNnNynyNnNNnNNnyynNBBB
       bnNynyNnNynyNnNNnNNnyynNBBB
       bbNnyynNNnNNnNNnyNnNNnNBB BB
       bbbnyynNNnNNnNNnyNnNNnBBB BB
       bbbBNNnNNnyNnNNnNynNNBBBB  KK
       bbbBBNnNNnyNnNNnNynNBBBBB D
       bbbBBBNNnyNnNNnNNnNNBBBBD
       bNNNNNNNnyNnNNnNNnNNNNNDLD
           bBByNnNnNNNnNnBBB  LOL
           bBBBNnN   NnNBBBB  OYO
           bBBBYYY   YYYBBBB  LOL
          LLLLLNnN   NnNLLLLD DDD
          DDDDDDD     DDDDDDD



```

### `halo_b`

```
















                               q
                         q qqqqqqq
                        q q q  qq q qq
                      qqqqq q  g   qq   q
                       qqqqqqggggggg   q q
                    q  qqgqqqqggggqgggq qqq
                    qq qqggqgqgqqgqggg qq q
                   q  qqgggqqgggggqgqgg  q
                    qq   gggqggggggggqq   q
                     q qqgqgqggggqgggq q qq
                       q   ggqgqqgqqqqq
                       qqqqq qqg qq q q
                        q qq q   qqq  qq
                               qq q q
```

### `rope_c`

```
    N             DDD
    y         WWLLLLlllll
    N        WWWLLLLllllll
   KNK      WWWWLLLLlllllll
   KKK     LLLLLLLLLllllllll
    Bb    DLDDDLDDDLDDDLDDDLD
    Bb      knnnnnnnnnnnnnk
    Bb      kK.WKKRRRK.WKKk
    Bb      kKKKKKRRRKKKKKk
     Bb   NNNNNnNkRRRkNNnNNNN
     Bb   yyyNNNNNNNNNNNNNyyy
     BbbbbBNnyyyyyNNNyyyyyNnBBBB
     BbbbbNnNNnNNn...NNnNNnNNBBBB
       bbyNnNNnNNnNNnNNnNNnNNnBBB
       bbNynyNnNynyNnNNnNNnyynNBBB
       bnNynyNnNynyNnNNnNNnyynNBBB
       bbNnyynNNnNNnNNnyNnNNnNBB BB
       bbbnyynNNnNNnNNnyNnNNnBBB BB
       bbbBNNnNNnyNnNNnNynNNBBBB  KK
       bbbBBNnNNnyNnNNnNynNBBBBB   D
       bbbBBBNNnyNnNNnNNnNNBBBBB     D
       bNNNNNNNnyNnNNnNNnNNNNNNB    DLD
           bBByNnNnNNNnNnBBB        LOL
           bBBBNnN   NnNBBBB        OYO
           bBBBYYY   YYYBBBB        LOL
          LLLLLNnN   NnNLLLLD       DDD
          DDDDDDD     DDDDDDD



```

### `halo_c`

```
















                                     q
                               qqq    qqq  q
                               qq q qq  qq q
                            q  q   qqg  qq
                           q     gggqgqggq
                            qqqgggqgggqgqggq
                             qqqqgqgggqgqgqq
                         q    ggggqgqggggggg
                            q  ggggggqgqqqqq
                          qq q ggqgggqqggggg
                           q  qqqgqqgggqggq
                             qq  qq qgq  q
                             q   qqq  qq  q
                               qq q q  q qqq
```

### `cave_bottom`

```
.......                                         N                        DDDDDDD
dh.....                                         y                        hhhhhdd
ddhhh.. -   --   -- -- -  -- - --  -   ----  ---N--  -   --           -- ddddddd
dddddhh                                         y                        ddddddd
ddddddd                                         N                        ddddddd
dhddddd                                         y                        hhhhhdd
ddhhhdd                                         N                        dd...dd
dddddhh                                         y                        dd...dd
ddddddd  -- ---   -  -- -  -      - -   -   - - N---  -    -    -   - - -dd...dd
.hddddd                                         y                        hhhhhDD
..hhhdd                                         N                        DDDDDDD
.....hh                                         y                        DDDDDDD
.......                                         N                        DDDDDDD
.h.....                                         y                        hhhhh..
..hhh..-- -    --- -   ---      --   -  - - -- -N -  -    -  --  -   -  -.......
.....hh                                         y                        .......
.......                                         N                        .......
dh.....                                         y                        hhhhh..
ddhhh..                                         N                        DDDDD..
dddddhh                                         y                        DDDDD..
ddddddd -  -    -  -  -  ---  ----  - -  --  ---N-- -   - -         -    DDDDD..
dhddddd                   LLLLLLLLLLLLLLLLLLLLLLLLLLL                    hhhhhdd
ddhhhdd                   l...llllhhlllllhDDDllllllll                    ddddddd
ddd..hh                   l...llllllDhhhDDDDDlhhhdhhh                    ddddddd
ddd...d                   l.hhllllllDDDDDDDDhhddddd..                    ddddddd
LlLlLllLlLLLLLLLLLlLLLllLLlLlLLlLLLLlLLlLLLLlllLLlLllLlLLlLlLLLLLLlLLLLLLllLllll
dddddddddhhl...lhh......dddDDDDDDDDhhhhhdddddhhhhhhhDDddd...dddDDD....hhhhhddddd
hhhhhhdddDDDhhhh........dddDDDDDDhh.ddd.hhdddDDDDDDDDDddd...dddDDD..h...DDDhhddd
DDDDDDhhdDDDDDD......hhhhhdDDhhhd...ddd...hddDDDDDDDDDddd...dddDDDhdd...DDDDDhhd
DDDDDDDDhDDDDDD...hhhDDDDDDhddddd...ddd...dhhDDDDDDDDhhhhhhhdddhhhddd...DDDDDD.h
```

### `sit_low`

```
                DDD
            WWLLLLlllll
           WWWLLLLllllll
          WWWWLLLLlllllll
         LLLLLLLLLllllllll
        DLDDDLDDDLDDDLDDDLD
          knnnnnnnnnnnnnk
          kK.WKKRRRK.WKKk
          kKKKKKRRRKKKKKk
        NNNNNnNkRRRkNNnNNNN
        yyyNNNNNNNNNNNNNyyy
     bbbBNnyyyyyNNNyyyyyNnBBBB
    bBbbNnNNnNNn...NNnNNnNNBBBBwWWw
    bBbyNnNNnNNnNNnNNnNNnNNnBBBLLLLD
   bBbbNynyNnNynyNnNNnNNnyynNBBLLLL
   bBbnNynyNnNynyNnNNnNNnyynNBBLLLLD
  bB bbNnyynNNnNNnNNnyNnNNnNBB LLLL
  bB bbbnyynNNnNNnNNnyNnNNnBBB KK
 KK  bbbBNNnNNnyNnNNnNynNNBBBB
     bNNNNNnNNnyNnNNnNynNNNNNB
   bbbbbbbbNNnyNnNNnNNnNNbbbbbbb
   BBBBBBBBNNnyNnNNnNNnNBBBBBBBB
   BBBBBBBBByNnNnNNNnNnBBBBBBBBB
    BBBBBB   NnN   NnN   BBBBBB
    BBBBBB   YYY   YYY   BBBBBB
    BBBBBB   NnN   NnN   BBBBBB
  DDDDDDDD               DDDDDDDD
```

### `sit_sip`

```
                DDD
            WWLLLLlllll
           WWWLLLLllllll
          WWWWLLLLlllllll
         LLLLLLLLLllllllll
        DLDDDLDDDLDDDLDDDLD
          knnnnnnnnnnnnnk
          kKnnKKRRRKnnKKk
          kKKKKKRRRwWWwKk
        NNNNNnNkRRRLLLLDNNN
        yyyNNNNNNNNLLLLNDyy
     bbbBNnyyyyyNNNLLLLDNnBBBB
    bBbbNnNNnNNn...LLLLKKNNBBB
    bBbyNnNNnNNnNNnNNnNKKBNnBB
   bBbbNynyNnNynyNnNNnNNnBBBNB
   bBbnNynyNnNynyNnNNnNNnyBBBB
  bB bbNnyynNNnNNnNNnyNnNNnNBB
  bB bbbnyynNNnNNnNNnyNnNNnBBB
 KK  bbbBNNnNNnyNnNNnNynNNBBBB
     bNNNNNnNNnyNnNNnNynNNNNNB
   bbbbbbbbNNnyNnNNnNNnNNbbbbbbb
   BBBBBBBBNNnyNnNNnNNnNBBBBBBBB
   BBBBBBBBByNnNnNNNnNnBBBBBBBBB
    BBBBBB   NnN   NnN   BBBBBB
    BBBBBB   YYY   YYY   BBBBBB
    BBBBBB   NnN   NnN   BBBBBB
  DDDDDDDD               DDDDDDDD
```

### `sit_look`

```
                DDD
            WWLLLLlllll
           WWWLLLLllllll
          WWWWLLLLlllllll
         LLLLLLLLLllllllll
        DLDDDLDDDLDDDLDDDLD
          knnnnnnnnnnnnnk
          kKW.KKRRRKW.KKk
          kKKKKKRRRKKKKKk
        NNNNNnNkRRRkNNnNNNN
        yyyNNNNNNNNNNNNNyyy
     bbbBNnyyyyyNNNyyyyyNnBBBB
    bBbbNnNNnNNn...NNnNNnNNBBBBwWWw
    bBbyNnNNnNNnNNnNNnNNnNNnBBBLLLLD
   bBbbNynyNnNynyNnNNnNNnyynNBBLLLL
   bBbnNynyNnNynyNnNNnNNnyynNBBLLLLD
  bB bbNnyynNNnNNnNNnyNnNNnNBB LLLL
  bB bbbnyynNNnNNnNNnyNnNNnBBB KK
 KK  bbbBNNnNNnyNnNNnNynNNBBBB
     bNNNNNnNNnyNnNNnNynNNNNNB
   bbbbbbbbNNnyNnNNnNNnNNbbbbbbb
   BBBBBBBBNNnyNnNNnNNnNBBBBBBBB
   BBBBBBBBByNnNnNNNnNnBBBBBBBBB
    BBBBBB   NnN   NnN   BBBBBB
    BBBBBB   YYY   YYY   BBBBBB
    BBBBBB   NnN   NnN   BBBBBB
  DDDDDDDD               DDDDDDDD
```

### `lantern`

```
 D 
DLD
LOL
OYO
LOL
DDD
```

### `lantern_halo`

```

     qqqq q q
     qqqqqq   qqq
   qqq qq  qq qqq
 q   qqgggggg    q
q  qq ggggggggqq q q
   qqggggggggggq   q
 q q ggggggggggqqq
  q  ggggggggggq qq
  qqqqggggggggq
  q qq gggggg q  q
   qq     q
     q   qq q
```

### `watcher`

```
R  R
```

### `eye_rock`

```
...ddhhhhhhhDDDhhhdddddDDDDhhhhhhlllllllllllllllhhhhhhDDDDDDDDDDDDDDhDDDDDDhhhDD
...ddd...DDDDDDDDDhhdDDDhhhhlllllllllllllllllllllllllhhhhDDDDDDDhhhdddhhhhhDDDDD
...ddd...DDDDDDDDDDDDhhhhlllllhhhhhhhhhhhhhhhhhhhhhlllllhhhhDDhhddddddddDDDDDDDD
hhhhhd...DDDDhhDDDDhhhllllhhhhhhhdddddddddddhhhhhhhhhhhllllhhhDDddddddddDDDDDDhh
DDDDDhhhhhhhDDDhDhhlllhhhhhddddhhhDDhhhhhhhDDdddddddhdhhhhhlllhhDdddhdddDDDhhhDD
DDDDDDDDDDDDDDDDhlllhhhDDDDddhhDDDDDDDD...DDDdddddddddhDDDhhhlllhDDDDDhhhhhDDDDD
DDDDDDDDDDDDDDhllhhhhhDDDDDhhDDDDDDDDDD...DDDdddddddddDhhDDDDhhhllhDDDDDDDDDDDDD
hhhhhDDDDDDDDhlhhDddddhhhhhDDDDDDDDDDDD...DDhhhh.hhhddDDDhhhhDDDhhlhDDDDDDDDDDhh
DDD..hhhhhDhlhhhhhdddddddddDDDDhhhnnhhhhhhhDDDDD...DhdDDDDDDDDDDDDhhlhDDDDDhhhDD
DDD...DDDDhhhDDDDDhhdddddddDDhhnnnnnDDDDDDDDDDDD...DDDhDDDDDDDDDhhhnhhhDhhhDDDDD
DDD...DDDlhDDDDDDDDDhhdddddhhnnnnnnnDDDDDDDDDDDD...DDDDhhDDDDhhhnnnnn.hlDDDDDDDD
hhhhh.DDhDDDDhhDDDDDD.hhhhhnnnnnnnnnDDDDDDDDhhhhdhhhDDDDDhhhh..nnnnnn...hDDDDDhh
dddddhDhhhhhdddhhhDDD...DDDnnnnhhhddhhhhhhhnndddddddhDDDDDDD...nnnnnh...DDDhhhdd
dddddDddddddddddddhhD...DDDnnhhdddddnnn...nnndddddddddhDDDDD...nhhhnnnhhhhhDdddd
ddddddddddddddddddddhh..DDDhhdddddddnnn...nnndddddddddnhhDDD.hhhnnnnnnnndddddddd
hhhhhddddddddhhdddddddhhhhhdddddddddnnn...nnhhhhdhhhddnnnhhhhnnnnnnnnnnnddddddhh
DDDDDDhhhhhhDDDhhhdddddddddddddhhhddhhhhhhhDD...ddddhdnnnnnnnnnnnnnnhnnndddDhhdd
DDDDDDDDDDDDDDDDDDhhdddddddddhh..dddDDDDDDDDD...ddddddhnnnnnnnnnhhhdddhhhhDddddd
DDDDDDDDhDDDDDDDDDddhhdddddhhd...dddDDDDDDDDD...ddddddDhhnnnnhhh..ddddddhDdddddd
hhhhhDDDDlhDDhhDDDddddhhhhhddd...dddDDDDDDDDhhhhDhhhddDDDhhhhDD...ddddhlDdddddhh
DDDDDhhhhDhhhDDhhhdddddddddddd.hhhddhhhhhhhdd...DDD.hdDDDDDDDDD...ddhhhDdddhhhdd
DDDDDDDDDDDhlhhDDDhhdddddddddhhddddd...dddddd...DDD...hDDDDDDDD.hhhhlhDhhhhddddd
DDDDDDDDDDDDDhlhhDddhhdddddhhddddddd...dddddd...DDD...dhhDDDDhhhhhlhDddddddddddd
hhhhhDDDDDDDDDhllhhhd.hhhhhddddddddd...dddddhhhhdhhh..dddhhhhhhhllhDddddddddddhh
dddddhhhhhhhDDDDhlllhhh.dddddddhhh..hhhhhhhdddddddddh.ddddhhhlllhDDdhddddddhhhdd
dddddd...DDDDDDDDhhlllhhhhhddhh.....ddddddddddddddddddhhhhhlllhhDhhdddhhhhhddddd
dddddd...DDDDDDDDDDhhhllllhhhhhhh...ddddddddddddhhhhhhhllllhhhDDdddddddddddddddd
hhhhhd...DDDDhhDDD.DDhhhhlllllhhhhhhhhhhhhhhhhhhhhhlllllhhhhDDddddddddddddddddhh
DDD..hhhhhhhnnnhhh...DDDhhhhlllllllllllllllllllllllllhhhhDDDddddddddhddddddhhhDD
DDD...DDDnnnnnnnnnhh...DDDDhhhhhhlllllllllllllllhhhhhhDDDDddddddhhhnnnhhhhhDDDDD
```

### `eye_ring`

```
              s       ss s        ssssss ssss s sss s  s  s  s
                      s    ssss sssss  ssssssssssssss s  sss
                  s  s   sss s ssssssss s ssss  ss sss        s     s      s s
                    s  ssss sssssssss  ss sss      sss ssss         s      s
                  sssssss sss               s   s   ssss  ssss  s
              s  sssssss  s                               ss  ss s
                sssss                  s             s      s ssss ss
          ssssss s                   s            s            ss s s      s
            sss                                                    ss
            s     s                                                 ss
        s s                s                                          ss
        s                         s                                   s  s ss
       s         s                                                             s
            s                                                s
                       s         s      s
          s                                                s
                                                                 s     s
       s                                               s   s          s  s
    s   s                                                               s
         s   s          s     s                            s  s       s
           s                               s         s              s  s
            sss                     s  s              s            s s     s
              ssss         s           s          s            sssss         s
               sss s   s                                    s ssss  s         s
 ss   s       s ssssss s      s       s       s          s s  ss               s
                   ssss   sss             s         sssss ssss
        s        s    ssssssss ssssss ssssssss ssss ss ssss    s
    s                 ss sss sss ssssssssssssss s    sss     s
                      ssss sss ss ss sssss ssss sss s     s s
             s     s       ss    sss sss  sssssss s   s  s                    s
```

### `eye_closed`

```



                                 lllllllllllllll
                           lllllllllllllllllllllllllll
                       hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh
                    lllllllllllllllllllllllllllllllllllllllll
                 lllllllllllllllllllllllllllllllllllllllllllllll
               hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh
             lllllllllllllllllllllllllllllllllllllllllllllllllllllll
           lllllllllllllllllllllllllllllllllllllllllllllllllllllllllll
         hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh
       lllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllll
      lllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllll
     LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL
     .......................................................................
      llllll.ll.ll.ll.ll.ll.ll.ll.ll.ll.ll.ll.ll.ll.ll.ll.ll.ll.ll.ll.lllll
       lllllllllllll.ll.ll.ll.ll.ll.ll.llll.ll.ll.ll.ll.ll.lllllllllllllll
         hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh
           lllllllllllllllllllllllllllllllllllllllllllllllllllllllllll
             lllllllllllllllllllllllllllllllllllllllllllllllllllllll
               hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh
                 lllllllllllllllllllllllllllllllllllllllllllllll
                    lllllllllllllllllllllllllllllllllllllllll
                       hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh
                           lllllllllllllllllllllllllll
                                 lllllllllllllll



```

### `eye_half`

```



                                 lllllllllllllll
                           hhhhhhhhhhhhhhhhhhhhhhhhhhh
                       hhhhlllllllllllllllllllllllllllhhhh
                    lllllllllllllllllllllllllllllllllllllllll
                 llllhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhllll
               hhhhhhhhhhhhlllllllllllllllllllllllllllhhhhhhhhhhhh
             hhhhlllllllllllllllllllllllllllllllllllllllllllllllhhhh
           llllllllllhhhhhhhhhhhhhWWWhhhhhhhhhhhhhhhhhhhhhhhllllllllll
         lllllhhhhhhhhhhhhh.......WW..................hhhhhhhhhhhhhlllll
       lhhhhhhhhh...........HHBccEEEECx...xCeEeEccBHH...........hhhhhhhhhl
      hhhhh....rrrrrHwwwwwwwwwBcceEECCx...xCCEEEccBwwwwwwwwwrrrHHH....hhhhh
     h.rrhHHHHHHHHwwwwwwwWWWWWBccEeECCx...xCCEeEccBWWWWWwwwwwwwrHHHHHHrrhh.h
     h.hhhHHHHHHHHwwwwwwwWWWWWBccEEECCx...xCCeEEccBWWWWWwwwwwwwHrrrrrrHhhh.h
      hhhhh....HHHHHHrwwwwwwwwBccEEECCx...xCCEEEccBwwwwwwwwwHHHHHH....hhhhh
       lhhhhhhhhh...........HHBcceEeECx...xCeEEEccBHH...........hhhhhhhhhl
         lllllhhhhhhhhhhhhh...........................hhhhhhhhhhhhhlllll
           llllllllllhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhllllllllll
             hhhhlllllllllllllllllllllllllllllllllllllllllllllllhhhh
               hhhhhhhhhhhhlllllllllllllllllllllllllllhhhhhhhhhhhh
                 llllhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhllll
                    lllllllllllllllllllllllllllllllllllllllll
                       hhhhlllllllllllllllllllllllllllhhhh
                           hhhhhhhhhhhhhhhhhhhhhhhhhhh
                                 lllllllllllllll



```

### `eye_open`

```



                                 ...............
                           .......hhhhhhBhhhhhh.......
                       ....hhHHHHHHHBBBBcBBBBHHHHHHHhh....
                    ...hHHHHHHHHHHBBcccccccccBBHHHHHHHHHHh...
                 ..hHHHHHHHHHHHHHBBcccxx.xxcccBBHHHHHHHHHHHHHh..
               .hHHHHHHHHHHHwwwwBBcceExx.xxEEccBBwwwwHHHHHHHHHHHh.
             .hrHHHHHrrrwwwwwwwwBccEEEx...xEEEccBwwwwwwwwHHHHHHHHHh.
           .hHrHrrrrrwwwrrwwwwwBccWWWEx...xeeEEccBwwwwwwwwwwHHHHHHHHh.
         .hhrrHHHHHHwwwwwwwwWWWBcEWWEEx...xEeEEEcBWWWwwwwwwwwHHHHHHHHhh.
       .hhhHHHHHHHwwwwwwwwWWWWBccEEEECx...xCeEeEccBWWWWwwwwwwwwHHHHHHHhhh.
      .hhrrrrrrrrrrrwwwwwWWWWWBcceEECCx...xCCEEEccBWWWWWwwwwrrrHHHHHHHHhrr.
     .rrrhHHHHHHHwwwwwwwWWWWWWBccEeECCx...xCCEeEccBWWWWWWwwwwwwrHHHHHHrrhhh.
     .hhhhHHHHHHHwwwwwwwWWWWWWBccEEECCx...xCCeEEccBWWWWWWwwwwwwwrrrrrrHhhhh.
      .hhhHHHHHHHHwwwrwwwWWWWWBccEEECCx...xCCEEEccBWWWWWwwwwwwwHHHHHHHHhhh.
       .rrrHHHHHrrrrrwwwwwWWWWBcceEeECx...xCeEEEccBWWWWwwwwwwwwHHHHHHrrrh.
         .hrrrrrHHHHwwwwwwwwWWWBcEeEEEx...xEEEeEcBWWWwwwwwrrwHHrrrrrrhh.
           .hHHHHHHHHwwwwwwwwwwBccEEeEx...xEEEEccBwwwwwrrrrrrrrrHHHHr.
             .hHHHHHHHHHwwwwwwwwBccEEex...xEEEccBwwwwwwwwHHHHHHHHHh.
               .hHHHHHHHHHHHwwwwBBccEexx.xxEEccBBwwwwHHHHHHHHHHHh.
                 ..hHHHHHHHHHHHHHBBcccxx.xxcccBBHHHHHHHHHHHHHh..
                    ...hHHHHHHHHHHBBcccccccccBBHHHHHHHHHHh...
                       ....hhHHHHHHHBBBBcBBBBHHHHHHHhh....
                           .......hhhhhhBhhhhhh.......
                                 ...............



```

### `eye_look_l`

```



                                 ...............
                           .......hhhhhhhhhhhhh.......
                       ....BBBcBBBBHHHHHHHHHHHHHHHHHhh....
                    ...hBBcccccccccBBHHHHHHHHHHHHHHHHHHHHh...
                 ..hHHHBBcccxx.xxcccBBwwwwwwwwwHHHHHHHHHHHHHHh..
               .hHHHHHBBcceExx.xxEEccBBwwwwwwwwwwwwwwHHHHHHHHHHHh.
             .hrHHHHHrBccEEEx...xEEEccBwwwwwwwwwwwwwwwwwwHHHHHHHHHh.
           .hHrHrrrrrBccWWWex...xEeEEccBWWWWWWWWWwwwwwwwwwwwHHHHHHHHh.
         .hhrrHHHHHHwBcEWWEEx...xEEEEEcBWWWWWWWWWWWWWwwwwwwwwHHHHHHHHhh.
       .hhhHHHHHHHwwBcceeEECx...xCEEEeccBWWWWWWWWWWWWWWwwwwwwwwHHHHHHHhhh.
      .hhrrrrrrrrrrrBcceEECCx...xCCEEEccBWWWWWWWWWWWWWWWwwwwrrrHHHHHHHHhrr.
     .rrrhHHHHHHHwwwBccEEECCx...xCCEEEccBWWWWWWWWWWWWWWWWwwwwwwrHHHHHHrrhhh.
     .hhhhHHHHHHHwwwBccEEeCCx...xCCEEEccBWWWWWWWWWWWWWWWWwwwwwwwrrrrrrHhhhh.
      .hhhHHHHHHHHwwBccEEECCx...xCCEEEccBWWWWWWWWWWWWWWWwwwwwwwHHHHHHHHhhh.
       .rrrHHHHHrrrrBccEEeECx...xCEeEeccBWWWWWWWWWWWWWWwwwwwwwwHHHHHHrrrh.
         .hrrrrrHHHHwBcEEeeEx...xEeEEEcBWWWWWWWWWWWWWwwwwwrrwHHrrrrrrhh.
           .hHHHHHHHHBcceEeex...xEEEeccBWWWWWWWWWwwwwwwrrrrrrrrrHHHHr.
             .hHHHHHHHBccEEex...xEEEccBwwwwwwwwwwwwwwwwwwHHHHHHHHHh.
               .hHHHHHBBccEExx.xxEeccBBwwwwwwwwwwwwwwHHHHHHHHHHHh.
                 ..hHHHBBcccxx.xxcccBBwwwwwwwwwHHHHHHHHHHHHHHh..
                    ...hBBcccccccccBBHHHHHHHHHHHHHHHHHHHHh...
                       ....BBBcBBBBHHHHHHHHHHHHHHHHHhh....
                           .......hhhhhhhhhhhhh.......
                                 ...............



```

### `eye_look_r`

```



                                 ...............
                           .......hhhhhhhhhhhhh.......
                       ....hhHHHHHHHHHHHHHHHHHBBBBcBBB....
                    ...hHHHHHHHHHHHHHHHHHHHHBBcccccccccBBh...
                 ..hHHHHHHHHHHHHHHwwwwwwwwwBBcccxx.xxcccBBHHHh..
               .hHHHHHHHHHHHwwwwwwwwwwwwwwBBcceexx.xxEEccBBHHHHHh.
             .hrHHHHHrrrwwwwwwwwwwwwwwwwwwBccEEEx...xEeeccBHHHHHHHh.
           .hHrHrrrrrwwwrrwwwwwwWWWWWWWWWBccWWWEx...xEEEEccBHHHHHHHHh.
         .hhrrHHHHHHwwwwwwwwWWWWWWWWWWWWWBcEWWEEx...xEEEEEcBwHHHHHHHHhh.
       .hhhHHHHHHHwwwwwwwwWWWWWWWWWWWWWWBccEeEeCx...xCEEEEccBwwHHHHHHHhhh.
      .hhrrrrrrrrrrrwwwwwWWWWWWWWWWWWWWWBccEEECCx...xCCeEEccBrrHHHHHHHHhrr.
     .rrrhHHHHHHHwwwwwwwWWWWWWWWWWWWWWWWBcceEECCx...xCCEeEccBwwrHHHHHHrrhhh.
     .hhhhHHHHHHHwwwwwwwWWWWWWWWWWWWWWWWBccEEeCCx...xCCEEEccBwwwrrrrrrHhhhh.
      .hhhHHHHHHHHwwwrwwwWWWWWWWWWWWWWWWBccEEECCx...xCCEEEccBwwHHHHHHHHhhh.
       .rrrHHHHHrrrrrwwwwwWWWWWWWWWWWWWWBccEeEECx...xCEeEEccBwwHHHHHHrrrh.
         .hrrrrrHHHHwwwwwwwwWWWWWWWWWWWWWBcEEEeEx...xEEEEecBwHHrrrrrrhh.
           .hHHHHHHHHwwwwwwwwwwwWWWWWWWWWBccEEEEx...xEEeEccBrrrrHHHHr.
             .hHHHHHHHHHwwwwwwwwwwwwwwwwwwBccEEEx...xeeeccBHHHHHHHh.
               .hHHHHHHHHHHHwwwwwwwwwwwwwwBBcceExx.xxEEccBBHHHHHh.
                 ..hHHHHHHHHHHHHHHwwwwwwwwwBBcccxx.xxcccBBHHHh..
                    ...hHHHHHHHHHHHHHHHHHHHHBBcccccccccBBh...
                       ....hhHHHHHHHHHHHHHHHHHBBBBcBBB....
                           .......hhhhhhhhhhhhh.......
                                 ...............



```

### `cave_back`

```
ddddddddhhhhhhhhhhhhhDDDDDDddd...dhhDDDDDhhhhhhDDDDDDDdhDDDDDDDdddddddhhhhh...hh
ddddddddd...DDDDDDdddhhDDDDddd..hhddDDDDDDDDDDDDDDDDDDdddhDDDDDddddhhhddDDD...DD
dddhddddd...DDDDDDdddddhhDDdddhhddddDDDDDDDDDDDDDDDDDDddddhhDDDddhhdddddDDD...DD
hhDDDhhhd...DDDDDDdddddddhhhhhddddddhhhhDDDDDDDhhhhhhhhdddddhhhhddddddddDDD...DD
DDDDDD..hhhhhhhhhhhhhdddddddddddddhhDDD..hhhhhhDDDDDDDdhddddddddddddddhhhhh...hh
DDDDDD...DDDDDDDDDdddhhdddddddddhhDDDDD...DDDDDDDDDDDDdddhdddddddddhhhddDDDDDDDD
DDDhDD...DDDDDDDDDdddddhhdddddhhDDDDDDD...DDDDDDDDDDDDddddhhdddddhhdddddDDDDDDDD
hhD..hhh.DDDDDDDDDdddddddhhhhhDDDDDDhhhh..DDDDDhhhhhhhhdddddhhhhddddddddDDDDDDDD
DDD.....hhhhhhhhhhhhhddddddDDDDDDDhhDDDDDhhhhhhllllllllhdddd...dddddddhhhhhDDDhh
DDD......llllllllllllhhddddDDDDDhhDDDDDDDDDDDllllllllllllhdd...ddddhhhllllllllll
DDDh.....llllllllllllllhhddDDDhhDDDDDDDDDDDDDlllllllllllllhh...ddhhlllllllllllll
hhdddhhh.llllllllllllllllhhhhhDDDDDDhhhhDDDDDllhhhhhhhhlllllhhhhllllllllllllllll
ddddddddhhhhhhhhhhhhhllllllDDDDDDDhhdddddhhhhhh.dddddddhllllllllllllllhhhhhlllhh
dddddddddddddddddddddhhllllDDDDDhhllddddddddd...dddddddddhlllllllllhhhlldddddddd
dddhdddddddddddddddddddhhllDDDhhllllddddddddd...ddddddddddhhlllllhhllllldddddddd
hhdddhhhdddddddddddddddddhhhhhllllllhhhhddddd..hhhhhhhhdddddhhhhlllllllldddddddd
dddddd..hhhhhhhhhhhhhdddddd...llllhhddd..hhhhhhDDDDDDDdhdddddddlllllllhhhhhdddhh
dddddd...DDDDDDDDDDDDhhdddd...llhhddddd...dddDDDDDDDDDdddhdddddllllhhhddDDDDDDDD
dddhdd...DDDDDDDDDDDDDDhhdd...hhddddddd...dddDDDDDDDDDddddhhdddllhhdddddDDDDDDDD
hhDDDhhh.DDDDDDDDDDDDDDDDhhhhhddddddhhhh..dddDDhhhhhhhhdddddhhhhddddddddDDDDDDDD
DDDDDDDDhhhhhhhhhhhhhDDDDDDdddddddhhDDD..hhhhhhDDDDDDDdhddddddddddddddhhhhhDDDhh
DDDDDDDDDDDDDDDDDDdddhhDDDDdddddhhDDDDD...DDDDDDDDDDDDdddhdddddddddhhhddDDDDDDDD
DDDhDDDDDDDDDDDDDDdddddhhDDdddhhDDDDDDD...DDDDDDDDDDDDddddhhdddddhh..dddDDDDDDDD
hh.DDhhhDDDDDDDDDDdddddddhhhhhDDDDDDhhhh..DDDDDhhhhhhhhdddddhhhhdd...dddDDDDDDDD
...DDDDDhhhhhhhhhhhhhddddddDDDDDDDhhDDDDDhhhhhh.dddddd.hdddddddddd...dhhhhhDDDhh
lllLLLlLLLllllLLLlLLlLLLlLlLlLLlLLlLLLLLlLLlLlLLlLLLlLlLLLLlLllLllllLlLlLLlLLlll
ddd...ddd...ddddhlDDDDhhddddddddddddddddddhhhDDDDDDhh.llhhh.dddDDD...DDDDDDDhhhh
ddd...hhhhh.ddddddhhhhdddddddddddddddddhhhDDDhhhDDDDDDhhd...dddDDD...DDDDDhhdddd
hhhhhhddddddhhdddddddddddddhhhhhhhhhhhhDDDDDDdddhDDDDDddd...dddDDD...DDDhhdddddd
ddddddddddddddhddddddddddhDDDD...DDDDDDDDDDDDddddhhDDDddd..hhhhhhhhhhhhDdddddddd
```

### `star_a`

```





                                          c
                                      c  c    cc c
                                  ccc  C C  Cc
                               c   CCC CCCCC
                                ccc   CWWWCCCc
                                    CCC CC    ccc
                                 ccc    c cc
                                c       cc

















```

### `star_b`

```


                           c                c
                            ccc            c
                               c     c     c          ccc
                                c    c    c        ccc
                                 c   cC  C    CC c
                         c        CCC  C C  CC
                        cccc ccC   CCC WWWCC
                                CCC   WWWWWCCC
                                    CCCWWW    CCc
                                 CCC    C CCc    ccccccc
                             cccC       CC   c
                           cc           c     cc
                          c             cc
                                         c














```

### `burst_1`

```


                                        tt
                                        t
                                    t tWWt t    t
                               ttFt tFWFCWCWtt  t
                                 FFCWFCC~F=FFCWF t
                                 tW====x~%==CFFW tt
                               t WCWC~WWWWWCCFWFt
                             t  WFFCxxWWWWW%%=FFW
                                FCC=%%WWWWW==xFCWtt
                            tt  WWFFFCCx=~CCCWFFF
                             t tt FFF~C==FF~CF
                               ttttWWFCFCWWWFW  tt
                                  ttFWWWWt  t t
                                 t  t t  t
                                   t













```

### `burst_2`

```
                   t tWWCC  WWFWFCFF~%%%====xCCCCWFW ttWt t
                   t WFCFCCCFFCFC~~~~%%%====xxxxFFFFFFFCWtt
                     WFCCCCCC~~CCC~~~%%%====xxxCCC~~%%%FFW
                       tCCCCCxxCCCC~~~~~%%%xxxCCCC~~%%%%CFW  t
                     t  WWCCxxxxCCCxCC~~%%%==xCC~~~~~%===FWt
                         FF==xxxx=xxxCC~%%==xxxC~~~~%%===FWt
                 t  tWFt FCF========xxCC~~=xxCCCC%%%%%%=FCt
                    tWCC==%%%==%%%%====x~%==CC~~~~%%===xFWW
                    FWC===%%%%%~~~~%~~WWWWWCC~%%%%=====xFCFW
                  t WCF%%%~~~~~CCCCCxxWWWWW%%=====xxxxxCCCCCW
                 ttFFC~~~~CCCCCxxxx=%%WWWWW==x====xxxxxCCCCCFWt
               t  tFCF~~~~CCCxx====%%CCx=~CCCCxxxxCCxxxCCCCCFW t
                 ttWFF~CCCxxxxxx%%%%~~C==%%~~CCCCCCCCCC~~~CCCF
                tttFFCCCCCCxx====%~~~CCxx=%%~~~C~~~~CC~~~~~%FCW t
               ttt tWWCCCCCx=====%%~CCxxx==%%~%%%~~~~F~~~~FFWFtt t
                  t t WWWFFxx==%%%%~~~xxx=====%%%%~FCFF  CFW  tt
                     t tWFFCx==%%%~~~CCCCxxx===%%%==FW
                        t WCF====~~~~CCCCCxx========Ft
                          tWFC==%%%%~CCCCFCC=xxxx==CCWt
                         tttWC=%%%%%~~~~~tWFFFFCCF=CF
                            WWFC%%%%~~CCFt   WFFFt FF   t
                          t  WFCCFFCFFFFF      tttt  t
                           ttt FFWWF  tt          t
                               t t
                                t t





```

### `burst_3`

```
Cxx======%%%%%~~%%%%~~~~~~%~~~~~%%%%~%%%====xCCCC~~~~~%======xxxxCC~~~~~%%%%%%==
Cxx=====%%%%%~~~~~%~~~~~~CCC~~~~~~~~~%%%====xxxx~~~~~%%%======xCCCCC~~~~~%%%%%==
Cx=====%%%%%%~~~~~CCC~~~CCCCC~~CCC~~~%%%====xxxCCC~~%%%%%===xxxCCCCC~~~~~~%%%%%=
==%%%==%%%%%~~~~~CCCCCCxCCCCCxxCCCC~~~~~%%%xxxCCCC~~%%%%%=xxxxxxCCCCC~~~~~%%===x
=%%%%%~~~~~%~~~~~CCCCCxxxxxCxxxxCCCxCC~~%%%==xCC~~~~~%=====xxxxxCCCCC~%%%%%=====
=%%%%%~~~~~CCCCCxCCCCCxxxxx==xxxx=xxxCC~%%==xxxC~~~~%%=====xxxxxC~~~~~%%%%%=====
=%%%%%~~~~~CCCCCxxxxx==xxx==========xxCC~~=xxCCCC%%%%%%===xxCCCCC~~~~~%%%%%=====
=%%%%%~~~~~CCCCCxxxxx=====%%%==%%%%====x~%==CC~~~~%%===xxxxxCCCCC~~~~~%%%%%=====
=%%%%%~~~~~CCCCCxxxxx=====%%%%%~~~~%~~WWWWWCC~%%%%=====xxxxxCCCCC~~~~~%%%%%=====
%~~~~~CCCCCxxxxx=====%%%%%~~~~~CCCCCxxWWWWW%%=====xxxxxCCCCC~~~~~%%%%%=====xxxxx
~CCCCCxxxxx=====%%%%%~~~~~CCCCCxxxx=%%WWWWW==x====xxxxxCCCCC~~~~~%%%%%=====xxxxx
~CCCCCxxxxx=====%%%%%~~~~~CCCxx====%%CCx=~CCCCxxxxCCxxxCCCCC~~~~~%%%%%=====xxxxx
~CCCCCxxxxx=====%%%%%~~CCCxxxxxx%%%%~~C==%%~~CCCCCCCCCC~~~CC~~~~~%%%%%=====xxxxx
~CCCCCxxxxx=====%~~~~~CCCCCxx====%~~~CCxx=%%~~~C~~~~CC~~~~~%%%%%~%%%%%=====xxxxx
~CCCCCxxxxx=%%%%%~~~~~CCCCCx=====%%~CCxxx==%%~%%%~~~~%~~~~~%%%%%=====x=====xxxxx
~~CCCxx=====%%%%%~~~~~~Cxxxxx==%%%%~~~xxx=====%%%%~~%%%%%~%%%%%%=====xxxxxCCxxxC
CCxxxxx======%%%%%~~~CCCxxxxx==%%%~~~CCCCxxx===%%%==%%%%%===%%%=====xxxxxxCCCCC~
CCCxxxxx=====%%%%%~CCCCCCxxx=====~~~~CCCCxxx=========%%%======x=====xxxxxCCCCC~~
CCCxxxxxx=====%%~~~~CCCCCCx=====%%%%~CCCCxxx=xxxx=====x======xxxx==xxxxxCCCCCC~~
CCCCxxxxx====%%~~~~~~CCCCxxxx==%%%%%~~~~~CCCCxxxxx==xxxxx===xxxxxxCCxxxxCCCCC~~~
CCCCCxxxxx%%%%%%~~~~~~~xxxxxxx=%%%%%~~~~~CCCCxxxxxCxxxxxxxxxxxxxxCCCCCCCCCCC~~~~
CCCCCxx====%%%%%%~~~~CCCxxxxx======~~~~~~CCCCCCCCCCCxxxxxCCCxxxxCCCCCC~~~~CC~~~~
~CCCxx======%%%%%%%~CCCCCCCx=======%%%%%%~~~~~CCCCCCCxCCCCCCCxCCCCCCC~~~~~~%%~~~
~Cxxxxx=======%%%%~~~CCCCCCCx=====%%%%%%%~~~~~~CCCCC~CCCCCCC~~~CCCC~~~~~~~%%%%%~
CCxxxxxxx======%%~~~~~~CCCCxxxxxxx%%%%%%%~~~~~~~~~~~~~CCCC~~~~~~~C~~~~~~%%%%%%%F





```

### `stand_low`

```
    DLLLD
   DLWLLLD
  DDDLDLDDD
  KK.WKK.WK
  kKKKRKKKk
 NNNNkRkNNNN
 BNnNNnNNnNB
BBNNNnNNnNNBwWw
BBNnNNnNNnNBLLLD
K NNnNNnNNN LLL
  NNNNNNNNN
  BNnNYNnNB
  BBB   BBB
  BBB   BBB
 DDDD   DDDD
```

### `stand_sip`

```
    DLLLD
   DLWLLLD
  DDDLwWwDD
  KK.WLLLDK
  kKKKLLLKk
 NNNNkRkNNNK
 BNnNNnNNnBB
BBNNNnNNnBB
BBNnNNnNNnN
K NNnNNnNNN
  NNNNNNNNN
  BNnNYNnNB
  BBB   BBB
  BBB   BBB
 DDDD   DDDD
```

### `stand_toss`

```
    DLLLD
   DLWLLLD   K
  DDDLDLDDD BB
  KK.WKK.WKBB
  kKKKRKKKBB
 NNNNkRkNNNN
 BNnNNnNNnNB
BBNNNnNNnNN
BBNnNNnNNnN
K NNnNNnNNN
  NNNNNNNNN
  BNnNYNnNB
  BBB   BBB
  BBB   BBB
 DDDD   DDDD
```

### `stand_ready`

```
    DLLLD
   DLWLLLD
  DDDLDLDDD
  KK.WKK.WK
  kKKKRKKKk
 NNNNkRkNNNN
 BNnNNnNNnNB
BBNNNnNNnNNBB
BBNnNNnNNnNBB
K NNnNNnNNN K
  NNNNNNNNN
  BNnNYNnNB
  BBB   BBB
  BBB   BBB
 DDDD   DDDD
```

### `mug_fly`

```
wWw
LLLD
LLL
```

### `lantern_small_halo`

```
    ggggg
  qggggqgqg
 ggqqggqqqqg
gqqqqggqqqgqq
gqggggggqgqqg
qggqggggqgqqg
 qqqqgqqqqqq
  qqggqgggq
    qqqqg
```

### `spray`

```
                                                 t   t                  t
 t                              t               t      C           t  C    t
  t   t   t       C             t            t   t     t
                              t                  t      t       t       t
          t                              C                   t   t
     t               t                                               C     C
               t                      t                                t       C
         t               t       t     t    t      C    t          t
       t                 t    t
   t                 t             t     t              t            t
                   t   t                              t            t   t t
    t    t                                                           t C       t
           t                         t            t     t     t
  t  C                                C                 t t                    C
             t          C                                 t
        t      t                      t                          t  Ct t
     t  t         t tt
  t                     t  t  t    t                           t      t  t
                           t                          t         C
                       t
       tt                                                    t   tt
                 t           t        t               t
    C                           t                                         tt
  t             C                 Ct  t t        t                       C C
                  C                            t
                            t                      C    t        t            t
```

### `glow_floor`

```
            tt  t tt tt    t  t t t t    t  t  tt t   tt      ttt tt t     tt
xxxCCxCxCxxxxxxCCxCxxCxCxxCxxCCxCCCxxCxCCxxxCCCCCCxxCxxCCCxxCCCCxCxCxxCxxCCxCxxx
~~%%%%%======xxxxxx~~~~%%%%====xxx~~~%%%===xxx~~~~%%%%====xxxxx~~~~~~%%%%%%====x
~~~~~~%%%%%====xxxx~~~~%%%===xxx~~~%%%====xxxx~~~~%%%%%%======xxxxx~~~~%%%%====x
xxx~~~~%%%%===xxxx~~~%%%===xxx~~~~%%%%====xxxxxx~~~~~~%%%%%====xxxx~~~~%%%===xxx
xxx~~~%%%===xxx~~~~%%%====xxxx~~~~~%%%%%%=====xxxxx~~~~%%%%===xxxx~~~%%%===xxx~~
x~~~%%%===xxxx~~~~%%%%=====xxxxxx~~~~~~%%%%====xxxx~~~%%%===xxx~~~%%%%====xxxx~~
~~%%%%====xxxx~~~~~~%%%%%%=====xxxx~~~~%%%%===xxx~~~%%%===xxxx~~~~%%%%=====xxxxx
~~%%%%======xxxxxx~~~~~%%%%====xxxx~~~%%%===xxx~~~%%%%====xxxx~~~~~~%%%%%%=====x
```

### `sil_raise`

```
   ..
    ..
     ..    ..........................
    ..........................
   ..     ...               ...
   ..     ...      ...      ...
   .       ..   .........   ..
  ..       ..  ...........  ..
  ..       ..  ...........  ..
  .        ...................
           ..  ...W...W...  ..
           ..  ...........  ..
           ...................
           ...................
           ...................
          .....................
          .....................
          .....................
           ...................
            .................
             ...............
             ...............
             ..... .........
             ..... ... .....
             .....  .  .....
             .....     .....
             .....     .....
             .....     .....
           ........   ........
           CCCCCCCC   CCCCCCCC
```

### `sil_strike`

```





                   ...
                .........
               ...........
               ...........
             ...............
               ...W...W...
               ...........
            .................
           ...................
           ...................
          .....................
          .....................
          .....................
           ....................
            ....................
             ...............  ...    ..
             ...............   ... ...
             ..... .........    ....
             ..... ... .....     ...
             .....  .  .....      ...
             .....     .....       ...
             .....     .....        ..
             .....     .....         ..
           ........   ........        C.
           CCCCCCCC   CCCCCCCC         C
```

### `glow_back`

```
                    b      bb bbb   bb  b b B    bb b bbb  b
                       b  bb B   bbb bbBb bbBBbBbBb b bb  b
                  bb      b bbb bBbBbBBbbBBBBBbBb b b bb  bb  bb
               b bb  bB b BBBBBbbBZbbbBZbBZZbBbBBbBbbbbb  bb bb   b
             b b    bbbBBbbbBZbZZZZZZZZZZZZZZZZZZZZZbbBbbb BB b  b
           bbb b bbbbBbBbBBZZZZZZZZZZZZZZZZZZZZZZZZbZZZBbBB Bbb b     b
        bb b  b   BBBBbBbZBZZZZZzZzzzzzzzzzzzZzzZZZZZZZZZZbBBBbbb b
        bbbb  bBbbbbbZbZZZZZcccccccccccccccccccccccccZZZZZbBBBBbB   bbbb
        bb bbb bbBBbZZZZZZZZzzzzzzzxxzxxxxzzzxzxzzzzzzZZZZZZbbbbB b   bbb
      b    b bBBbBZbZZZZccccccxxxcxxxxxxxxxxxxxxcccccccZZZZZZZBBbbb B  bbb b
     bb bb BBBbBBbbZZZZzzzzzzzxxxxxxxxCxxxxCxxxxxxzxzxzzzzzZZZbBbBbBb bb
      b bb BbBbbZZZZZZcccccxxxxxxCCxCCCCCCCCCCxCCxxxxxxcccZZZZZZBbbBBB  bb b
    b  b bb BbbbBZZZzzzzzxxxxxxxxxCCCCCCCCCCCCCCCxxxxxzxzzzzzzZBZZbbBbb   b  b
     b  b BBbbBZZZZZcccccxxxxxxCCCCCCCCCCCCCCCCCCCCxxxxxcccccZZZZZZBbBBbbbb b
    b bbbb BBBZZZZZzzzzzzxxxxCCCCCCCCCCCCCCCCCCCCCCxCxxxxxzzzzZZZZBBBbB
  b  bb bbBBBZbBZZZZccxcxxxxxCCCCCCCCCCCCCCCCCCCCCCCCCxxxxxccZZZZZBbBbBB     b
    b b bbBBBBBZZZZzzzzxxxxCCCCCCCCCCCCCCCCCCCCCCCCCxCxxxxzzzzzzZZZBBbbbB
  bbb  b bBbbZZZZZccccxxxxxxxCCCCCCCCCCCCCCCCCCCCCCCCxCxxxccccZZZbZZbBbb b  bbb
   bb  bbb BbBbbZZZzzzzzxxxxCCCCCCCCCCCCCCCCCCCCCCCCxxxxxzzzzzZZZZZBbb bb bbb b
  b    b BBbBBbZZcccccxxxxxxCCCCCCCCCCCCCCCCCCCCCCCCCxxxxcxcccZZZZZBbbbb bbb  b
     bbb bbbBBZZZZZzZzzzzxxxCCCCCCCCCCCCCCCCCCCCCCCCxxxxxxzzzZZZZZbbBBBbbb   b
  b    bbbBBBbbBZZZZccccxxxxxxCCCCCCCCCCCCCCCCCCCCCxxxxxcxccccZZZZbBbBBbbbb b
     bb   bBbBBbZZZZzZzzzzxxxxxCxCCCCCCCCCCCCCCCxCxxxxzxzzzzzZZZbZbbbbB bbbbbb
       b  bBBBBZZZZZZcccccccxxxxxxxCCxCCCCCCxCxxxxxxxcccccccZZZZBBbbB    b
      bb bb BBbBBbZZZzzzzzzzzxxxxxxxxCxxxCxxxxxxxxxxzzzzzzZZZZBbBBbBB bbbb  b
    b  b   bbBbbbbBZZZZZZcccccxccxxcxxxxxxxxxxxcxcxcccccZZZZZZBBbbbb  b
          bb  bBbbbBZBZZZzZzZzzzzzzxzzxzxzxxzxzzzzzzzzZZZZZZZbbbBb b   b  b
       bb  bbb B bbBbZBZZZZZcZccccccccccccccccccccZZZZZZZZZbbbbbbbb     b
           bb bbbbbbbBBbBbbZZZZZZZzZzzzZzzzzzzZZZZZZZZZBbZBBbbBbbb bbbb b
          bbb b  b  BbBbbBZBZbZZZZZZZcZZZZZZZZZZZZZZZZBBbBBBb bbb  bb b b
```

### `sparks`

```



              S
          S  SS  S
           S  S S    S
             SS   SS
                     S
        SS SS  SS S S  S
     S     SS S S   S SS
     S S S    S  S S  S
              S    S
      S     SS S S S   S
                S  S S
```

### `face`

```
llllllLLllllllLLllLLllllLLllLLLLllLLLLLLLLllllllLLllLLllLLLLllllllLLLLLLllllllLL
LLllLLllllLLLLllllLLllLLLLLLLLllllLLllLLLLllllllllLLLLLLLLllLLllllLLLLllllllllll
DDDDDWDDDDDDDDDWDDDDDDDDDWDDDDDDDDDWDDDDDDDDDWDDDDDDDDDWDDDDDDDDDWDDDDDDDDDWDDDD
................................................................................
nnnnkkkkkkKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKkkkkkknnn
nnnnkkNNNNyyKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKyyNNyykknnn
nnnnkkNNNNNNyNyNyNNyNNNyKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKyNNNNyyyNNNyNNNNNNkknnn
nnnnkknnnnnnNNNNNNNNNNNNyNNNNNNNNyNNKkRKKKkkKyNyyyNNNNyNyNNNNNNNNNNNNnnnnnnkknnn
nnnnkkkkkkKKnnnnnnnnnnnnNNNNNNNNNNNNykRKKKkkNNNNNNNNNNNNNnnnnnnnnnnnnKKkkkkkknnn
nnnnkkkkkkKKKKKKKK.......nnnnnnnnnnnkRRKKKKkknnnnnnnnnnn.......KKKKKKKKkkkkkknnn
nnnnkkkkkkKKK.....LLLLLLL.....KKKKKKkRRKKKKkkKKKKKK.....LLLLLLL.....KKKkkkkkknnn
nnnnkkkkkkK......LL.WW..LL......KKKKkRRKKKKkkKKKK......LL.WW..LL......Kkkkkkknnn
nnnnkkkkkk.......WW..CC.WW.......KKkRRRKKKKKkkKK.......WW..CC.WW.......kkkkkknnn
nnnnkkkkkkK.......WWWWWWW.......KKKkRRRKKKKKkkKKK.......WWWWWWW.......Kkkkkkknnn
nnnnkkkkkkKKKkkkkkkkkkkkkkkkkkKKKKKkRRRKKKKKkkKKKKKkkkkkkkkkkkkkkkkkKKKkkkkkknnn
nnnnkkkkkkKKKKKKKKkkkkkkkKKKKKKKKKkRRRRKKKKKKkkKKKKKKKKKkkkkkkkKKKKKKKKkkkkkknnn
nnnnkkkkkkKKKKKKKKKKKKKKKKKKKKKKKKkRRRRKKKKKKkkKKKKKKKKKKKKKKKKKKKKKKKKkkkkkknnn
nnnnkkkkkkKKKKKKKKKKKKKKKKKKKKKKKkRRRRRKKKKKKKkkKKKKKKKKKKKKKKKKKKKKKKKkkkkkknnn
nnnnkkkkkkKKKKKKKKKKKKKKKKKKKKKKKkRRRRRKKKKKKKkkKKKKKKKKKKKKKKKKKKKKKKKkkkkkknnn
nnnnkkkkkxKKxKKKKKKKKKKKKKKxKKKxKkRRRRRKKKKKKKkkKKKxKKKKKKxKKKxxxxKKxKxxkkkkknnn
nnnnkkkkkKKKxxxKKKxKKKxxKKxxKKKxkRRRRRRKKKKKKKKkkxKxxxKKxxxKKxKKKKxKKKKKkkkkknnn
nnnnkkkkkxxxxKxxKxKKxKKKxxxKKxKxkRRRRRRKKKKKKKKkkKxKKKxKKxKKKKKxKKxKxKKKkkkkknnn
nnnnkkkkkKxKKxxxKKKKxxKKKKxxKxxxkRRRRRRKKKKKKKKkkKKKKxxKKxKKxKxKxxKxxxKxkkkkknnn
nnnnkkkkkxKKKxxKKxxKxKxKxxxxKKKCCCC...CCCCC...CCCCxxxxKKxKxxKKKxKKxxxKxxkkkkknnn
nnnnkkkkknNNnNNnNNnNNnNynNynNynNNnNNnNNnNNnNynyynyNnNNnNNnNNnNNnNNnyNnNNkkkkknnn
nnnnknyNnyNnNNnyNnyynNNnNNnNNnNNnyNnNNnNNnNNnNynNNnyNnNNnNNnNynNNnNNnNNnNynyknnn
nnNNnNynNynyynyNnNNnNNnyNnNNnNNnNynNNnNNnyNnyynNynNNnNNnNNnNNnNNnNNnNNnyynyNnNNn
nyNnyynNNnNynNNnNNnNynNNnNNnNNnNNnyNnNNnNNnNNnNynyynNNnNNnNNnNNnNNnNNnNynNynNNnN
NNnNNnNNnNNnyNnNNnNNnNynyNnNynNNnyynNNnNynNNnNNnNynNNnNNnNynNNnyNnNNnyynyynyNnNN
CCCCxxCCCxxCCCCxxCCCxCxxxCxxxCCxCxxxxxCCCxxCCCCCCxxCCCxCxCCxxCCCxxCCCCxxxCxxCCxC
```

### `title_letters`

```
WWWWWW    WWWWWW  WWWWWW  WWWWWW    WW    WW    WWWW    WW      WW      WW
WWCCCCD   WWCCCCD WWCCCCD WWCCCCD   WWD   WWD   CCCCD   WWD     WWD     WWD
WWDDDDWW  WWDDDDDdWWDDDDDdWWDDDDWW  WWDd  WWDdWW DDDWW  WWDd    WWWW  WWWWDd
WWDdddWWD WWDdddddWWDdddddWWDdddCCD WWDd  WWDdWWD ddWWD WWDd    WWCCD CCWWDd
WWDd  WWDdWWWW    WWWW    WWWWWW DDdWWWWWWWWDdWWDd  WWDdWWDd    WWDDWW DWWDd
WWDd  WWDdWWCCD   WWCCD   WWCCCCD ddWWCCCCWWDdWWDd  WWDdWWDd    WWDdCCD WWDd
wwDd  wwDdwwDDDd  wwDDDd  wwDDDDDd  wwDDDDwwDdwwDd  wwDdwwDd    wwDd DDdwwDd
wwDd  wwDdwwDddd  wwDddd  wwDddddd  wwDdddwwDdwwDd  wwDdwwDd    wwDd  ddwwDd
wwDd  wwDdwwDd    wwDd    wwDd      wwDd  wwDdwwDd  wwDdwwDd    wwDd    wwDd
LLDd  CCDdLLDd    LLDd    LLDd      LLDd  LLDdCCDd  CCDdLLDd    LLDd    LLDd
LLLLLL DDdLLLLLL  LLLLLL  LLDd      LLDd  LLDd DLLLL DDdLLLLLL  LLDd    LLDd
CCCCCCD ddCCCCCCD CCCCCCD CCDd      CCDd  CCDd  CCCCD ddCCCCCCD CCDd    CCDd
 DDDDDDd   DDDDDDd DDDDDDd DDd       DDd   DDd   DDDDd   DDDDDDd DDd     DDd
  dddddd    dddddd  dddddd  dd        dd    dd    dddd    dddddd  dd      dd

```

### `title_rock`

```
d                   dd   d  d     d  dd       d             d              dd
      dd                   d            d                          d  d    d  d
d          dd  d  d               d      d d     d          d          d
 -  -- - --  ------ - -    - - -- -  ---- - ---   --    -  ----  ------ -- -----
                    d                         d          d         d      d
      d                           d                    d               d
 d              dd    d                     d    d                d     d
  d              d                 d         d   d
-  --- -   - ------ --    ---d--d  -d -d  - --- - d--- --  -  --  - ---  -   ---
d             d    d                   d  d       d d           d          d
                       d     d         d
     d                  dd             d                          d
          d                                                      d    d
--- -- -- --  -- - --- - ------------ ----  - -- --     - --- - -----  -----
   d   d    d                  d                           d            d
      d                        d   d                         d d           ddd
  d d          d        d    d      d d                 dd                  d
                                   d              d                  d
- --d     - -d-  -- -- -- - ----- --- d--------- - - -- d--- ---- --- -  - -- --
           d                     d                   d         d d d
    d                                                                  d
                d    d       d  d  d                d  d           d
         d                       d  d  d            d      d        d  d   d
  ------    --     - - -------- ----  --  ---------  ------- -- d-   - - - -- -
                      d      d     dd                   d           d  d
  d               d                                                       d
 d          d   d                 d    d
                        d   d              d  d                    d  d
---------  -   d- ---  ---  - ---- --  - ---d-- d -   -- - -- -- -d --- ----- --
         d    d      d  d   d      d      d                  d         d
```

### `title_water`

```
 tt     tt      t tttt  t t ttttt tt  ttttt   ttt t  tt     t  tttt tt   t tttt
xCCCxCxCxxCxCxxCxxxxxCCCCCCCCxxCCxCxCCxCxCxxCxCCxxxxCCCCxxxxCxCCxxCCCxxCxxCCxCxC
~~~%%%%%====xxx~~~%%%==xx~~%%==xxx~~~%%%====xxxxx~~~~~%%%===xxx~~%%%==xx~~%%===x
xxx~~~%%%===xx~~%%==xx~~~%%%===xxxx~~~~~%%%%%===xxx~~~%%===xx~~%%==xxx~~~%%%====
xxx~~%%==xx~~%%%===xxx~~~~%%%%%=====xxx~~~%%%==xxx~~%%==xx~~~%%%===xxxx~~~~~~%%%
~~%%===xxx~~~%%%%=====xxxxx~~~%%%===xx~~~%%==xx~~%%%===xxx~~~~%%%%%%====xxx~~~%%
```

### `embers`

```
       S                                                  S
                     SS           S S                      S       S       S
          S
                                 S       S                      S
                      S    S
   S                                                      S
 S                                                     S
                                                  S                     S  SSS S
                             S                    S                S
   S                                        S
 S            S     S             S                S
                                          S           S   S
        S                                                     S
                                                            S
                    S              S       S
                                                                              S
             S  S
            S                                           S S    S               S
           S                                         S          S     S
                          S                                  S        S
       S                                                    S
     S    S  S   S            S                                       S
```

### `frag_1`

```
         LLLL
     LLLLDDDDLLLL
   LLDDDDDDDDDD..LL
  LlhhhDDDDDDDD...DL
 LllllllhhhhhhhhhhhhL
 llllllll...llllllllh
Llhllllll...lllllllllL
.h.lhhhll...lllllllll.
 ..lllllhhhhhhhhhhhhl
 ..llllll...llllllll.
  .llllll...lllllll.
   ..hhll...lllll..
     ....hhhh....
         ....
```

### `frag_2`

```

       LLLLLLLL
    LLLDDllllllLLL
  LLDDDDDllhhhllllLL
 LDDhhhhhhlllllhhlDDL
 DDDDDDDDllllllllhhDD
 DDDDDDDDlllllllll.hh
 hhhDDDDDllhhhllll...
 hhhhhhhhhlllllhhl...
 .hhhhhhhllllll..hh..
  ..hhhhhllllll.....
    ...hhllhhhl...
       ........

```

### `frag_3`

```

      LLLLLLLLLL
    LLlllllllll.LL
  LLllhhhhhhlll...LL
 Lhhhhllllllhhl...DDL
 lllllllllllllh...DDD
 llllllllllllll.h.DDD
 lllllhhhhhhlll...hhh
 hhhhhllllllhhl...DDD
 .llllllllllllh...DD.
  ..llllllllllllh...
    ..hhhhhhllll..
      ..........

```

### `frag_4`

```

      LLLLLLLLLL
    LLDDDDDDhhhhLL
   LhhhhhDDDDDhhhhL
  LDDD...hhDDDDDDD.L
 LDDDD...DDhDDDDDD..L
 DDDDD...DDDhhDDDD.hh
 DhhhhhhhDDDDDhhhhhll
 .h...hhhhhDDDDDDDll.
  ....hhhllhDDDDDDl.
   ...hhhlllhhDDDD.
    ..hhhlllllhh..
      ..........

```

### `frag_5`

```

      LLLLLLLLLL
    LLDDDhhlllllLL
   LhhDDDDDhhhhDDDL
  LlllhhDDDDDDDDDD.L
 LllllllhDDDDDDDDDhhL
 llllllllhhDDDDDhhDDD
 hhhhhlllDDhhhh...DDD
 .llllhhlDDDDDD...DD.
  .lllllhDDDDDD...h.
   .lllllhhDDDD.hh.
    ..lllhhhhhhh..
      ..........

```

### `frag_6`

```
         LLLL
     LLLLllllLLLL
   LL.hhhlllhhh..LL
  L...llhhhhlll...DL
 LDh..lllllllll...DDL
 DDDDhlllllllllhhhDDD
LDDDDDhhllllhhhlllDDDL
.hhDDDDDhhhhllllllDDD.
 llhDDDDD...llllllDDD
 .l..hDDD...lllhhhhh.
  ....hhD...hhhlllh.
   .....hhhh...ll..
     ............
         ....
```

### `frag_7`

```
        LLLLLL
     LLLllllhhLLL
   LLlllhhh....llLL
  LDDDhhD......llllL
 LDDDDDDD......lllllL
 hhDDDDDD...hhhhhhhhh
LDDhhDDDhhhllll...DDDL
.DDDDDhhDllllll...DDD.
 DDDDDDDDllllll...DDD
 .hDDDDDDlllhhhhhhhh.
  .hhDDDhhhl...llll.
   ..lhhllll...ll..
     ...llll.....
        ......
```

### `frag_8`

```

      LLLLLLLLLL
    LLhhDlll....LL
   LDDDDDlll......L
  LDDDDDDlll.......L
 LDDDDDDhhhhhhhhhhhhL
 hhDhhhhDDDDDDDDDDlll
 ..DDDDDDDDDDDDDDDlll
 ..DDDDDDDDDDDDDDDll.
  .DDDDDhhhhhhhhhhh.
   .hhhhlhhhhhhhhh.
    ..lllhhhhhhh..
      ..........

```
