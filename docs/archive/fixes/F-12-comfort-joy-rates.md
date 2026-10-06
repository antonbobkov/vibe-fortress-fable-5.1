# F-12 — Comfort and joy rates: match the documented visit frequency (S)

**Needs:** the three_years fixture repair (T-M8-06 follow-up) · **Blocks:** the balance re-measure · **Spec touched:** `10-dwarves.md`, `balance.md`

## Why

[`reports/M8-mood-diagnosis.md`](../../../reports/audits/M8-mood-diagnosis.md) found that `bored` is active 100% of dwarf-time and `uncomfortable` 93%, costing about 8 mood points, and that `restless` costs about 3 more. Dwarves spend much of the day chasing comfort and joy instead of working, so purpose rises too.

The cause is that the spec contradicts itself. A dwarf acts at its want threshold and one visit relieves a fixed amount, so the interval between visits is `relief / rate` hours:

- comfort: `balance.md` says "a sit every day or two". The rate is 3/h and a sit in a decent room relieves 40, which gives a sit every **13 hours**. To keep up, a dwarf would need about 1.8 sits a day.
- joy: `balance.md` says "a hearth visit every two days". The rate is 1.5/h and a visit relieves 30, which gives a visit every **20 hours**. A visit every two days relieves 15 a day against a rise of 36.

At the documented frequency neither need can stay under its want threshold, so both standing thoughts are near-permanent by design.

**Owner decision (2026-10-02):** the documented frequency is right and the rates are wrong. Change the rates, not the relief amounts, which is the same choice F-10 made for hunger and thirst.

## Decisions

1. **Decision F-12a — the new rates.** `comfort` becomes **1 per hour** and `joy` becomes **0.75 per hour**. Derivation, to be reproduced in the tests:
   - comfort: 40 relieved per decent-room sit ÷ 1/h = a sit about every **40 hours** ("every day or two"); a hearth-hall sit (20) lasts 20 hours.
   - joy: 30 relieved per hearth visit ÷ 0.75/h = a visit about every **40 hours** ("about every two days"), with fine meals, mist and masterworks relieving some of it.
2. **Decision F-12b — nothing else changes.** Relief amounts, want thresholds, the standing-thought formulas in `personality-and-thoughts.md`, `purpose`, `social`, `rest`, `hunger`, `thirst`, `MOOD_BASELINE`, `IMMIGRATION_SPIRIT_MIN` and every thought value and duration stay as they are. Purpose is expected to improve on its own, because dwarves spend less time on comfort and joy activities. That is to be measured, not tuned.
3. **Decision F-12c — no representation change.** Needs already accumulate fractionally (F-10c).

## Spec amendments

### `docs/02-systems/10-dwarves.md` § Needs, the rates table

Old:

```
| comfort | 3 | sitting in a room of tier ≥ decent −40 per sit; hearth hall −20 | 55 | none |
```

New:

```
| comfort | 1 | sitting in a room of tier ≥ decent −40 per sit; hearth hall −20 | 55 | none |
```

Old:

```
| joy | 1.5 | hearth hall visit −30; mist −30; fine meal −20; seeing a masterwork −10 | 60 | none |
```

New:

```
| joy | 0.75 | hearth hall visit −30; mist −30; fine meal −20; seeing a masterwork −10 | 60 | none |
```

### `docs/03-content/balance.md` § Needs and consumption, the rate rows

Old:

```
| comfort | 3 | 55 | a sit every day or two |
```

New:

```
| comfort | 1 | 55 | a sit about every 40 hours in a decent room (20 in the hearth hall) |
```

Old:

```
| joy | 1.5 | 60 | a hearth visit every two days |
```

New:

```
| joy | 0.75 | 60 | a hearth visit about every 40 hours, fewer with fine meals |
```

## Code

- `src/systems/dwarves/needs.ts`: `COMFORT_PER_HOUR` 3 → 1, `JOY_PER_HOUR` 1.5 → 0.75. Nothing else moves.
- Check for any other place that assumes the old rates (a comment, a test helper, a hint) and update it to cite the new numbers.

## Tests

- Unit, `F-12`: the visit arithmetic. One dwarf, no interruptions, Endurance 50: starting from 0, comfort reaches want (55) in 55 hours, and after a 40-relief sit it returns to want in 40 hours. Starting from 0, joy reaches want (60) in 80 hours, and after a 30-relief visit it returns to want in 40 hours.
- `test/unit/dwarves/needs.test.ts` "rates are unchanged (guards F-10b)": update only `COMFORT_PER_HOUR` and `JOY_PER_HOUR` to the F-12 values, and say so in the commit body. Every other assertion in it stays.
- Any existing test that asserts a comfort or joy timing derived from the old rates: update only the arithmetic, never a threshold or a rule, and list each one in the commit body.

## Golden files

Simulation timing changes, so `test/golden/world-hashes.json` will change, and render goldens may. Regenerate with `npm run golden:update -- <name>` in the same commit, with a `golden:` paragraph saying "world hashes: F-12 changes how often dwarves sit and visit the hearth".

## Done

- The two rates changed and the four spec amendments applied verbatim.
- The tests above exist, are tagged `F-12`, and pass.
- `npm run lint`, `npm run typecheck`, `npm run content:check` and `npm test` green.
- `PROGRESS.md` ticked, a `DECISIONS.md` D- row recording the owner decision, and goldens regenerated in the same commit.
