# T-673 — The mouse wheel's level direction is reversed, and a setting chooses it

**Closed:** 2026-11-21, in 59ff0f5c,2ffd0212,dec3bbf1.

**Source:** the owner's feedback of 2026-11-21 · **Size:** S · **Needs:** — · **Status:** done

## Why

The owner finds the wheel's default direction for going up and down levels backwards.

## What to do

Reverse the default (wheel up goes up a level, or whatever the reverse of today is: check the code and say which), and add a Settings option that swaps it, saved with the other settings. Keep Shift+wheel and zoom as they are unless they share the setting.

## Done

- [x] A test of the default and of the setting, saved and reloaded (`test/unit/ui/t673-wheel-direction.test.ts`).
- [x] The wheel over the map went up a level on the wheel up and down a level on the wheel down; now the wheel up goes down a level (deeper) and the wheel down up a level. Settings' `Wheel up goes` (`down a level`, the default, or `up a level`; `wheelUp` in the settings store) turns it round. The wheel over a panel, `Ctrl` + wheel (zoom) and `Shift` + wheel (pan) are unchanged.
- [x] 24 § Input model and § Settings, `ui-keymap-and-screens.md` § Mouse and § Settings, `menus-and-world.md` § Settings and a Help note under Map (`ui.help.map.wheel`) say so.
