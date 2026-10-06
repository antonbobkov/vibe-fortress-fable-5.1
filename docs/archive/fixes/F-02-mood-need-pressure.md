# F-02 — Mood: need pressure as its own term; the needs-met floor (S)

**Needs:** — · **Resolves:** C-006, C-007 · **Spec touched:** `15-happiness-and-morale.md`, `03-content/balance.md`, `04-implementation/acceptance-tests.md`

## Why

`15` § Mood gives

```
mood = clamp(0, 100, 55 + positives(≤ 40) − negatives(≤ 35) − needPressure(≤ 20) + hearthBonus + personalityBase)
```

and promises: "A dwarf with every need met … has a floor of 20 … Reaching Miserable requires neglected needs." That promise holds only if need pressure is a **separate** term. The same document's § Interaction with 10 needs then says the standing need thoughts *are* the pressure term and count inside `negatives`. The code follows that paragraph:

- `src/systems/morale/mood.ts:33` has no need-pressure term, and `NEED_PRESSURE_CAP` is declared but never used.
- The seven standing need thoughts add up to at most −45, but they share the −35 cap with every other negative.

The consequences:

- A dwarf with a neutral personality can never go below 20, so neglect alone never causes Miserable and there are no sulks (C-007).
- A sensitive and timid dwarf (`personalityBase` −6) reaches 14 with all needs met, which is exactly what the floor forbids (C-006).

M6 adds grief, fear and wound thoughts, and M7 immigration needs hall spirit ≥ 65. Both are tuned against this formula, so it has to be settled now.

## Decisions

1. **Decision F-02a — which thoughts are need pressure.** `needPressure` is computed from the standing thoughts `hungry`, `thirsty`, `tired` and `lonely` only, the four needs `balance.md` § Mood names ("the player … failed to provide food, drink, beds or company"). `uncomfortable`, `restless` and `bored` stay ordinary standing negatives.
   - Measured reason: when all seven thoughts counted, a normal fortress without chairs or a meeting area in its first week produced 5–14 sulks in 20 days (0–4 today).
2. **Decision F-02b — the formula.**

   ```
   positives    = min(POSITIVE_CAP, Σ value of active thoughts with value > 0)
   negatives    = min(NEGATIVE_CAP, Σ |value| of active thoughts with value < 0)          // standing need thoughts included
   needPressure = floor(min(NEED_PRESSURE_CAP, Σ |value| of active hungry, thirsty, tired, lonely))
   raw          = MOOD_BASELINE + positives − negatives − needPressure + hearthBonus + personalityBase
   mood         = clamp(MOOD_MIN, MOOD_MAX, max(raw, MOOD_NEEDS_MET_FLOOR − needPressure))
   ```

   - The need thoughts count in `negatives` too. Counting them twice is deliberate: it is what lets neglect, and only neglect, take a dwarf below 20.
   - The values used are the displayed, personality-scaled values.
   - `floor` keeps a hunger that has just crossed its want threshold (−0.2) from counting.
   - The floor term guarantees mood ≥ 20 whenever `needPressure` is 0, whatever the personality, and it falls smoothly (no jump) as pressure grows.
