# T-676 — Dwarves haul the wagon's goods to stockpiles

**Source:** the owner's feedback of 2026-11-21 · **Size:** M · **Needs:** — · **Status:** open

## Why

The owner saw dwarves leave the wagon's goods in the wagon though stockpiles stood ready.

## What to do

Reproduce in a new embark with a food and a goods stockpile placed: do haulers take items out of the wagon? If not, find why (the wagon's contents not offered to the haul search, a forbid flag, a priority) and fix it in 13/11 so goods leave the wagon for a stockpile that accepts them, as the spec says (check 13 and the embark docs). If they do haul and the owner's case is a setting (no matching stockpile, the wagon kept as storage), make the UI say why.

## Done

A scenario: an embark with stockpiles empties the wagon into them within the first days; the sweep's verdict if the simulation changes.
