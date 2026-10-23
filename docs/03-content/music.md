# Music

**Owner:** content (`instruments`, `tunes`) · **Depends on:** [`../02-systems/24-ui-and-input.md`](../02-systems/24-ui-and-input.md) § Music

The music is synthesized while it plays: each instrument is an oscillator shaped by an envelope, a low-pass filter and a share of a small cave reverb, and each tune is note data. There are no audio files. Every tune here was written for Deepholm; none is transcribed or adapted from another game or from any copyrighted piece. A traditional public-domain tune may be added only with its source named in its `Source` cell.

## Instruments

`Wave` is `sine`, `triangle` or `sawtooth`. A note rises to its peak in `Attack`, falls to `Sustain` (a share of the peak) in `Decay`, holds until the note ends and fades out in `Release`. `Level` is the peak loudness before the music volume. `Filter` is the cut-off of a gentle low-pass filter; a `sawtooth` instrument is filtered at 2000 Hz or below, so that no instrument sounds harsh. `Detune` plays a second oscillator that many cents apart, for a soft chorus (0: one oscillator). `Reverb` is the share sent to the reverb.

| id | name | Wave | Attack (ms) | Decay (ms) | Sustain (%) | Release (ms) | Level (%) | Filter (Hz) | Detune (cents) | Reverb (%) |
|---|---|---|---|---|---|---|---|---|---|---|
| `harp` | stone harp | triangle | 4 | 1400 | 0 | 600 | 50 | 3000 | 0 | 35 |
| `lyre` | low lyre | triangle | 6 | 1100 | 0 | 500 | 28 | 2200 | 0 | 35 |
| `flute` | bone flute | sine | 90 | 300 | 70 | 400 | 34 | 4000 | 0 | 40 |
| `drone` | bellows drone | sawtooth | 1500 | 1000 | 80 | 2000 | 12 | 700 | 6 | 30 |
| `pad` | hall choir | triangle | 1200 | 800 | 75 | 1800 | 18 | 1800 | 5 | 50 |
| `bell` | anvil bell | sine | 2 | 2200 | 0 | 900 | 24 | 6000 | 0 | 45 |
| `bass` | low string | triangle | 10 | 900 | 30 | 400 | 40 | 900 | 0 | 15 |
| `drum` | deep drum | sine | 3 | 380 | 0 | 200 | 55 | 400 | 0 | 20 |

## Tunes

`Role` says when a tune plays (24 § Music): `intro` under the intro, once; `menu` on the screens before a fortress, `fortress` in turn while a fortress runs, `tense` while the hearth alert or a siege stands. `Tempo` is steps per minute; a step is the unit of the scores below (an eighth note in all of these).

| id | name | Role | Tempo (steps/min) | Mode | Source |
|---|---|---|---|---|---|
| `out_of_the_hold` | Out of the Hold | intro | 168 | G major | original |
| `hall_beneath` | The Hall Beneath | menu | 132 | D dorian | original |
| `deep_lantern` | Lantern in the Deep | fortress | 104 | A minor pentatonic | original |
| `stone_and_water` | Stone and Still Water | fortress | 96 | G major pentatonic | original |
| `forge_at_rest` | The Forge at Rest | fortress | 116 | D dorian | original |
| `long_winter` | The Long Winter Hall | fortress | 80 | E aeolian | original |
| `hearth_holds` | The Hearth Holds | tense | 168 | E phrygian | original |

## Scores

One table per tune, under its id. Each voice is played by one instrument; a voice's rows run on one after another, and every voice of a tune has the same length. A score is a list of tokens separated by spaces:

- a pitch is a letter `A`–`G`, an optional `#` (sharp) or `b` (flat) and an octave `0`–`8` (`A4` is 440 Hz);
- pitches joined by `+` sound together (`D3+A3`);
- `.` is a rest;
- `*n` after a pitch, a chord or a rest makes it last `n` steps (1 to 64); without it, one step.

### out_of_the_hold

The intro's piece, 120 steps (about 43 seconds and the tail), laid against its four scenes: bars 1 to 3 the hold, bars 4 to 8 the road (footsteps on the drum, the rabbit's scatter of notes in bar 6, the deer's one long note in bar 7), bars 9 to 12 the mountain (the pick strikes on the drum and the bell, then the spark), bars 13 to 15 the title.

