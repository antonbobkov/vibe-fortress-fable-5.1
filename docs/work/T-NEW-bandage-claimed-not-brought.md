# T-NEW — A medic claims a bleeding dwarf's bandage and has not started it three hours later

**Source:** T-778 (its work file, § Measured) · **Size:** S · **Needs:** — · **Status:** open

## Why

With the wagon's linen kept for wounds (12 § Cloth kept for dressings), T-763's probe on `probe-3` (busy, shift 331) still lost a dwarf to a snow leopard's bites on day 5, with five cloth in the wagon. The `stop_bleeding` job was made at hour 105 and claimed the same hour by a medic; it was neither started nor done when the dwarf fell unconscious at hour 108 and bled out, and it was cancelled `target_gone`. A first bandage that takes three hours to come decides a serious cut (17 § Patients and hospitals: `stop_bleeding` is the first aid), so where those hours went matters: fetching the cloth from the wagon, a walk round the leopard, the medic fleeing it, or the medic held by another need.

## What to do

Reproduce with the probe and trace the medic's hours 105–108 (its activity, path, carried item, the job's state and blocked reasons):

```
T763_PROBE=1 T763_DAMAGE=1 T763_SEEDS=probe-3 T763_VARIANTS=busy T763_SHIFTS=331 T763_DAYS=6 npx vitest run -c vitest.perf.config.ts test/perf/t763_first_week_probe.test.ts
```

Decide from what it shows whether it is a fault (a claim held while the medic does something else, a fetch that cannot finish) or the danger of the place (the leopard still there), and fix or record it. A test if the rule changes.

## Done

- [ ] The medic's three hours explained in this file.
- [ ] A fix with a test, or the reason none is needed, in 17 or 11.
