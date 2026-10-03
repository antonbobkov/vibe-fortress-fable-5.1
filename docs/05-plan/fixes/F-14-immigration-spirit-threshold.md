# F-14 — Immigration spirit threshold: 65 → 55 (S)

**Needs:** F-12 · **Blocks:** the T-M8-06 re-measure · **Spec touched:** `21-immigration.md`, `balance.md`, `acceptance-tests.md`

## Why

`balance.md` § Mood floor sets the immigration threshold at hall spirit 65 ("an average of Content"). It reaches that figure by adding a hearth hall, decent bedrooms, table meals, ale and a chat **at their peak values**: 55 + 11 + 4 = 70. Event thoughts decay linearly over their duration (`15` § Thoughts), so a thought refreshed about once a day averages roughly half its peak.

[`reports/M8-mood-diagnosis.md`](../../../reports/M8-mood-diagnosis.md) measured the three-year fortress after the fixture repair, F-12 and the drink fix. It has decent bedrooms for everyone, a tier-3 hearth hall, a dining hall and 87% ale. The fortress settles at end-of-year-3 mood 55–58, a 20-seed peace sweep of 50–62, and hall spirit about 55. At 65, a fortress built exactly as the hints describe never gets an immigrant after the guaranteed year-one waves, so the population stays at 12 and wealth and renown stay flat.

**Owner decision (2026-10-03):** lower `IMMIGRATION_SPIRIT_MIN` from 65 to **55** and leave the mood constants alone. With the measured spread of 50–62, a well-kept fortress attracts immigrants and a neglected one does not. That is the "reward for exactly the things the hints tell the player to build" that `balance.md` intends.

## Decisions

1. **Decision F-14a.** `IMMIGRATION_SPIRIT_MIN` = **55**.
2. **Decision F-14b — nothing else changes.** The mood tiers (Content stays 65–84), `MOOD_BASELINE`, every thought value and duration, `IMMIGRATION_PERMILLE`, wave sizes, `WEALTH_PER_WAVE` and the population cap stay as they are. `hallSpiritTier` still uses the mood bands; only the immigration gate moves. The acceptance test `mo_hall_spirit` (hall spirit ≥ 65 within 7 days in a good fortress) is about the spirit formula, not immigration, and stays as it is.

## Spec amendments

### `docs/02-systems/21-immigration.md` § Tuning constants

Old:

```
| `IMMIGRATION_SPIRIT_MIN` | 65 | Content tier |
```

New:

```
| `IMMIGRATION_SPIRIT_MIN` | 55 | upper Fine tier; a well-kept fortress settles here (balance.md) |
```

### `docs/03-content/balance.md` § Mood floor and the no-spiral guarantee

Old:

```
- Hall spirit for immigration (65) needs an average of Content: a hearth hall (+4 to +10), decent bedrooms (+3), meals at a table (+2), ale (+3) and a chat (+3) give 55 + 11 + 4 = 70 to a fed and rested dwarf. Immigration is the reward for exactly the things the hints tell the player to build.
```

New:

```
- Hall spirit for immigration (55) needs a well-kept fortress: a hearth hall (+4 to +10), decent bedrooms (+3), meals at a table (+2), ale (+3) and a chat (+3) give 55 + 11 + 4 = 70 to a fed and rested dwarf at their peak. Event thoughts fade over their duration and average about half their peak, so a fortress with all of them settles near 55–60 (measured in T-M8-06), and some standing need thoughts are always present. Immigration is the reward for exactly the things the hints tell the player to build.
```

### `docs/03-content/balance.md` § Immigration

Old:

```
Then each season with spirit ≥ 65:
```

New:

```
Then each season with spirit ≥ 55:
```

(Only those words change; the rest of the paragraph stays.)

### `docs/04-implementation/acceptance-tests.md`, the `im_threshold` row

Old:

```
| `im_threshold` | year 2, spirit 60 vs 70 | 60: `ImmigrationSkipped { spirit }`; 70: a wave with probability ~70% (over 100 seeds: 58–82) |
```

New:

```
| `im_threshold` | year 2, spirit 50 vs 60 | 50: `ImmigrationSkipped { spirit }`; 60: a wave with probability ~70% (over 100 seeds: 58–82) |
```

## Code

- `src/systems/immigration/constants.ts`: `IMMIGRATION_SPIRIT_MIN` 65 → 55.
- `test/scenarios/im_threshold.scenario.ts`: the two spirit values become 50 and 60, as the amended row says. The `hallSpiritTier` expression in its helper follows the mood bands and stays.
- Any other test or label that encodes 65 as the immigration gate (for example the `three_years` report row "spirit >= 65") becomes 55. A 65 that means the Content tier stays 65. Check each one and list them in the commit body.

## Tests

- `im_threshold` passes at 50 / 60.
- Unit, `F-14`: eligibility at spirit 54 reports the `spirit` reason; at 55 it does not.

## Golden files

World hashes change only if a golden world reaches an immigration check with spirit between 55 and 65. Regenerate if they move, with a `golden:` paragraph saying "world hashes: F-14 lowers the immigration spirit threshold".

## Done

- The constant changed, the four amendments applied verbatim, the tests updated and passing.
- `npm run lint`, `npm run typecheck`, `npm run content:check`, `npm test` green.
- `PROGRESS.md` ticked, a `DECISIONS.md` D- row.
