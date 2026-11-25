# T-NEW — One Esc too many, then a panel letter, asks to abandon the fortress

**Source:** playtest 2026-11-24 ([report](../../reports/data/2026-11-24-playtest.md), finding 6) · **Size:** S · **Needs:** — · **Status:** open

## Why

`Esc` backs out one step: tool, then panel, then the game menu (`ui-keymap-and-screens.md` § Global). The game menu's rows have letter accelerators, and six of them are fortress panel letters: `s` Save (Stocks), `l` Load (Labors), `o` Settings (Orders), `n` Rename fortress (Animals), `a` Abandon fortress (Log), `m` Main menu (Military). So a player who closes a panel with one `Esc` too many and then presses a panel letter does a menu action instead.

It happened to me twice in the first hour, closing Look and pressing `a` for the log: "Abandon Wolfcrown and choose a new site on this world? The hall will be recorded in the Legends and cannot be resumed." (`reports/data/2026-11-24-playtest/52-abandon-confirm.png`). The confirmation defaults to No, so nothing was lost, but the same slip gives `m` → "Return to the main menu?", `x` → "Retire Wolfcrown?", `s` → saves at once, `l` → the Load screen, `n` → the rename dialog. The fortress screen's own rule, D-253, keeps `Shift` for destructive actions and lets a bare letter open its panel; the game menu is the one place where a bare letter starts an ending.

## What to do

Decision, in the spirit of D-253:

- **In the game menu, a fortress panel letter closes the menu and opens its panel**, as it would on the fortress screen (`a` opens the Log, `m` Military, and so on).
- **The menu's own accelerators that are panel letters move to `Shift`:** `Shift+S` Save, `Shift+L` Load, `Shift+O` Settings, `Shift+N` Rename, `Shift+A` Abandon, `Shift+M` Main menu, `Shift+X` Retire (Shift because it ends the fortress, though `x` is no panel letter). `r` Resume keeps its bare letter. The rows' captions show `[S-a]` and so on, as panels show their Shift actions; arrows, `Enter` and a click work as now; the confirmations stay.
- The keybinding editor lists the menu's keys under their context as now.

Spec: 24 § Game menu, `ui-keymap-and-screens.md` (the game menu's key table and § Panels' paragraph on letters), `ui-screens/menus-and-world.md` if it draws the menu.

## Done

- [ ] Tests: from the fortress with no panel, `Esc` then `a` opens the Log and the fortress goes on; `Esc` then `Shift+A` opens the abandon confirmation; `Esc` then `m` opens Military, `Shift+M` the main-menu confirmation; `r` resumes.
- [ ] e2e `game-menu` updated for the new keys.
