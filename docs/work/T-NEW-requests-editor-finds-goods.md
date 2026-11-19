# T-NEW — The requests editor finds a good without stepping through every item

**Source:** [T-640](T-640-long-lists-animals-jobs-requests.md), found while adding the material choice · **Size:** S · **Needs:** — · **Status:** open

## Why

The Civilizations requests editor lists every item id of the content registry in registry order, a few hundred, and `↑` `↓` step through them one at a time. To ask the Mountainhome for iron bars a player presses `↓` until "bar" comes up, then `→` for the material. Most of the list is goods no civilization brings (a request for one is never served), and the ones the selected civilization does bring are scattered among them.

## What to do

Put the selected civilization's own goods first, in its list's order, then the rest in registry order; and let typing filter the list by name, as the other panels' `/filter` does. Keep the never-sold refusal on `Enter`.

Spec: `ui-screens/panels.md` § Civilizations (the editor's sentence); `ui-keymap-and-screens.md` § Civilizations panel.

## Done

A test that the Mountainhome's editor starts on a good of its list and that typing "bar" leaves the bars.
