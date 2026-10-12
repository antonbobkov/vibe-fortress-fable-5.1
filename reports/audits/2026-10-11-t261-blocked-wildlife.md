# Late infection input validation: blocked annual result

Measured 2026-10-11 on runtime commit `7f31cc436f71141f1f2a86447b7f8a5f20e49bf7` plus the T-261 health-producer patch saved in the stash named `T-261: correct late-infection brightleaf fix; parked by annual worst/extinction guards (12.5/0/8/1/2)`. The patch, four regression tests and proposed spec edits are parked, not landed.

Baseline: [accepted infection-cure measurement](../data/2026-10-11-infection-cure-wildlife.json). Rejected patch: [complete twelve-seed output](../data/2026-10-11-t261-blocked-wildlife.json).

| Runtime | Median living | Worst living | Wildlife-free years | Extinctions | Hunger/thirst dwarf deaths |
|---|---:|---:|---:|---:|---:|
| Accepted baseline | 12.5 | 3 | 7/12 | 0 | 2 |
| Late-infection input validation | 12.5 | 0 | 8/12 | 1 | 2 |

The decided policy blocks this patch: worst survival and extinctions both worsen and both exceed their strict guards. Its median and wildlife-free count pass the tolerant guards. No guard, fixture, constant or existing assertion was changed.

## Observations

Two complete twelve-seed runs produced identical seed records, including hashes. The first completed all seed tests but failed while obtaining git metadata in its final hook; the repeat wrote the full output above and failed the minimum-survivor assertion. All twelve individual seed checks passed; the aggregate guard failed. The repeat took 563.72 seconds.

Taiga seed 4 changes from three living dwarves to extinction. The first five dwarf deaths agree through Torfi Boardelve at tick 83567 (day 70). The next dwarf death in the rejected run is Sigrid Darkbrow at tick 87492 (day 73), from bleeding after wolf attacks; the baseline loses Sigrid only at tick 97862 (day 82). The three dwarves that survived the baseline die from wolf-inflicted bleeding in the rejected run: Einar Forgesong at 125797 (day 105), Alrik Bearhall at 127077 (day 106), and Sverre Saltward at 129367 (day 108). This records the changed events; it does not establish the first causal divergence in their treatment or combat paths.

Forest seed 3 falls from 11 living to 10; taiga seed 1 rises from 10 to 11. The other nine survivor counts are unchanged. Taiga seed 1 retains the same two need deaths that T-260 diagnoses.

The narrow fix revalidates the input-free `clean_wound` at producer polling and before final work, then uses ordinary job cancellation and input fetching. Three staged regressions fail without it and pass with it; the uninfected control passes in both versions. All 29 health tests, six static checks, 2,413 full-suite tests (273 files), and the whole 25-test e2e suite passed with the patch. The browser year is unchanged: 7 living, no hunger/thirst death, hash `54f0bf60c7e768c3`. No golden moved.

## Reproduce

Restore the named stash selectively (its work-file closure and backlog deletion are provisional and must not be retained while parked). Run:

```powershell
$env:WILDLIFE_YEAR_OUT = '.vite/t261-wildlife.json'
npm exec -- vitest run --config vitest.perf.config.ts test/perf/wildlife_year.test.ts
Remove-Item Env:WILDLIFE_YEAR_OUT
```

Next investigation: trace taiga seed 4's treatment cancellations and earliest world divergence against the accepted runtime before considering this fix for landing. Do not tune the annual fixture or lower the guard to admit it.
