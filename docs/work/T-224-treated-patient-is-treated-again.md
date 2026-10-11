# T-224 — A treated patient whose pain keeps it in hospital is treated again and again

**Source:** T-134 (`docs/work/T-134-soldier-need-interruptions.md` § Findings) · **Size:** S · **Needs:** — · **Status:** open

## Why

17's health tick recomputes `Patient.needs` only while the dwarf still has a reason to be a patient (a bleeding wound, an unsplinted fracture, an undressed burn, an infection, unconsciousness) (`src/systems/health/tick.ts`). Once every wound is treated but pain is still at or over `PAIN_DISCHARGE`, the dwarf stays a patient and keeps the needs list of its last update. The job producer then posts the same treatments again: each `set_bone` consumes a splint and emits `TreatmentDone` though no fracture is unsplinted.

## Reproduction

`hospital_run` on `cloud/T-134` with the fire staged on soldier3 alone (T-222, item 3), seed `hospital-run-4`: soldier 16777277 takes a grievous head fracture at tick 6167. It is splinted at 6917 and cleaned at 7790, and then gets `set_bone` more than twenty times, with `clean_wound` and `diagnose`, up to tick 36,000. At tick 36,000 its only wound is `splinted: true, cleaned: true`, body pain 31, and `Patient.needs` is still `["set_bone", "clean_wound", "diagnose"]`.

## What the spec says

17 § Patients and hospitals: medic jobs are "produced per patient per need"; `set_bone` takes "1 `splint` per fracture → `splinted`"; discharge needs pain below `PAIN_DISCHARGE`.

## What to do

Recompute the needs list on every health tick for every patient, so that a treated patient waiting only for its pain to fall has none; the producer then posts nothing for it. Pin it with a unit test: a splinted, cleaned grievous fracture with pain over `PAIN_DISCHARGE` keeps the patient admitted with no `set_bone` job and no splint consumed.

## Done

The test names T-224 and fails before the change; no treatment is repeated on a treated wound.
