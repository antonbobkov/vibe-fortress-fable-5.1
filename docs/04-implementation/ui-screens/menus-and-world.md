# Wireframes: Main Menu, World Generation, World Map, Settings, Load, Legend

**Owner:** `ui/screens/*` · **Depends on:** [`../../02-systems/24-ui-and-input.md`](../../02-systems/24-ui-and-input.md), [`../../02-systems/01-world-generation.md`](../../02-systems/01-world-generation.md)

## Main menu

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│                    D E E P H O L M                             │
│                 a hall beneath the world                       │
│                                                                │
│                  ▶ [n] New world                               │
│                    [c] Continue   (Emberhall · Year 2)         │
│                    [l] Load                                    │
│                    [g] Legends                                 │
│                    [o] Settings                                │
│                    [a] About                                   │
│                                                                │
│   ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒≈≈≈≈▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒   │
│   (decorative slice of the last save's surface, or a          │
│    generated demo slice when no save exists)                   │
└────────────────────────────────────────────────────────────────┘
```

`Continue` loads the newest save of any kind; hidden when none exists.

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
┌────────────────────────────────────────────────────────────┬─────────────────────────────────┐
│≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈│ Greenhollow                     │
│≈≈≈≈""""""♣♣♣♣♣∩∩∩▲▲▲▲∩∩♣♣♣♣""""≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈│ Temperate forest                │
│≈≈"""""♣♣♣♣♣[♣]∩∩▲▲▲▲▲▲∩∩♣♣♣♣"""".≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈│ A river runs east to south.     │
│≈"""""""♣♣♣♣♣∩∩∩▲▲▲▲▲∩∩♣♣♣♣♣""""..≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈│                                 │
│≈""""""♣♣♣♣☺♣∩∩∩▲▲▲▲∩∩∩♣♣♣♣""""...≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈│ Wealth  ▓▓▓░░ 3                 │
│≈"""""""♣♣♣♣♣♣∩∩∩▲▲▲∩∩∩♣♣♣""""....≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈│ Peril   ▓░░░░ 1                 │
│≈≈""""""""♣♣♣♣∩∩∩∩∩∩∩∩♣♣♣"""".....≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈│ Temper  ▓░░░░ 1                 │
│≈≈≈"""""""""♣♣♣♣∩∩∩∩♣♣♣♣""""......≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈│ Trait: Gemsprings               │
│≈≈≈≈"""""""""""♣♣♣♣♣♣♣""""".......≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈│                                 │
│≈≈≈≈≈"""""""""""""""""""".........≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈│ Mountainhome 9 regions (E)      │
│≈≈≈≈≈≈"""""""""""""""""..........G.≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈│ Hillfolk 5 (S) · Wildwood 3 (W) │
│  (cursor [♣] · civ homes ☺ G · rivers drawn in blue)      │ Gloam 22 (E)                    │
│                                                            │                                 │
│                                                            │ [f] filter  [?] legend          │
│                                                            │ [Enter] Embark here             │
└────────────────────────────────────────────────────────────┴─────────────────────────────────┘
```

Filter panel (`f`): checkboxes for biomes, min/max sliders for the three ratings (`+`/`-` on the focused row), river / volcano toggles, trait list; matching regions keep full color, others dim one step (`dim(c, 1)`). The cursor starts at the centre and inverts its cell. River regions draw blue `~`; civilization home glyphs and colors replace rivers and biomes. The region panel lists name, biome, river, lake, volcano, five-cell rating bars (a dim line under the Peril bar reads "Peril counts raiders. Wild beasts live everywhere."), traits and every civilization's distance and cardinal arrival edge; there is no relief field.

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
│   [d] Reset to defaults         [Esc] Back       │
└──────────────────────────────────────────────────┘
```

Zoom is `Auto` or a fixed level (0.75, 1, 1.5, 2). Under the list a dim line says that `Auto` picks a larger cell on a large window and that a fixed zoom keeps the old look. When the window is too small for the requested zoom, a line in the alert color says so: `Zoom 1 (shown at 0.75: the window is small)` (`Zoom Auto (shown at 0.75: …)` for `Auto`).

Keybindings sub-screen: a table of context, action, key; `Enter` on a row then press a key; conflicts are shown in red with the conflicting action's Help wording and the player-facing context heading; `Esc` cancels the rebind. Clicking a binding row also starts capture. Failed rebinding uses the shared registry messages `ui.settings.binding_conflict` and `ui.settings.binding_modifiers` and leaves every binding unchanged.

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
