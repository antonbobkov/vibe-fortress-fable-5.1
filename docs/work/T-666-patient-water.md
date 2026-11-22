# T-666 — A patient is watered only with drink

**Source:** [T-664's report](../../reports/data/2026-11-20-t664-small-fortress-starves.md) · **Size:** S · **Needs:** — · **Status:** open

## Why

T-664 found that `feed_patient` took only a meal, so patients starved in bed beside full stores of plants; it now takes any food when no meal is to be had. `water_patient` (17 § Patients and hospitals) takes only an item of category `drink`. A dwarf on its feet drinks at a well or at the brook when the drink is gone (10 § Eating and drinking), and T-656's sweep had peril-4 fortresses with no drink for weeks, so a bedridden patient there has nothing brought to it while its fellows drink water; the job stands `blocked: missing_input`, which does not tell the player why.

## What to do

Decide how a patient is given water when there is no drink: a hauler fills a bucket at a well or the brook and brings it (the bucket is already a hospital supply, 17 § Patients and hospitals: `clean_wound` takes one), or the patient, if it can walk, drinks at the brook. Write the rule in 17, with a unit test of a patient in a fortress with no drink and a bucket and a well, and look in the sweep's logs (`[three_years_thirst_death]` with `outdoors: false` in a hospital bed) for whether it happens.

## Done

The rule and its test, and the count of patients dead of thirst in a sweep before and after.
