# T-771 — The Military panel does not say where a squad's members are or what they are doing

**Closed:** 2026-11-25, in 356a38b7.

**Source:** playtest 2026-11-25 (military) ([report](../../../reports/data/2026-11-25-playtest-6.md), finding 4) · **Size:** M · **Needs:** — · **Status:** open

## Why

A squad's details give its mode, members, weapons, gear choices, station, patrol, orders and barracks, all settings. Nothing says what the squad is doing now. In play I could not answer "is my squad at the gate?" from the panel:

- **Raid, Autumn 21, Year 1** (`playtest-1125-p3m`, peril 3). The Gate Guard was Active with a station north of the gate and the alert at Watch. Its five members were not together: three went first to eat, drink and sleep, as 16 allows when no hostile is in sight, and walked out to the station one at a time as each finished. The first ones met the raid of 11 alone: "! 3 dwarves are fighting 7 gloam warriors, a gloam captain and 2 gloam archers.", then "!! Thora Forgeeye has bled to death." and "Fundin Frostfoot has lost consciousness." (`07-squad-piecemeal-log.png`). The panel meanwhile read "Mode: active", "Armed 4 of 4" (Fundin, unconscious, counted as armed) and "Station (30,6,z32)", the same as it did before the fight.
- **The Units panel** says "On duty" for every member, whether at the post, on the way, or standing shut in a gatehouse (`04-soldier-shut-in-thirst.png`, finding 3).
- **The members row is cut:** "Members Fundin F., Thora F., Kar»", "Members Ulf D., Yngvar T., Sigru»". With a squad of five or six, half the names are behind the `»` (`02-d76-military.png`).

16 § Squads gives the parts: a member is on duty, or serving a need, fleeing, retreating or a patient (its brain behavior), it has a post (`fixedPost`), and 17 knows who is down.

## What to do

Decisions:

- **A status line under the members' keys**, for a squad with members: how many stand at their post and what the others are doing, from each member's state, in this order: `at post` (on its post tile or within 1 of it), `fighting` (has a hostile target), `on the way` (on duty, walking to its post), `eating`, `drinking`, `asleep` (a need), `in hospital` (patient), `down` (unconscious), `fled`. "Now: 2 at post · 1 on the way · 1 eating · 1 down (Fundin F.)". With no post (no station, no barracks, no order), `at post` reads `standing` and the line adds "no post: they stand where they are". Off duty (mode off under Calm) the line reads "Off duty: at work." A `down` member is named. The line wraps with a two-cell indent; it is in the alert colour while any member is down or fled.
- **"Armed N of M" counts the conscious members only**; a member who is down is in the status line, not the armed count.
- **The members row wraps** under itself with a two-cell indent instead of cutting, as the armed line does.
- The Units panel's Activity is unchanged.

Made in the work (2026-11-25):

- **The post comes from 16, not a copy in the UI.** A new reader, `combat.postOf(dwarfId)`, runs the squads' own positioning (`fixedPost`) as a read, so the panel and the squad cannot disagree about where a member belongs. It moves no one and stores nothing: no world hash moves.
- **Precedence, one state per member:** down, then in hospital, then fled (fleeing or retreating), then a need, then fighting, then the post. A member fighting at its post counts as `fighting`.
- **Needs other than food, drink and sleep** (social, comfort, joy) read `on a break`, after `asleep`.
- **Patrol, follow and kill orders** give a member no fixed post: a member under one that is not fighting reads `on the way`, not `standing`. `standing` and the "no post" words are only for a squad with no station, no barracks and no order.
- **The armed line is left out when every member is down**; the status line says so.
- **The members row breaks between words**, as the armed line does; a name may break between the first name and the initial.
- `03-content/ui-keymap-and-screens.md` needs no edit: its § Strings states the rule (every UI word is a key), and the new keys are UI defaults in `src/ui/strings.ts` (`ui.military.now`, `ui.military.now_no_post`, `ui.military.off_duty`, `ui.military.now.<state>`).

Spec: `ui-screens/panels.md` § Military (the squad details), 16 § Player-facing behavior, `03-content/ui-keymap-and-screens.md` (strings).

## Done

- [x] Tests (`describe` with the task id): a squad of five with two at the station, one walking to it, one eating and one unconscious shows "Now: 2 at post · 1 on the way · 1 eating · 1 down (…)" in the alert colour, and "Armed 4 of 4". A squad with no post reads "standing … no post". Six members' names wrap onto two rows.
- [x] UI only: no world hash moves.
