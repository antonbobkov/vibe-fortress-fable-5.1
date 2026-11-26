# T-NEW — The Thane and the Broker die, and their titles empty without a word

**Source:** playtest 7 ([report](../../reports/data/2026-11-26-playtest-7.md), finding 2) · **Size:** S · **Needs:** — · **Status:** open

## Why

In Spring, Year 4, the Thane, Jorund Saltvein, bled out after an ambush at the depot. The log said "!! Jorund Saltvein has bled to death.", with no title. Nothing else changed in the log. The Units panel's whim line ("The Thane wishes for something strong …") disappeared. At Summer 1 the season's whim was judged ("The Thane wished for something strong, and did not get it."), and no new whim followed. In Summer the Hillfolk came, and the trade request answered "No one has taken the trade yet. No Broker: appoint one in Units [u]." That was the first sign that the Broker was dead too. The title list ([u] [t]) read Thane (vacant), Broker (vacant), Chief medic (vacant). Two months later the Warden, Liv Bronzestair, died of an infection, also without a word.

The cause is in `dwarves/index.ts`: on `CreatureDied`, 10 clears `this.titles[title]` for each title the dead dwarf held and emits nothing. `TitleAssigned { dwarfId: 0, previousId }`, whose `announce.title_vacated` note exists, is emitted only by the `AssignTitle` command. The Thane gives the hall thought and the whims, and the Broker trades, so an empty title costs the fortress.

## What to do

Decisions taken here:

- On a title holder's death, 10 emits `TitleAssigned { dwarfId: 0, title, previousId: id }` for each title held, as a vacate does. The event catalog row already allows it.
- The vacate line for a death is an alert, not a note, and names the way back: "Jorund Saltvein was the Thane. The title is vacant: [u] [t] names another." (`announce.title_vacated_died`). One line per death, listing every title the dwarf held ("… was the Thane and the Broker.").
- The death line itself names the title: "!! Jorund Saltvein, Thane, has bled to death." (the `{name}` of `announce.died.*` takes the title as the whim line does).
- No automatic successor. Choosing one is the player's decision, and the line says so.

## Done

- [ ] 10 emits the vacate on death; a test that a dead Thane's title is vacated with the event.
- [ ] The alert line and the titled death line in strings and 24's announcement table; a UI test.
- [ ] 10 § Titles says what a death does to a title.