| Voice | Instrument | Notes |
|---|---|---|
| 1 | flute | `.*8 B4*2 D5*2 G5*3 F#5 E5*2 D5 C5 A4*2 D5*2` |
| 1 | flute | `G5*2 F#5 G5 B5*2 A5*2 E5*2 G5*2 E5*2 C5*2 A4 B4 C#5 D5 E5 F#5 G5 A5 D5*6 .*2 B4 D5 G5 B5 A5*2 F#5*2` |
| 1 | flute | `.*8 .*4 A4*2 B4*2 .*8 .*4 D5 F#5 A5 B5` |
| 1 | flute | `D5*2 G5*2 B5*4 E5*2 G5*2 C6*2 B5 A5 D5*2 B4*2 G5*4` |
| 2 | harp | `G3 D4 B3 D4 G3 D4 B3 D4 E3 B3 G3 B3 E3 B3 G3 B3 C3 G3 E3 G3 D3 A3 F#3 A3` |
| 2 | harp | `. B3+D4 . B3+D4 . B3+D4 . B3+D4 . C4+E4 . C4+E4 . C4+E4 . C4+E4 . F#3+A3 .*6 . G3+B3 .*3 G3+B3 .*2 . D4+F#4 . D4+A4 . D4+F#4 . D4+A4` |
| 2 | harp | `E3*2 B3*2 G3*2 B3*2 A3 E4 C4 E4 D3 A3 F#3 A3 D3+A3 .*3 D3+A3 .*3 D3 A3 D4 F#4 A4 D5 F#5 A5` |
| 2 | harp | `G3 D4 G4 B4 D5 B4 G4 D4 C4 G4 E5 G4 D4 A4 F#5 A4 G3 D4 G4 B4 D5*4` |
| 3 | bass | `.*8 E2*4 B2*4 C2*4 D2*4` |
| 3 | bass | `G2*2 D3*2 G2*2 D3*2 C3*2 G2*2 C3*2 G2*2 D2*2 A2*2 .*4 G2*4 .*4 D2*2 A2*2 D3*2 A2*2` |
| 3 | bass | `E2*8 A2*4 D2*4 D2*2 .*2 D2*2 .*2 D2*2 A2*2 D3*2 A2*2` |
| 3 | bass | `G2*4 D3*4 C3*4 D3*4 G2*8` |
| 4 | drum | `.*24` |
| 4 | drum | `D2 . D2 . D2 . D2 . D2 . D2 . D2 . D2 . D2 . D2 .*5 D2 .*3 D2 .*3 D2 . D2 . D2 . D2 D2` |
| 4 | drum | `.*16 E2 .*3 E2 .*3 E2 . E2 . E2 E2 E2 .` |
| 4 | drum | `G2 .*7 .*8 .*8` |
| 5 | bell | `.*24` |
| 5 | bell | `.*16 A6 .*23` |
| 5 | bell | `.*16 D6 .*3 D6 .*3 .*5 F#6 A6 D7` |
| 5 | bell | `G4+D5+G5*8 C6 .*3 D6 .*3 G6*8` |
| 6 | pad | `.*24` |
| 6 | pad | `.*40` |
| 6 | pad | `.*32` |
| 6 | pad | `G2+D3+G3+B3*8 C3+G3+C4+E4*4 D3+A3+D4+F#4*4 G2+D3+G3+B3*8` |

### hall_beneath

| Voice | Instrument | Notes |
|---|---|---|
| 1 | flute | `D5*3 E5 F5*2 A5*2 G5*4 E5*2 D5*2 C5*3 D5 E5*2 G5*2 F5*6 .*2` |
| 1 | flute | `A5*3 G5 F5*2 E5*2 D5*2 E5*2 C5*4 D5*2 F5*2 E5*2 C5*2 D5*8` |
| 1 | flute | `.*2 A4*2 D5*2 E5*2 F5*3 G5 A5*4 C6*2 B5*2 A5*2 G5*2 A5*8` |
| 1 | flute | `G5*3 F5 E5*2 D5*2 C5*2 E5*2 G5*4 F5*2 E5*2 D5*2 C5*2 D5*8` |
| 2 | lyre | `D3 A3 D4 F4 A4 F4 D4 A3 C3 G3 C4 E4 G4 E4 C4 G3 C3 G3 C4 E4 G4 E4 C4 G3 F2 C3 F3 A3 C4 A3 F3 C3` |
| 2 | lyre | `A2 E3 A3 C4 E4 C4 A3 E3 C3 G3 C4 E4 G4 E4 C4 G3 D3 A3 D4 F4 A4 F4 D4 A3 D3 A3 D4 F4 A4 F4 D4 A3` |
| 2 | lyre | `D3 A3 D4 F4 A4 F4 D4 A3 F2 C3 F3 A3 C4 A3 F3 C3 G2 D3 G3 B3 D4 B3 G3 D3 A2 E3 A3 C4 E4 C4 A3 E3` |
| 2 | lyre | `G2 D3 G3 B3 D4 B3 G3 D3 C3 G3 C4 E4 G4 E4 C4 G3 F2 C3 F3 A3 C4 A3 F3 C3 D3+A3+D4*8` |
| 3 | drone | `D2+A2*64 D2+A2*64` |

