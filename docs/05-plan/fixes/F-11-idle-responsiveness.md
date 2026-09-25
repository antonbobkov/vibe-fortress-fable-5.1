# F-11 — An idle dwarf notices work before `IDLE_TICKS` elapses (S)

**Needs:** F-10 · **Blocks:** F-04, T-M6-01 · **Spec touched:** `10-dwarves.md`

## Why

An idle dwarf ignores new work for up to a full game hour. `10-dwarves.md` § Behavior selection step 9 reads "go to the hearth hall and wait `IDLE_TICKS`, then re-evaluate", and `IDLE_TICKS` is 50, which is `TICKS_PER_HOUR`. The implementation follows that literally: once a dwarf enters `idle` it does not ask 11 for a job again until the timer expires, however much work appears in the meantime.

Measured on `tr_dig_room` at commit `696bd49` (after F-01 and F-10), digging a 3×3 granite room with one miner:

```
t=  0..  1        select
t=  2.. 51 (50)   idle / "No job"     <- the dig job already exists
t= 53..168 (116)  work / Dig
```

Total 2,001 ticks, of which 50 are that opening idle. The job was designated at tick 0 and created within a tick or two; the dwarf simply was not looking. Across a fortress this is an hour of every idle dwarf's time lost after every new designation, order or haul, which is a visible responsiveness bug and not only a test artifact.

The same section's opening sentence already provides for the fix: "Evaluated when the dwarf has nothing to do, when a need crosses a threshold, and **when interrupted by an event**." A dwarf with nothing to do is precisely the idle case, and a job becoming available is an event. Step 9's timer is a poll interval for a dwarf with nothing to look at, not a licence to ignore work that has arrived.

**Owner decision (2026-09-25):** make an idle dwarf re-evaluate as soon as work is available, rather than accepting the 1-tick overshoot on C-004 or deferring it again.

## Decisions

1. **Decision F-11a — what wakes an idle dwarf.** While a dwarf is in `idle`, it re-evaluates behaviour on the first tick at which 11 could give it a job, instead of waiting out `IDLE_TICKS`. Implement it as the cheapest correct check in the existing tick order: the idle branch asks 11 whether a job is available for this worker (the same candidate filter assignment already uses) and, if so, re-enters selection immediately. Do not add a new event type, a new registry or a per-tick scan over all jobs.
2. **Decision F-11b — `IDLE_TICKS` keeps its meaning and its value.** It remains the re-evaluation interval for a dwarf with nothing available: 50, unchanged, still in `10`'s constants table. Only the "and nothing has appeared" case waits it out. Do not change the constant.
3. **Decision F-11c — the walk to the hearth hall is unchanged.** An idle dwarf still heads for the hearth hall (or the wagon tile until there is one). Waking early cancels the wait, not the walk: a dwarf part-way there simply takes the job from where it stands.
4. **Decision F-11d — no other behaviour branch changes.** Steps 1 to 8 keep their order and their conditions. In particular this is not a licence to re-check needs more often; only the idle branch's poll changes.
5. **Decision F-11e — re-measure C-004.** After the change, re-run `tr_dig_room` **with its setup untouched**. The predicted result is about 1,951 ticks against the documented 2,000. If it passes, mark C-004 resolved per [README § Decision log](README.md#decision-log) and remove its `todo: 'C-004'`. If it does not, leave the contradiction and its marker exactly as they are and report the measured number. Do not adjust the setup or any constant to reach the limit.
   C-005 is **not** expected to resolve (measured 2,057 ticks after equip against a 1,500 limit at `696bd49`); leave it alone unless it genuinely passes, in which case resolve it the same way.

## Spec amendment

### `docs/02-systems/10-dwarves.md` § Behavior selection, step 9

Old:

```
9. `idle`: go to the hearth hall and wait `IDLE_TICKS`, then re-evaluate. Idle dwarves are shown as "No job" in the units panel.
```

New:

```
9. `idle`: go to the hearth hall and wait up to `IDLE_TICKS`, then re-evaluate; re-evaluate at once if a job becomes available for this dwarf before the wait is over, so that new work is never ignored for a whole hour. Idle dwarves are shown as "No job" in the units panel.
```

## Code

- `src/systems/dwarves/brain.ts`: the idle branch (the step 9 handler, which currently waits `IDLE_TICKS` before selecting again).
- Reuse 11's existing "is there a job for this worker" path rather than duplicating candidate logic. If the jobs board has no suitable query yet, add the narrowest one and say so in the commit body.
- Keep the hot path cheap: this runs for every idle dwarf every tick, so it must not allocate or walk the whole job list. If the cheapest correct check is still measurably expensive, report the measurement rather than optimising past the spec.

## Tests

- Unit, `F-11`: a dwarf standing idle is given a job designated after it entered `idle`, and claims it within a handful of ticks rather than after 50. Assert the tick count is well under `IDLE_TICKS`.
- Unit, `F-11`: with no job available, an idle dwarf still re-evaluates on the `IDLE_TICKS` cadence (guards F-11b) and still walks toward the hearth hall or wagon tile (guards F-11c).
- Re-run and report per F-11e: `tr_dig_room`, and `search.test.ts`'s D-076 case.
- Check the existing `dw_walk_idle` scenario still passes on its own terms; if its assertions encode the old 50-tick wait, report exactly which and why the change is legitimate before altering anything — an assertion about the *cadence with no work* must keep passing unchanged.

## Golden files

Job claim timing moves, so `test/golden/world-hashes.json` will change and render goldens may. Regenerate with `npm run golden:update -- <name>` in the same commit, with a `golden:` paragraph reading "world hashes: F-11 lets idle dwarves claim work without waiting out IDLE_TICKS".

## Ordering

After F-10 (whose rates F-11's measurements assume), and before F-04, whose year-one bounds depend on how promptly work is picked up.

## Done

- The idle branch wakes on available work; `IDLE_TICKS` unchanged; the spec amendment applied verbatim.
- The tests above exist, are tagged `F-11`, and pass.
- C-004 re-measured and either resolved with its marker removed, or left untouched with its number reported; C-005 likewise.
- `npm run lint`, `npm run typecheck`, `npm run content:check`, `npm test` green; `npm run test:e2e` green if `src/render`, `src/ui` or `src/app` were touched.
- `PROGRESS.md` ticked, `DECISIONS.md` row added, goldens regenerated in the same commit.
