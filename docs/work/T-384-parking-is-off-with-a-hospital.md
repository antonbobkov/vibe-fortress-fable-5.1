# T-384 — Waiting items are not parked in a fortress with a hospital

**Source:** the review of T-344 (2026-10-17) · **Size:** S · **Needs:** — · **Status:** open

## Why

T-344 parks an item that waits for a container until something that could give it a slot changes. It turns parking off whenever the fortress has a hospital (`parking = !store.hasHospital()` in `src/systems/items/hauling.ts`), and every real fortress has one after its first injury, the three-year and instrument fortresses included. So the large saving measured on a flat map does not occur where T-344 was aimed; what remains there is the slot cache and the zone views. The "12 of 12 hashes identical" mostly covers those two; the forced-on parking check is the evidence for parking itself.

## What to do

- Treat a hospital as one more source of wake-ups instead of turning parking off: its chest and supply limits already move the Zone, Building and container signals; check each and test that a parked cloth wakes when a hospital chest is built, emptied or its supply limit changes.
- The review's notes: zone views are now shared objects (freeze them in development, or document that callers only read); prune `parked` entries when an item leaves the wants set; add tests for a container emptied by drinking and a container destroyed while an item is parked.
- Measure the reference fortress (items loose and forbidden) and the three-year fixture before and after, on a quiet machine; instrument hashes must stay identical.

## Done

- Parking works with a hospital; the notes are done; timings and identical hashes in the commit.
