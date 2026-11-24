# T-NEW — A hospital never stocks honey, and raising a supply does not call goods already lying loose

**Source:** T-696 · **Size:** S · **Needs:** — · **Status:** open

## Why

Found while T-696 added the `bandages` supply. Probed on a flat test world (a hospital of one bed and one built chest, a hauler, six of the good twenty tiles away, half a day):

- **Honey is never hauled in.** With `SetHospitalSupplies { honey: 4 }` the chest stayed empty. 17 § Patients and hospitals lists `honey` among the desired supplies and 13's `hospitalAccepts` reads its count, but a hospital's filter (`hospitalFilter` and `STOCKPILE_PRESETS.hospital` in `src/systems/items/stockpiles.ts`) has no `food/honey`, and `HOSPITAL_EXTRA_CATEGORIES` (the supplies a hospital takes whatever filter its record was made with) holds only `medical/soap` and now `medical/bandage`. So the hospital's honey setting does nothing, and a medic fetches honey from the food stockpile.
- **Raising a supply does not call loose goods.** Bandages lying loose on no stockpile while the hospital wanted none (`bandages` 0) stayed where they lay after the setting was raised to 4; the same bandages were hauled in when the setting was made first. `SetHospitalSupplies` (17, `health/index.ts`) writes the zone setting and raises no event that 13 re-examines its `noHome` set on (13 § The "wants hauling" set: a filter change, a stockpile created, a stockpile gaining a slot). Goods in an ordinary stockpile are looked at again on `HourPassed` (T-676), so only loose goods with no home are stuck; it holds for any supply kind raised from 0.

## What to do

Decide whether honey belongs in a hospital's chest (add `food/honey` to the extra categories, as soap and bandages, or drop `honey` from the record), and make a raised hospital supply re-examine the `noHome` goods it now accepts (as a filter change does). Pin both with tests.

Spec: 17 § Patients and hospitals (the supply record); 13 § The "wants hauling" set (`noHome`), § Stockpiles.

## Done

- [ ] Tests: a hospital asked for honey has it hauled into its chest; a hospital whose bandages are raised from 0 has the loose bandages hauled in.
