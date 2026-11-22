# T-NEW — Unpastured animals after the hall: grazers go out to graze, cats prowl

**Source:** T-675 (the owner's feedback of 2026-11-21, "Shouldn't they be grazing/exploring?") · **Size:** S · **Needs:** — · **Status:** open

## Why

T-675 gave the wagon's animals an amble about the wagon until there is a hearth hall (08 § Tame behavior, *Before the hall*). Once the hall stands, every tame animal with no pasture goes back to standing on its tile in or beside the hall (T-463, T-482, T-510). Two things follow that the owner may not want:

- A grazer with no pasture stands in the hall, usually underground, where no grass lies within the 6 tiles a hungry grazer looks; it grows hungry and, with no pasture drawn, starves after `ANIMAL_STARVE_DAYS`. 08 § Pastures and feeding still says unassigned grazers "eat any grass they find", which from the hall they cannot.
- Cats only heap in the cats' corner; the owner suggested cats may roam the fortress (there are no vermin to hunt yet).

## What to do

Decide, and spec in 08, whether a hungry grazer with no pasture walks out to the nearest grass it can reach (or to the wagon's ground, ambling as before the hall) and comes back, and whether a cat now and then leaves its corner to prowl the fortress's rooms and comes back to heap. Keep the pets' heap and the cats' corner (fun features), and keep the hall tests of T-463, T-482 and T-510.

## Done

- [ ] A test for each rule taken, and the sweep's verdict.
