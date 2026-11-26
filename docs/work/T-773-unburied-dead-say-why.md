# T-773 — After a massacre the dead lie unburied for days, and nothing says a coffin is missing

**Source:** playtest 2026-11-25 (military) ([report](../../reports/data/2026-11-25-playtest-6.md), finding 6) · **Size:** S · **Needs:** — · **Status:** open

## Why

`playtest-1125-p3m`, Spring 18 to 30, Year 3 (38 dwarves, peril 3): an ambush killed two and a raid of 17 met on a Calm alert killed eleven more. The fortress had four coffins, all holding bodies (`buildings.freeCoffins()` empty). Seven to twelve days later 13 dwarf corpses still lay where they fell: in the hall at z 26 (Eydis, Fundin, Steinn, Olav, Kolbein, Gloin, Vera, Ragnvald, Dagr, Thorin), on the stair, and outside the gate (Varin, Brynja). The Mood panel's top thought was "-4 The dead lie unburied. x24", with no "Helps:" line under it, while "I am thirsty" has one (T-760) (`20-mood-unburied.png`). The log had no line about burial or coffins: a filter on "cof" or "bur" found nothing. Dog corpses from Year 1 (tick 80,647) were still at the gate, as skeletons, 174 days later.

A player after a lost fight has to know to build coffins and a tomb, and how many. The game knows: 13's `items.unburiedDead(tick)` and 14's `freeCoffins()`.

## What to do

Decisions:

- **A Helps line for `unburied_dead`**: "a coffin [b > Furniture] in a tomb zone [z] for each body, or a memorial slab for one who is lost" (`ui.mood.helps.unburied_dead`), shown as T-760's other helps.
- **An alert once a day while some dwarf has lain unburied past `UNBURIED_DAYS`** (`announce.unburied`), its focus the oldest body, folded by day as the other standing alerts are (T-741). With no free coffin: "5 dead wait for burial and no coffin is free: build coffins [b > Furniture], best in a tomb [z]." With fewer free coffins than bodies: "5 dead wait for burial and only 2 coffins are free: build 3 more [b > Furniture]." With enough (no path, no hauler, a forbidden body): "5 dead wait for burial: 5 coffins are free." A coffin outside a tomb also takes a burial (14, the `coffin` row), so the line asks for coffins first.
- The burial rules are unchanged.

Spec: 15 § Registrations (the alert), 24 § Announcements and the log, `ui-screens/panels.md` § Mood, `03-content/ui-keymap-and-screens.md` (strings).

## Done

- [ ] Tests (`describe` with the task id): three dwarf corpses past `UNBURIED_DAYS` give the alert in its three wordings with no free coffin, with one ("only 1 coffin is free: build 2 more") and with three; none before `UNBURIED_DAYS`; the Mood panel shows the Helps line under "The dead lie unburied.".
- [ ] UI only: no world hash moves.
