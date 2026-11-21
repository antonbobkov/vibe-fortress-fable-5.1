# T-680 — `z` offers what zones to make, and a stockpile's settings open by clicking it

**Source:** the owner's feedback of 2026-11-21 · **Size:** M · **Needs:** T-669 · **Status:** open

## Why

Pressing `z` should show how to make new zones; today it opens the zone list for selecting and editing. The owner expects a stockpile's settings to open by clicking the stockpile (T-669's ladder does this for an empty stockpile tile).

## What to do

Rework `z` into a menu of zone kinds to place (stockpile, pasture, bedroom, ...), each starting the placement tool; reach existing zones' settings by clicking them (T-669) and from a list inside the menu. Keep keys consistent with T-674's proposal if it has landed. Update 24 and the keymap.

## Done

UI tests: `z` then a kind places a zone; a click on a stockpile tile opens its settings.
