# T-NEW — A busy first week makes a gregarious dwarf miserable before anything can help: measure it

**Source:** T-760 (playtest 2026-11-25 ([report](../../reports/data/2026-11-25-playtest-5.md), finding 6), checked while T-760 was done) · **Size:** M · **Needs:** — · **Status:** open

## Why

In the newcomer playtest, Ulfar Ironfist was miserable on Spring 2: "I have not talked to anyone in a while. Slept under the sky. Got soaked." Two more dwarves followed on Spring 5. 15 § Mood says need pressure (`hungry`, `thirsty`, `tired`, `lonely`) is "what makes neglect, and only neglect, able to take a dwarf below 20", and that "a fortress without chairs or a meeting area is gloomier, not miserable". A player on day 2 has neglected nothing.

A probe while T-760 was done (default embark, `deep-5589-1`, `probe-2`, `probe-3`, no player orders, ten half-days) found no miserable dwarf in five days. Hall spirit fell from about 53 to 37–47. The lowest moods were 23–26 by day 5, from a `restless`-trait dwarf with nothing to do (`restless` −10, `bored` −10). Idle dwarves talk on social errands, so `lonely` hardly showed.

The playtest fortress was busy from the first hour, with digs, chops, orders and a farm. A dwarf at work takes no social errand (10 § Behavior selection, step 8). With no hearth hall there is no hall errand (step 6). A talk in passing needs two dwarves standing still within two tiles (10 § Social, comfort, joy). So in a busy fortress with no hearth hall, social has no reliable relief, and it rises 2 an hour from about 30. `lonely` starts within the first day and reaches −5 by about day 2. That is −10 for a gregarious dwarf, and it counts twice, once as a thought and once as pressure. Add `slept_outdoors` −5, `caught_in_rain` −2 and `uncomfortable`, and a gregarious dwarf with a low personality base can drop below 20 on day 2. The probe above had no work, so it did not show this.

## What to do

Measure before deciding. Do not retune in this task.

- A probe of the first 14 days on the default embark with a busy fortress, on several seeds. Give the orders a newcomer gives on day 1: a dig, a chop box, a carpenter's workshop with an order, and a farm plot. Record, by day, the share of dwarves at Miserable, the first day any dwarf is, and each such dwarf's top three thoughts, its traits and its social need. Run it once with nothing else and once with a meeting area zoned on day 1.
- If day-2 to day-4 misery is common and comes from `lonely` in a fortress with no way to talk, choose one change and record the choice in the spec. The options: talks in passing between dwarves working near each other; the wagon's tiles or the embark site counting as a meeting area until a hearth hall exists; a slower `lonely` onset in the first season; or no change, keeping the T-760 Mood lines and hint as the answer.

## Done

- [ ] A dated audit report under `reports/audits/` with the probe, its seeds and the commit.
- [ ] Either a spec and code change, with tests and an instrument run, or a note in the report that the design stands.
