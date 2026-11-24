# T-693 — A wildfire's light burns ask for a cloth each

**Source:** T-691 follow-up · **Size:** S · **Needs:** T-691 · **Status:** open

## Why

Since T-691 a light burn takes no infection and asks for no cleaning, but it is still dressed, one cloth a burn (17 § Patients and hospitals), because the dressing halves its pain. On the two timelines T-691 replayed (`three-years-p4-1` and `three-years-p2-1` at shift 0, on T-665's branch) a lightning-lit wildfire gave 141 and 59 light burns, and 34 and 28 `dress_burn` jobs stood blocked on cloth for weeks. Nobody died of it, but a fortress that had the cloth would spend its bandages on scorches the week before a raid's cuts need them.

## What to do

Decide whether a light burn's dressing waits behind the hospital's bandage stock (dress only while cloth is above what the hospital wants for `stop_bleeding`), is made from a cheaper stuff, or is not made at all once pain from the dwarf's light burns is below `PAIN_DISCHARGE`; measure the cloth a wildfire's dressings take and the bandages a raid soon after finds.

Spec: 17 § Patients and hospitals (`dress_burn`, cloth and water first).

## Done

- [ ] Tests: a dwarf with light burns does not take the hospital's last bandage cloth from a bleeding patient.
- [ ] The cloth spent on light burns after a wildfire, before and after, on the two timelines.
