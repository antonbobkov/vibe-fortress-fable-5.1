# T-698 — A hospital never stocks honey, and raising a supply does not call goods already lying loose

**Source:** T-696 · **Size:** S · **Needs:** — · **Status:** open

## Why

Found while T-696 added the `bandages` supply. Probed on a flat test world (a hospital of one bed and one built chest, a hauler, six of the good twenty tiles away, half a day):

- **Honey is never hauled in.** With `SetHospitalSupplies { honey: 4 }` the chest stayed empty. 17 § Patients and hospitals lists `honey` among the desired supplies and 13's `hospitalAccepts` reads its count, but a hospital's filter (`hospitalFilter` and `STOCKPILE_PRESETS.hospital` in `src/systems/items/stockpiles.ts`) has no `food/honey`, and `HOSPITAL_EXTRA_CATEGORIES` (the supplies a hospital takes whatever filter its record was made with) holds only `medical/soap` and now `medical/bandage`. So the hospital's honey setting does nothing, and a medic fetches honey from the food stockpile.
- **Raising a supply does not call loose goods.** Bandages lying loose on no stockpile while the hospital wanted none (`bandages` 0) stayed where they lay after the setting was raised to 4; the same bandages were hauled in when the setting was made first. `SetHospitalSupplies` (17, `health/index.ts`) writes the zone setting and raises no event that 13 re-examines its `noHome` set on (13 § The "wants hauling" set: a filter change, a stockpile created, a stockpile gaining a slot). Goods in an ordinary stockpile are looked at again on `HourPassed` (T-676), so only loose goods with no home are stuck; it holds for any supply kind raised from 0.

## What to do

Decide whether honey belongs in a hospital's chest (add `food/honey` to the extra categories, as soap and bandages, or drop `honey` from the record), and make a raised hospital supply re-examine the `noHome` goods it now accepts (as a filter change does). Pin both with tests.

Spec: 17 § Patients and hospitals (the supply record); 13 § The "wants hauling" set (`noHome`), § Stockpiles.

## Decision

- **Honey belongs in the hospital's chest.** `food/honey` joins `HOSPITAL_EXTRA_CATEGORIES` (the chests take it whatever filter the record was made with, as soap and bandages); the hospital filter and its preset are unchanged. 17 lists `honey` among the desired supplies and honey stands in for a medic's bucket and dressing, so a hospital asked for some keeps it at hand. The default stays `honey` 0, so a fortress that never asks keeps its honey in the food stocks, as before (17 § Patients and hospitals).
- **`SetHospitalSupplies` raises `ZoneChanged { change: settings }`**, as 14's `SetZoneSetting` already did for the same setting, so 13 re-examines its `noHome` goods (and the hospital's own tiles) and a supply raised from 0 calls in what lay loose with no home. It is raised on every accepted command, as the zone setting does, not only on a raise: a lower count moves nothing out (`belongs` ignores supply limits). 17 § Events emitted names it as 14's event, as it names 04's `CreatureSubmerged`; 14 § Zones and 13 § The "wants hauling" set say so.
- **Not taken:** dropping `honey` from the record (the medics use honey, and the panel already shows its row); a new event of 17's for 13 to hear (the zone event already means "a stockpile's settings changed" to 13); re-examining `noHome` on each `HourPassed` (a whole pass every hour for a rare change).

## Done

- [x] Tests: a hospital asked for honey has it hauled into its chest; a hospital whose bandages are raised from 0 has the loose bandages hauled in (`test/unit/health/t698-hospital-supplies.test.ts`; also: no honey by default, loose honey hauled in once honey is raised from 0).
- [x] Sweep (measure run 45521317186, on dfab926c): pooled living 1123.75, deaths 118.25, alive 20, grown 7, extinct 0, need deaths 0; verdict pass, no seed worth tracing (bounds living ≥ 1046.63, deaths ≤ 132.5). The same pooled row as T-696's sweep: the three-year scripts never raise a hospital's honey or call `SetHospitalSupplies`. CI run 45521321824 green, e2e 46 passed.
- No follow-up, and no fun-features row: the hospital only does what its setting already said.
