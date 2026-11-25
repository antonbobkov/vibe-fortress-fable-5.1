# T-723 — A war dog bleeding with no bandage or cloth dies with no warning

**Closed:** 2026-11-25, in d412f436,d76534d5,4a8b1e72.

**Source:** T-716 (playtest 2026-11-24, second, [report](../../../reports/data/2026-11-24-playtest-2.md) finding 3: "Five dogs died the same way that autumn") · **Size:** S · **Needs:** — · **Status:** done

## Why

T-716 made a dwarf bleeding with no bandage or cloth to be had an alert (`NoDressing`, 17 § Player-facing behavior), with a Care line and a hospital line. A tame animal's `bandage_animal` takes the same dressing (17 § Animals) and blocks the same way, but nothing says so: in the playtest five dogs, two of them the Warband's war dogs, bled out from the restless dead's cuts in a fortress with no cloth, and the log said only that each had died. A pet's death is an alert (08 § Death); its bleeding is not.

## What to do

Decide whether a tame animal (or only a pet and a war animal, which the player chose to keep) bleeding from a wound that does not clot raises the same alert, once a wound, naming the animal by its name or species ("Bramble the dog is bleeding and there is no bandage or cloth …"), and whether the Animals panel's line for it says so. An animal has no `Patient`, so the once-a-wound record needs a home (a field on its `Tame`, or a saved set in 17's state).

Spec: 17 § Animals and § Player-facing behavior; 08 § Player-facing behavior; `ui-screens/panels.md` (Animals).

## Decision

- **Which animals:** every tame animal that `bandage_animal` would treat and the fortress owns: `Tame`, not a summon, not caged, faction `fortress` (so not a merchant's caged goods, nor a wild one). Not only pets and war animals: a herd bled out with no cloth is as much the player's loss, and the merged line keeps it from spamming.
- **Same event, same rule:** the animal raises T-716's `NoDressing { id }` (no new event; the catalog row and the count stay), by the dwarf's rule shared in `noDressingFor` (`health/tick.ts`): a serious or grievous wound bleeding unbandaged, no bandage or cloth to be had, no one with its `bandage_animal` under way. It is checked at each health update of the animal, the wound's own included.
- **Once a wound, on the `Tame`:** `Tame.noDressingAlerted?` keeps the tick (an optional saved field; an older save warns at the next update), as `Patient.noDressingAlerted` does.
- **Quieter than a dwarf's:** a dwarf's alert is a line of its own; the animals of a day are one alert line ("Bramble and the war dog are bleeding and there is no bandage or cloth: …", from four on "5 animals are bleeding …", `LOG_BLEEDING_NAMES` = 3, 24 § Tuning). Only the day's first flashes and pauses; the later ones change the line in place (its `[v]` and focus the latest animal). An unnamed animal is "the dog", a trained one "the war dog" or "the hunting dog".
- **The Animals panel:** not in this task; filed as a follow-up (an animal's view has no wound line at all today).
- World hashes unchanged (the hashed worlds carry linen); no sweep.

## Done

- [x] Tests (`test/unit/health/t723-animal-no-dressing.test.ts`): a war dog with a serious cut in a fortress with no dressing gives the alert once, at the cut, "The war dog is bleeding …"; a wild wolf's cut and a dog's light cut give none; with cloth, none, and the keeper bandages the dog; the day's animals merge into one line; the save keeps the tick and an older save warns again.
- [x] Spec: 17 § Animals, § State, § Registrations, § Player-facing behavior; 24 § Announcements (the merged line) and § Tuning (`LOG_BLEEDING_NAMES`); `schemas/components.md` (Tame); `save-format.md`; `fun-features.md`.
- [x] Follow-up: `T-730-animal-view-bleeding.md`.
