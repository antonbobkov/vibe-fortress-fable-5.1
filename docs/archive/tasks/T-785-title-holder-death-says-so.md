# T-785 — The Thane and the Broker die, and their titles empty without a word

**Closed:** 2026-11-26, in 82e42a21.

**Source:** playtest 7 ([report](../../../reports/data/2026-11-26-playtest-7.md), finding 2) · **Size:** S · **Needs:** — · **Status:** open

## Why

In Spring, Year 4, the Thane, Jorund Saltvein, bled out after an ambush at the depot. The log said "!! Jorund Saltvein has bled to death.", with no title. Nothing else changed in the log. The Units panel's whim line ("The Thane wishes for something strong …") disappeared. At Summer 1 the season's whim was judged ("The Thane wished for something strong, and did not get it."), and no new whim followed. In Summer the Hillfolk came, and the trade request answered "No one has taken the trade yet. No Broker: appoint one in Units [u]." That was the first sign that the Broker was dead too. The title list ([u] [t]) read Thane (vacant), Broker (vacant), Chief medic (vacant). Two months later the Warden, Liv Bronzestair, died of an infection, also without a word.

The cause is in `dwarves/index.ts`: on `CreatureDied`, 10 clears `this.titles[title]` for each title the dead dwarf held and emits nothing. `TitleAssigned { dwarfId: 0, previousId }`, whose `announce.title_vacated` note exists, is emitted only by the `AssignTitle` command. The Thane gives the hall thought and the whims, and the Broker trades, so an empty title costs the fortress.

## What to do

Decisions taken here:

- On a title holder's death, 10 emits `TitleAssigned { dwarfId: 0, title, previousId: id }` for each title held, as a vacate does. The event catalog row already allows it.
- The vacate line for a death is an alert, not a note, and names the way back: "Jorund Saltvein was the Thane. The title is vacant: [u] [t] names another." (`announce.title_vacated_died`). One line per death, listing every title the dwarf held ("… was the Thane and the Broker.").
- The death line itself names the title: "!! Jorund Saltvein, Thane, has bled to death." (the `{name}` of `announce.died.*` takes the title as the whim line does).
- No automatic successor. Choosing one is the player's decision, and the line says so.

## Decisions made while implementing

- **The UI joins the vacate to the death.** 10 destroys the dead dwarf as it hears `CreatureDied`, so when the announcer reads `TitleAssigned { dwarfId: 0, previousId }` the holder is gone and 10 no longer knows its titles. The event catalog row is unchanged (no `died` field): the announcer keeps each fortress dwarf's death line of the last day (presentation state, not saved) and, when a vacate names one of them, rewrites that death line with the titles and opens the alert. The first title opens the alert (it flashes, and pauses under auto-pause on alert); a second title of the same death changes both lines in place and returns nothing.
- **Wording.** The titled name is `announce.titled_name` "{name}, {titles}," so every `announce.died.*` line reads with it ("Jorund Saltvein, Thane and Broker, has bled to death."). The alert lists "the Thane and the Broker" (`announce.the_title` before each title after the first), singular and plural keys `announce.title_vacated_died` and `_many`. The alert's focus is the death line's.
- **The vacates come in title-table order** (thane, warden, broker, chief medic), as 10's titles are listed everywhere else.
- **A vacate by command stays the note** `announce.title_vacated`.
- No new event type and no new announcement registration, so the severity table and the event counts are unchanged. No world hash moves (an extra event on a title holder's death only; 20's Broker handler already repairs the trade job on `CreatureDied`, and does it again, idempotently).

## Done

- [x] 10 emits the vacate on death; a test that a dead Thane's title is vacated with the event.
- [x] The alert line and the titled death line in strings and 24's announcement table; a UI test.
- [x] 10 § Titles says what a death does to a title.