### deep_lantern

| Voice | Instrument | Notes |
|---|---|---|
| 1 | harp | `E4*2 G4*2 A4*4 G4*2 E4*2 D4*4 C4*2 D4*2 E4*2 G4*2 A4*8` |
| 1 | harp | `C5*2 A4*2 G4*2 E4*2 G4*3 A4 G4*2 E4*2 D4*2 C4*2 D4*2 E4*2 E4*8` |
| 1 | harp | `A4*2 C5*2 D5*4 E5*2 D5*2 C5*4 A4*2 G4*2 A4*2 C5*2 D5*8` |
| 1 | harp | `E5*3 D5 C5*2 A4*2 G4*2 A4*2 C5*4 D4*2 E4*2 G4*2 E4*2 A3*8` |
| 2 | pad | `A2+E3+A3+C4*8 G2+D3+G3+B3*8 C3+G3+C4+E4*8 A2+E3+A3+C4*8` |
| 2 | pad | `A2+E3+A3+C4*8 E2+B2+E3+G3*8 D3+A3+D4+F4*8 E2+B2+E3+G3*8` |
| 2 | pad | `A2+E3+A3+C4*8 C3+G3+C4+E4*8 A2+E3+A3+C4*8 D3+A3+D4+F4*8` |
| 2 | pad | `A2+E3+A3+C4*8 C3+G3+C4+E4*8 G2+D3+G3+B3*8 A2+E3+A3+C4*8` |

### stone_and_water

| Voice | Instrument | Notes |
|---|---|---|
| 1 | flute | `.*4 D5*2 E5*2 G5*4 E5*2 D5*2 B4*6 A4*2 G4*8` |
| 1 | flute | `.*2 B4*2 D5*2 E5*2 D5*3 B4 A4*4 B4*2 A4*2 G4*2 E4*2 D4*8` |
| 1 | flute | `.*2 G4*2 A4*2 B4*2 D5*4 E5*2 G5*2 A5*4 G5*2 E5*2 D5*8` |
| 1 | flute | `E5*2 D5*2 B4*2 A4*2 G4*3 A4 B4*4 A4*2 G4*2 E4*2 D4*2 G4*8` |
| 2 | lyre | `G2 D3 G3 B3 D4 B3 G3 D3 E2 B2 E3 G3 B3 G3 E3 B2 G2 D3 G3 B3 D4 B3 G3 D3 C3 G3 C4 E4 G4 E4 C4 G3` |
| 2 | lyre | `G2 D3 G3 B3 D4 B3 G3 D3 D3 A3 D4 F#4 A4 F#4 D4 A3 E2 B2 E3 G3 B3 G3 E3 B2 D3 A3 D4 F#4 A4 F#4 D4 A3` |
| 2 | lyre | `G2 D3 G3 B3 D4 B3 G3 D3 E2 B2 E3 G3 B3 G3 E3 B2 A2 E3 A3 C4 E4 C4 A3 E3 D3 A3 D4 F#4 A4 F#4 D4 A3` |
| 2 | lyre | `E2 B2 E3 G3 B3 G3 E3 B2 C3 G3 C4 E4 G4 E4 C4 G3 D3 A3 D4 F#4 A4 F#4 D4 A3 G2+D3+G3*8` |
| 3 | drone | `G2+D3*64 G2+D3*64` |

### forge_at_rest

| Voice | Instrument | Notes |
|---|---|---|
| 1 | flute | `.*8 .*8 A4*3 G4 E4*2 G4*2 A4*6 .*2` |
| 1 | flute | `B4*3 A4 G4*2 D5*2 A4*6 .*2 G4*2 E4*2 C5*2 B4*2 D4*6 .*2` |
| 1 | flute | `F4*2 G4*2 A4*2 C5*2 D5*3 C5 B4*2 G4*2 E5*3 D5 C5*2 G4*2 A4*6 .*2` |
| 1 | flute | `C5*2 A4*2 F4*2 A4*2 B4*3 A4 G4*2 B4*2 C5*2 E5*2 D5*2 C5*2 D5*8` |
| 2 | bass | `D2*3 A2 C3*2 A2*2 D2*3 A2 C3*2 A2*2 C2*3 G2 E3*2 G2*2 D2*3 A2 C3*2 A2*2` |
| 2 | bass | `G2*3 D3 B2*2 D3*2 D2*3 A2 C3*2 A2*2 C2*3 G2 E3*2 G2*2 D2*3 A2 C3*2 A2*2` |
| 2 | bass | `D2*3 A2 C3*2 A2*2 G2*3 D3 B2*2 D3*2 C2*3 G2 E3*2 G2*2 D2*3 A2 C3*2 A2*2` |
| 2 | bass | `F2*3 C3 A2*2 C3*2 G2*3 D3 B2*2 D3*2 C2*3 G2 E3*2 G2*2 D2+A2*8` |
| 3 | bell | `.*24 D6*8 .*24 A5*8 .*24 D6*8 .*24 D6*8` |

