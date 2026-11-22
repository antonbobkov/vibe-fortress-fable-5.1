# T-666 — A patient is watered only with drink

**Closed:** 2026-11-22, in 5a1b6622,a204f04d.

**Source:** [T-664's report](../../../reports/data/2026-11-20-t664-small-fortress-starves.md) · **Size:** S · **Needs:** — · **Status:** done

## Why

T-664 found that `feed_patient` took only a meal, so patients starved in bed beside full stores of plants; it now takes any food when no meal is to be had. `water_patient` (17 § Patients and hospitals) takes only an item of category `drink`. A dwarf on its feet drinks at a well or at the brook when the drink is gone (10 § Eating and drinking), and T-656's sweep had peril-4 fortresses with no drink for weeks, so a bedridden patient there has nothing brought to it while its fellows drink water; the job stands `blocked: missing_input`, which does not tell the player why.

## What to do

Decide how a patient is given water when there is no drink: a hauler fills a bucket at a well or the brook and brings it (the bucket is already a hospital supply, 17 § Patients and hospitals: `clean_wound` takes one), or the patient, if it can walk, drinks at the brook. Write the rule in 17, with a unit test of a patient in a fortress with no drink and a bucket and a well, and look in the sweep's logs (`[three_years_thirst_death]` with `outdoors: false` in a hospital bed) for whether it happens.

## Done

The rule and its test, and the count of patients dead of thirst in a sweep before and after.

- [x] **The rule.** 17 § Patients and hospitals: when no drink is to be had while a `bucket` is, and there is water to fill it (a working well, or drinkable water within reach of the patient, by 10's drink search), `water_patient` takes the bucket as its tool and no input; the hauler brings water in it, filled as part of the job as `clean_wound`'s bucket is, and keeps the bucket. With no bucket or no water the job waits for a drink. A drink job blocked `missing_input` while a bucket of water can be had is cancelled (`no_drink`) and made again with the bucket (`src/systems/health/producer.ts`). A patient able to walk does not go to the brook: patients rest in bed as before.
- [x] **Unit test.** `test/unit/health/t666-patient-water.test.ts`: no drink, a bucket and a well: watered with the bucket, which is kept; a drink is taken before water; no water: the bucket is not taken and the job waits for a drink; a drink job whose drink is gone is made again with the bucket.
- [x] **Patients dead of thirst in a sweep.** Before (master, T-683's sweep `45027251322`): one `starvation` death in a bed with thirst 100 (`p4-4` shift 50, day 285, logged twice), with 96 drinks in stock, so not a fortress with no drink; no other need death indoors. After (`45037122991`): the same one, unchanged. No sweep timeline has a bedridden patient in a fortress with no drink at present, so the rule changes no sweep figure.
- [x] CI `45035598102` green on `a204f04d`; sweep `45037122991` (shifts 0 to 150) on `c69de682` (master `a513d903` merged): Pooled 20 / 7 / 0 / 1097 living / 122.75 deaths / 0.5 extinct / 0.5 need deaths, **Verdict: pass**, worth tracing by seed: none (master's T-683 sweep `45027251322`: 1097.25 / 122.5).
