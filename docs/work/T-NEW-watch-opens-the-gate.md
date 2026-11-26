# T-NEW — Hearth to Watch opens every Lock on alert door, and nothing says so

**Source:** playtest 2026-11-25 (military) ([report](../../reports/data/2026-11-25-playtest-6.md), finding 2) · **Size:** S · **Needs:** — · **Status:** open

## Why

Day 20 of Autumn, Year 1, `playtest-1125-p3m` (peril 3, 13 dwarves), the eve of a Gloam raid of 11, with the alert at Hearth and the gate's four `lock_on_alert` doors locked. I wanted the Gate Guard out at a station north of the gate, which it could not reach (finding 3). The Military panel offers three alerts: "Calm: everyone works.", "Watch: squads stand to; civilians work." and "Hearth: civilians stop work and shelter in the hall or behind a door; Lock on alert doors shut." Watch reads as "the squad goes, the rest stays as it is". I pressed `[2]`.

Every `lock_on_alert` door opened at once (`alertLocked` false on all six). The civilians went back to work, and the soldiers went to eat and drink first (they had been shut in the gatehouse, finding 3). The raid arrived 650 ticks later and walked down the open stair: at the moment I raised Hearth again, one raider stood in the hall and six were in the stair shaft (`09-raid-in-gate-under-watch.png`). The civilians then "sheltered" in the hall among them. All 13 dwarves were dead 2,100 ticks later, and the legend opened (`08-fall-legend.png`).

The rule that did it is 14's door mode, "`lock_on_alert` (locks while the alert is `hearth`…)", and `onAlertChanged` in `src/systems/buildings/build.ts` clears the lock whenever the alert leaves `hearth`. 19 § Hearth alert retreat says something else: "When the alert returns to `calm`, the alert lock clears". Neither the Watch line, the alert keys nor the log says that Watch opens the gate.

Reproduce: load the d76 save (in the report), press `[m]` `[2]` and read the doors' `settings.alertLocked` (all false), then step 1,250 ticks and list the hostiles on z 26 to 32.

## What to do

Decisions:

- **The rule stays as the code has it:** a `lock_on_alert` door is locked only under Hearth. 19's sentence is corrected to "When the alert leaves `hearth`, the alert lock clears…". Watch keeps the gate open by design, for a fortress that wants its squads out and its civilians at work.
- **The alert lines say what the doors do.** "Watch: squads stand to; civilians work; Lock on alert doors stay open." and "Calm: everyone works; Lock on alert doors stay open." (the Calm line's squad tail follows as now), only while the fortress has a built `lock_on_alert` door; without one, the lines read as now.
- **Leaving Hearth with a hostile party on the map or coming** asks first, as the Hearth → lower confirmation of the danger-line task decides (the two tasks share it; whichever lands first adds it). The question says the doors open: "Lower the alert? Lock on alert doors open with a Gloam raid of 11 on the map. [y] yes [n] no".
- **The log notes the doors opening**: when the alert leaves Hearth while some `lock_on_alert` door was locked, a note "Lock on alert doors open: the gate is open." (not an alert: the player did it).

Spec: 19 § Hearth alert retreat (the clearing sentence), 14 § Doors (unchanged, check it agrees), `ui-screens/panels.md` § Military (the alert lines), 24 § Announcements (the note), `03-content/ui-keymap-and-screens.md` (strings).

## Done

- [ ] Tests (`describe` with the task id): with a built `lock_on_alert` door, the Watch and Calm lines end with the door clause; without one they do not. Hearth → Watch with a party on the map asks; `y` clears every alert lock and logs the note once.
- [ ] UI and spec text only: no world hash moves.
