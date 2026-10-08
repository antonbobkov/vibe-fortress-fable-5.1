# T-168 — No accepted command leaves a state that cannot be saved

**Source:** T-115 and its report, [`../../reports/audits/2026-10-08-bug-hunt.md`](../../reports/audits/2026-10-08-bug-hunt.md) (bug 9) · **Size:** S · **Needs:** — · **Status:** open

## Why

`SetHospitalSupplies` stores `wants` as given and `SetZoneSetting` stores `value` as given. A `NaN` in either makes the next save throw `non-finite number in state: NaN`. `SetHospitalSupplies` also accepts `null`, strings, arrays, negative counts and unknown keys; `SetZoneSetting { key: 'squad' }` accepts a squad that does not exist.

## Reproduction

[`commands.probe.ts`](../../reports/data/2026-10-08-bug-hunt-commands.probe.ts.txt): the lines `SetHospitalSupplies … -> {"ok":true}; save THROWS …` and `SetZoneSetting … value NaN`.

## What to do

**Decision.** Each setting has a type, checked on the command: `desired supplies` is a record whose keys are 17's supply kinds and whose values are integers 0 … 999; `squad` is 0 or a living squad's id; `owner` goes through `AssignRoom`'s checks; `crop per season` through `SetPlotCrop`'s; `priority` is 1 … 9. Anything else is `bad_setting`. Write the value types into the zone-type table of `03-content` and into 14 § Zones and 17 § Hospital.

Tests, `describe('T-168 …')`: the two probe lines reject; a valid value is stored; the game saves after 1,000 random `SetZoneSetting` and `SetHospitalSupplies` commands.

## Done

- The tests pass.
