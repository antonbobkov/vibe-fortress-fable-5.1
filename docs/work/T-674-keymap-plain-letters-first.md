# T-674 — Common actions on plain letters: a keymap proposal, then the change

**Source:** the owner's feedback of 2026-11-21 · **Size:** L · **Needs:** — · **Status:** open

## Why

Digging takes `d` then `Shift+d`, too much for the most common action; `d d` would do. The owner asks to rework such commands for common actions generally, and asks why so many actions are on Shift: plain letters should be used first.

## What to do

First write a short proposal (`reports/designs/2026-11-2x-keymap-plain-letters.md`): list every Shift chord and two-key sequence by how often a player uses it, and give each common action a plain letter or a repeated letter (`d d` dig), keeping Shift for rare or dangerous ones; keep the existing keymap structure, rebindability and the parity scenario. Then implement it, update the keymap docs, help, hints and every test that presses old keys. Coordinate with T-669..T-671 (new inspection keys) by rebasing on whatever of them has landed.

## Done

The proposal, the new keymap with docs and help updated, and the keymap parity scenario passing.
