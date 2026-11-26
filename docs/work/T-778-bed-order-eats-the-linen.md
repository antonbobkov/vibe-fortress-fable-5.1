# T-778 — A first bed order eats the embark's linen, the only dressing the fortress has

**Source:** T-765 ([report](../../reports/audits/2026-11-25-t765-alpine-frostbite.md), § The linen) · **Size:** M · **Needs:** — · **Status:** open

## Why

Every embark preset carries five linen so that the first bleeding wound can be bandaged (17 § Patients and hospitals, `stop_bleeding`; `embark-catalog.md` § Presets). `make_bed` takes one log and two cloth (`workshops-and-recipes.md` § Carpenter), and nothing keeps the linen from it until a hospital asks for cloth. In T-765's reproduction a newcomer's first order, four beds at the carpenter's, took the five linen in the first 30 hours (5 → 3 → 0 by hour 27), and the dogs and the cat frostbitten that night found no dressing: the `NoDressing` alert came at hour 29. With T-765's fix nobody bleeds from frostbite, but the next cut of the first week, a snow leopard's or a boar's, finds the same empty wagon.

## What to do

Decide how a fortress with no hospital keeps a dressing for the first wound. Options, in the order to weigh them: a carpenter's order does not take the last `HOSPITAL_DEFAULT_SUPPLIES.cloth`-worth of cloth while no hospital exists (as `dress_burn` already spares the hospitals' cloth, 17 § `dress_burn`); `make_bed` prefers wool and takes cloth only when there are more than five; or the embark gives a few bandages in place of some linen, which no recipe uses. Measure with T-763's probe (`T763_DAMAGE=1`) how many cloth are left on day 7 of a busy first week, and add a test.

## Decision

**The first option, widened to one rule for every fortress: a workshop order does not take the dressings the fortress keeps** (12 § Cloth kept for dressings). An order takes cloth only while the dressings to be had after it (cloth and bandages, not forbidden, reserved, owned or carried) are at least the kept count: the sum of the hospitals' `cloth` and `bandages` supply settings, or, while there is no hospital zone, a default hospital's (`HOSPITAL_DEFAULT_SUPPLIES` cloth 10 + bandages 0). An input with another alternative takes it (`make_bed`'s raw wool, a scale shirt's leather); an input that is only cloth waits with the reason `cloth_kept`. A recipe whose output is a bandage is never held.

- **Why not "while no hospital exists" only.** Building a hospital would then free the linen to the carpenter in the hours before the haulers carry it to the chest: a cliff the player would not expect. With the hospitals' own settings as the count, a hospital keeps what it asks for, and setting its `cloth` and `bandages` to 0 is the player's way to free every cloth. 17's `dress_burn` keeps its own rule (it spares the hospitals' dressings and none without a hospital): a light burn's dressing is a medical use, and its pass was not in this task.
- **Why not the second option** (`make_bed` prefers wool, cloth only above five). It guards one recipe; the stone bed (`make_stone_bed`), bedding, clothes, cloaks and scale armour take cloth too, and a keep of five is the wagon's count, not a rule the player can see or set.
- **Why not the third** (bandages in the embark in place of linen). It moves every embark's goods, prices and world hashes, and leaves the next cloth (a caravan's, a loom's) to the beds again.
- **Ten, not fewer.** A default hospital's ten is the count the player already meets in the hospital panel, and the three-year sweep's player already kept it from its beds (T-572's `BED_CLOTH_KEPT`). With five linen the whole embark's cloth is kept, so the newcomer's four-bed order makes no bed until straw, wool or a loom; the embark's three beds and the floor serve. Logged as a fun trade-off (docs/fun-features.md).
- **The UI.** The Orders panel's status reads "cloth kept for wounds (5)", its full line and the workshop's idle line say how many are kept and how to free them, the picker's `○` note "· cloth kept for wounds", and the log a note once per workshop until its next craft ("Carpenter's Workshop #1 is idle: the last cloth is kept to bandage wounds."), as `WorkshopBlocked { cloth_kept }` (no new event; the registration sits before the alert rows, so `WorkshopBlocked`'s severity row is unchanged).

## Measured

T-763's probe (`test/perf/t763_first_week_probe.test.ts`, which now prints the cloth, bandages and beds at each day's end), `probe-5` and `probe-3` busy, shifts 0, 17, 331, 613, eight days:

```
T763_PROBE=1 T763_SEEDS=probe-5,probe-3 T763_VARIANTS=busy T763_SHIFTS=0,17,331,613 T763_DAYS=8 npx vitest run -c vitest.perf.config.ts test/perf/t763_first_week_probe.test.ts
```

| | cloth on day 7 (8 timelines) | beds on day 7 | dwarves alive on day 8 |
|---|---|---|---|
| Before (master `1815c80e`) | 1 in all 8 (two beds took four, a dog's bandage one) | 5 | 55 of 56 (`probe-3` +17: a snow leopard's bites, day 6) |
| After | 5 in all 8 | 3 | 55 of 56 (`probe-3` +331: a snow leopard's bites, day 5) |

The one death after the change is not a missing dressing: the cloth was there, a medic claimed the `stop_bleeding` job at hour 105 and had not started it when the dwarf bled out at hour 108 (`T763_DAMAGE=1` and a log of the job's events). Filed as a follow-up (`T-NEW-bandage-claimed-not-brought.md`).

The rule does not move the long measurements, at `92ff4a9b`. Every seed, sample and verdict job passed on GitHub (the verdicts were also run locally on the downloaded samples while their jobs stood queued, with the same figures).

| | Pooled | Shifts | Master | Bounds | Verdict |
|---|---|---|---|---|---|
| Sweep [45776716702](https://github.com/antonbobkov/vibe-fortress-fable-5.1/actions/runs/45776716702): living at year 3 | 1171 | 1152, 1179, 1169, 1184 | about 1169.25 | ≥ 1046.63 | pass |
| Sweep: dwarf deaths | 110.5 | 122, 115, 110, 95 | about 110.25 | ≤ 132.5 | pass |
| Instrument [45776720362](https://github.com/antonbobkov/vibe-fortress-fable-5.1/actions/runs/45776720362): median, worst, second-worst, sum of the living, wildlife-free | 13, 8.25, 9.13, 150.25, 9 | | T-765's 13, 8.25, 9.13, 150.25, 9 | | pass |

## Done

- [x] A decision in 17 or 12, with a test. (12 § Cloth kept for dressings, with 17 § Bandages first, `workshops-and-recipes.md`, `embark-catalog.md`, panels.md and the event catalog; `test/unit/workshops/t778-cloth-kept.test.ts`.)
- [x] The probe's day-7 cloth count before and after. (1 → 5 in each of eight timelines.)
