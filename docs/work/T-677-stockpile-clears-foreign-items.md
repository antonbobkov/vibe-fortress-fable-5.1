# T-677 — A stockpile clears items that do not belong on it

**Source:** the owner's feedback of 2026-11-21 · **Size:** M · **Needs:** — · **Status:** open

## Why

A stockpile placed over items it does not accept fills around them: dwarves never move the foreign items aside, so the tiles stay taken.

## What to do

Make a stockpile tile holding an item the stockpile does not accept give a haul job for that item to a stockpile that accepts it, or to a free tile out of the way when none does (13 § Stockpiles), so the tile frees up. Keep it cheap (per stockpile change and on a slow sweep, not every tick).

## Done

A unit test: a stone on a food stockpile is hauled away and food fills the tile; the sweep's verdict.
