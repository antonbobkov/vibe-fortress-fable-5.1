# T-NEW — Bandages are made and bought, and no medic uses them

**Source:** T-693 · **Size:** S · **Needs:** — · **Status:** open

## Why

`items.md` says bandages are cloth cut at the clothier (`make_bandages`, 1 cloth → 4 bandages) and that `stop_bleeding` and `dress_burn` accept a bandage or a cloth; caravans sell `bandage` ×4 (`caravan-goods.md`). The health producer asks only for `textile/cloth` (`src/systems/health/producer.ts`, the `stop_bleeding`, `dress_burn` and `bandage_animal` inputs), and a bandage is `medical/bandage`, so a fortress that cuts its cloth into bandages, or buys them, has no bandage a medic will take, and the hospital's supply record has no `bandage` kind for its chest to want. Found while T-693 made a light burn's dressing wait behind the hospitals' cloth.

## What to do

Make the treatments that take a cloth take a bandage as well (one bandage a treatment, as one cloth), decide which is taken first (the bandage, made for it, seems the reading of `items.md`), whether the hospital's supply record and the spare-cloth count of a light burn's dressing (17 § Patients and hospitals) count bandages, and pin it with a test; or, if bandages should stay a trade good only, say so in `items.md` and 17.

Spec: 17 § Patients and hospitals (`stop_bleeding`, `dress_burn`, the supply record), § Animals; `items.md` § bandage; `workshops-and-recipes.md` (`make_bandages`).

## Done

- [ ] Tests: a medic bandages a bleeding dwarf with a bandage when there is no cloth.
