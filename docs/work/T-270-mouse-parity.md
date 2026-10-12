# T-270 — Mouse parity: every caption on the fortress screen is a button

**Source:** T-116 and its report, [`../../reports/audits/2026-10-12-ui-ux.md`](../../reports/audits/2026-10-12-ui-ux.md) (issue 2, § 3) · **Size:** M · **Needs:** T-244 (it rewrites the hotkey strip in `src/ui/status.ts`) · **Status:** open

## Why

A mouse-only player can do everything inside an open panel and nothing around it. The hotkey strip looks like buttons and is not. No click opens a panel (except the date, a tile and a building), closes one, pauses, changes speed or opens the game menu. The wheel over a list changes the map level under the sidebar, so the order picker cannot be scrolled.

## Reproduction

Default embark, 1280×800, mouse only. Click `[d] dig`, `[b] build`, `[?] help`, `☺ 7`, `♥ Fine`, the speed glyph: nothing (capture 1/27 to 1/34, 1/117). Open Designate with `d`, click the `[d]` in its title row: nothing (1/112); click "Priority: 5", `[Ctrl+Z] undo last`, `[Del] clear`: nothing (1/108 to 1/110). Open Orders, `Shift+N`, wheel down over the recipe list: the map level changes and the list stays (1/79; the judgement replay saw z 32 → 31).

## What the spec says

- [`24-ui-and-input.md`](../02-systems/24-ui-and-input.md) § Rules: the input model for keys and mouse.
- [`fortress-screen.md`](../04-implementation/ui-screens/fortress-screen.md) § Status row 1 and § Status row 2: the fields and the strip, with no click behaviour stated for most of them.

## What to do

**Decisions.**
- **The strip.** Each `[x] name` entry of status row 2 is a button that does what its key does. `[?] help` in row 1 is one too.
- **Status row 1.** A click on `☺ n` opens Units; on `♥ …` Mood; on `+n` Units with the wounded first; on `!n` Threats; on `$` Civilizations; on the weather the Calendar (as the date does today); on `z n` nothing. A click on the speed glyph pauses or resumes; a right click on it steps the speed (1x → 2x → 4x → 1x). Hovering `+n` shows the tooltip "n wounded", and `!n` "n hostile creatures on the map".
- **Close.** The title row of every sidebar panel ends with `[x]` in place of the repeated hotkey (`[d]`), and a click on it closes the panel as `Esc` does with no tool armed. Help lists the panel keys, so the letter is not lost.
- **Menu.** Status row 1 gains `[Esc] menu` left of `[?] help`, a button that opens the game menu. If the row is too narrow it shows `[Esc]` alone, never a cut word.
- **Wheel.** The wheel over the sidebar scrolls the list under the pointer (three rows a notch) and never changes the map level. Over the map it changes the level as now. A scrollbar track is clickable (jump to that place) and its thumb can be dragged.
- **Designate.** "Priority: n" becomes `Priority [-] n [+]`, and `[Ctrl+Z] undo last` and `[Del] clear` are buttons that do what the keys do.
- **Typing.** No on-screen keyboard. The picker's quantity already has `[-]` and `[+]`; a filter needs the keyboard, and that is accepted.
- **A pinned danger line** is dismissed by a click on it, as by the first key.

1. Amend `fortress-screen.md` (§ Status row 1, § Status row 2, § Sidebar) and `ui-keymap-and-screens.md` (the mouse table).
2. Implement in `src/ui/status.ts`, `src/ui/screens/fortress.ts`, `src/ui/widgets/` (list scrolling), `src/ui/panels/designate.ts` (the three rows only).
3. Tests, `describe('T-270 …')`: a click on each strip entry and each status field; the close button; the speed glyph; the wheel over a list leaves `z` unchanged and moves the list; an e2e that opens Orders, scrolls the picker and adds the last recipe with the mouse alone.

## Done

- The reproduction opens, closes, pauses and scrolls with no key pressed.
- The verification commands of [`../process/agent-workflow.md`](../process/agent-workflow.md) are green, with the browser suite; moved render goldens are explained.
