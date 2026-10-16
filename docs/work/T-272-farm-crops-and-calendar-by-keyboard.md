# T-272 — Farm crops and the Calendar can be reached by keyboard

**Source:** T-116 and its report, [`../../reports/audits/2026-10-12-ui-ux.md`](../../reports/audits/2026-10-12-ui-ux.md) (issue 1, § 3) · **Size:** S · **Needs:** T-274 (same file, `src/ui/panels/zones.ts`) · **Status:** open

## Why

A farm plot's four season rows are dropdowns with no key, so a keyboard-only fortress cannot plant anything. The Calendar panel opens only by a click on the date.

## Reproduction

Default embark, keyboard only: make a farm plot and select it. The rows read `Spring  [ none ▼ ]` and so on, with no caption; `ArrowDown`, `Enter`, `1`, `ArrowRight` and `Space` change nothing (capture 2/52 to 2/60). `Tab`, `F2` and `F3` do not open the Calendar (2/28).

## What the spec says

- [`panels.md`](../04-implementation/ui-screens/panels.md) § Zones (farm plot): one crop per season.
- [`ui-keymap-and-screens.md`](../03-content/ui-keymap-and-screens.md): the panel key table has no Calendar key.

## What to do

**Decisions.**
- The farm plot editor works like the stockpile editor's lists. Up and Down move a highlight over the four season rows (it starts on the current season). `Enter` opens that row's crop list; Up, Down and `Enter` choose; `Esc` closes the list without a change. A footer shows the keys: "↑↓ season · Enter choose crop · [S-a] all seasons". `Shift+A` sets the highlighted row's crop for every season in which that crop can grow.
- A crop with no seeds in stock is listed with "(no seeds)" after its name, and the number after a row is labelled: `turnip ▼  10 seeds`.
- The Calendar opens with `Shift+C` on the fortress screen when no open panel uses that key (`c` is Civilizations). If a panel that can be open at the same time uses `Shift+C`, the key is `Shift+Y`; the implementer checks the panel key tables once and writes the result into the keymap table. Help lists the key, and the date keeps its click.

1. Amend `panels.md` § Zones (farm plot) and `ui-keymap-and-screens.md` (panel keys).
2. Implement in `src/ui/panels/zones.ts`, `src/ui/keymap.ts`, `src/ui/panels/help.ts` (one line), and the strings.
3. Tests, `describe('T-272 …')`: a crop set for one season and for all by keys; the "(no seeds)" mark; the Calendar key.

## Done

- The reproduction plants turnips by keyboard and opens the Calendar by key.
- The verification commands of [`../process/agent-workflow.md`](../process/agent-workflow.md) are green, with the browser suite.

## Decisions made in the work

- The Calendar key is `Shift+Y`: `Shift+C` is an accelerator of Designate (Channel), Build (Constructions), Animals (cap) and Military (clear station), so the fallback of the work file applies. `y` is then bare-only in panels (`[y]` zone types, pull lever, clear patrol); the spec sentences about the free letters say so.
- The keymap row sits last in the table (a `LATE_ACTIONS` list in `src/ui/keymap.ts`), so the index of every older row, which a saved rebinding is keyed by, does not move.
- With a farm plot selected `Shift+A` is "all seasons" and not the Archery zone type; `y` returns to the type list. `↑` `↓` belong to the inspector while a plot is selected and no tool is armed (as the stockpile tree's do), so they do not pan the map then.
- The key footer is two lines because one line does not fit 36 columns; its `[S-a]` is clickable. The open crop list is as wide as the panel (a name with "(no seeds)" does not fit the 18-cell field).
