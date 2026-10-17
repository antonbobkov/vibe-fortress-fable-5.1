# T-373 — Balance-model sums that the rules do not give

**Closed:** 2026-10-17, in c2663d1.

**Source:** T-333, [`../../reports/audits/2026-10-17-unmeasured-spec-numbers.md`](../../../reports/audits/2026-10-17-unmeasured-spec-numbers.md) § Contradictions found · **Size:** S · **Needs:** — · **Status:** open

## Why

Four worked figures of `docs/03-content/balance.md` do not follow from the rules and tables they explain:

1. **Raid size at peril 2, year 2** (§ Wealth curve): "6 + 4 = 10". The raid row of `threat-schedules.md` is base 6, `perRenown` 0.30, and the size is rounded (`src/systems/threats/schedule.ts` rounds half up): at renown 15 that is round(10.5) = 11.
2. **Blood at unconsciousness** (§ Combat pace): "unconscious at 240 lost". A dwarf has 600 blood (`BLOOD_PER_SIZE` × size), and 17 makes it unconscious below `BLOOD_UNCONSCIOUS_PERCENT` (40%) of it, that is after 360 lost; 240 is the blood left.
3. **Tree regrowth** (§ Wood and fuel): "around 40 saplings a day in a forest". 07 tries `REGROWTH_TRIES_PER_DAY` (40) tiles a day, each with chance `treeDensity × REGROWTH_PERMILLE` (200); with the forest densities of `regions-biomes-and-traits.md` that is one or two saplings a day, not 40.
4. **Logs per tree** (§ Wood and fuel): "2–4 logs (average 3)". The species rows of `plants.md` give 1–2 to 2–4, most 2–3; only oak reaches 2–4, and `TREE_LOGS_MIN` / `TREE_LOGS_MAX` (03) are 1 / 4.

## What to do

Correct each figure in `balance.md` from the rule (raid 11 or a renown that gives 10; 360 lost; the regrowth the rule gives, and whether wood is then still "not scarce on forested maps"; the species' average logs). If a corrected figure breaks the claim it supports (item 3 may), say so in the work file's report line and file the rule question as its own task. No constant changes here.

## Done

- The four figures follow from the rules, and any claim they no longer support has a task.
