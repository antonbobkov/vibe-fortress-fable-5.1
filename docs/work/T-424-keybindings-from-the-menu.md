# T-424 — Every key binding configurable from the menu

**Source:** the owner, 2026-10-22 · **Size:** M · **Needs:** T-113 · **Status:** open (audit first)

## Why

The owner asked that key bindings be configurable through the menu. A keybinding editor already exists (Settings › Keybindings, `src/ui/screens/settings.ts`, `src/ui/keymap.ts`, T-M7-07, [ui-keymap-and-screens.md](../03-content/ui-keymap-and-screens.md)). This task makes sure it covers everything and works end to end.

## What to do

1. **Audit.** List every key the game reacts to: every screen and panel, the map, the menus, confirmations and the debug keys. Mark each as rebindable from the editor or fixed.
   - Fixed keys may stay fixed only where the spec says so, such as Escape for back and text entry inside a text field. Each such key gets a written reason.
   - Every hard-coded key check that bypasses the keymap is a fault.
2. **Fix what the audit finds.**
   - Route every non-fixed key through the keymap.
   - The editor groups bindings by screen, shows conflicts within a context, and has "reset this binding" and "reset all to defaults".
   - A rebinding takes effect at once, survives a reload, and is shown everywhere a key is named: help, hints and the panels' key labels.
   - Old saved keymaps still load.
3. **Spec.** ui-keymap-and-screens.md and 24 UI and input say which keys are fixed and why, and describe the editor's grouping and resets.

## Done

- The audit table is in a dated report. Every non-fixed key is rebindable from the menu.
- An e2e test rebinds a map key and a panel key, uses both, reloads, uses them again, then resets to defaults.
- Unit tests cover conflicts and loading an old keymap.
- The six static checks, `npm test`, e2e and the build pass.
