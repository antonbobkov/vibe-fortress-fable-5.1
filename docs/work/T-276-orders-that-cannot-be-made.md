# T-276 — Orders: a warning when nothing can make it, blocked orders in Jobs, the right recipe first

**Source:** T-116 and its report, [`../../reports/audits/2026-10-12-ui-ux.md`](../../reports/audits/2026-10-12-ui-ux.md) (issue 5, § 4) · **Size:** M · **Needs:** T-248 (same file, `src/ui/panels/orders.ts`) · **Status:** open

## Why

An order for a mail shirt with no forge is accepted with "Ordered: x1 Mail shirt · any forge". The reason it will never be made shows only in the Orders list, and never in Jobs, where a player looks for work that is not happening. Typing "barrel" and pressing `Enter` orders a metal barrel at a forge. `Enter` on an empty Find orders arrowheads. A quantity of 0 becomes 1 silently.

## Reproduction

Default embark, no workshop. `o`, `Shift+N`, type `mail`, `Enter`: "Ordered: x1 Mail shirt · any forge" (capture 5/47). `j`: the order is not listed (3/46). `Shift+N`, type `barrel`: "Metal barrel" is highlighted above "Barrel" (4/51). `Shift+N`, `Enter` with an empty Find: "Ordered: x1 Arrowheads · any forge" (9/110). `Shift+N`, `barrel`, `Tab`, `0`, `Enter`: "Ordered: x1 Metal barrel" (5/50).

## What the spec says

- [`12-workshops-and-professions.md`](../02-systems/12-workshops-and-professions.md) § Player-facing behavior: work orders and why an order waits.
- [`panels.md`](../04-implementation/ui-screens/panels.md) § Orders (the picker) and § Jobs.

## What to do

**Decisions.**
- **Still accepted.** An order with no workshop to make it is accepted, as now (the player may be about to build the workshop). The status row says so in the same line: "Ordered: x1 Mail shirt. No forge is built yet: [b] Build › Workshops." When a workshop exists but an input is missing: "Ordered: x5 Barrel. Waiting for log (0 in stock)."
- **Jobs panel.** Below the job list, a section "Orders waiting (n)" lists every work order that has no job, one row each with the reason the Orders panel shows: "x1 Mail shirt · no forge", "x3 Door · waiting for log". `Enter` on a row opens Orders with that order selected. The Jobs filters apply to the section's text.
- **Ranking in the picker.** Within the filter's matches, recipes are ordered: those a built workshop can make now, then those whose workshop exists but lacks an input, then those with no workshop; inside each group the present order. A recipe with no workshop is drawn in `text_dim` with "· no forge" after its name. So "barrel" highlights the carpenter's Barrel once a carpenter's workshop stands, and in a fortress with no workshop both show their missing workshop.
- **Empty Find.** `Enter` adds the highlighted recipe only after the player has typed a filter or moved the highlight with a key or a click. Otherwise it says "Type a name or choose a recipe."
- **Quantity.** The quantity field refuses 0: typing `0` as the first digit does nothing, and clearing the field shows 1 again when focus leaves it.
- **PageDown and PageUp** scroll the picker list by a screen while Find has focus (the wheel is T-270).

1. Amend 12 § Player-facing behavior, `panels.md` § Orders and § Jobs.
2. Implement in `src/ui/panels/orders.ts`, `src/ui/panels/jobs.ts`, and the strings. No system change: the reasons come from 12's reader, which the Orders panel already uses.
3. Tests, `describe('T-276 …')`: each status line; the Jobs section and its `Enter`; the three ranking groups; the empty `Enter`; the quantity field.

## Done

- The reproduction warns at once, lists the mail shirt under "Orders waiting" in Jobs, and "barrel" then `Enter` orders a wooden barrel when a carpenter's workshop stands.
- The verification commands of [`../process/agent-workflow.md`](../process/agent-workflow.md) are green, with the browser suite.
