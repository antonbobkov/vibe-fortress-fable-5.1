# T-624 — The Hearth alert with no shelter, training with no barracks, and what "Idle" means

**Closed:** 2026-11-18, in b436dca5.

**Source:** [T-618's first-year audit](../../../reports/audits/2026-11-18-t618-first-year-ux.md), findings 12–15 · **Size:** M · **Needs:** — · **Status:** open

## Why

On Spring 3 the predator hint says "[m] then [3] raises the Hearth alert: civilians go to the hearth …". A new player does it at once, before there is a hall, a hearth or a door. With no shelter (19 § Hearth alert retreat finds no hearth hall, no indoor tile behind a door and no bedroom), all seven dwarves stood at the wagon in the open for the rest of the day and no designation was dug; the Units panel called each of them "Idle", and nothing said the alert had nowhere to send them. The player has stopped the fortress and left it under the sky, and has to guess that `[1]` undoes it.

The squad of the audit was set to Train before any barracks existed. The panel said "Mode: train" and "No barracks [S-b] assign" in the normal colour; the soldiers stood "On duty" and trained nothing. After a barracks was zoned the panel went on saying "No barracks" until a tick passed.

Activities read as need names in lower case ("hunger", "thirst", "sleep", "social") beside "Dig", "Haul to depot" and "Craft (recipe)", and the hover line of an idle dwarf says "No job" where Units says "Idle".

## What to do

1. **No shelter, said.** While the alert is Hearth and some civilian has no retreat tile, the military panel's alert line says so in the alert colour: "No shelter: 7 dwarves wait at the wagon, in the open. Make a Hearth hall [z] or a room behind a door." The activity of such a dwarf is "Sheltering (no shelter)" in place of "Idle".
2. **The predator hint** says the alert needs a hall first when there is none: "… once your hall has a door."
3. **Training needs a barracks.** A squad on Train with no barracks shows "No barracks: the squad cannot train. [z] Barracks, then [S-b]." in the alert colour; the barracks line reads the zone as soon as it is made while paused, as the zone inspector does (T-609).
4. **Activity words.** A need errand reads as a verb, capitalised like the job names: "Eating", "Drinking", "Sleeping", "Talking", "Resting"; a job named "Craft (recipe)" in `jobTypes` shows the recipe's name ("Craft: wooden bolts"); the hover line says "Idle" as Units does.

Spec: 19 § Hearth alert retreat, `ui-screens/panels.md` § Military, `ui-keymap-and-screens.md` § Hints, 10 § Behavior selection (activity text), 16 § Training.

## Done

Tests for the no-shelter line and activity, the barracks warning, and the activity words; the military e2e still passes.
