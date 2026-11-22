# T-674 — Common actions on plain letters: a keymap proposal, then the change

**Source:** the owner's feedback of 2026-11-21 · **Size:** L · **Needs:** — · **Status:** open

## Why

Digging takes `d` then `Shift+d`, too much for the most common action; `d d` would do. The owner asks to rework such commands for common actions generally, and asks why so many actions are on Shift: plain letters should be used first.

## What to do

First write a short proposal (`reports/designs/2026-11-2x-keymap-plain-letters.md`): list every Shift chord and two-key sequence by how often a player uses it, and give each common action a plain letter or a repeated letter (`d d` dig), keeping Shift for rare or dangerous ones; keep the existing keymap structure, rebindability and the parity scenario. Then implement it, update the keymap docs, help, hints and every test that presses old keys. Coordinate with T-669..T-671 (new inspection keys) by rebasing on whatever of them has landed.

## Done

- [x] The proposal: `reports/designs/2026-11-21-keymap-plain-letters.md` (approved, on master at 93cacf4d).
- [x] The new keymap: D-253 replaces D-U2's letter rule (the open panel's own letters first; `Esc` then a letter reaches any panel; `k` never a panel's key). 86 Shift bindings became 12: Shift kept for set a fire, dump (map selection and Stocks), melt, slaughter, suspend, kill, the compost heap, `Shift+F1`, `Shift+Tab`, `Shift+↑↓` in Orders. The calendar is the panel letter `y`. Old saved rebindings load onto the moved rows.
- [x] Docs and help: `ui-keymap-and-screens.md` (notation, § Panels, every table, the hint `hint_panel_letters`, the tutorial's workshop step), 24 § Input model and § Settings, `panels.md`, `fortress-screen.md`, 13 and 25; D-U2 marked superseded in `archive/ui-fixes/README.md`; Help's accelerator row; `c` and `f` reserved in the Look views for T-671.
- [x] The parity scenario passes and checks the new rule in every panel (§ 4 of `ui_keymap_parity`); every test that pressed the old keys is updated. CI run `44973939266` on the branch: checks, unit (4 shards) and e2e green.
- Deviations from the proposal: Military (`m` next mode) and Animals (`n` name) also bind their own letter, so their own letter no longer closes them (the proposal named only Designate). Military's unlisted `Shift+D` draughts key (no keymap row) is left as it was. From Zones after drawing a stockpile, Build takes `Esc` first (the proposal's choice 10); the tutorial's workshop step now says so.