### long_winter

| Voice | Instrument | Notes |
|---|---|---|
| 1 | bell | `B4*4 G4*4 E5*6 .*2 E5*4 D5*4 C5*6 .*2 B4*4 D5*4 G4*6 .*2 A4*4 F#4*4 D5*6 .*2` |
| 1 | bell | `C5*4 E5*4 A4*6 .*2 G4*4 C5*4 E5*6 .*2 D5*4 B4*4 F#4*6 .*2 G4*4 F#4*4 E4*8` |
| 2 | harp | `E2*2 B2*2 E3*2 G3*2 B3*2 G3*2 E3*2 B2*2 C2*2 G2*2 C3*2 E3*2 G3*2 E3*2 C3*2 G2*2` |
| 2 | harp | `G2*2 D3*2 G3*2 B3*2 D4*2 B3*2 G3*2 D3*2 D2*2 A2*2 D3*2 F#3*2 A3*2 F#3*2 D3*2 A2*2` |
| 2 | harp | `A2*2 E3*2 A3*2 C4*2 E4*2 C4*2 A3*2 E3*2 C2*2 G2*2 C3*2 E3*2 G3*2 E3*2 C3*2 G2*2` |
| 2 | harp | `B1*2 F#2*2 B2*2 D3*2 F#3*2 D3*2 B2*2 F#2*2 E2*2 B2*2 E3*2 G3*2 B3*8` |
| 3 | pad | `E3+G3+B3*16 C3+G3+E4*16 G2+D3+B3*16 D3+F#3+A3*16` |
| 3 | pad | `A2+E3+C4*16 C3+G3+E4*16 B2+F#3+D4*16 E3+G3+B3*16` |

### hearth_holds

| Voice | Instrument | Notes |
|---|---|---|
| 1 | drum | `E2*3 E2*3 E2*2 E2*3 E2*3 E2*2 E2*3 E2*3 E2*2 E2*3 E2*3 E2 E2` |
| 1 | drum | `E2*3 E2*3 E2*2 E2*3 E2*3 E2*2 E2*3 E2*3 E2*2 E2*3 E2*3 E2 E2` |
| 1 | drum | `E2*3 E2*3 E2*2 E2*3 E2*3 E2*2 E2*3 E2*3 E2*2 E2*3 E2*3 E2 E2` |
| 1 | drum | `E2*3 E2*3 E2*2 E2*3 E2*3 E2*2 E2*3 E2*3 E2*2 E2*3 E2*3 E2 E2` |
| 2 | bass | `E3*2 F3*2 E3*2 .*2 E3*2 F3*2 G3*2 F3*2 E3*2 F3*2 E3*2 .*2 E3*2 F3*2 G3*2 F3*2` |
| 2 | bass | `F2*2 G2*2 F2*2 .*2 F2*2 G2*2 A2*2 G2*2 E3*2 F3*2 E3*2 .*2 E3*2 F3*2 G3*2 F3*2` |
| 2 | bass | `D3*2 E3*2 D3*2 .*2 D3*2 E3*2 F3*2 E3*2 C3*2 D3*2 C3*2 .*2 C3*2 D3*2 E3*2 D3*2` |
| 2 | bass | `F2*2 G2*2 F2*2 .*2 F2*2 G2*2 A2*2 G2*2 E3*2 F3*2 E3*2 .*2 E3*8` |
| 3 | pad | `E3+B3*16 E3+B3*16 F3+C4*16 E3+B3*16 D3+A3*16 C3+G3*16 F3+C4*16 E3+B3*16` |
| 4 | flute | `.*16 .*16 A4*6 G4*2 F4*8 E4*6 F4*2 E4*8` |
| 4 | flute | `F4*4 A4*4 G4*4 F4*4 E4*6 D4*2 C4*8 F4*4 G4*4 A4*4 C5*4 B4*4 A4*2 F4*2 E4*8` |
