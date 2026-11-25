# T-696 — Bandages are made and bought, and no medic uses them

**Source:** T-693 · **Size:** S · **Needs:** — · **Status:** open

## Why

`items.md` says bandages are cloth cut at the clothier (`make_bandages`, 1 cloth → 4 bandages) and that `stop_bleeding` and `dress_burn` accept a bandage or a cloth; caravans sell `bandage` ×4 (`caravan-goods.md`). The health producer asks only for `textile/cloth` (`src/systems/health/producer.ts`, the `stop_bleeding`, `dress_burn` and `bandage_animal` inputs), and a bandage is `medical/bandage`, so a fortress that cuts its cloth into bandages, or buys them, has no bandage a medic will take, and the hospital's supply record has no `bandage` kind for its chest to want. Found while T-693 made a light burn's dressing wait behind the hospitals' cloth.

## What to do

Make the treatments that take a cloth take a bandage as well (one bandage a treatment, as one cloth), decide which is taken first (the bandage, made for it, seems the reading of `items.md`), whether the hospital's supply record and the spare-cloth count of a light burn's dressing (17 § Patients and hospitals) count bandages, and pin it with a test; or, if bandages should stay a trade good only, say so in `items.md` and 17.

Spec: 17 § Patients and hospitals (`stop_bleeding`, `dress_burn`, the supply record), § Animals; `items.md` § bandage; `workshops-and-recipes.md` (`make_bandages`).

## Decision

Bandages are taken, first, and nothing else about them changes (17 § Patients and hospitals, *Bandages first*; § Animals; `items.md` § bandage):

- **A bandage or a cloth, one a treatment.** `stop_bleeding`, `dress_burn` and `bandage_animal` take one `bandage` while one is to be had, else one `cloth`. A bandage is neither quicker nor a better clot: the spec gives it no number, and none is invented. It is preferred because it is the cheaper dressing (a cloth makes four), so the cloth stays for the clothier and the loom while bandages last. The choice is made when the job is made (each job a health tick makes takes one from the bandages counted at its start); a job still waiting for a worker whose bandage is gone while a cloth is to be had, or the reverse, is made again with the other (`dressing_in_place`). Honey stands in for `dress_burn` only when neither is to be had.
- **The supply record has `bandages`, default 0.** As honey and soap: a fortress that never asks keeps its hospital as it was (the T-693 reserve with the default record stays 10). The hospital panel shows `Bandages: n/m` under Cloth with its `[-][+]`; the chests take bandages whatever filter the record was made with, as they take soap.
- **T-693's reserve counts dressings.** The dressings the hospitals keep are the sum of their `cloth` and `bandages` settings; the spare a light burn may take is the bandages and cloth to be had together, less that. A bandage counts one, as a cloth does (not a quarter of a cloth): the reserve is in treatments, and a treatment takes one of either.
- **Not taken:** counting a cloth as four bandages in the reserve; a nonzero default for `bandages` (it would raise every fortress's reserve with no bandages to fill it); a faster or better bandage (no spec number).

## Done

- [x] Tests: a medic bandages a bleeding dwarf with a bandage when there is no cloth (`test/unit/health/t696-bandages.test.ts`; also: a bandage before cloth, cloth when there is no bandage, a waiting job takes a bandage that comes to be had, a serious burn dressed with bandages, T-693's reserve with a bandage counted with the cloth and with the `bandages` setting, an animal bandaged with a bandage, the hospital wants none by default and stocks them when asked). The hospital panel test (`t332`) shows the `Bandages` row.
- [x] Sweep (measure run 45497350527, on 5fa17dc8): pooled living 1123.75, deaths 118.25, alive 20, grown 7, extinct 0, need deaths 0; verdict pass, no seed worth tracing (master 1130.25 / 109.75; bounds living ≥ 1046.63, deaths ≤ 132.5). CI run 45497356242 green, e2e 46 passed.
- [x] Follow-up: `T-NEW-hospital-honey-and-raised-supplies.md` (a hospital never stocks honey; raising a supply from 0 does not call goods lying loose).
- No fun-features row: nothing characterful, a bandage only does what a cloth did.
