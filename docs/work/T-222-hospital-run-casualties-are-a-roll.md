# T-222 — `hospital_run` passes on one roll of its staged fight

**Source:** T-134 (`docs/work/T-134-soldier-need-interruptions.md` § Findings) · **Size:** M · **Needs:** — · **Status:** open

## Why

`hospital_run` (`test/scenarios/hospital_run.scenario.ts`) creates its casualties by simulation: a staged fire beside one soldier, and a two-member raid against four soldiers on day 5. It then asserts at least three wounded survivors, and that every one of them is admitted, treated and discharged by day 30. Whether that holds is a roll of the fight, and the seed was chosen by search (its own comment: T-144 found only `hospital-run-4` passing). Measured for T-134 with the same script over seeds `hospital-run`, `hospital-run-2` … `hospital-run-12`:

| Code | Passing seeds |
|---|---|
| `cloud/main` `d36dd19` | 1 of 12 (`-4`) |
| `cloud/T-134` (soldiers on calm orders now eat and sleep) | 0 of 12, and 0 of 28 more (`-13` … `-40`) |

Four things make the fixture a roll rather than a test of rules:

1. **"Wounded" is any `DamageDealt`.** 17 admits a dwarf only for a bleeding wound, an unsplinted fracture, an undressed burn, an infection or unconsciousness (17 § Patients and hospitals). A dwarf whose hits were all light bruises is rightly never admitted, and the fixture then fails "should be admitted". Seed `hospital-run-5` on `cloud/T-134`: dwarf 16777275 took five blunt hits of 4–5, all `bruise`/`light`, and was never a patient. 15 of the 28 failures in seeds `-13` … `-40` (with the fire change of item 3; 12 of 28 without it) are this.
2. **Discharge by day 30.** A grievous fracture keeps pain over `PAIN_DISCHARGE` (30) for longer than the 25 days left: with T-134 and the fire change of item 3, seed `-4` gives soldier 16777277 a grievous head fracture at tick 6167; splinted and cleaned, it still has body pain 31 and `healRemaining` 6,729 at tick 36,000, so it is not discharged.
3. **The staged fire burns whoever shares soldier3's tile.** The fire is lit on soldier3's tile and the tile east of it, wherever soldier3 stands at tick 6000. Since T-134, a tired soldier on a calm station order sleeps; soldier3, the scout and the medic were asleep on the same hospital bed tile (41, 6) (several dwarves sleep in one bed, T-223), and all three were burned at tick 6015. With the only medic a patient, the three guards' arrow wounds went untreated and they bled out at ticks 6788, 6793 and 6943: one wounded survivor. Waiting until soldier3 has both fire tiles to itself fixes this part, and the run then fails on item 2.
4. **The seed that passed on `cloud/main` relied on the fault T-134 fixed.** There the scout and the reserve, on `active` squads with a station and a `calm` alert, never left their posts for a want: the scout stood at its station with rest 84–89 at ticks 6000–6100 (want threshold 60). 10 § Behavior selection step 5 lets a want wait for a calm standing order no longer.

Raising a `watchful` alert when the squads deploy (so that their station orders hold wants, as a player would) and lowering it when the raid ends was tried: 0 of 12 seeds pass on `cloud/T-134` (items 1 and 2 remain).

## Reproduction

`npx vitest run test/scenarios/m8.test.ts -t hospital_run` on `cloud/T-134`: `expected 1 to be greater than or equal to 3`. For a seed sweep, run the scenario object with `{ ...scenario, seed }` for each seed through `runScenario` (`test/scenarios/runner.ts`).

## What the spec says

17 § Patients and hospitals (who becomes a patient, discharge at pain below `PAIN_DISCHARGE`), 10 § Behavior selection step 5 and 16 § Squads (soldiers on calm orders eat and sleep), `process/testing-strategy.md` (a scenario asserts rules, not a roll).

## What to do

Decisions:

- A wounded survivor is a living dwarf that 17's rule makes a patient (it received a `WoundInflicted` that bleeds, a fracture, a burn, or became unconscious), not any dwarf with a `DamageDealt`. This is 17's rule, not a looser assertion.
- Every admitted survivor must be discharged; the run steps on after day 30, with no command, until each is discharged, bounded by 30 more days, instead of requiring it by day 30.
- The staged fire waits until soldier3 has its two tiles to itself (at most half a day), so that it burns soldier3 alone.
- The squads deploy under a `watchful` alert, lowered to `calm` when the raid ends, so that the soldiers hold their posts by the rule of 16 § Squads.
- Keep every other assertion. Measure seeds `hospital-run`, `-2` … `-12` before and after and record both counts in the commit.

## Done

`hospital_run` passes on its seed and on at least 10 of the 12 measured seeds, with the counts in the commit body; no other assertion is changed.