3. **Decision F-02c — new constant.** `MOOD_NEEDS_MET_FLOOR = 20` in `15` § Tuning constants (it is the "floor of 20" the section already states).
4. **Decision F-02d — the `mo_misery_needs` fixture.** "No food, no drink" for 7 days conflicts with M6: at thirst 100 for `DEHYDRATE_DAYS` (3), 17 deals 8% of torso hp a day, and the "exactly one sulk per dwarf per 7 days" wording cannot be met by any formula, because a dwarf must be Miserable at seven consecutive day boundaries and nobody is Miserable at the first one. The fixture becomes:
   - 7 dwarves, no food, 400 loose `ale` on the ground (drinkable through D-120's last resort), no beds or furniture, run 14 days.
   - Assertions: some dwarf below 20 by day 7; every dwarf's sulks fall exactly on the days the sulk rule (`15` § Sulks) gives for its recorded daily tiers; at least one sulk; nobody dies.
   - Hunger damage (`STARVE_DAYS` 7, then 8% a day) totals 56% of torso hp by day 14, so the fixture stays valid through M6.

## Spec amendments

`docs/02-systems/15-happiness-and-morale.md` § Mood: replace the code block and the paragraph under it with

````markdown
```
positives    = min(POSITIVE_CAP, Σ value of active thoughts with value > 0)
negatives    = min(NEGATIVE_CAP, Σ |value| of active thoughts with value < 0)
needPressure = floor(min(NEED_PRESSURE_CAP, Σ |value| of the active standing thoughts hungry, thirsty, tired, lonely))
hearthBonus  = hearthHallTierIndex × HEARTH_TIER_BONUS          // 0 with no hearth; bare = 0 … royal = 5 × bonus
raw          = MOOD_BASELINE + positives − negatives − needPressure + hearthBonus + personalityBase
mood         = clamp(MOOD_MIN, MOOD_MAX, max(raw, MOOD_NEEDS_MET_FLOOR − needPressure))
```

With the constants below: baseline 55, positives up to +40, negatives down to −35, need pressure down to −20, hearth up to +10. The standing thoughts of the four survival and company needs count twice, once as thoughts and once as pressure: that is what makes neglect, and only neglect, able to take a dwarf below 20. With every need met, `needPressure` is 0 and mood is at least `MOOD_NEEDS_MET_FLOOR` (20, Unhappy, not Miserable) whatever the thoughts and the personality. This is the design's anti-spiral guarantee, and the Wave 4 acceptance tests check it.
````

`docs/02-systems/15-happiness-and-morale.md` § Interaction with 10 needs: replace the paragraph with

> Need pressure is part of the mood formula, so a hungry fortress is an unhappy fortress before it is a starving one. The standing need thoughts are both the legible form of the pressure ("Hungry (−6)" in the dwarf's thought list) and its measure: all seven count among `negatives`, and `hungry`, `thirsty`, `tired` and `lonely` also make up `needPressure`. `uncomfortable`, `restless` and `bored` are ordinary standing negatives: a fortress without chairs or a meeting area is gloomier, not miserable.

`docs/02-systems/15-happiness-and-morale.md` § Tuning constants: add the row `| `MOOD_NEEDS_MET_FLOOR` | 20 | Mood floor while no need is neglected |` after `NEED_PRESSURE_CAP`.

`docs/03-content/balance.md` § Mood (the formula line and its bullets): replace

> `mood = 55 + min(40, positives) − min(35, negatives) − min(20, need pressure) + hearth bonus`:

with

> `mood = max(55 + min(40, positives) − min(35, negatives) − need pressure + hearth bonus + personality, 20 − need pressure)`, need pressure = the four survival and company thoughts (hungry, thirsty, tired, lonely), capped at 20:

and replace the bullet "Worst case with needs met: 55 − 35 + 0 = 20 (Unhappy, not Miserable)." with

> - Worst case with needs met: 55 − 35 + 0 = 20, and the floor keeps it at 20 for a sensitive, timid dwarf too (Unhappy, not Miserable).

`docs/04-implementation/acceptance-tests.md` § 15 Morale, replace the two rows:

| id | Scenario | Expected |
|---|---|---|
| `mo_floor` | every need met; every negative event thought applied at once; three dwarves: sensitive + timid, stoic + brave, neither | mood ≥ 20 for each; exactly 20 for the sensitive + timid dwarf |
| `mo_misery_needs` | 7 dwarves, no food, loose ale only, no beds or furniture, 14 days | mood < 20 for some dwarf by day 7; each dwarf sulks exactly on the days the sulk rule gives for its daily tiers (never twice within `SULK_DAYS`); ≥ 1 sulk; no dwarf dies |

## Code

| File | Change |
|---|---|
| `src/systems/morale/mood.ts` | Export `MOOD_NEEDS_MET_FLOOR = 20` beside `NEED_PRESSURE_CAP`. `moodValue(values: readonly { value: number; need?: boolean }[], hearthTier, personalityBase)` implements Decision F-02b exactly (the `floor` is `Math.floor`). Replace the comment "Standing need thoughts already carry need pressure …" with one line citing this task. |
| `src/systems/morale/standing.ts` | Export `NEED_PRESSURE_THOUGHTS: ReadonlySet<string> = new Set(['hungry', 'thirsty', 'tired', 'lonely'])`. |
| `src/systems/morale/index.ts` | In `recompute`, map each thought to `{ value: currentValue(...), need: NEED_PRESSURE_THOUGHTS.has(def.id) }`. |

`test/property/mood-bounds.test.ts` already passes a `need` field and needs no change.

## Tests

`test/unit/morale/morale.test.ts`: replace the test "applies positive and negative caps and pins C-006 personality floor conflict" with "F-02: caps, need pressure and the needs-met floor". Its assertions are exact (verified against the prototype):

```ts
expect(moodValue([{ value: 100 }], 0, 0)).toBe(95);
expect(moodValue([{ value: -100 }], 0, 0)).toBe(20);
expect(moodValue([{ value: -100 }], 0, -6)).toBe(20);                                   // the floor (was 14, C-006)
expect(moodValue([{ value: -10, need: true }], 0, 0)).toBe(35);                        // counted twice
expect(moodValue([{ value: -10, need: true }, { value: -10, need: true }, { value: -100 }], 0, 0)).toBe(0);
expect(moodValue([{ value: -3.6, need: true }, { value: -100 }], 0, -6)).toBe(17);     // max(11, 20 − 3)
expect(moodValue([{ value: -0.4, need: true }, { value: -100 }], 0, -6)).toBe(20);     // floor(0.4) = 0
expect(moodValue([], 2, 0)).toBe(59);
```

Add "F-02: only hungry, thirsty, tired and lonely are need pressure" as a unit test on `NEED_PRESSURE_THOUGHTS` (exactly those four ids, each an existing `thoughts.json` row with `decay: 'standing'`).

`test/scenarios/mo_floor.scenario.ts` (remove `todo`):

- `flat-test`, `embark: 'none'`, three dwarves. Overwrite each `Personality.traits` so the first traits are `['sensitive', 'timid']`, `['stoic', 'brave']` and `[]` respectively, filled up to three with traits that are none of those four.
- `w.step(1)`.
- For each dwarf, append to its `Mood.thoughts` one `ActiveThought` per `thoughts.json` row with `decay !== 'standing'` and a negative base value (`baseValue(def)` of `@systems/morale`), `startTick` = now, `baseValue` = the base value × `personalityMultiplier(...)`. Inject thoughts directly: emitting trigger events also fires positive rows such as `got_it_out` and `healed`.
- Then three times: set every need of every dwarf to 0 (`w.setNeed`) and `w.step(TICKS_PER_HOUR)`.
- Assert `mood ≥ 20` for all three and `mood === 20` for the sensitive + timid dwarf.

`test/scenarios/mo_misery_needs.scenario.ts` (remove `todo`):

- `flat-test`, `embark: 'none'`, seed `mo-misery-needs`. Spawn 7 dwarves at `(10 + i, 10, 32)` and `spawnItem('drink', 'ale', w.index(10, 12, 32), 400)`.
- `w.step(2)`. Then for day 1 … 14: `w.step(TICKS_PER_DAY)`, and record each dwarf's `tier` and its cumulative `SulkHappened` count.
- For each dwarf, replay its tiers through `advanceSulkCounter` (from 0) to get the expected sulk days. Assert that the days on which its count rose are exactly those days.
- Assert: some dwarf had mood < 20 on day 7; total `SulkHappened` ≥ 1; `w.events('CreatureDied')` is empty.
- Measured with the prototype on this seed: three dwarves Miserable (moods 2–19); expected and actual sulk days `[7, 14]`, `[7, 14]` and `[8]`; the four stoic dwarves stayed at 26–43; no deaths. If the seed produces no Miserable dwarf after the change, that is a defect in the implementation, not a reason to change the seed.

## Done

- The three scenarios `mo_hall_spirit`, `mo_grief` and `mo_caps` still pass unchanged (they did with the prototype).
- `DECISIONS.md`:
  - one row for F-02a–d (pinning: the unit test above and both scenarios);
  - under C-006 and C-007: `Resolved by F-02 (<date>): need pressure is a separate term over hungry, thirsty, tired, lonely, with a floor of 20 − needPressure.`
- `test/golden/world-hashes.json` regenerated if it changes (mood changes productivity). Say so in the commit body.
- Suite green; spec amendments applied verbatim.
