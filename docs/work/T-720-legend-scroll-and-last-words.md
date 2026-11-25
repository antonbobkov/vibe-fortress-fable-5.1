# T-720 — The legend scrolls past its end, and its last words are thirty starving lines

**Source:** playtest 2026-11-24 (second) ([report](../../reports/data/2026-11-24-playtest-2.md), finding 7) · **Size:** S · **Needs:** — · **Status:** open

## Why

After abandoning "Reedholm" (world `deep-2346-1`, 98 days, 11 dwarves left) the player opened it from the main menu's Legends (`57-legends.png`, `58-legend-entry.png`):

- **`↓` scrolls past the end.** The footer read "↑↓ Scroll 1/62"; after 60 presses the page showed two lines, and after 100 it read "Scroll 101/62" over an empty page. `PageDown` does nothing.
- **"Last words (log)" is mostly one line repeated.** Of the 50 alert and danger lines (24 § Legends), about 16 were "! N dwarves are starving: …", 8 "! X is starving." and a dozen "! The restless dead rise.", one per day each. Borin Wolfcloak's death in battle (Autumn 6) had already dropped out of the 50; Ulfhild Beareye's starvation, the fortress's one death by hunger, sat between two starving lines near the bottom. The story of the fortress (a cavern breached in spring, a caravan missed, the undead every autumn night, a raid turned back by the river) is not there to read.

## What to do

Decisions:

- **The legend's scroll stops at the last page** (the offset is clamped to `lines − rows`; the footer never shows a number above its total), and `PageDown`/`PageUp`, `Home`/`End` move by a page and to the ends, as the Load screen's list does.
- **"Last words" keeps one line per kind of announcement**: of lines with the same string key (and the same subject, for a line about one dwarf), the newest is kept and marked with how many days it came, "! The restless dead rise. (14 nights)", "! 3 dwarves are starving: Modi, Dagny, Rurik. (31 days)". Deaths (`CreatureDied` of a dwarf) are never folded. The list then holds up to 50 such lines, newest first, as now. 24 § Legends says so.

Spec: 24 § Legends ("the last 50 alert or danger announcements"), `ui-screens/menus-and-world.md` § Legend (keys).

## Done

- [ ] Tests (`describe` with the task id): the legend screen's offset stops at its last page and `End` reaches it; a record whose log has 30 daily starving lines and 3 deaths shows one starving line with its day count and all 3 deaths.
- [ ] UI and the legend record only: world hashes unchanged.
