# T-275 — Units and labors: a readable activity, an idle filter, skill in the labor manager

Closed by `T-275: Units lists idle dwarves and the labor manager shows skill` (the commit that moved this file). The reference-fortress path with the resolved `l` is nine keys: `u`, `i`, `l`, `Enter` (quick grid to the manager), `m` x4, `Enter`.

> **Collision found 2026-10-12 (ui-fixes run, not implemented):** the decision "`l` on a Units row opens the labor manager with the cursor on that dwarf" uses a key that is already taken. `l` is the panel hotkey of Labors ([`ui-keymap-and-screens.md`](../../03-content/ui-keymap-and-screens.md) § Fortress panels, and the Units panel's own help row reads `[l] labors`); "Panel hotkeys always win" and "a panel's accelerator may not use one of those letters bare" (same document, § Rules), so a bare `l` in Units still opens the Labors panel. The work file names no fallback. The `[S-l]` accelerator is taken too (labor manager on the marked dwarves; it needs marks). The other keys of the decisions are free (`i` is one of the free letters `g h i q r v w x y`; `Shift+W` uses the free `w`). Decide the key for "from a Units row to the labor manager" (for example `[S-l]` without marks opens it on the cursor's dwarf) before starting; no part of this task was implemented.
>
> **Resolved 2026-10-12 (orchestrator):** there is no second key. `l` stays the Labors panel hotkey everywhere. When it is pressed while the Units panel is open, the Labors panel opens with its cursor on the dwarf under the Units cursor (the first labor column; the filter, if any, is dropped). Pressed from anywhere else it opens as it does now. The Units help row keeps `[l] labors`.

**Source:** T-116 and its report, [`../../reports/audits/2026-10-12-ui-ux.md`](../../../reports/audits/2026-10-12-ui-ux.md) (issue 6, § 4) · **Size:** M · **Needs:** — · **Status:** open

## Why

Finding an idle dwarf and turning one labor on took 25 key presses in the 80-dwarf fortress. The Units list shows the activity in four characters ("No j", "soci", "hung", "slee"). The labor manager shows on and off only, so the player cannot see who is good at what, and reaching the 20th labor column takes 19 presses.

## Reproduction

`test/fixtures/reference-fortress.deepholm`, loaded through Load › Import. `u`: the Act. column (capture 3/07, `07-t1-units.png`). `l`: the quick grid shows 7 of 25 labors, two headed "An" (3/09). `Enter`: the manager; `ArrowRight` ×19 to reach Mining (3/11, `10-t1-manager.png`).

## What the spec says

- [`panels.md`](../../04-implementation/ui-screens/panels.md) § Units and § Labors; the Labor manager in [`fortress-screen.md`](../../04-implementation/ui-screens/fortress-screen.md).
- [`11-jobs-and-labor.md`](../../02-systems/11-jobs-and-labor.md) § Player-facing behavior.

## What to do

**Decisions.**
- **Units columns.** In the 36-column sidebar: name 14, mood glyph 1, activity 16. The profession column is dropped from the list; it stays in the row's tooltip and in Look. An idle dwarf's activity reads "Idle" (not "No job") in the `text_dim` colour.
- **Idle filter and order.** `i` in Units toggles "idle only"; the header then reads "Units · idle (n)". `Shift+W` toggles "wounded first". Both are remembered while the fortress is open and are not saved. The count of idle dwarves is always in the header: "Units (80, 9 idle)".
- **From Units to a labor.** `l` on a Units row opens the labor manager with the cursor on that dwarf (today it opens the quick grid at the top).
- **Skill in the manager.** Each cell keeps `■` for on and `∙` for off, and its colour shows the dwarf's skill in that labor's skill: `text_dim` for none, the normal colour for levels 1 to 4, `text_value` for 5 to 9, `good` for 10 and over. The header line adds the skill: "Vera Deepmark, Miner · Mining: on · priority 5 · skill 6 (Skilled)". The colourblind palette uses the same four names, which already differ in lightness.
- **Letter jump.** In the manager a typed letter moves the cursor to the next labor column whose name starts with that letter, wrapping (`m` → Masonry → Mechanics → Medicine → Mining). The keys the manager already uses (`a`, `c`, `t`) keep their meaning; for those letters the jump is `Shift+letter`.
- **Column heads.** The vertical heads show the whole labor name; the head area grows to the longest name (16 rows) when the window has at least 55 rows, else names are cut at 8 with the full name in the header line as now.
- **Quick grid.** The sidebar grid heads use three letters that are unique ("AnC", "AnT", "Bre", "But" …), and Left and Right scroll it by column; the `»` mark stays.

1. Amend `panels.md` § Units and § Labors and the labor manager's screen text; `ui-keymap-and-screens.md` for the new keys.
2. Implement in `src/ui/panels/units.ts`, `src/ui/panels/labors.ts`, `src/ui/screens/labor_manager.ts`, `src/ui/panels/help.ts` (the key lines), and the strings.
3. Tests, `describe('T-275 …')`: the column widths at 36 columns; the idle filter and count; `l` from a row; the four skill colours; the letter jump and its wrap; unique three-letter heads for every labor in the content table.

## Done

- In the reference fortress, "find an idle dwarf and turn mining on" takes `u`, `i`, `l`, `m` ×4, `Enter`: eight keys.
- The verification commands of [`../process/agent-workflow.md`](../../process/agent-workflow.md) are green, with the browser suite.
