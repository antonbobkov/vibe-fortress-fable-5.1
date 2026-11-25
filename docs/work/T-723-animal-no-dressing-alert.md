# T-723 — A war dog bleeding with no bandage or cloth dies with no warning

**Source:** T-716 (playtest 2026-11-24, second, [report](../../reports/data/2026-11-24-playtest-2.md) finding 3: "Five dogs died the same way that autumn") · **Size:** S · **Needs:** — · **Status:** open

## Why

T-716 made a dwarf bleeding with no bandage or cloth to be had an alert (`NoDressing`, 17 § Player-facing behavior), with a Care line and a hospital line. A tame animal's `bandage_animal` takes the same dressing (17 § Animals) and blocks the same way, but nothing says so: in the playtest five dogs, two of them the Warband's war dogs, bled out from the restless dead's cuts in a fortress with no cloth, and the log said only that each had died. A pet's death is an alert (08 § Death); its bleeding is not.

## What to do

Decide whether a tame animal (or only a pet and a war animal, which the player chose to keep) bleeding from a wound that does not clot raises the same alert, once a wound, naming the animal by its name or species ("Bramble the dog is bleeding and there is no bandage or cloth …"), and whether the Animals panel's line for it says so. An animal has no `Patient`, so the once-a-wound record needs a home (a field on its `Tame`, or a saved set in 17's state).

Spec: 17 § Animals and § Player-facing behavior; 08 § Player-facing behavior; `ui-screens/panels.md` (Animals).

## Done

- [ ] A test: a war dog with a serious cut in a fortress with no dressing gives the alert once; with cloth, none.
