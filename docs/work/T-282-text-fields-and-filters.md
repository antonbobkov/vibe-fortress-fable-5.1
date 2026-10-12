# T-282 — Text fields refuse control characters; a filter does not outlive its panel

**Source:** T-116 and its report, [`../../reports/audits/2026-10-12-ui-ux.md`](../../reports/audits/2026-10-12-ui-ux.md) (§ 8 c); the abuse pass came from T-115 · **Size:** S · **Needs:** — · **Status:** open

## Why

The UI held under abuse, with three small defects. A name made of control characters is accepted and then shows as "???????" in every list. The Units filter keeps its text after the panel is closed, so a player who reopens Units sees a few dwarves and no reason. And a burst of keys in Stocks that included `Space` left the clock running; the capture did not record whether the filter field had focus.

## Reproduction

Default embark. `u`, `Shift+N`, send the key events bell, NUL, ESC, DEL, tab, CR, backspace (synthetic `KeyboardEvent`s, as the capture's flow 9 did): the field counts 7/24 and `Enter` accepts; the Units list shows `???????` (capture 9/73, 9/74; the same for the fortress and squad names, 9/65, 9/81). `u`, `/`, type `xxx`, `Enter`, `Esc`, `u`: the filter is still `xxx` (9/83 to 9/90). `s`, `/`, type `a b`: check whether the clock starts (9/09 is the unclear step).

## What the spec says

- [`24-ui-and-input.md`](../02-systems/24-ui-and-input.md) § Rules: text input, the name limits, and "a focused text field takes every printable key".
- [`panels.md`](../04-implementation/ui-screens/panels.md): the `/filter` fields.

## What to do

**Decisions.**
- **What a text field accepts.** A text field takes a key event only when its `key` is a single printable character: one grapheme, not in Unicode category Cc, Cf, Co or Cn. Everything else is ignored by the field (and handled as a command key only if it is one of the field's own: `Enter`, `Esc`, `Backspace`, `Delete`, the arrows, `Home`, `End`). A character with no glyph in the bundled font is accepted and drawn as `?`, as now; only control and format characters are refused.
- **Names.** A name is trimmed, runs of spaces become one space, and a name that is empty after that is refused with the existing "needs a name" line.
- **Filters.** A panel's `/filter` text is cleared when the panel closes. While a filter is active, the panel's header shows it: "Units · filter: xxx (3 of 80)".
- **Space.** While any text field or filter field has focus, `Space` types a space and never reaches the pause key. The first step of the task is a test that shows whether this already holds; if it does, only the test is added.

1. Amend 24 § Rules (text input) and `panels.md` (the filter line).
2. Implement in `src/ui/screens/text_input.ts`, `src/ui/panels/filter.ts`, the order picker's Find field in `src/ui/panels/orders.ts` only through the shared field code, and the strings.
3. Tests, `describe('T-282 …')`: the seven control characters are refused in each field kind; emoji and right-to-left text are still accepted; the filter is cleared on close and shown in the header; `Space` in a focused filter leaves the speed unchanged.

## Done

- The reproduction cannot make a name of control characters, reopens Units unfiltered, and types a space without starting the clock.
- The verification commands of [`../process/agent-workflow.md`](../process/agent-workflow.md) are green, with the browser suite.
