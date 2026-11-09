# T-531 — Starting loadouts can be saved and loaded

**Closed:** 2026-11-09, in e881c037.

**Source:** the owner, 2026-11-08 · **Size:** M · **Needs:** — · **Status:** open

## Why

The owner: "starting loadouts should be saveable/loadable." Today a loadout is built from scratch each embark (02 Embark and loadout).

## What to do

- On the loadout screen, save the current loadout under a name, and load a saved one. List, rename and delete saved loadouts. They persist in local storage like settings, and survive a content change by dropping rows that no longer exist (with a note).
- Loading a loadout that costs more points than the chosen embark allows shows it and lets the player trim it; it never silently changes the budget.
- Spec: 02 § Loadout and the screens doc. e2e: save, reload the page, load, embark.
