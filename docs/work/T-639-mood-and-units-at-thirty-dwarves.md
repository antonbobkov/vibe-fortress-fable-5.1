# T-639 — The Mood and Units panels at thirty dwarves and more

**Source:** [T-635's mid-game audit](../../reports/audits/2026-11-19-t635-midgame-ux.md), findings 13–15 · **Size:** M · **Needs:** — · **Status:** open

## Why

- **Mood.** At 33 dwarves the panel shows each dwarf's top thought cut to six letters ("-4 I have »", "-6 Nothing»"), and names cut to twelve: "Ragnhild Bri" twice, "Oddny" twice. With 80 dwarves the hall spirit stood at Fine (49) and the panel could not say why: the player has to open dwarves one by one to learn that "One of» " is "One of my friends died" for half the hall. Nothing sums the thoughts across the fortress.
- **Inspector thoughts.** Thoughts of weight zero are listed ("0 The Thane sleeps in a hovel.", "+0 Ate in a decent hall."); a soldier off duty thinks "-5 I have nothing to do."
- **Units.** Names are cut to twelve letters with a third of the panel empty; `[S-w] hurt` is a toggle with no mark on its caption, so pressing it when nobody is hurt and again later turns it off without a sign; titles are not shown in the list, and appointing a Thane writes no line.

## What to do

1. Mood opens on a summary: the hall spirit and the five thoughts held by most dwarves with their counts and weights ("-6 One of my friends died ×31", "+5 Had a lavish meal ×28"); `Enter` on one lists who holds it. The per-dwarf table follows, its name column as wide as the panel allows (full names at sidebar width when they fit), with two rows per dwarf when the top thought does not fit, as the wireframe wraps.
2. The inspector lists only thoughts whose weight rounds to a nonzero value; the purpose thought "I have nothing to do" is not given to a soldier of a squad in training or on duty.
3. Units gives the full name where it fits, a title mark after it (`Palnir Wolfaxe ♔`), and `[S-w] hurt ■` while the sort is on; appointing or removing a title writes a note ("Palnir Wolfaxe is now the Thane.").

Spec: `ui-screens/panels.md` § Mood and the Units panel of `fortress-screen.md`; 15 § thoughts (purpose); 10 § Titles.

## Done

Tests: the summary counts thoughts across a fixture of 30 dwarves; two dwarves with a shared first name and family prefix are told apart; the toggle mark; the title note.
