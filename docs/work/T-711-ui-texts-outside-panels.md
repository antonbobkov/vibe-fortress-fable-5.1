# T-711 — The creature view, the screens and the UI's shared modules still write text in code

**Source:** [T-709](../archive/tasks/T-709-panel-texts-in-strings.md), found while moving the panels' texts · **Size:** M · **Needs:** T-705, T-707 (they change the tile list, the building view and the creature view now) · **Status:** open

## Why

T-709 moved the fortress panels' texts into `UI_STRINGS` and taught `strings:check` to fail on a literal that reads as text in `src/ui/panels` (`LITERAL_DIRS`). It left out what was being changed or was outside the panels; the same scan (`literalsIn` and `looksPlayerFacing` of `scripts/strings-check.mjs`) finds, at the T-709 merge:

- **The creature view** (`src/ui/panels/look.ts`, skipped by `LITERAL_FILES_SKIPPED`): ten literals of the mood and health lines (`Mood: {tier} ({value})`, `Health: Blood {blood}%, Pain {pain}`, `Wounded, bleeding`, `Conscious`, `Unconscious`, `  Permanent: …`, `  {part}: destroyed`, the part rows' `hp`).
- **The screens** (`src/ui/screens`, 86): `fortress.ts` (21: the panel titles `Designate`, `Look`, `Log`, … and the buildings' `Depot`, `Workshop`), `settings.ts` (28), `legend.ts` (16: `Founded …`, `Years … · Days …`, `Milestones`, `No legends recorded.`), `trade_session.ts` (10, with a second copy of the civilization names the Civilizations panel now reads from `ui.civ.name.*`), `game_menu.ts` (7: `Resume`, `Save`, …), `embark.ts`, `labor_manager.ts`, `world_map.ts`.
- **The shared UI modules** (`src/ui/*.ts`): `messages.ts` (6: list joins `{a} and {b}`, ` or `), `announcements.ts` (3), `raid-lines.ts` (2: `a few`, `a horde`), `constants.ts` (7), `settings.ts` (4), `hints.ts`, `food-at-hand.ts`; and `keymap.ts` (304), whose action wording is the keymap table of `ui-keymap-and-screens.md` § Keymap, copied verbatim.
- `status.ts` and `announcements.ts` read `MOOD_TIER_NAMES`, which T-709 builds from the `ui.mood_tier.*` defaults: a `strings.json` row of those keys does not reach them; `moodTierName(strings, tier)` does.
- 18's `threats.schedulePreview()` returns English ("possible from Autumn, Year 2"), which the Threats panel parses to write "from Autumn, Y2"; a reader that gives the season and year would let the panel word it alone.

## What to do

- After T-705 and T-707 merge, move `look.ts`'s literals to `ui.look.*` keys and remove its line from `LITERAL_FILES_SKIPPED`.
- Move the screens' and shared modules' texts to `UI_STRINGS` under `ui.<screen>.*` keys, keeping the words; the trade screen reads `ui.civ.name.*`.
- Decide whether the keymap wording becomes `ui.keymap.*` keys or stays as the keymap table's canonical copy (then: allow-list `keymap.ts` with that reason).
- Extend `LITERAL_DIRS` to `src/ui/screens` and `src/ui`, so the scan covers them.
- `status.ts`, `announcements.ts` and `look.ts` draw the tier with `moodTierName`; `MOOD_TIER_NAMES` goes.

## Done

- [ ] `strings:check` scans `src/ui` whole; its skip list is empty and its allow-list gives a reason for each entry.
- [ ] The screens' and panels' existing tests pass unchanged. UI only: no world hash moves.
