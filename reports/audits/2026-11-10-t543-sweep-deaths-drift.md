# T-543: the drift of the sweep's dwarf deaths

**Date:** 2026-11-10 · **Commits:** master `48b754d1` (after T-535) and master `6e6a6ec3` (after T-541) · **Data:** [the deaths by killer](../data/2026-11-10-t543-deaths-by-killer.txt), [the reference verdict](../data/2026-11-10-t543-sweep-verdict.md)

## The question

Each of today's merges passed the sweep, but pooled dwarf deaths rose from merge to merge: 132.75 (T-535), 146 (T-538), 150.75 (T-539), 142.25 (T-540), 154.25 (T-541). The bound is 155.25. Raider kills in T-539's and T-541's runs rose from 366 to 430, with no raid code changed. Is the rise raids, wild animals or noise, and is any of it a fault?

## How

- **Eight shifts, before and after.** One 4-shift sweep is too noisy to compare merge to merge. So I ran master before today's rule changes (`48b754d1`, master after T-535) and master after T-541 (`6e6a6ec3`) each at the four standard shifts and at four more (200 to 350). That gives eight timelines per seed per commit (runs 42870676873, 42870682282, 42872065870, 42873612241).
- **Deaths by killer.** I sorted every dwarf death in those runs, and in the nine earlier sweeps whose logs are still kept, by its killer (the data file).
- **The fights themselves.** A probe on `6e6a6ec3` logged the first blow of each fight between a dwarf and a wild animal: who struck first, the alert, and whether the dwarf was a soldier. It ran six seeds that lose dwarves to bears and wolves, at the four standard shifts (run 42903590270, branch `t543-probe`, 24 timelines). Its timelines are the sweep's: same commit, same deaths on the same ticks.

## What was found

**The rise is wild animals, and it is the cost of the rules.** Over eight shifts, per sweep:

| | living | deaths | to raids | to wild animals | other |
|---|---:|---:|---:|---:|---:|
| `48b754d1`, before | 939.75 | 134.38 | 104.25 | 22.75 | 7 |
| `6e6a6ec3`, now | 882.25 | 146.38 | 101.63 | 41.63 | 2.75 |
| difference | −57.5 | +12 | −2.63 | +18.88 | −4.25 |

The standard error of the difference of two 8-shift figures is about 9 deaths, 8.5 for raids and 4.8 for wild animals. Wild deaths rose by four standard errors. Raid deaths did not move.

**The raid rise was timeline noise.** Raid parties are the same in every run: 164 to 171 raids and 2,287 to 2,561 raiders over the 80 timelines. Raid deaths per sweep in the twelve runs range from 93.75 to 115.5 with no trend. T-539's and T-541's runs (111 and 115.5) are the two highest draws. Master's eight shifts give 101.63. The two runs with the most wild deaths, T-538's and T-540's, had among the fewest raid deaths (101.75 and 98). So soldiers dying to wildlife first do not make the raids deadlier. A squad that waits to muster cannot matter either: the muster applies to wild-only alerts, and a raid never waits for it. Kit on the ground arms recruits sooner, so if anything it would cut raid deaths.

**By merge** (wild deaths per sweep, one 4-shift run each unless stated):

- **T-538** (a struck wolf or bear fights back): from 22.75 to 38. With the script as it was, 47.5.
- **T-539** (the squad musters, shelters from wolves, answers an attack at once): back down to 29 and 32.25 (T-539's and T-541's runs).
- **T-540** (noise and closeness wake a sleeper): up to 42 without T-539. With it, 41.63 on master's eight shifts against 30.6 for the T-539 runs: about +11. A sleeping wolf or bear that a passing dwarf wakes is a dangerous animal at close range.
- **T-541** (the kit drops): no visible effect.

Named bear kills went from 1.5 a sweep (eight shifts before) to 8.25 (now). Wolf kills went from 5.5 to 11.63. Deaths with no killer named near a wild-only alert went from 13.1 to 20.4.

**The fights cannot be answered in time.** In the probe's 24 timelines, 86 of the 96 dwarves killed by a bear or a wolf were struck first by the animal. For 62 of the 86, no alert stood at that first blow. All 96 died within a day of the first blow, and 57 within 300 ticks of it (a quarter of a day), bled out from one or two wounds. Twelve of the 17 bear deaths followed a bear's first blow in a calm fortress: the script raises the alert for a wolf near any dwarf on the surface, but for a bear only near the gate (T-538). Even an instant alert would not have saved those dwarves: they were mauled before anyone could come. Of the other five, four were soldiers who struck a bear under the alert. A bear lets a fleeing dwarf go, but since T-538 it fights one that strikes it.

**No plain fault.** The rules do what 08 says. A struck aggressive animal fights to its flee percent. A dwarf approaching within `APPROACH_RADIUS` is attacked. Noise wakes sleepers. The script plays like a sensible player within the limits T-529, T-538 and T-539 set. What would cut these deaths is a tactical choice, not a fix: hunting a bear or a pack with the mustered squad before it mauls, or keeping workers away from where animals sleep. T-539 chose sheltering over hunting for wolves, for good reasons. Reopening that choice for bears needs its own measurement, so it is filed as a follow-up ([T-544-bear-mauls-unanswered](../../docs/archive/tasks/T-544-bear-mauls-unanswered.md)).

**Living fell with the deaths.** The 57.5 fewer living per sweep are more than the 12 deaths. A dead dwarf no longer works for the wealth and the halls that draw migrants, and a few more fortresses die out (1 and 1.25 extinct a sweep, against 1.25 and 0.75 before). Need deaths rose to 2.5 to 2.75 a sweep, from 1. They are the last dwarves of fortresses dying at perils 2 and 4, plus `three-years-p0-4` (two to three dwarves, in one timeline of each set of four, as before T-512). The peril-0 hunger rule holds: 0.25 of 1.

## The reference and bounds

`SWEEP_REFERENCE` (20 / 7 / 0 / 948.5 / 125.25) and the best figures (`SWEEP_MEASURED`, 948.5 living and 125.25 deaths) date from T-525's master, before wolves and bears fought back. They are not today's game. Also, 125.25 was a low draw even then. T-525's raid deaths, 93.75 a sweep, are the lowest of the twelve runs. The ratchet keeps the best figure ever seen, and the best of many noisy draws sits below the true level.

With today's true level near 146 and one verdict's standard error near 9, a 155.25 bound blocks unchanged code about one time in six. The living bound, 848.5, is 34 below today's 882, while two sets of four shifts of one commit differ by up to 96 living, so it blocks unchanged code often too.

Proposed, and made in this task's second commit:

- `SWEEP_REFERENCE` = master `6e6a6ec3` at shifts 0 to 150 (run 42872065870): 19.75 / 7 / 0.25 / 886 / 147, with 1 extinct and 2.5 need deaths.
- `SWEEP_MEASURED` = the means of master `6e6a6ec3` over eight shifts: 882.25 living and 146.38 deaths. That gives bounds of 782.25 living and 176.38 deaths, with the tolerances unchanged (100 and 30). Taking an 8-shift mean as the best figure, not the lowest single verdict, keeps the bound from being set by luck.

A change that makes the fortress better still ratchets the best figures, as before.
